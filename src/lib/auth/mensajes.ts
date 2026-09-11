/**
 * Textos fijos de error del login (docs/arquitectura/marca.md §5,
 * docs/sdd/specs/M1-01-base-de-la-app.md §3 "Los tres estados").
 *
 * El código de error viaja en la URL (`/login?error=<codigo>`) para no perder
 * el mensaje en la vuelta del redirect del callback. Un código desconocido no
 * muestra nada (falla silenciosa, no un texto roto).
 */

export const CODIGOS_ERROR_LOGIN = ["dominio", "auth", "sesion_vencida"] as const;

export type CodigoErrorLogin = (typeof CODIGOS_ERROR_LOGIN)[number];

const MENSAJES: Record<CodigoErrorLogin, string> = {
  dominio: "Esta cuenta no pertenece a HI Travel.",
  auth: "No pudimos ingresar. Probá de nuevo.",
  sesion_vencida: "Tu sesión venció. Volvé a ingresar.",
};

export function esCodigoErrorLogin(valor: string | null): valor is CodigoErrorLogin {
  return valor !== null && (CODIGOS_ERROR_LOGIN as readonly string[]).includes(valor);
}

export function obtenerMensajeErrorLogin(codigo: string | null): string | null {
  if (!esCodigoErrorLogin(codigo)) return null;
  return MENSAJES[codigo];
}
