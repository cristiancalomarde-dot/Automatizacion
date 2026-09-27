import { describe, expect, it } from "vitest";
import { leerCodigosTourRadar } from "./codigos-tourradar";

// Spec M1-04 §3 #8: los códigos TourRadar vienen de
// "Insumos/Codigos Productos Tourradar.xlsx" (Codigo TR · Nombre en Tourradar ·
// Nuestro Codigo). El nombre se guarda tal cual: los PDF de reserva de
// TourRadar traen el nombre del tour, no el código.

describe("leerCodigosTourRadar", () => {
  it("lee código TR, nombre en TourRadar (tal cual) y nuestro código, por nombre de columna", () => {
    const filas = [
      ["Codigo TR", "Nombre en Tourradar", "Nuestro Codigo"],
      ["160955", "Iguazu Falls on a Shoestring (3N)", "OD010A"],
      ["", "", ""],
      ["285055", "Iguazu Glamping  (4 days)", " OD011 "],
    ];
    expect(leerCodigosTourRadar(filas)).toEqual([
      { codigo: "160955", nombre: "Iguazu Falls on a Shoestring (3N)", nuestroCodigo: "OD010A" },
      { codigo: "285055", nombre: "Iguazu Glamping  (4 days)", nuestroCodigo: "OD011" },
    ]);
  });

  it("la fila de encabezado puede no ser la primera; las columnas pueden venir en otro orden", () => {
    const filas = [
      [],
      ["Nuestro Codigo", "Codigo TR", "Nombre en Tourradar"],
      ["OD010B", "318366", "Iguazu Falls on a Shoestring Brazil (4 days)"],
    ];
    expect(leerCodigosTourRadar(filas)).toEqual([
      { codigo: "318366", nombre: "Iguazu Falls on a Shoestring Brazil (4 days)", nuestroCodigo: "OD010B" },
    ]);
  });

  it("sin las columnas esperadas → error claro (no se adivina qué columna es cuál)", () => {
    expect(() => leerCodigosTourRadar([["A", "B", "C"], ["1", "2", "3"]])).toThrow(/Codigo TR/);
  });
});
