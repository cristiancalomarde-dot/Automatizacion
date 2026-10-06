// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contraste, leerTokens } from "./contraste";

const RAIZ = resolve(__dirname, "..", "..", "..");
const css = readFileSync(join(RAIZ, "src/app/globals.css"), "utf-8");
const tokens = leerTokens(css);

function archivosCss(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosCss(ruta);
    return ruta.endsWith(".css") ? [ruta] : [];
  });
}

describe("tokens de marca (spec M1-06 #13, marca.md §1)", () => {
  it("contraste: la fórmula WCAG da los valores de marca.md", () => {
    expect(contraste("#ffffff", "#3b659b")).toBeCloseTo(5.96, 1);
    expect(contraste("#ffffff", "#4e7cba")).toBeCloseTo(4.27, 1);
  });

  it("el primario es el de marca.md y el texto blanco sobre él supera 4.5:1", () => {
    expect(tokens["--color-primario"]).toBe("#3b659b");
    expect(tokens["--color-primario-hover"]).toBe("#2d4d76");
    expect(contraste("#ffffff", tokens["--color-primario"])).toBeGreaterThanOrEqual(4.5);
    expect(contraste("#ffffff", tokens["--color-primario-hover"])).toBeGreaterThanOrEqual(4.5);
  });

  it("los chips de estado y los avisos superan 4.5:1 (texto sobre su fondo)", () => {
    const pares = Object.keys(tokens)
      .filter((k) => k.endsWith("-texto") && tokens[k.replace(/-texto$/, "-fondo")])
      .map((k) => [k, tokens[k], tokens[k.replace(/-texto$/, "-fondo")]] as const);
    expect(pares.length).toBeGreaterThanOrEqual(4);
    for (const [nombre, texto, fondo] of pares) {
      expect(contraste(texto, fondo), nombre).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ningún estilo usa el naranja del logo, y el azul claro del logo solo como anillo de foco", () => {
    for (const archivo of archivosCss(join(RAIZ, "src"))) {
      const contenido = readFileSync(archivo, "utf-8").toLowerCase();
      expect(contenido, archivo).not.toContain("#dc9912");
      const usosAzulClaro = contenido.match(/^.*#4e7cba.*$/gm) ?? [];
      for (const linea of usosAzulClaro) expect(linea.trim(), archivo).toMatch(/^--color-foco:/);
    }
  });
});
