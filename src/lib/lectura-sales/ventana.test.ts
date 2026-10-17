import { describe, expect, it } from "vitest";
import { DIAS_VENTANA, dentroDeLaVentana, desdeCuandoLeer, inicioDeLaVentana } from "./ventana";

describe("la ventana de lectura (criterio #9)", () => {
  const ahora = new Date("2026-10-16T15:00:00Z");

  it("son 7 días hacia atrás", () => {
    expect(DIAS_VENTANA).toBe(7);
    expect(inicioDeLaVentana(ahora).toISOString()).toBe("2026-10-09T15:00:00.000Z");
    expect(inicioDeLaVentana(ahora, 2).toISOString()).toBe("2026-10-14T15:00:00.000Z");
  });

  it("un mail de hace 6 días entra; uno de hace 10, no", () => {
    expect(dentroDeLaVentana(new Date("2026-10-10T09:00:00Z"), ahora)).toBe(true);
    expect(dentroDeLaVentana(new Date("2026-10-06T09:00:00Z"), ahora)).toBe(false);
  });

  it("los días tienen que ser un entero entre 1 y 60", () => {
    expect(() => inicioDeLaVentana(ahora, 0)).toThrow();
    expect(() => inicioDeLaVentana(ahora, 61)).toThrow();
    expect(() => inicioDeLaVentana(ahora, 1.5)).toThrow();
  });
});

describe("la fecha de arranque (owner, 2026-10-17)", () => {
  const ahora = new Date("2026-10-20T15:00:00Z");

  it("sin arranque, la ventana de siempre", () => {
    expect(desdeCuandoLeer(ahora, 7, null).toISOString()).toBe("2026-10-13T15:00:00.000Z");
  });

  it("con arranque dentro de la ventana, nada anterior al arranque", () => {
    const arranque = new Date("2026-10-17T16:00:00Z");
    expect(desdeCuandoLeer(ahora, 7, arranque).toISOString()).toBe("2026-10-17T16:00:00.000Z");
  });

  it("con arranque más viejo que la ventana, manda la ventana", () => {
    expect(desdeCuandoLeer(ahora, 7, new Date("2026-09-01T00:00:00Z")).toISOString()).toBe("2026-10-13T15:00:00.000Z");
  });
});
