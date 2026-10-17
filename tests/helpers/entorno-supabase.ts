import { resolve } from "node:path";
import { asegurarBaseDePruebas, cargarEntornoDePruebas } from "@/lib/entorno/base-de-pruebas";

/**
 * Las variables de los tests de integración, que hablan con un Supabase de
 * verdad (spec M1-02: no un mock).
 *
 * Desde M2-07 (DECISIONS 2026-10-14) ese Supabase es la BASE DE PRUEBAS:
 * primero `.env.pruebas.local` (las claves de Supabase) y después `.env.local`
 * (lo demás, sin pisar). Ningún archivo se commitea (#2) y este loader nunca
 * imprime su contenido.
 */
export function cargarEnvLocal(): void {
  cargarEntornoDePruebas(resolve(__dirname, "..", ".."));
}

/** Nombres de variable que necesitan los tests de integración. */
const VARIABLES_REQUERIDAS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * `true` si están las 3 credenciales de Supabase. Sin ellas los tests de
 * integración se saltean. Si apuntan a la base REAL de producción, frena con
 * un error claro: ninguna prueba automática escribe en producción.
 */
export function credencialesSupabaseDisponibles(): boolean {
  cargarEnvLocal();
  const hay = VARIABLES_REQUERIDAS.every((variable) => Boolean(process.env[variable]));
  if (hay) asegurarBaseDePruebas();
  return hay;
}
