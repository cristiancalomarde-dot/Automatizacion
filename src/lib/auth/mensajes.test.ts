import { describe, expect, it } from "vitest";
import { esCodigoErrorLogin, obtenerMensajeErrorLogin } from "./mensajes";

describe("obtenerMensajeErrorLogin", () => {
  it.each([
    ["dominio", "Esta cuenta no pertenece a HI Travel."],
    ["auth", "No pudimos ingresar. Probá de nuevo."],
    ["sesion_vencida", "Tu sesión venció. Volvé a ingresar."],
  ])("mapea %s al texto fijo de marca.md/spec", (codigo, textoEsperado) => {
    expect(obtenerMensajeErrorLogin(codigo)).toBe(textoEsperado);
  });

  it("devuelve null si no hay código", () => {
    expect(obtenerMensajeErrorLogin(null)).toBeNull();
  });

  it("devuelve null ante un código desconocido (no inventa mensaje)", () => {
    expect(obtenerMensajeErrorLogin("cualquier-otra-cosa")).toBeNull();
  });
});

describe("esCodigoErrorLogin", () => {
  it("reconoce los tres códigos válidos", () => {
    expect(esCodigoErrorLogin("dominio")).toBe(true);
    expect(esCodigoErrorLogin("auth")).toBe(true);
    expect(esCodigoErrorLogin("sesion_vencida")).toBe(true);
  });

  it("rechaza null y strings arbitrarios", () => {
    expect(esCodigoErrorLogin(null)).toBe(false);
    expect(esCodigoErrorLogin("otro")).toBe(false);
  });
});
