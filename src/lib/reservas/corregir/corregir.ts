import "server-only";

/**
 * Corregir los vuelos y los datos dudosos de una reserva (spec M3-07), en el
 * servidor y con el cliente de la SESIÓN de quien corrige (RLS, #1). No llama
 * a la IA (#3).
 *
 * En orden:
 * 1. Sesión del equipo (@hitravel.com.ar); si no, nada (fila 8).
 * 2. Se valida lo que llega (los vuelos, la nota, las fechas o el pax), con
 *    los mismos mensajes que la pantalla (fila 2).
 * 3. Se lee la reserva: si no es la que vio la pantalla (`version`), no se
 *    pisa ("Alguien la cambió: volvé a cargar"); cerrada, descartada o
 *    cancelada por la agencia, no se corrige.
 * 4. Qué motivos quedan (`decidir.ts`), con el detalle de sus productos para
 *    los vuelos que hacen falta; y, si cambian los vuelos, qué pedidos ya
 *    enviados hay que avisar (fila 6).
 * 5. Todo se guarda en una transacción (`corregir_reserva`, 0022), que vuelve
 *    a controlar que la reserva siga como se la leyó y deja el historial.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarProducto } from "@/lib/catalogo/consultas";
import type { DetalleProducto } from "@/lib/catalogo/tipos";
import { quienEnvia } from "@/lib/pedidos/envio/enviar";
import { TEXTOS } from "@/lib/textos";
import { aVuelos } from "../consultas";
import { DATOS_CLAVE, type DatoClave, type FichaLectura, type VueloIA } from "../esquema-ficha";
import { esCancelacion, esIdDeReserva } from "../reglas";
import type { EstadoReserva } from "../tipos";
import {
  comoCambianLasFechas,
  datosDudosos,
  decidirCorreccion,
  porQueNoSeCorrige,
  validarFechas,
  validarPax,
  versionParaCorregir,
  type Cambio,
  type ReservaParaCorregir,
} from "./decidir";
import { pedidosAAvisar, validarVuelos, vuelosEnHistorial, type ErrorDeVuelo, type VueloCorregido } from "./vuelos";

const T = TEXTOS.reserva.corregir;
const R = T.motivos;

/** El máximo de una nota corta (fila 3); la base controla lo mismo. */
export const MAXIMO_NOTA = 200;

interface Base {
  reservaId: string;
  /** `versionParaCorregir` de la reserva que vio la pantalla. */
  version: string;
}

export interface EntradaCorregirVuelos extends Base {
  vuelos: VueloCorregido[];
  nota?: string | null;
}

export interface EntradaRevisarDato extends Base {
  dato: DatoClave;
}

/** M3-39: los motivos guardados de un renglón de la pantalla y la nota de cómo se resolvió. */
export interface EntradaMarcarResuelto extends Base {
  motivos: string[];
  nota: string;
}

export type EntradaCorregirDato =Base & ({ dato: "fechas"; fechaInicio: string; fechaFin: string } | { dato: "pax"; pax: number });

export type ResultadoCorregir =
  | {
      ok: true;
      estado: EstadoReserva;
      motivos: string[];
      avisos: string[];
      /** Owner 2026-10-20: cambió la duración de un tour con partes (las partes no se corrieron). */
      aviso?: string;
    }
  | { ok: false; error: string; sinSesion?: true; cambio?: true; errores?: ErrorDeVuelo[] };

const fallo = (motivo: string): ResultadoCorregir => ({ ok: false, error: T.error(motivo) });
const CAMBIO: ResultadoCorregir = { ok: false, error: T.cambio, cambio: true };

