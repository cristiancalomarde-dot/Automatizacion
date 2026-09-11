/**
 * Restricción de dominio para el login con Google (M1-01).
 *
 * Función pura, sin dependencias de Supabase ni de Next.js — se puede testear
 * de forma aislada. La usan tanto el pedido de login (hint `hd` a Google, no
 * autoritativo) como el callback del servidor (chequeo real, autoritativo).
 *
 * Ver docs/arquitectura/auth-y-permisos.md (Anexo técnico) y
 * docs/sdd/specs/M1-01-base-de-la-app.md #4.
 */

/** Quita espacios, pasa a minúsculas y saca un `@` inicial si lo tuviera. */
export function normalizarDominio(dominio: string): string {
  return dominio.trim().toLowerCase().replace(/^@/, "");
}

/**
 * ¿El mail pertenece al dominio permitido?
 * Rechaza mails vacíos, mal formados (sin `@` o con más de uno) o de otro dominio.
 */
export function esCorreoDelDominioPermitido(
  email: string | null | undefined,
  dominioPermitido: string,
): boolean {
  if (!email) return false;

  const partes = email.trim().toLowerCase().split("@");
  if (partes.length !== 2) return false;

  const [usuario, dominio] = partes;
  if (!usuario || !dominio) return false;

  return dominio === normalizarDominio(dominioPermitido);
}

/**
 * Lee el dominio permitido desde la variable de entorno.
 * No tiene default silencioso: si falta, es un error de configuración que
 * tiene que verse (no queremos "abrir" el login a cualquier dominio por un
 * despliegue mal configurado).
 */
export function obtenerDominioPermitido(): string {
  const dominio = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN;
  if (!dominio) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN (el dominio de mail permitido para entrar).",
    );
  }
  return normalizarDominio(dominio);
}
