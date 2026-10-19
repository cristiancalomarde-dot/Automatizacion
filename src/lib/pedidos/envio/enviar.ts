import "server-only";

/**
 * Enviar los pedidos aprobados de una reserva (spec M3-03), en el servidor y
 * con el cliente de la SESIÓN de quien aprueba (RLS, #1).
 *
 * En orden, y sin saltear ninguno:
 * 1. Sesión del equipo (si no, nada) y la confirmación del diálogo (#4).
 * 2. La configuración (`config.ts`): si falta la casilla, no se abre ninguna
 *    conexión. Modo prueba salvo `PEDIDOS_ENVIO_REAL=si`.
 * 3. Por cada pedido: se TOMA con un UPDATE condicional (estado borrador o
 *    fallo → enviando). Dos envíos a la vez del mismo pedido no lo pueden
 *    tomar los dos: sale un solo mail (fila 6). Uno ya enviado solo se toma con
 *    "Reenviar" (y queda registrado).
 * 4. Se arma el mail (`mensaje.ts`: en modo prueba el sobre lleva SOLO la
 *    casilla de prueba) y se manda por SMTP. Un fallo no frena a los demás
 *    (fila 7), salvo que sea de la casilla (clave o servidor caído): ahí los
 *    que siguen no se intentan y dicen el mismo motivo.
 * 5. Envío real: estado `enviado` con fecha, quién y Message-ID; copia en
 *    Enviados por IMAP (solo APPEND; si falla, igual cuenta como enviado y
 *    queda el aviso). Modo prueba: el pedido vuelve a como estaba, con la marca
 *    del envío de prueba, y no se guarda copia.
 * 6. La reserva: envío real con al menos uno → `pedido_a_proveedor` y el
 *    historial "<persona> envió N pedidos a: …"; modo prueba → solo el
 *    historial "envío de prueba", sin cambiar el estado (fila 8).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esCorreoDelDominioPermitido, obtenerDominioPermitido } from "@/lib/auth/dominio";
import { esIdDeReserva } from "@/lib/reservas/reglas";
import type { EstadoReserva } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { cargarPedidos, type PedidoGuardado } from "../guardar";
import { nombreDeQuienFirma } from "../pantalla";
import { leerConfigEnvio, type ConfigEnvio } from "./config";
import { guardarEnEnviadosImap, type GuardarEnEnviados } from "./enviados";
import { armarMail, componerMail, nuevoMessageId } from "./mensaje";
import { abrirTransporteSmtp, ErrorSmtp, type AbrirTransporte, type Transporte } from "./smtp";

const T = TEXTOS.pedidos.envio;

/** Un pedido que quedó "enviando" más de esto se puede reenviar (algo se cortó a mitad de camino). */
export const MINUTOS_TRABADO = 10;

export interface PedidoDeEnvio {
  reservaId: string;
  pedidoIds: string[];
  /** La persona confirmó en el diálogo (#4). Sin esto no sale nada. */
  confirmado?: boolean;
  /** "Reenviar": mandar de nuevo uno ya enviado (queda registrado). */
  reenviar?: boolean;
}

export type ResultadoPedido =
  | { pedidoId: string; tipo: "enviado"; enviadoEn: string; prueba: boolean; aviso?: string }
  | { pedidoId: string; tipo: "fallo"; motivo: string }
  | { pedidoId: string; tipo: "no_enviado"; motivo: string };

export interface EnvioHecho {
  ok: true;
  modoPrueba: boolean;
  destinoPrueba: string;
  resultados: ResultadoPedido[];
  avisos: string[];
  pedidos: PedidoGuardado[];
  reserva: { estado: EstadoReserva; pedidoIncompleto: boolean };
}

export type Rechazo = { ok: false; error: string; sinSesion?: true };

export type ResultadoEnvio = EnvioHecho | Rechazo;

