/**
 * Lectura validada de las variables de entorno de Supabase (regla #2 — las
 * claves salen de variables de entorno, nunca del código).
 *
 * `NEXT_PUBLIC_*` es seguro de exponer al navegador: la URL del proyecto y la
 * clave "anon" están pensadas para eso (la protección real es RLS, no el
 * secreto de esta clave). Ver docs/arquitectura/secretos.md.
 */

export function obtenerUrlSupabase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Falta configurar NEXT_PUBLIC_SUPABASE_URL.");
  }
  return url;
}

export function obtenerAnonKeySupabase(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Falta configurar NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return key;
}

/** Solo para código de servidor (Route Handlers / Server Actions). Nunca importar desde un componente de cliente. */
export function obtenerServiceRoleKeySupabase(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY.");
  }
  return key;
}
