import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leerCodigosTourRadarCsv, planCargaCodigosTourRadar } from "./codigos-tourradar-csv";
import { buscarNoCargado, leerProductosNoCargados } from "./productos-no-cargados";

/**
 * Productos y códigos (owner, 2026-10-14, roadmap M2 §3): los productos que
 * existen en el catálogo de HI Travel pero no están cargados
 * (`data/productos-no-cargados.csv`) y el código TourRadar 150146 → AR09
 * (`data/codigos-tourradar.csv`). Sin base ni IA.
 */

const NO_CARGADOS = readFileSync(join(process.cwd(), "data", "productos-no-cargados.csv"), "utf-8");
const CODIGOS_TR = readFileSync(join(process.cwd(), "data", "codigos-tourradar.csv"), "utf-8");
const ENCABEZADO = "codigo,nombre,agencia,codigo_agencia,nombre_agencia,nota";

describe("data/productos-no-cargados.csv", () => {
  const lista = leerProductosNoCargados(NO_CARGADOS);

  it("trae solo ARCH33EXP, ARBR23 y ARUY01", () => {
    expect([...new Set(lista.map((p) => p.codigo))].sort()).toEqual(["ARBR23", "ARCH33EXP", "ARUY01"]);
  });

  it.each([
    ["Kilroy", "HI_TRAVEL_ARCH_EXP-677", "ARCH33EXP"],
    ["TourRadar", "275366", "ARCH33EXP"],
    ["TourRadar", "150104", "ARBR23"],
    ["TourRadar", "317766", "ARUY01"],
  ])("%s %s → %s", (agencia, codigo, esperado) => {
    expect(buscarNoCargado(lista, agencia, { codigos: [codigo], nombre: null })?.codigo).toBe(esperado);
  });

  it("por el nombre de la agencia, ignorando mayúsculas y espacios: 'buenos aires to rio de janeiro  12 days' → ARBR23", () => {
    expect(buscarNoCargado(lista, "TourRadar", { codigos: [], nombre: "buenos aires to rio de janeiro  12 days" })?.codigo).toBe("ARBR23");
  });

  it("no debe pasar: un código de una agencia no vale para otra, ni un nombre 'parecido'", () => {
    expect(buscarNoCargado(lista, "Kilroy", { codigos: ["150104"], nombre: null })).toBeNull();
    expect(buscarNoCargado(lista, "TourRadar", { codigos: [], nombre: "Buenos Aires to Rio de Janeiro" })).toBeNull();
    expect(buscarNoCargado(lista, "TourRadar", { codigos: ["150146"], nombre: null })).toBeNull();
  });

  it("falla con un mensaje claro si falta el código o la agencia", () => {
    expect(() => leerProductosNoCargados(`${ENCABEZADO}\n,X,Kilroy,ABC,,`)).toThrow("productos-no-cargados.csv fila 2: falta el código HI Travel.");
    expect(() => leerProductosNoCargados(`${ENCABEZADO}\nX,X,,ABC,,`)).toThrow("productos-no-cargados.csv fila 2: falta la agencia.");
  });

  it("falla si el mismo código de agencia figura dos veces", () => {
    expect(() => leerProductosNoCargados(`${ENCABEZADO}\nX,X,Kilroy,ABC,,\nY,Y,Kilroy,ABC,,`)).toThrow(
      "productos-no-cargados.csv fila 3: el código ABC de Kilroy ya figura en la fila 2.",
    );
  });
});

describe("data/codigos-tourradar.csv", () => {
  it("trae solo 150146 → AR09", () => {
    expect(leerCodigosTourRadarCsv(CODIGOS_TR)).toEqual([
      { codigo: "150146", nombre: "Patagonia Adventure Tour 16 Days", nuestroCodigo: "AR09" },
    ]);
  });

  it("la carga apunta a AR09; si el producto no existe, falla sin escribir nada", () => {
    const filas = leerCodigosTourRadarCsv(CODIGOS_TR);
    expect(planCargaCodigosTourRadar(filas, new Map([["AR09", "id-ar09"]]))).toEqual([
      { productoId: "id-ar09", agencia: "TourRadar", codigo: "150146", nombre: "Patagonia Adventure Tour 16 Days" },
    ]);
    expect(() => planCargaCodigosTourRadar(filas, new Map())).toThrow(
      "codigos-tourradar.csv: el código HI Travel AR09 no existe en el catálogo (TourRadar 150146). No se cargó nada.",
    );
  });
});
