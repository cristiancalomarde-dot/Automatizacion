import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistroLlamadasIA } from "@/lib/ia/registro-llamadas";
import { cargarProducto } from "@/lib/catalogo/consultas";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { avisosDeLlegada, cargarAvisosDeVuelo } from "@/lib/reservas/avisos-vuelo";
import type { DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import type { ResultadoLectura } from "@/lib/reservas/extraer";
import { decidirEntrada, TEXTO_SALTEO } from "@/lib/reservas/filtro-entrada";
import { borrarDatosDePruebaDe, guardarMailRecibido } from "@/lib/reservas/guardar";
import { MOTIVOS, type MailParaLeer } from "@/lib/reservas/preparar-mail";
import { sinDatoDeLlegada } from "@/lib/reservas/llegada-iguazu";
import { cargarReservasDelAsunto, procesarMail, type AccionPedido, type ResultadoPedido } from "@/lib/reservas/procesar-mail";
import { numerosDelAsunto } from "@/lib/reservas/respuestas";
import type { EstadoReserva, OrigenEmparejado } from "@/lib/reservas/tipos";
import { leerArchivoDeMail } from "./leer-archivo";
import type { ReservaParaReporte, ResultadoParaReporte } from "./reporte";
import { crearTopeDeCorrida, TOPE_CORRIDA_USD, type BloqueoGasto } from "./tope-corrida";

/**
 * Una corrida del modo prueba (spec M2-06): cada archivo pasa por el mismo
 * circuito que un mail de sales@ — leer el archivo, filtrar antes de gastar
 * (`filtro-entrada.ts`), y si se lee, M2-02 → M2-03 → M2-04 con todo marcado
 * "de prueba".
 *
 * - Idempotente (fila 7): el Message-ID es la huella del archivo; un archivo
 *   ya procesado no se vuelve a leer ni gasta IA.
 * - Tope por corrida (fila 10): si la próxima llamada pasaría el tope de la
 *   corrida o el techo del mes, no se hace. Ese archivo (su mail a medio
 *   guardar se borra, para que se pueda reintentar) y los que siguen quedan
 *   "no procesados", sin inventar datos.
 * - Nada sale hacia afuera (fila 9): no hay IMAP ni envío de mails. Solo la
 *   base y la IA que se le pasa.
 */

export interface ContextoIA {
  mailRecibidoId: string;
  /** El registro de `uso_ia` con el tope de la corrida: la lectura y la propuesta de la IA lo usan. */
  registro: RegistroUsoIA;
}

export interface OpcionesCorrida {
  admin: SupabaseClient;
  /** El registro del gasto del mes (`uso_ia`). */
  registroUso: RegistroUsoIA;
  leer: (mail: MailParaLeer, ctx: ContextoIA) => Promise<ResultadoLectura>;
  deps: (ctx: ContextoIA) => Promise<DependenciasReservas> | DependenciasReservas;
  llamadas?: RegistroLlamadasIA;
  tope?: number;
  techo?: number;
  /** Solo tests: acota el "mismo intercambio" a las reservas de estos mails (`procesarMail`). */
  alcance?: () => readonly string[];
  /** Avisa cada archivo terminado (para mostrar el avance). */
  alTerminar?: (r: ResultadoArchivo) => void;
}

export interface ResultadoArchivo extends ResultadoParaReporte {
  ruta: string;
  mailRecibidoId: string | null;
  /** Llamadas de lectura a la IA hechas por este archivo (0 si se salteó o ya estaba). */
  lecturasIA: number;
}

export interface ResultadoCorrida {
  archivos: ResultadoArchivo[];
  gasto: number;
  lecturasIA: number;
  corte: string | null;
}

class TopeAlcanzado extends Error {
  constructor(readonly bloqueo: BloqueoGasto) {
    super("tope");
  }
}

const textoCorte = (b: BloqueoGasto, tope: number) =>
  b === "tope_corrida"
    ? `No procesado: tope de la corrida (US$ ${tope})`
    : "No procesado: se agotó el presupuesto de IA del mes (US$ 20)";

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST, se tipan al mapear */

/** Las reservas de un mail: las que creó y a las que se sumó (eventos "mail_agregado"). */
export async function reservasDelMail(
  admin: SupabaseClient,
  mailId: string,
  pedidos?: readonly ResultadoPedido[],
): Promise<ReservaParaReporte[]> {
  let ids: string[];
  const accion = new Map<string, AccionPedido>();
  if (pedidos) {
    ids = pedidos.map((p) => p.reservaId);
    for (const p of pedidos) accion.set(p.reservaId, p.accion);
  } else {
    const nacidas = await admin.from("reserva").select("id,posible_duplicada").eq("mail_recibido_id", mailId).order("created_at");
    const sumadas = await admin.from("evento_reserva").select("reserva_id").eq("mail_recibido_id", mailId).eq("tipo", "mail_agregado");
    if (nacidas.error || sumadas.error) throw new Error(`No se pudieron leer las reservas del mail: ${(nacidas.error ?? sumadas.error)!.message}`);
    for (const r of nacidas.data ?? []) accion.set(r.id, r.posible_duplicada ? "posible_duplicada" : "nueva");
    for (const e of sumadas.data ?? []) if (!accion.has(e.reserva_id)) accion.set(e.reserva_id, "sumada");
    ids = [...accion.keys()];
  }
  if (ids.length === 0) return [];
  const { data, error } = await admin
    .from("reserva")
    .select(
      "id,booking_id,booking_id_original,producto_texto_agencia,origen_emparejado,confianza_emparejado,fecha_inicio,fecha_fin,pax,estado,motivos_revision," +
        "producto_id,vuelos,pedidos_especiales," +
        "producto:producto_id(codigo,nombre),sugerencia:sugerencia_producto_id(codigo,nombre)",
    )
    .in("id", ids);
  if (error) throw new Error(`No se pudieron leer las reservas del mail: ${error.message}`);
  const { data: partes } = await admin.from("reserva_componente").select("reserva_id").in("reserva_id", ids);
  const cuantas = (id: string) => (partes ?? []).filter((p) => p.reserva_id === id).length;
  const porId = new Map((data as any[]).map((r) => [r.id as string, r]));
  const avisos = await cargarAvisosDeVuelo(
    (id) => cargarProducto(admin, id),
    (data as any[]).map((r) => ({
      id: r.id,
      productoId: r.producto_id,
      estado: r.estado,
      productoTexto: r.producto_texto_agencia,
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
      vuelos: Array.isArray(r.vuelos) ? r.vuelos : [],
      pedidos: r.pedidos_especiales,
    })),
  );
  return ids
    .map((id) => porId.get(id))
    .filter(Boolean)
    .map((r: any) => ({
      accion: accion.get(r.id) ?? "nueva",
      bookingId: r.booking_id,
      bookingIdOriginal: r.booking_id_original,
      productoTexto: r.producto_texto_agencia,
      producto: r.producto ? { codigo: r.producto.codigo, nombre: r.producto.nombre } : null,
      origenEmparejado: r.origen_emparejado as OrigenEmparejado | null,
      confianzaEmparejado: r.confianza_emparejado === null ? null : Number(r.confianza_emparejado),
      sugerencia: r.sugerencia ? { codigo: r.sugerencia.codigo, nombre: r.sugerencia.nombre } : null,
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
      pax: r.pax,
      estado: r.estado as EstadoReserva,
      motivos: r.motivos_revision ?? [],
      // Owner 2026-10-16: una sola marca "falta dato de llegada" (vuelos que faltan + Iguazú sin vuelo ni bus).
      avisos: avisosDeLlegada({
        avisosVuelo: avisos.get(r.id) ?? [],
        sinDatoLlegada: sinDatoDeLlegada({
          productoCodigo: r.producto?.codigo ?? null,
          vuelos: Array.isArray(r.vuelos) ? r.vuelos : [],
          pedidos: r.pedidos_especiales ?? null,
        }),
      }),
      partes: cuantas(r.id),
    }));
}

/** La ficha de la IA de un mail ya procesado, guardada en la primera reserva que creó (`datos_extraidos`). */
async function lecturaGuardada(admin: SupabaseClient, mailId: string): Promise<ResultadoLectura | undefined> {
  const { data } = await admin
    .from("reserva")
    .select("datos_extraidos")
    .eq("mail_recibido_id", mailId)
    .not("datos_extraidos", "is", null)
    .order("created_at")
    .limit(1);
  const ficha = data?.[0]?.datos_extraidos;
  return ficha ? { estado: "leido", ficha, costo: 0 } : undefined;
}

/** Lo que gastó la IA con un mail ya procesado (sus llamadas en ia_llamada). */
async function costoGuardado(admin: SupabaseClient, mailId: string): Promise<number> {
  const { data } = await admin.from("ia_llamada").select("costo_usd").eq("mail_recibido_id", mailId);
  return (data ?? []).reduce((s, l) => s + Number(l.costo_usd), 0);
}

export async function correrModoPrueba(rutas: readonly string[], o: OpcionesCorrida): Promise<ResultadoCorrida> {
  const topeUsd = o.tope ?? TOPE_CORRIDA_USD;
  const tope = crearTopeDeCorrida(o.registroUso, { tope: topeUsd, techo: o.techo });
  const archivos: ResultadoArchivo[] = [];
  let corte: string | null = null;
  let lecturasIA = 0;

  const terminar = (r: ResultadoArchivo) => {
    archivos.push(r);
    o.alTerminar?.(r);
  };

  for (const ruta of rutas) {
    const entrada = await leerArchivoDeMail(ruta);
    const base = { ruta, archivo: entrada.archivoOrigen ?? ruta, mailRecibidoId: null, lecturasIA: 0, reservas: [], costo: 0 };

    const decision = await decidirEntrada(entrada, {
      dePrueba: true,
      buscarReservas: (asunto, agencia) => cargarReservasDelAsunto(o.admin, asunto, agencia, true, o.alcance ? o.alcance() : null),
    });
    if (!decision.leer) {
      let mailRecibidoId: string | null = null;
      if (decision.registrar && decision.agencia) {
        // Jysk: el mail queda registrado (de prueba), sin IA.
        const { mail, nuevo } = await guardarMailRecibido({ ...entrada, agencia: decision.agencia, dePrueba: true }, o.admin);
        if (nuevo) await o.admin.from("mail_recibido").update({ procesado_en: new Date().toISOString() }).eq("id", mail.id);
        mailRecibidoId = mail.id;
      }
      terminar({
        ...base,
        mailRecibidoId,
        estado: "salteado",
        agencia: decision.agencia,
        motivo: TEXTO_SALTEO[decision.motivo],
        numerosAsunto: decision.agencia ? numerosDelAsunto(entrada.asunto, decision.agencia) : [],
      });
      continue;
    }
    if (corte) {
      terminar({ ...base, estado: "no_procesado", agencia: decision.agencia, motivo: corte });
      continue;
    }

    let lectura: ResultadoLectura | undefined;
    let mailRecibidoId: string | null = null;
    let lecturasArchivo = 0;
    try {
      const r = await procesarMail(
        { ...entrada, agencia: decision.agencia, dePrueba: true },
        {
          admin: o.admin,
          dePrueba: true,
          llamadas: o.llamadas,
          alcance: o.alcance,
          leer: async (mail, ctx) => {
            mailRecibidoId = ctx.mailRecibidoId;
            lecturasArchivo += 1;
            const l = await o.leer(mail, { mailRecibidoId: ctx.mailRecibidoId, registro: tope.registro });
            if (l.estado === "para_revision" && l.motivo === MOTIVOS.techo) throw new TopeAlcanzado(tope.bloqueo() ?? "tope_corrida");
            lectura = l;
            return l;
          },
          deps: (ctx) => o.deps({ mailRecibidoId: ctx.mailRecibidoId, registro: tope.registro }),
        },
      );
      lecturasIA += lecturasArchivo;
      // Uno ya procesado no se vuelve a leer: lo que entendió la IA está guardado en su reserva.
      let costo = r.costo;
      if (r.estado === "ya_procesado") {
        lectura = await lecturaGuardada(o.admin, r.mailRecibidoId);
        costo = await costoGuardado(o.admin, r.mailRecibidoId);
      }
      terminar({
        ...base,
        mailRecibidoId: r.mailRecibidoId,
        lecturasIA: lecturasArchivo,
        estado: r.estado === "ya_procesado" ? "ya_procesado" : "procesado",
        agencia: decision.agencia,
        lectura: lectura?.estado === "leido" ? { estado: "leido", ficha: lectura.ficha } : lectura,
        reservas: await reservasDelMail(o.admin, r.mailRecibidoId, r.estado === "procesado" ? r.pedidos : undefined),
        costo,
      });
    } catch (e) {
      if (!(e instanceof TopeAlcanzado)) {
        lecturasIA += lecturasArchivo;
        terminar({
          ...base,
          mailRecibidoId,
          lecturasIA: lecturasArchivo,
          estado: "error",
          agencia: decision.agencia,
          motivo: `Error al procesar: ${e instanceof Error ? e.message.slice(0, 300) : "inesperado"}`,
        });
        continue;
      }
      // El mail quedó guardado a medias: se borra (es de prueba) para poder reintentarlo.
      if (mailRecibidoId) await borrarDatosDePruebaDe({ mails: [mailRecibidoId] }, o.admin);
      corte = textoCorte(e.bloqueo, topeUsd);
      terminar({ ...base, estado: "no_procesado", agencia: decision.agencia, motivo: corte });
    }
  }
  return { archivos, gasto: tope.gasto(), lecturasIA, corte };
}
