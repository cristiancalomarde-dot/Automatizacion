import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Regla #2 (docs/arquitectura/secretos.md): ninguna clave real va en el
// código. Recorre el repo (sin depender de que ya esté "git add"eado) y
// busca patrones que solo aparecen en claves reales: JWT de Supabase, client
// secret de Google OAuth, API key de Anthropic. `.env.example` queda afuera
// a propósito: es el único archivo que documenta NOMBRES de variable.

const RAIZ = resolve(__dirname, "..");

const DIRECTORIOS_IGNORADOS = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  "build",
  "dist",
  ".turbo",
  "coverage",
  "Insumos", // planillas fuente del catálogo, no código
]);

const PATRONES_DE_CLAVE_REAL: Array<{ nombre: string; patron: RegExp }> = [
  { nombre: "JWT de Supabase (anon/service role)", patron: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { nombre: "Client secret de Google OAuth", patron: /GOCSPX-[A-Za-z0-9_-]+/ },
  { nombre: "API key de Anthropic", patron: /sk-ant-[A-Za-z0-9-]+/ },
];

function esArchivoDeEntornoLocal(nombreArchivo: string): boolean {
  // .env, .env.local, .env.production, etc. — nunca se commitean (.gitignore)
  // y pueden tener valores reales en la máquina de un dev; no son "el repo".
  return /^\.env(\..+)?$/.test(nombreArchivo) && nombreArchivo !== ".env.example";
}

function listarArchivos(dir: string): string[] {
  const resultado: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (DIRECTORIOS_IGNORADOS.has(entrada)) continue;
    const ruta = join(dir, entrada);
    const info = statSync(ruta);
    if (info.isDirectory()) {
      resultado.push(...listarArchivos(ruta));
    } else if (!esArchivoDeEntornoLocal(entrada)) {
      resultado.push(ruta);
    }
  }
  return resultado;
}

describe("sin claves reales en el repo (regla #2)", () => {
  it("ningún archivo del repo contiene un secreto con forma de clave real", () => {
    const encontrados: string[] = [];

    for (const ruta of listarArchivos(RAIZ)) {
      let contenido: string;
      try {
        contenido = readFileSync(ruta, "utf-8");
      } catch {
        continue; // binario (ico, xlsx, etc.) — no es texto donde vivir una clave
      }

      for (const { nombre, patron } of PATRONES_DE_CLAVE_REAL) {
        if (patron.test(contenido)) {
          encontrados.push(`${relative(RAIZ, ruta)} → ${nombre}`);
        }
      }
    }

    expect(encontrados).toEqual([]);
  });
});
