import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carga `.env.local` a `process.env` para los tests de integración que hablan
 * con el proyecto Supabase real (spec M1-02: V2 y V3 corren contra el
 * proyecto real, no un mock). El archivo nunca se commitea (regla #2 —
 * `docs/arquitectura/secretos.md`) y este loader nunca imprime su contenido,
 * solo lo copia a variables de entorno del proceso de test.
 *
 * Si el archivo no existe (por ejemplo, una máquina sin las credenciales
 * reales), no hace nada: los tests que dependen de esto se saltean solos con
 * `credencialesSupabaseDisponibles()`.
 */
export function cargarEnvLocal(): void {
  const ruta = resolve(__dirname, "..", "..", ".env.local");
  if (!existsSync(ruta)) return;

  for (const lineaCruda of readFileSync(ruta, "utf-8").split("\n")) {
    const linea = lineaCruda.trim();
    if (!linea || linea.startsWith("#")) continue;

    const separador = linea.indexOf("=");
    if (separador === -1) continue;

    const clave = linea.slice(0, separador).trim();
    const valor = linea.slice(separador + 1).trim();
    if (clave && !(clave in process.env)) {
      process.env[clave] = valor;
    }
  }
}

/** Nombres de variable que necesitan los tests de integración de esta spec. */
const VARIABLES_REQUERIDAS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * `true` si están las 3 credenciales de Supabase necesarias para hablar con
 * el proyecto real. Los tests de integración usan esto para saltearse
 * (en vez de fallar de forma confusa) cuando corren en una máquina sin
 * `.env.local`.
 */
export function credencialesSupabaseDisponibles(): boolean {
  cargarEnvLocal();
  return VARIABLES_REQUERIDAS.every((variable) => Boolean(process.env[variable]));
}
