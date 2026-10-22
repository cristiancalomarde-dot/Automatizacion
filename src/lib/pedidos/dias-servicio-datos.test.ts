/**
 * Los días fijos que pidió el owner, leídos del archivo real `data/dias-servicio.csv`.
 * Owner (2026-10-22): en los paquetes de El Calafate el Perito Moreno va el día 2 de la
 * estadía (también dentro de los tours) y en AR34 el día 5.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCHIVO_DIAS, leerDiasServicio } from "./cargar";

const dias = leerDiasServicio(readFileSync(ARCHIVO_DIAS, "utf8"));
const diaDe = (codigo: string, orden: number) => dias.find((d) => d.codigo === codigo && d.orden === orden)?.dia;

describe("días fijos del Perito Moreno (data/dias-servicio.csv)", () => {
  it.each(["OD013", "OD014", "OD016"])("%s: el Perito Moreno (servicio 6) va el día 2", (codigo) => {
    expect(diaDe(codigo, 6)).toBe(2);
  });

  it("AR34: el Perito Moreno (servicio 10) va el día 5", () => {
    expect(diaDe("AR34", 10)).toBe(5);
  });

  it("no hay dos reglas para el mismo servicio (o la misma excursión del servicio)", () => {
    // Con nombre de excursión (M3-15), la regla es por excursión: OD019 5 tiene Bodegas, Alta Montaña y Rafting.
    const claves = dias.map((d) => `${d.codigo}#${d.orden}#${d.servicio ?? ""}`);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
