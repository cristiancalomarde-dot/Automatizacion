import { describe, expect, it } from "vitest";
import { parsearPaquetesPiloto } from "./paquetes-piloto";

// Spec M1-04c §3 #1: la lista de paquetes sale de un archivo de datos
// (data/paquetes-piloto.csv: código y destino), no del código fuente.

describe("parsearPaquetesPiloto", () => {
  it("devuelve código y destino por fila, en el orden del archivo, sin espacios sobrantes", () => {
    expect(parsearPaquetesPiloto("codigo,destino\n OD018 ,BUE\nCH10,PNT\n")).toEqual([
      { codigo: "OD018", destino: "BUE" },
      { codigo: "CH10", destino: "PNT" },
    ]);
  });

  it("ignora líneas en blanco y columnas extra (ej. una nota)", () => {
    expect(parsearPaquetesPiloto("codigo,destino,nota\r\nOD010A,IGR,ya cargado\r\n\r\n")).toEqual([
      { codigo: "OD010A", destino: "IGR" },
    ]);
  });

  it("un código repetido es un error explícito (con su fila)", () => {
    expect(() => parsearPaquetesPiloto("codigo,destino\nOD018,BUE\nOD018,BUE\n")).toThrow(/fila 3.*OD018.*repetido/);
  });

  it("una fila sin código o sin destino es un error explícito", () => {
    expect(() => parsearPaquetesPiloto("codigo,destino\nOD018,\n")).toThrow(/fila 2/);
    expect(() => parsearPaquetesPiloto("codigo,destino\n,BUE\n")).toThrow(/fila 2/);
  });

  it("si faltan las columnas codigo o destino, falla", () => {
    expect(() => parsearPaquetesPiloto("code,dest\nOD018,BUE\n")).toThrow(/codigo.*destino/);
  });
});
