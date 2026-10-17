import { createHash, timingSafeEqual } from "node:crypto";

/**
 * La llamada del cron trae `Authorization: Bearer <CRON_SECRET>` (Vercel lo
 * manda solo). Comparación de tiempo constante sobre los hash (no depende del
 * largo). Sin CRON_SECRET cargado en el servidor, nada pasa (#5).
 */
export function cronAutorizado(encabezado: string | null | undefined, secreto: string | undefined): boolean {
  if (!secreto || !secreto.trim() || !encabezado) return false;
  const hash = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(hash(encabezado), hash(`Bearer ${secreto}`));
}
