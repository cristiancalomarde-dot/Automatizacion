/**
 * Números de reserva propios de los tests (decisión 2026-10-14, antes de M2-06).
 *
 * Los tests de integración y el modo prueba (M2-06) comparten la base. Las
 * reservas del modo prueba llevan los números reales de los mails de ejemplo
 * (DK1594100, 1377598…); si un test usara los mismos, el "mismo intercambio"
 * de M2-04 lo sumaría a la reserva que revisa el owner, o chocaría con el
 * índice único de booking_id + producto.
 *
 * Los números reales de Kilroy y de TourRadar empiezan con 1 (país + 7
 * dígitos, o 7 dígitos). La copia de test cambia ese 1 por un 9
 * (DK1594100 → DK9594100, 1377598 → 9377598): mismo formato, nunca un
 * número real. Es idempotente (un número ya cambiado no cambia de nuevo).
 */
const NUMERO_REAL = /(?<![0-9A-Za-z])([A-Za-z]{2})?1(\d{6})(?!\d)/g;

export function aNumeroDeTest(texto: string): string;
export function aNumeroDeTest(texto: string | null | undefined): string | null | undefined;
export function aNumeroDeTest(texto: string | null | undefined): string | null | undefined {
  return typeof texto === "string" ? texto.replace(NUMERO_REAL, (_m, pais: string | undefined, resto: string) => `${pais ?? ""}9${resto}`) : texto;
}

/** Copia profunda con todos los textos pasados a números de test (no toca los bytes de un PDF). */
export function conNumerosDeTest<T>(valor: T): T {
  if (typeof valor === "string") return aNumeroDeTest(valor) as T;
  if (Array.isArray(valor)) return valor.map((v) => conNumerosDeTest(v)) as T;
  if (valor && typeof valor === "object" && !(valor instanceof Uint8Array) && !(valor instanceof Date)) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, conNumerosDeTest(v)])) as T;
  }
  return valor;
}
