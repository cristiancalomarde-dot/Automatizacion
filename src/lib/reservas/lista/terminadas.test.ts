// Spec M3-08 filas 5 y 6: qué es un viaje terminado (fin del viaje antes de
// hoy, hora Argentina) y quién es administradora (ADMINS_EMAILS).
import { describe, expect, it } from "vitest";
import { esAdministradora, esTerminada, hoyEnArgentina } from "./terminadas";

describe("M3-08 — hoy en Argentina", () => {
  it("usa la fecha de Buenos Aires (UTC-3), no la del servidor", () => {
    // 2026-10-21 01:30 UTC = 2026-10-20 22:30 en Argentina.
    expect(hoyEnArgentina(new Date("2026-10-21T01:30:00Z"))).toBe("2026-10-20");
    expect(hoyEnArgentina(new Date("2026-10-21T03:00:00Z"))).toBe("2026-10-21");
  });
});

describe("M3-08 fila 5 — viaje terminado", () => {
  const hoy = "2026-10-20";
  it("terminó si su fin es anterior a hoy", () => {
    expect(esTerminada({ fechaFin: "2026-10-19" }, hoy)).toBe(true);
  });
  it("hoy todavía viaja: no terminó", () => {
    expect(esTerminada({ fechaFin: "2026-10-20" }, hoy)).toBe(false);
    expect(esTerminada({ fechaFin: "2026-11-01" }, hoy)).toBe(false);
  });
  it("sin fecha de fin no se esconde (nunca se adivina)", () => {
    expect(esTerminada({ fechaFin: null }, hoy)).toBe(false);
  });
});

describe("M3-08 fila 6 — administradoras (ADMINS_EMAILS)", () => {
  it("una lista separada por comas, sin importar espacios ni mayúsculas", () => {
    const lista = " Owner@HiTravel.com.ar , otra@hitravel.com.ar";
    expect(esAdministradora("owner@hitravel.com.ar", lista)).toBe(true);
    expect(esAdministradora("OTRA@hitravel.com.ar", lista)).toBe(true);
    expect(esAdministradora("leticia@hitravel.com.ar", lista)).toBe(false);
  });
  it("sin variable, sin mail o con la lista vacía: nadie es administradora", () => {
    expect(esAdministradora("owner@hitravel.com.ar", undefined)).toBe(false);
    expect(esAdministradora("owner@hitravel.com.ar", " , ")).toBe(false);
    expect(esAdministradora(null, "owner@hitravel.com.ar")).toBe(false);
    expect(esAdministradora("", ",")).toBe(false);
  });
});
