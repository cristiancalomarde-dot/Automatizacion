import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELOS, PRECIOS_POR_MODELO, preciosDelModelo } from "./modelos";

// Spec M2-02 fila 25 (revisión de IA, owner 2026-10-12): el modelo de cada
// tarea y su precio viven en un solo lugar.

const SRC = resolve(__dirname, "..", "..");
const PREFIJO_MODELO = ["clau", "de-"].join(""); // armado para no contener el literal

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe("modelos.ts — el modelo por tarea, en un solo lugar (M2-02 fila 25)", () => {
  it("las tres tareas usan Sonnet 5.5", () => {
    expect(MODELOS.lectura_mail.modelo).toBe(`${PREFIJO_MODELO}sonnet-5-5`);
    expect(MODELOS.propuesta_producto.modelo).toBe(`${PREFIJO_MODELO}sonnet-5-5`);
    expect(MODELOS.importador.modelo).toBe(`${PREFIJO_MODELO}sonnet-5-5`);
  });

  it("cada tarea lleva el precio de su modelo (US$ por millón de tokens)", () => {
    for (const tarea of Object.values(MODELOS)) {
      expect(tarea.precios).toEqual(PRECIOS_POR_MODELO[tarea.modelo]);
    }
    expect(MODELOS.lectura_mail.precios).toEqual({ entradaPorMillon: 2, salidaPorMillon: 10 });
  });

  it("Opus 5.5 tiene precio cargado (para la comparación de M2-06); un modelo sin precio es un error", () => {
    expect(preciosDelModelo(`${PREFIJO_MODELO}opus-5-5`)).toEqual({ entradaPorMillon: 4, salidaPorMillon: 20 });
    expect(() => preciosDelModelo("modelo-inventado")).toThrow(/precio/);
  });

  it("ningún archivo de src/ fuera de modelos.ts nombra un modelo", () => {
    const conModelo = archivos(SRC)
      .filter((ruta) => !ruta.endsWith(join("ia", "modelos.ts")))
      .filter((ruta) => readFileSync(ruta, "utf-8").includes(PREFIJO_MODELO))
      .map((ruta) => relative(SRC, ruta));
    expect(conModelo).toEqual([]);
  });
});
