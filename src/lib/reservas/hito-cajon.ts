/**
 * M3-38 (owner, 2026-10-28, Journaway Petzold, SPAP05): el traslado San Pedro → Hito Cajón es parte
 * del Overland y se pide a Imperio Inca todo junto. En el pedido y en el detalle de la reserva va
 * dentro del Overland, no suelto. El traslado es SIEMPRE regular: "privado" solo califica al
 * Overland (el de SPAP05/06 es privado con los Tayka), nunca al traslado.
 */
import { fechaCorta } from "@/lib/pedidos/formato";

const HITO_CAJON = /hito\s+caj[oó]n/i;
const ES_TRASLADO = /\b(transfer|traslado)\b/i;
const OVERLAND = /\boverland\b/i;

/** El texto nombra el traslado San Pedro → Hito Cajón (y no es el Overland, que sale "desde Hito Cajón"). */
export function esTrasladoAHitoCajon(texto: string): boolean {
  return HITO_CAJON.test(texto) && ES_TRASLADO.test(texto) && !OVERLAND.test(texto);
}

export function esOverland(texto: string): boolean {
  return OVERLAND.test(texto);
}

/** "incluye traslado regular San Pedro → Hito Cajón el 26 may 2027" (sin fecha, sin "el …"). */
export function incluyeTrasladoAHitoCajon(fecha: string | null): string {
  return `incluye traslado regular San Pedro → Hito Cajón${fecha ? ` el ${fechaCorta(fecha)}` : ""}`;
}

/**
 * De una lista, la que se queda con el traslado: el Overland que arranca ese día o, si no hay, el
 * primero. -1 si no hay Overland (el traslado queda como estaba).
 */
export function overlandDelTraslado<T>(lista: readonly T[], fechaDelTraslado: string | null, esElOverland: (x: T) => boolean, fecha: (x: T) => string | null): number {
  const delDia = lista.findIndex((x) => esElOverland(x) && !!fechaDelTraslado && fecha(x) === fechaDelTraslado);
  return delDia >= 0 ? delDia : lista.findIndex(esElOverland);
}
