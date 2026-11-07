/**
 * M3-51 (owner, 2026-11-07): los pedidos de una reserva en orden cronológico, por la primera fecha
 * que piden (`partes[].fecha`). Se guardan todos juntos (mismo `created_at`) y la base los devolvía
 * en cualquier orden. Sin fecha, al final; a igual fecha, por `created_at` y después como vinieron
 * (el orden del armado: el alojamiento antes que su transfer). Puro: lo usan la pantalla de pedidos y la ficha de la reserva.
 */
export function ordenarPorFecha<T extends { created_at: string; partes?: unknown }>(pedidos: readonly T[]): T[] {
  const primera = (p: T) =>
    (Array.isArray(p.partes) ? (p.partes as Array<{ fecha?: unknown } | null>) : [])
      .map((x) => x?.fecha)
      .filter((f): f is string => typeof f === "string" && !!f)
      .sort()[0] ?? "9999-12-31";
  return [...pedidos].sort((a, b) => primera(a).localeCompare(primera(b)) || a.created_at.localeCompare(b.created_at));
}
