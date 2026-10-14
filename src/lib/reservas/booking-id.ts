import type { TipoMail } from "./esquema-ficha";

/**
 * El booking_id de cada agencia, normalizado para comparar (spec M2-04 fila
 * 2). La reserva guarda los dos: el original (para mostrarlo) y este (para
 * buscar el mismo intercambio). Se compara siempre dentro de la misma agencia.
 *
 * - Kilroy y Jysk: país + número (`DK1594100`). Lo que va después de la `/`
 *   (iniciales) o del `-` (número de orden) cambia entre mails de la misma
 *   reserva.
 * - TourRadar: el TOURRADAR REFERENCE ID, el primer número de "Booking
 *   Statement N - M". El segundo cambia en cada estado de cuenta. "Blanca
 *   Roman x1" (el campo "HI TRAVEL … BOOKING ID") no es un número.
 * - Journaway: el "ID" de 11 dígitos del asunto (owner, 2026-10-13). El Trip
 *   Number es una referencia secundaria: solo, no da booking_id.
 */

const KILROY = /(?<![A-Za-z])([A-Za-z]{2}\d{5,})(?!\d)/;
const TOURRADAR = /(?<!\d)(\d{6,8})(?!\d)/;
const JOURNAWAY = /(?:^|\bID\s*:?\s*)(\d{11})(?!\d)/i;

export function normalizarBookingId(original: string | null | undefined, agencia: string): string | null {
  if (!original) return null;
  const t = original.trim();
  if (!t) return null;
  if (agencia === "Journaway") return JOURNAWAY.exec(t)?.[1] ?? null;
  if (agencia === "TourRadar") return TOURRADAR.exec(t)?.[1] ?? null;
  if (agencia === "Kilroy" || agencia === "Jysk") {
    const m = KILROY.exec(t);
    if (m) return m[1].toUpperCase();
  }
  return t.replace(/\s+/g, "") || null;
}

/** El booking_id que trae el asunto, sin IA. Null si el asunto no lo trae. */
export function bookingIdDelAsunto(asunto: string | null | undefined, agencia: string): string | null {
  if (!asunto) return null;
  if (agencia === "Kilroy" || agencia === "Jysk") return KILROY.exec(asunto)?.[1].toUpperCase() ?? null;
  if (agencia === "TourRadar") return /booking statement\s+(\d{6,8})(?!\d)/i.exec(asunto)?.[1] ?? null;
  if (agencia === "Journaway") return /\bID\s*:?\s*(\d{11})(?!\d)/i.exec(asunto)?.[1] ?? null;
  return null;
}

/**
 * Fila 9: el mail es una cancelación de la agencia. En TourRadar se reconoce
 * sin IA ("vendorcredit" en el asunto, o el encabezado "BOOKING CANCELLATION
 * STATEMENT"); en el resto, por lo que dijo la lectura de M2-02.
 */
export function esCancelacionDeAgencia(mail: {
  asunto?: string | null;
  cuerpo?: string | null;
  tipoMail?: TipoMail | null;
}): boolean {
  if (mail.tipoMail === "cancelacion") return true;
  if (/\bvendorcredit\b/i.test(mail.asunto ?? "")) return true;
  return /booking cancellation statement/i.test(`${mail.asunto ?? ""}\n${mail.cuerpo ?? ""}`);
}
