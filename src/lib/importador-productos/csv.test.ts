import { describe, expect, it } from "vitest";
import { leerCsv } from "./csv";

// Lector de CSV mínimo (RFC 4180) para las listas que revisa el owner
// (spec M1-04b: equivalencias de proveedores y niveles confirmados).

describe("leerCsv", () => {
  it("devuelve un objeto por fila con las columnas del encabezado", () => {
    expect(leerCsv("a,b\n1,2\n3,4\n")).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("respeta comillas: comas adentro y comillas dobladas", () => {
    const [fila] = leerCsv('nombre,nota\nCuenca,"No es ""Cuenca del Plata, +"" (sin mail)"\n');
    expect(fila).toEqual({ nombre: "Cuenca", nota: 'No es "Cuenca del Plata, +" (sin mail)' });
  });

  it("campos vacíos quedan como texto vacío; tolera CRLF, BOM y líneas en blanco", () => {
    expect(leerCsv("﻿a,b,c\r\nTetris,,x\r\n\r\n")).toEqual([{ a: "Tetris", b: "", c: "x" }]);
  });

  it("una fila con más o menos columnas que el encabezado es un error explícito", () => {
    expect(() => leerCsv("a,b\n1,2,3\n")).toThrow(/fila 2/);
  });
});
