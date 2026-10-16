/**
 * Iguazú sin dato de llegada (owner, 2026-10-14; plan M2 §3).
 *
 * Kilroy suele reservar Iguazú (OD010A–D) sin el vuelo de llegada, y a veces
 * los pasajeros llegan en bus. La reserva NO va a revisión por eso: sigue
 * "recibida" porque conseguir el alojamiento es lo crítico. Queda un aviso
 * visible para pasarle el dato a Cuenca del Plata cuando llegue, bajo la misma
 * marca que los vuelos que faltan: "falta dato de llegada" (owner, 2026-10-16;
 * `avisosDeLlegada` en `avisos-vuelo.ts`).
 *
 * El aviso no se guarda: se calcula con lo que tiene la reserva (producto,
 * vuelos y pedidos especiales). Cuando un mail posterior trae el vuelo (o dice
 * que llegan en bus) y se suma a la reserva (M2-04), el aviso se va solo.
 * Una respuesta ("Re: NEW FLIGHT …") de una de estas reservas se lee con IA
 * igual que la de una reserva que espera el vuelo (`respuestas.ts`).
 *
 * Los traslados de OD010A–D van dentro del paquete receptivo de Cuenca del
 * Plata, así que el control de vuelos de M2-03 nunca los pide: esto no cambia
 * ningún estado.
 */

const IGUAZU = /^OD010[A-D]$/;
const AEROPUERTOS_IGUAZU = new Set(["IGR", "IGU"]);
const EN_BUS = /(?<!\p{L})(bus|buses|[oó]mnibus|micro|rodovi[aá]ria)(?!\p{L})/iu;

export function esIguazu(codigoProducto: string | null | undefined): boolean {
  return IGUAZU.test(codigoProducto ?? "");
}

export interface DatosDeLlegada {
  productoCodigo: string | null | undefined;
  vuelos: ReadonlyArray<{ destino?: string | null; numero?: string | null }>;
  pedidos: string | null | undefined;
}

/** True si la reserva es de Iguazú y todavía no hay vuelo de llegada ni se sabe que llegan en bus. */
export function sinDatoDeLlegada(r: DatosDeLlegada): boolean {
  if (!esIguazu(r.productoCodigo)) return false;
  const hayVuelo = r.vuelos.some((v) => !!v.numero && (!v.destino || AEROPUERTOS_IGUAZU.has(v.destino.trim().toUpperCase())));
  if (hayVuelo) return false;
  return !EN_BUS.test(r.pedidos ?? "");
}
