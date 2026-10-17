import type { DetalleProducto } from "@/lib/catalogo/tipos";
import { TEXTOS } from "@/lib/textos";
import { saleDePuertoNatales } from "./emparejar/componentes";
import { motivosDeVuelos } from "./emparejar/vuelos-requeridos";
import type { VueloIA } from "./esquema-ficha";
import type { EstadoReserva } from "./tipos";

/**
 * "Falta el vuelo" es un aviso, no un motivo de revisión (owner, 2026-10-16;
 * plan M2 §3). Generaliza la regla de Iguazú (`llegada-iguazu.ts`): lo que no
 * depende del vuelo (alojamiento, excursiones, bus) se puede pedir ya; solo el
 * traslado espera el dato. La reserva queda "recibida" con un aviso concreto
 * ("Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030").
 *
 * El aviso no se guarda: se calcula con lo que tiene la reserva (producto,
 * vuelos, pedidos especiales y fechas) con el mismo control de M2-03
 * (`motivosDeVuelos`). Cuando un mail posterior trae el vuelo y se suma a la
 * reserva (M2-04), el aviso se va solo. "Elegir la variante" (con o sin
 * traslados) pide una decisión: sigue siendo motivo de revisión.
 */

const FALTA_VUELO = /^Falta el vuelo de /;

export const esAvisoDeVuelo = (texto: string) => FALTA_VUELO.test(texto);

/** Lo que sale del control de vuelos, separado: los avisos y lo que sigue siendo motivo de revisión. */
export function separarAvisosDeVuelo(textos: readonly string[]): { avisos: string[]; motivos: string[] } {
  return { avisos: textos.filter(esAvisoDeVuelo), motivos: textos.filter((t) => !esAvisoDeVuelo(t)) };
}

/**
 * Owner 2026-10-16: lo que espera el dato de llegada va bajo UNA marca
 * ("falta dato de llegada"), con una línea concreta por cada cosa: los vuelos
 * que faltan para un traslado y, en Iguazú, el vuelo o bus (`llegada-iguazu.ts`).
 * Lo usan la lista, el detalle y el reporte del modo prueba.
 */
export function avisosDeLlegada(r: { avisosVuelo: readonly string[]; sinDatoLlegada: boolean }): string[] {
  return [...r.avisosVuelo, ...(r.sinDatoLlegada ? [TEXTOS.reserva.avisoLlegada] : [])];
}

/** Lo que el cálculo necesita de una reserva guardada. */
export interface DatosParaAvisos {
  productoTexto: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  vuelos: readonly VueloIA[];
  /** Los pedidos especiales tal como se guardan (uno por renglón). */
  pedidos: string | null;
  /** M2-09: el lado del traslado que lleva otra reserva del mismo pedido (no pide vuelo). */
  sinTrasladoDe?: "llegada" | "salida" | null;
}

/** Los avisos "Falta el vuelo…" de una reserva. Sin producto del catálogo, ninguno. */
export function avisosDeVuelo(detalle: DetalleProducto | null, r: DatosParaAvisos): string[] {
  if (!detalle) return [];
  const pedidos = r.pedidos ? r.pedidos.split("\n").filter((p) => p.trim()) : [];
  const vuelos = [...r.vuelos];
  const motivos = motivosDeVuelos(detalle, {
    vuelos,
    pedidos,
    producto: { nombre: r.productoTexto ?? "", opcionales: [], fecha_inicio: r.fechaInicio, fecha_fin: r.fechaFin },
    finalPuertoNatales: saleDePuertoNatales({ vuelos, pedidos_especiales: pedidos.map((texto) => ({ texto, confianza: 1 })) }),
    omitir: r.sinTrasladoDe === "salida" ? ["out"] : r.sinTrasladoDe === "llegada" ? ["in"] : [],
  });
  return separarAvisosDeVuelo(motivos).avisos;
}

/** Los estados en los que todavía se trabaja la reserva: después, el aviso ya no sirve. */
const ESTADOS_CON_AVISO: ReadonlySet<EstadoReserva> = new Set(["recibida", "para_revision"]);

export interface FilaParaAvisos extends DatosParaAvisos {
  id: string;
  productoId: string | null;
  estado: EstadoReserva;
}

/**
 * Los avisos de varias reservas, cargando el detalle de cada producto una sola
 * vez (`cargarProducto` con el cliente que corresponda). Si un detalle no se
 * puede cargar, falla: quien llama muestra el error, nunca datos a medias.
 */
export async function cargarAvisosDeVuelo(
  detalle: (productoId: string) => Promise<DetalleProducto>,
  filas: readonly FilaParaAvisos[],
): Promise<Map<string, string[]>> {
  const conAviso = filas.filter((f) => f.productoId && ESTADOS_CON_AVISO.has(f.estado));
  const ids = [...new Set(conAviso.map((f) => f.productoId!))];
  const detalles = new Map(await Promise.all(ids.map(async (id) => [id, await detalle(id)] as const)));
  const avisos = new Map<string, string[]>(filas.map((f) => [f.id, []]));
  for (const f of conAviso) avisos.set(f.id, avisosDeVuelo(detalles.get(f.productoId!) ?? null, f));
  return avisos;
}