function motivoDeError(code: string | undefined): ResultadoCorregir {
  switch (code) {
    case "HT401":
      return { ok: false, error: T.error(R.sinSesion), sinSesion: true };
    case "HT403":
      return fallo(R.noEstoyEnElEquipo);
    case "HT409":
      return CAMBIO;
    case "HT423":
      return fallo(R.cerrada);
    case "P0002":
      return fallo(R.noExiste);
    case "22023":
    case "23514":
      return fallo(R.datos);
    default:
      return fallo(R.conexion);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST, se tipan al mapear */

const CAMPOS =
  "id,estado,motivos_revision,producto_id,otros_productos,producto_texto_agencia,fecha_inicio,fecha_fin,pax,vuelos,notas," +
  "pedidos_especiales,sin_traslado_de,datos_extraidos";

const lista = <X>(v: unknown): X[] => (Array.isArray(v) ? (v as X[]) : []);

interface Leida {
  fila: any;
  reserva: ReservaParaCorregir;
  version: string;
}

async function leer(cliente: SupabaseClient, reservaId: string): Promise<Leida | ResultadoCorregir> {
  const [leida, cancelada] = await Promise.all([
    cliente.from("reserva").select(CAMPOS).eq("id", reservaId).maybeSingle(),
    cliente
      .from("evento_reserva")
      .select("id", { count: "exact", head: true })
      .eq("reserva_id", reservaId)
      .eq("tipo", "mail_agregado")
      .contains("detalle", { cancelacion: true }),
  ]);
  if (leida.error || cancelada.error) return fallo(R.conexion);
  if (!leida.data) return fallo(R.noExiste);
  const r = leida.data as any;
  const motivos = lista<string>(r.motivos_revision);
  const notas = lista<string>(r.notas);
  const reserva: ReservaParaCorregir = {
    estado: r.estado as EstadoReserva,
    cancelacion: (cancelada.count ?? 0) > 0 || esCancelacion(motivos),
    motivos,
    productoTexto: r.producto_texto_agencia ?? null,
    fechaInicio: r.fecha_inicio ?? null,
    fechaFin: r.fecha_fin ?? null,
    vuelos: lista<VueloIA>(r.vuelos),
    pedidosEspeciales: r.pedidos_especiales ?? null,
    sinTrasladoDe: r.sin_traslado_de ?? null,
    datosExtraidos: (r.datos_extraidos ?? null) as FichaLectura | null,
  };
  // Mapeada igual que el detalle (`cargarReserva`), para comparar con lo que vio la pantalla.
  const version = versionParaCorregir({
    estado: reserva.estado,
    motivos,
    vuelos: aVuelos(r.vuelos),
    fechaInicio: reserva.fechaInicio,
    fechaFin: reserva.fechaFin,
    pax: typeof r.pax === "number" ? r.pax : null,
    notas: notas.filter((n) => typeof n === "string" && !!n.trim()),
  });
  return { fila: r, reserva, version };
}

async function detallesDe(cliente: SupabaseClient, fila: any): Promise<{ principal: DetalleProducto | null; otros: DetalleProducto[] }> {
  if (!fila.producto_id) return { principal: null, otros: [] };
  const [principal, ...otros] = await Promise.all(
    [fila.producto_id as string, ...lista<string>(fila.otros_productos)].map((id) => cargarProducto(cliente, id)),
  );
  return { principal, otros };
}

type Evento = { tipo: "vuelos_corregidos" | "dato_revisado" | "dato_corregido"; detalle: Record<string, unknown> };

/** Lo común: sesión, lectura, control de la versión, decisión y guardado. */
async function corregir(
  cliente: SupabaseClient,
  entrada: Base,
  armar: (l: Leida) => Promise<{ cambio: Cambio; cambios: Record<string, unknown>; evento: Evento; aviso?: string } | ResultadoCorregir>,
): Promise<ResultadoCorregir> {
  const persona = await quienEnvia(cliente);
  if (!persona) return { ok: false, error: T.error(R.sinSesion), sinSesion: true };
  if (typeof entrada?.reservaId !== "string" || !esIdDeReserva(entrada.reservaId)) return fallo(R.noExiste);
  if (typeof entrada.version !== "string") return CAMBIO;

  const l = await leer(cliente, entrada.reservaId);
  if ("ok" in l) return l;
  if (l.version !== entrada.version) return CAMBIO;
  const noSe = porQueNoSeCorrige(l.reserva);
  if (noSe) return fallo(noSe);

  const armado = await armar(l);
  if ("ok" in armado) return armado;
  const decision = decidirCorreccion(l.reserva, armado.cambio, await detallesDe(cliente, l.fila));

  const { data, error } = await cliente.rpc("corregir_reserva", {
    p_reserva: entrada.reservaId,
    p_antes: {
      estado: l.fila.estado,
      motivos: l.reserva.motivos,
      vuelos: l.fila.vuelos ?? [],
      fecha_inicio: l.fila.fecha_inicio ?? null,
      fecha_fin: l.fila.fecha_fin ?? null,
      pax: l.fila.pax ?? null,
      notas: lista<string>(l.fila.notas),
    },
    p_cambios: armado.cambios,
    p_motivos: decision.motivos,
    p_evento: armado.evento,
  });
  if (error) return motivoDeError(error.code);
  const r = (data ?? {}) as { estado?: EstadoReserva; motivos?: string[] };
  return {
    ok: true,
    estado: r.estado ?? decision.estado,
    motivos: Array.isArray(r.motivos) ? r.motivos : decision.motivos,
    avisos: decision.avisos,
    ...(armado.aviso ? { aviso: armado.aviso } : {}),
  };
}

/** Filas 1 a 4, 6 y 7: los vuelos corregidos (y, si hay, la nota del operativo). */
export function corregirVuelos(cliente: SupabaseClient, entrada: EntradaCorregirVuelos): Promise<ResultadoCorregir> {
  return corregir(cliente, entrada, async (l) => {
    if (!Array.isArray(entrada.vuelos)) return fallo(R.datos);
    const validados = validarVuelos(entrada.vuelos);
    if (!validados.ok) return { ok: false, error: T.error(R.datos), errores: validados.errores };
    const nota = typeof entrada.nota === "string" ? entrada.nota.trim() : "";
    if (nota.length > MAXIMO_NOTA) return fallo(T.errores.notaLarga(MAXIMO_NOTA));

    const pedidos = await cliente.from("reserva_pedido").select("id,estado,proveedores,cuerpo").eq("reserva_id", entrada.reservaId);
    if (pedidos.error) return fallo(R.conexion);
    const avisar = pedidosAAvisar(
      ((pedidos.data ?? []) as any[]).map((p) => ({ id: p.id, estado: p.estado, proveedores: lista<string>(p.proveedores), cuerpo: p.cuerpo ?? "" })),
      l.reserva.vuelos,
      validados.vuelos,
    );
    return {
      cambio: { vuelos: validados.vuelos },
      cambios: { vuelos: validados.vuelos, ...(nota ? { nota } : {}) },
      evento: {
        tipo: "vuelos_corregidos",
        // Sin datos de pasajeros (#1): los vuelos y a qué proveedores hay que avisarles.
        detalle: { vuelos: vuelosEnHistorial(validados.vuelos), avisar: avisar.map((a) => ({ pedido_id: a.pedidoId, proveedores: a.proveedores })) },
      },
    };
  });
}

/** Fila 5: "Está bien así" sobre un dato dudoso. */
export function revisarDato(cliente: SupabaseClient, entrada: EntradaRevisarDato): Promise<ResultadoCorregir> {
  return corregir(cliente, entrada, async (l) => {
    if (!(DATOS_CLAVE as readonly string[]).includes(entrada.dato)) return fallo(R.datos);
    if (!datosDudosos(l.reserva.motivos).includes(entrada.dato)) return fallo(R.noEsDudoso);
    return { cambio: { revisado: entrada.dato }, cambios: {}, evento: { tipo: "dato_revisado", detalle: { dato: entrada.dato } } };
  });
}

/**
 * Spec M3-39: "Marcar como resuelto" un motivo de revisión, con una nota
 * corta obligatoria. Sin migración: el evento es un `dato_revisado` con los
 * motivos resueltos y la nota (`resueltos`, `explicacion`); la nota queda en el
 * historial, no en las notas de la reserva. Solo si la reserva sigue para
 * revisión y el motivo sigue estando.
 */
export function marcarResuelto(cliente: SupabaseClient, entrada: EntradaMarcarResuelto): Promise<ResultadoCorregir> {
  return corregir(cliente, entrada, async (l) => {
    const motivos = Array.isArray(entrada.motivos) ? [...new Set(entrada.motivos)] : [];
    if (motivos.length === 0 || motivos.some((m) => typeof m !== "string" || !m.trim())) return fallo(R.datos);
    const nota = typeof entrada.nota === "string" ? entrada.nota.trim() : "";
    if (!nota) return fallo(T.errores.faltaNota);
    if (nota.length > MAXIMO_NOTA) return fallo(T.errores.notaLarga(MAXIMO_NOTA));
    if (l.reserva.estado !== "para_revision" || motivos.some((m) => !l.reserva.motivos.includes(m))) return fallo(R.yaResuelto);
    return {
      cambio: { resueltos: motivos },
      cambios: {},
      evento: { tipo: "dato_revisado", detalle: { resueltos: motivos, explicacion: nota } },
    };
  });
}

/** Fila 5: corregir las fechas de inicio y fin o la cantidad de pasajeros. */
export function corregirDato(cliente: SupabaseClient, entrada: EntradaCorregirDato): Promise<ResultadoCorregir> {
  return corregir(cliente, entrada, async (l) => {
    if (entrada.dato === "fechas") {
      const inicio = String(entrada.fechaInicio ?? "").trim();
      const fin = String(entrada.fechaFin ?? "").trim();
      const error = validarFechas(inicio, fin);
      if (error) return fallo(error);
      // Owner 2026-10-20: si se corre el tour, la base corre las partes; si cambia la duración, se avisa.
      const como = comoCambianLasFechas(l.reserva, { fechaInicio: inicio, fechaFin: fin });
      let aviso: string | undefined;
      if (como.tipo === "duracion") {
        const partes = await cliente.from("reserva_componente").select("id", { count: "exact", head: true }).eq("reserva_id", entrada.reservaId);
        if (partes.error) return fallo(R.conexion);
        if ((partes.count ?? 0) > 0) aviso = T.avisoDuracion(como.nochesAntes, como.nochesDespues);
      }
      return {
        cambio: { fechas: { fechaInicio: inicio, fechaFin: fin } },
        cambios: { fecha_inicio: inicio, fecha_fin: fin },
        evento: { tipo: "dato_corregido", detalle: { dato: "fechas" } },
        aviso,
      };
    }
    if (entrada.dato === "pax") {
      const pax = Number(entrada.pax);
      const error = validarPax(pax);
      if (error) return fallo(error);
      return { cambio: { pax }, cambios: { pax }, evento: { tipo: "dato_corregido", detalle: { dato: "pax" } } };
    }
    return fallo(R.datos);
  });
}