export interface DependenciasEnvio {
  /** Las variables de entorno (por defecto `process.env`). Los tests las arman a mano. */
  env?: Record<string, string | undefined>;
  abrirTransporte?: AbrirTransporte;
  guardarEnEnviados?: GuardarEnEnviados;
  ahora?: () => Date;
}

export interface QuienEnvia {
  id: string;
  email: string;
  /** El nombre de la cuenta de Google o lo previo a la @ (fila 4). */
  nombre: string;
}

/** La persona de la sesión si es del equipo; null si no hay sesión o es de otro dominio. */
export async function quienEnvia(cliente: SupabaseClient): Promise<QuienEnvia | null> {
  const { data } = await cliente.auth.getUser();
  const u = data?.user;
  if (!u?.email) return null;
  let dominio: string;
  try {
    dominio = obtenerDominioPermitido();
  } catch {
    return null;
  }
  if (!esCorreoDelDominioPermitido(u.email, dominio)) return null;
  return { id: u.id, email: u.email, nombre: nombreDeQuienFirma(u) };
}

export const pedidoIncompleto = (estado: EstadoReserva, pedidos: ReadonlyArray<{ estado: string }>): boolean =>
  estado === "pedido_a_proveedor" && pedidos.some((p) => p.estado !== "enviado");

function motivoDeError(e: unknown): { motivo: string; deLaCasilla: boolean } {
  if (e instanceof ErrorSmtp) {
    if (e.motivo === "clave") return { motivo: T.claveInvalida, deLaCasilla: true };
    if (e.motivo === "no_responde") return { motivo: T.noResponde, deLaCasilla: true };
    if (e.motivo === "rechazado") return { motivo: T.rechazado(e.direcciones.join(", ") || "la dirección"), deLaCasilla: false };
  }
  return { motivo: T.error, deLaCasilla: false };
}

type Toma = { ok: true; previo: string } | { ok: false; motivo: string };

/** Toma el pedido para mandarlo: UPDATE condicional al estado que se leyó. Si otro lo tomó antes, no. */
async function tomar(cliente: SupabaseClient, p: PedidoGuardado, reenviar: boolean, ahora: Date): Promise<Toma> {
  const trabado = p.estado === "enviando" && !!p.enviando_desde && Date.parse(p.enviando_desde) < ahora.getTime() - MINUTOS_TRABADO * 60_000;
  const sePuede = p.estado === "borrador" || p.estado === "fallo" || (reenviar && (p.estado === "enviado" || trabado));
  if (!sePuede) return { ok: false, motivo: p.estado === "enviado" ? T.yaEnviado : T.enCurso };

  let consulta = cliente
    .from("reserva_pedido")
    .update({ estado: "enviando", enviando_desde: ahora.toISOString() })
    .eq("id", p.id)
    .eq("estado", p.estado);
  // Uno trabado se toma solo si nadie lo tocó desde que se leyó.
  if (p.estado === "enviando") consulta = consulta.eq("enviando_desde", p.enviando_desde!);
  const { data, error } = await consulta.select("id");
  if (error) throw new Error(`No se pudo tomar el pedido: ${error.message}`);
  if (!data || data.length === 0) {
    const { data: ahoraEs } = await cliente.from("reserva_pedido").select("estado").eq("id", p.id).maybeSingle();
    return { ok: false, motivo: !ahoraEs ? T.noEsta : ahoraEs.estado === "enviado" ? T.yaEnviado : T.enCurso };
  }
  return { ok: true, previo: p.estado };
}

async function actualizar(cliente: SupabaseClient, id: string, cambios: Record<string, unknown>): Promise<void> {
  const { error } = await cliente.from("reserva_pedido").update(cambios).eq("id", id).eq("estado", "enviando");
  if (error) throw new Error(`No se pudo registrar el envío: ${error.message}`);
}

