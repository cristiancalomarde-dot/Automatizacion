// Spec M3-06 filas 1 y 6: el nombre para la firma (qué se guarda) y cómo se
// muestra una persona del equipo (el de la firma, si no el nombre, si no lo
// previo a la @).
import { describe, expect, it } from "vitest";
import { TEXTOS } from "@/lib/textos";
import { MAX_NOMBRE_FIRMA, nombreVisible, normalizarNombreParaLaFirma } from "./nombre";

const M = TEXTOS.miFirma.motivos;

describe("nombreVisible (fila 6)", () => {
  it("prefiere el nombre para la firma, después el nombre y después lo previo a la @", () => {
    expect(nombreVisible({ nombre_firma: "Damián · Operaciones", nombre: "Damián Pérez", email: "dperez@hitravel.com.ar" })).toBe(
      "Damián · Operaciones",
    );
    expect(nombreVisible({ nombre_firma: null, nombre: "Damián Pérez", email: "dperez@hitravel.com.ar" })).toBe("Damián Pérez");
    expect(nombreVisible({ nombre_firma: " ", nombre: "", email: "dperez@hitravel.com.ar" })).toBe("dperez");
    expect(nombreVisible(null)).toBeNull();
  });
});

describe("normalizarNombreParaLaFirma (fila 1)", () => {
  it("limpia los espacios; vacío es null (vuelve al nombre de Google)", () => {
    expect(normalizarNombreParaLaFirma("  Damián   Pérez ")).toEqual({ ok: true, valor: "Damián Pérez" });
    expect(normalizarNombreParaLaFirma("   ")).toEqual({ ok: true, valor: null });
    expect(normalizarNombreParaLaFirma(undefined)).toEqual({ ok: true, valor: null });
  });

  it("igual al nombre de Google también es null: sigue al de la cuenta", () => {
    expect(normalizarNombreParaLaFirma("Damián Pérez", "Damián Pérez")).toEqual({ ok: true, valor: null });
  });

  it("muy largo, no", () => {
    expect(normalizarNombreParaLaFirma("x".repeat(MAX_NOMBRE_FIRMA + 1))).toEqual({ ok: false, error: M.largo });
    expect(normalizarNombreParaLaFirma("x".repeat(MAX_NOMBRE_FIRMA))).toEqual({ ok: true, valor: "x".repeat(MAX_NOMBRE_FIRMA) });
  });
});
