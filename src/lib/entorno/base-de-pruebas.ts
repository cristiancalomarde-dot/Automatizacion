import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * La base de pruebas separada (DECISIONS 2026-10-14): los tests de
 * integración y los scripts de prueba que escriben en la base usan el
 * proyecto de Supabase de `.env.pruebas.local`; la app, `npm run dev` y
 * `probar:mails` siguen con `.env.local` (la base real).
 *
 * - `cargarEntornoDePruebas`: copia `.env.pruebas.local` y después `.env.local`
 *   a las variables del proceso, sin pisar lo que ya está. Así las claves de
 *   Supabase salen de la base de pruebas y el resto (la clave de la IA) de
 *   `.env.local`. Nunca imprime valores (#2).
 * - `asegurarBaseDePruebas`: frena con un mensaje claro si la URL de Supabase
 *   es la de la base real.
 */

/** El proyecto de producción: ninguna prueba automática escribe acá. */
export const REF_BASE_REAL = "uhwkifqmexdktaseaxxo";

export const ARCHIVO_BASE_DE_PRUEBAS = ".env.pruebas.local";

type Entorno = Record<string, string | undefined>;

export function refDelProyecto(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function leerArchivoEnv(ruta: string): Array<[string, string]> {
  return readFileSync(ruta, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()] as [string, string])
    .filter(([k, v]) => k && v);
}

/** Carga `.env.pruebas.local` (si existe) y `.env.local`, sin pisar lo que ya está. Devuelve si había base de pruebas. */
export function cargarEntornoDePruebas(raiz: string = process.cwd(), env: Entorno = process.env): boolean {
  const pruebas = join(raiz, ARCHIVO_BASE_DE_PRUEBAS);
  const hay = existsSync(pruebas);
  for (const ruta of [...(hay ? [pruebas] : []), join(raiz, ".env.local")]) {
    if (!existsSync(ruta)) continue;
    for (const [k, v] of leerArchivoEnv(ruta)) {
      if (env[k] !== undefined && env[k] !== "") continue;
      // La URL del proyecto, sin el camino de la API que a veces se pega del panel.
      env[k] = k === "NEXT_PUBLIC_SUPABASE_URL" ? v.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "") : v;
    }
  }
  return hay;
}

export function asegurarBaseDePruebas(env: Entorno = process.env): void {
  const ref = refDelProyecto(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!ref) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL de la base de pruebas (.env.pruebas.local).");
  if (ref === REF_BASE_REAL) {
    throw new Error(
      "Frenado: esto apunta a la base REAL de producción. Las pruebas automáticas usan la base de pruebas: " +
        "completá .env.pruebas.local (DECISIONS 2026-10-14).",
    );
  }
}
