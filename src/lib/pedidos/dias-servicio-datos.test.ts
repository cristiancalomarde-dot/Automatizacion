/**
 * Los días fijos que pidió el owner, leídos del archivo real `data/dias-servicio.csv`.
 * Owner (2026-10-22): en los paquetes de El Calafate el Perito Moreno va el día 2 de la
 * estadía (también dentro de los tours) y en AR34 el día 5.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCHIVO_DIAS, leerDiasServicio } from "./cargar";

const dias = leerDiasServicio(readFileSync(ARCHIVO_DIAS, "utf8"));
// La regla general (sin tour); las de un tour (M3-23) se prueban aparte.
const diaDe = (codigo: string, orden: number) => dias.find((d) => d.codigo === codigo && d.orden === orden && !d.tour)?.dia;
const diaEnTour = (tour: string, codigo: string, orden: number) => dias.find((d) => d.codigo === codigo && d.orden === orden && d.tour === tour)?.dia;

describe("reglas de un tour (M3-23, owner 2026-10-26)", () => {
  it("AR10: en El Calafate (OD013) Torres del Paine (7) el día 2 y Perito Moreno (6) el día 3; la regla general no cambia", () => {
    expect(diaEnTour("AR10", "OD013", 7)).toBe(2);
    expect(diaEnTour("AR10", "OD013", 6)).toBe(3);
    expect(diaDe("OD013", 6)).toBe(2);
    expect(diaDe("OD013", 7)).toBe(3);
  });

  it("solo AR10 tiene reglas propias", () => {
    expect([...new Set(dias.filter((d) => d.tour).map((d) => d.tour))]).toEqual(["AR10"]);
  });
});

describe("días fijos del Perito Moreno (data/dias-servicio.csv)", () => {
  it.each(["OD013", "OD014", "OD016"])("%s: el Perito Moreno (servicio 6) va el día 2", (codigo) => {
    expect(diaDe(codigo, 6)).toBe(2);
  });

  it("AR34: el Perito Moreno (servicio 10) va el día 5", () => {
    expect(diaDe("AR34", 10)).toBe(5);
  });

  // Owner (2026-10-22): City Tour o Bike Tour por defecto el día 2 de todo componente con noches en Buenos Aires.
  it.each(["OD018", "OD020"])("%s: el City Tour o el Bike Tour (servicio 5) va el día 2", (codigo) => {
    expect(diaDe(codigo, 5)).toBe(2);
  });

  // M3-17 (owner 2026-10-23, feedback de operaciones G3): el día de cada excursión en su destino.
  it.each([
    ["OD017", 4, 2],
    ["OD032", 4, 2],
    ["OD025", 5, 2],
    ["OD013", 7, 3],
    ["OD018", 7, 3],
    ["OD020", 7, 3],
    // Owner (2026-10-26, M3-23): en Ushuaia estaba al revés: Parque Nacional (6) el día 2 y Beagle / lobos marinos (5) el día 3.
    ["OD022", 6, 2],
    ["OD022", 5, 3],
    ["OD029", 4, 2],
  ] as const)("%s: la excursión del servicio %i va el día %i", (codigo, orden, dia) => {
    expect(diaDe(codigo, orden)).toBe(dia);
  });

  it("OD018: el Tango va por la noche", () => {
    expect(dias.find((d) => d.codigo === "OD018" && d.orden === 7)?.momento).toBe("por la noche");
  });

  it.each([
    ["OD010A", 4],
    ["OD010B", 5],
    ["OD010C", 7],
    ["OD011", 3],
  ] as const)("%s (servicio %i): Cataratas Argentinas el día 2 y Brasileras el día 3", (codigo, orden) => {
    const de = (servicio: string) => dias.find((d) => d.codigo === codigo && d.orden === orden && d.servicio === servicio)?.dia;
    expect(de("Cataratas Argentinas")).toBe(2);
    expect(de("Cataratas Brasileras")).toBe(3);
  });

  it("no hay dos reglas para el mismo servicio (o la misma excursión del servicio)", () => {
    // Con nombre de excursión (M3-15), la regla es por excursión: OD019 5 tiene Bodegas, Alta Montaña y Rafting.
    const claves = dias.map((d) => `${d.tour ?? ""}#${d.codigo}#${d.orden}#${d.servicio ?? ""}`);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
