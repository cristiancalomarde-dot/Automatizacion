import { describe, expect, it } from "vitest";
import { leerOpcionesCarga, seleccionarPaquetes } from "./carga-paquetes";

// Spec M3-46 puntos 6 y 7: las opciones de importar:paquetes e importar:tours.
describe("leerOpcionesCarga", () => {
  it("sin opciones, recorre todo y escribe (igual que hoy)", () => {
    expect(leerOpcionesCarga([])).toEqual({ codigos: null, enSeco: false, posicionales: [] });
  });

  it("la ruta del Excel sigue siendo un argumento suelto", () => {
    expect(leerOpcionesCarga(["otro.xls"])).toEqual({ codigos: null, enSeco: false, posicionales: ["otro.xls"] });
  });

  it("--codigos con uno o varios, separados por coma, en mayúsculas y sin repetir", () => {
    expect(leerOpcionesCarga(["--codigos", "BR18"]).codigos).toEqual(["BR18"]);
    expect(leerOpcionesCarga(["--codigos", "odbr15, COMPBR04,ODBR15"]).codigos).toEqual(["ODBR15", "COMPBR04"]);
    expect(leerOpcionesCarga(["--codigos=BR18,AR10"]).codigos).toEqual(["BR18", "AR10"]);
  });

  it("--en-seco se combina con lo demás, en cualquier orden", () => {
    expect(leerOpcionesCarga(["--en-seco", "x.xls", "--codigos", "BR18"])).toEqual({ codigos: ["BR18"], enSeco: true, posicionales: ["x.xls"] });
  });

  it("--codigos sin códigos o una opción desconocida cortan (nunca corre todo por un error de tipeo)", () => {
    expect(() => leerOpcionesCarga(["--codigos"])).toThrow(/--codigos/);
    expect(() => leerOpcionesCarga(["--codigos", "--en-seco"])).toThrow(/--codigos/);
    expect(() => leerOpcionesCarga(["--codigos="])).toThrow(/--codigos/);
    expect(() => leerOpcionesCarga(["--enseco"])).toThrow(/--enseco/);
  });
});

describe("seleccionarPaquetes", () => {
  const lista = [
    { codigo: "OD018", destino: "BUE" },
    { codigo: "ODBR15", destino: "SSA" },
    { codigo: "COMPBR04", destino: "CHAP" },
  ];

  it("sin códigos, la lista entera", () => {
    expect(seleccionarPaquetes(lista, null)).toEqual(lista);
  });

  it("con códigos, solo esos, en el orden de la lista", () => {
    expect(seleccionarPaquetes(lista, ["COMPBR04", "ODBR15"]).map((p) => p.codigo)).toEqual(["ODBR15", "COMPBR04"]);
  });

  it("un código que no está en la lista corta, sin cargar nada", () => {
    expect(() => seleccionarPaquetes(lista, ["ODBR15", "ZZ9"])).toThrow(/ZZ9/);
  });
});