export async function enviarPedidosAprobados(cliente: SupabaseClient, entrada: PedidoDeEnvio, deps: DependenciasEnvio = {}): Promise<ResultadoEnvio> {
  const persona = await quienEnvia(cliente);
  if (!persona) return { ok: false, error: TEXTOS.pedidos.sinSesion, sinSesion: true };
  if (
    !entrada ||
    !esIdDeReserva(entrada.reservaId ?? "") ||
    !Array.isArray(entrada.pedidoIds) ||
    entrada.pedidoIds.length === 0 ||
    !entrada.pedidoIds.every((id) => typeof id === "string" && esIdDeReserva(id))
  ) {
    return { ok: false, error: T.invalido };
  }
  if (entrada.confirmado !== true) return { ok: false, error: T.sinConfirmar };

  const leida = leerConfigEnvio(deps.env ?? process.env);
  if (!leida.ok) return { ok: false, error: leida.error };
  const config: ConfigEnvio = leida.config;
  const modoPrueba = !config.envioReal;
  const ahora = deps.ahora ?? (() => new Date());
  const reenviar = entrada.reenviar === true;

  const { data: reserva, error: errorReserva } = await cliente.from("reserva").select("id,estado").eq("id", entrada.reservaId).maybeSingle();
  if (errorReserva) throw new Error(`No se pudo leer la reserva: ${errorReserva.message}`);
  if (!reserva) return { ok: false, error: "No existe la reserva." };
  if (reserva.estado !== "recibida" && reserva.estado !== "pedido_a_proveedor") return { ok: false, error: T.reservaNoLista };

  const ids = [...new Set(entrada.pedidoIds)];
  const { data: filas, error: errorPedidos } = await cliente.from("reserva_pedido").select("*").eq("reserva_id", entrada.reservaId).in("id", ids);
  if (errorPedidos) throw new Error(`No se pudieron leer los pedidos: ${errorPedidos.message}`);
  const porId = new Map(((filas ?? []) as PedidoGuardado[]).map((p) => [p.id, p]));

  const resultados: ResultadoPedido[] = [];
  const salieron: Array<{ pedido: PedidoGuardado; crudo: Buffer }> = [];
  let transporte: Transporte | null = null;
  let errorDeLaCasilla: string | null = null;

  try {
    for (const id of ids) {
      const p = porId.get(id);
      if (!p) {
        resultados.push({ pedidoId: id, tipo: "no_enviado", motivo: T.noEsta });
        continue;
      }
      if (p.destinatarios.length === 0) {
        resultados.push({ pedidoId: id, tipo: "no_enviado", motivo: T.sinMail });
        continue;
      }
      if (errorDeLaCasilla) {
        resultados.push({ pedidoId: id, tipo: "fallo", motivo: errorDeLaCasilla });
        continue;
      }
      const toma = await tomar(cliente, p, reenviar, ahora());
      if (!toma.ok) {
        resultados.push({ pedidoId: id, tipo: "no_enviado", motivo: toma.motivo });
        continue;
      }

      const fecha = ahora();
      const messageId = nuevoMessageId(config.remitente);
      let rechazados: string[] = [];
      try {
        const mail = armarMail(p, { nombre: persona.nombre, config, messageId, fecha });
        const crudo = await componerMail(mail);
        transporte ??= (deps.abrirTransporte ?? abrirTransporteSmtp)(config.smtp);
        const r = await transporte.enviar({ sobre: mail.sobre, crudo });
        rechazados = r.rechazados;
        if (!modoPrueba) salieron.push({ pedido: p, crudo });
      } catch (e) {
        const { motivo, deLaCasilla } = motivoDeError(e);
        if (deLaCasilla) errorDeLaCasilla = motivo;
        // Un reenvío o una prueba que falla no borran lo que ya había: el pedido vuelve a como estaba.
        const vuelveA = modoPrueba || toma.previo === "enviado" ? toma.previo : "fallo";
        await actualizar(cliente, id, { estado: vuelveA, enviando_desde: null, ...(vuelveA === "fallo" ? { motivo_fallo: motivo } : {}) });
        resultados.push({ pedidoId: id, tipo: "fallo", motivo });
        continue;
      }

      const aviso = rechazados.length ? T.noLlego(rechazados.join(", ")) : undefined;
      try {
        if (modoPrueba) {
          await actualizar(cliente, id, {
            estado: toma.previo === "enviando" ? "fallo" : toma.previo,
            enviando_desde: null,
            envio_prueba_en: fecha.toISOString(),
            envio_prueba_por_nombre: persona.nombre,
            ...(toma.previo === "enviando" ? { motivo_fallo: T.trabado } : {}),
          });
        } else {
          await actualizar(cliente, id, {
            estado: "enviado",
            enviando_desde: null,
            enviado_en: fecha.toISOString(),
            enviado_por: persona.id,
            enviado_por_nombre: persona.nombre,
            message_id: messageId,
            motivo_fallo: null,
            copia_en_enviados: null,
            reenvios: (p.reenvios ?? 0) + (toma.previo === "enviado" || toma.previo === "enviando" ? 1 : 0),
          });
        }
        resultados.push({ pedidoId: id, tipo: "enviado", enviadoEn: fecha.toISOString(), prueba: modoPrueba, ...(aviso ? { aviso } : {}) });
      } catch {
        // El mail salió: queda "enviando" (no se vuelve a mandar solo) y se avisa.
        resultados.push({ pedidoId: id, tipo: "enviado", enviadoEn: fecha.toISOString(), prueba: modoPrueba, aviso: T.trabado });
      }
    }
  } finally {
    transporte?.cerrar();
  }

  const avisos: string[] = [];
  if (salieron.length) {
    const copia = await (deps.guardarEnEnviados ?? guardarEnEnviadosImap)(
      config,
      salieron.map((s) => s.crudo),
    ).catch(() => ({ ok: false as const, motivo: T.copiaNoResponde }));
    await cliente
      .from("reserva_pedido")
      .update({ copia_en_enviados: copia.ok })
      .in(
        "id",
        salieron.map((s) => s.pedido.id),
      )
      .eq("estado", "enviado");
    if (!copia.ok) avisos.push(T.sinCopia(copia.motivo));
  }

  const enviados = resultados.filter((r): r is Extract<ResultadoPedido, { tipo: "enviado" }> => r.tipo === "enviado");
  let estado = reserva.estado as EstadoReserva;
  if (enviados.length) {
    const nombres = enviados.flatMap((r) => porId.get(r.pedidoId)?.proveedores.join(" y ") ?? []);
    const detalle = {
      persona: persona.nombre,
      cantidad: enviados.length,
      proveedores: nombres,
      pedidos: enviados.map((r) => r.pedidoId),
      ...(modoPrueba ? { destino: config.destinoPrueba } : { reenvio: reenviar }),
    };
    if (!modoPrueba && estado === "recibida") {
      const { error } = await cliente.from("reserva").update({ estado: "pedido_a_proveedor" }).eq("id", reserva.id).eq("estado", "recibida");
      if (error) throw new Error(`No se pudo pasar la reserva a pedido a proveedor: ${error.message}`);
    }
    const { error } = await cliente
      .from("evento_reserva")
      .insert({ reserva_id: reserva.id, tipo: modoPrueba ? "envio_de_prueba" : "pedidos_enviados", detalle });
    if (error) throw new Error(`No se pudo registrar el envío en el historial: ${error.message}`);
    const releida = await cliente.from("reserva").select("estado").eq("id", reserva.id).single();
    if (releida.data) estado = releida.data.estado as EstadoReserva;
  }

  const { pedidos } = await cargarPedidos(cliente, reserva.id);
  return {
    ok: true,
    modoPrueba,
    destinoPrueba: config.destinoPrueba,
    resultados,
    avisos,
    pedidos,
    reserva: { estado, pedidoIncompleto: pedidoIncompleto(estado, pedidos) },
  };
}
