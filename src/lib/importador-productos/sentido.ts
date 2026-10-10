/**
 * Sentido de un traslado de paquete (spec M1-08 §3 #1): de llegada, de
 * salida o de ida y vuelta. Sale solo del texto del Excel; si el texto no lo
 * dice, queda `sin_sentido` y se reporta (nunca se inventa).
 *
 * Cómo se lee (lo que va antes del "Booking Supplier", sin el "Transfer"):
 * - "Round Trip" (o "in + out") → ida y vuelta.
 * - Se parte en tramos por " - " o " to ". Un tramo es un *punto de llegada
 *   o salida* si nombra un aeropuerto, una terminal o un código de tres
 *   letras en mayúsculas (SCL, FTE, EZE, CJC…).
 *   - punto al principio y al final ("EZE o AEP - Hotel - EZE o AEP") → ida y vuelta;
 *   - punto al principio ("SCL - accommodation", "El Calafate Airport to El Chalten") → llegada;
 *   - punto al final ("El Calafate Accommodation - FTE Airport") → salida;
 *   - si no → sin sentido ("Remis Mendoza").
 */

export const SENTIDOS = ["llegada", "salida", "ida_y_vuelta", "sin_sentido"] as const;
export type SentidoTraslado = (typeof SENTIDOS)[number];

const BOOKING_SUPPLIER = /[\s.:/]*\b(?:booking\s+)?book(?:ing|ind|inkg)\s+sup{1,2}lier\b[\s\S]*$/i;
const PREFIJO = /^\s*transfers?\b\s*[:.]?\s*/i;
const IDA_Y_VUELTA = /\bround\s*trip\b|\bin\s*\+\s*out\b|\bida\s+y\s+vuelta\b/i;
const PUNTO = /\b(airport|aeropuerto|terminal|bus station|rodoviaria)\b/i;
const CODIGO = /\b[A-Z]{3}\b/;

function esPunto(tramo: string): boolean {
  return PUNTO.test(tramo) || CODIGO.test(tramo);
}

export function sentidoDelTraslado(texto: string): SentidoTraslado {
  const t = texto.split("\n")[0].replace(BOOKING_SUPPLIER, "").replace(PREFIJO, "").trim();
  if (!t) return "sin_sentido";
  if (IDA_Y_VUELTA.test(t)) return "ida_y_vuelta";
  const tramos = t.split(/\s+-\s+|\s+to\s+/i).filter((x) => x.trim() !== "");
  if (tramos.length < 2) return "sin_sentido";
  const primero = esPunto(tramos[0]);
  const ultimo = esPunto(tramos[tramos.length - 1]);
  if (primero && ultimo) return tramos.length >= 3 ? "ida_y_vuelta" : "sin_sentido";
  if (primero) return "llegada";
  if (ultimo) return "salida";
  return "sin_sentido";
}
