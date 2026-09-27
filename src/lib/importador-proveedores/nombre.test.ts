import { describe, expect, it } from "vitest";
import { limpiarNombre, normalizarNombre } from "./nombre";

// Spec M1-03 §3 #3 y Anexo técnico "Normalización de nombre".
describe("normalizarNombre (spec M1-03 #3)", () => {
  it("recorta, colapsa espacios y pasa a minúsculas", () => {
    expect(normalizarNombre("  CUENCA   DEL PLATA ")).toBe("cuenca del plata");
  });

  it("variantes de mayúsculas/espacios del mismo proveedor dan la misma forma canónica", () => {
    expect(normalizarNombre("Cuenca del Plata")).toBe(normalizarNombre("CUENCA DEL PLATA "));
    expect(normalizarNombre("Loi flats buenos aires ")).toBe(
      normalizarNombre("Loi Flats Buenos Aires "),
    );
  });

  it("trata saltos de línea y tabs como espacios", () => {
    expect(normalizarNombre("Viajero Colonia Posada B&B | Colonia del Sacramento\n")).toBe(
      "viajero colonia posada b&b | colonia del sacramento",
    );
  });

  it("no toca la ortografía (no fusiona nombres distintos)", () => {
    expect(normalizarNombre("Cuenca Del Plata (Natalia )")).not.toBe(
      normalizarNombre("Cuenca del Plata, +"),
    );
  });
});

describe("limpiarNombre — nombre para mostrar", () => {
  it("recorta y colapsa espacios pero respeta mayúsculas", () => {
    expect(limpiarNombre("  Merit   San Telmo ")).toBe("Merit San Telmo");
  });
});
