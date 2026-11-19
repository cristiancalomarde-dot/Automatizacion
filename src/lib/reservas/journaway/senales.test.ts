import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogoJournawayDePrueba } from "../../../../tests/fixtures/journaway/catalogo";
import { leerSenalesJournaway, verificarSenales } from "./senales";

/** Las señales de Journaway (`data/journaway-senales.csv`, editable por el owner). */

const TEXTO = readFileSync(join(process.cwd(), "data", "journaway-senales.csv"), "utf-8");

describe("data/journaway-senales.csv", () => {
  it("declara los hoteles Tayka, los 3 días del Overland, los títulos con N/D, el aeropuerto, la nota de IGRE01 y lo que es parte del Overland", () => {
    const s = leerSenalesJournaway(TEXTO);
    expect(s.hotelesTayka).toEqual(["tayka del desierto", "tayka del sal", "tayka de sal"]);
    expect(s.diasOverland.map((d) => [d.dia, d.codigo])).toEqual([
      [1, "UYUO01"],
      // M3-52: el día 1 con ", and" (mail 66925083976).
      [1, "UYUO01"],
      [2, "UYUO01"],
      [3, "UYUO01"],
      // M3-30: los mismos días en alemán (mail Petzold).
      [1, "UYUO01"],
      [2, "UYUO01"],
      [3, "UYUO01"],
    ]);
    expect(s.familiaTayka.codigos).toEqual(["SPAP05", "SPAP06"]);
    expect(s.titulos.map((t) => t.codigo)).toEqual(["SPAP05", "SPAP06"]);
    expect(s.aeropuertos[0].iata).toBe("CJC");
    expect(s.notas[0]).toMatchObject({ codigo: "IGRE01", nota: "Journaway lo llama half-day; es el full day" });
    expect(s.partesDe).toEqual([
      { clave: "tayka del desierto", codigo: "UYUO01" },
      { clave: "tayka del sal", codigo: "UYUO01" },
      { clave: "tayka de sal", codigo: "UYUO01" },
      { clave: "night bus uyuni", codigo: "UYUO01" },
    ]);
    // M3-54: el traslado de Iguazú lleva el hotel al final (67734240405).
    expect(s.empiezaCon).toEqual([
      { clave: "shared transfer: igu -", codigo: "IGRT01" },
      // M3-59: el shuttle de Calama con el hotel (68296867683).
      { clave: "shared transport: cjc -", codigo: "SPAT01" },
    ]);
    expect(s.terminaCon).toEqual([{ clave: "- cjc", codigo: "SPAT01" }]);
  });

  it("M3-57: las palabras clave de un mail Tayka, con el día del Overland", () => {
    const s = leerSenalesJournaway(TEXTO);
    expect(s.clavesTayka.map((c) => [c.clave, c.codigo, c.dia])).toEqual([
      ["sol de manana", "UYUO01", 1],
      ["sol de manana geysire", "UYUO01", 1],
      ["siloli", "UYUO01", 2],
      ["tour to uyuni", "UYUO01", 3],
      ["tour nach uyuni", "UYUO01", 3],
      ["astronom", "SPAE01", null],
      ["moon valley", "SPAE03", null],
      ["quepiaco", "SPAE05", null],
      ["tatio", "SPAE04", null],
    ]);
  });

  it("M3-57: una palabra clave con un código que no existe frena; un día que no es número, también", () => {
    const roto = leerSenalesJournaway(TEXTO.replace("clave_tayka,Tatio,SPAE04", "clave_tayka,Tatio,SPAE99"));
    expect(() => verificarSenales(roto, catalogoJournawayDePrueba().catalogo)).toThrow(/el código SPAE99 no está en el catálogo/);
    expect(() => leerSenalesJournaway(TEXTO.replace("clave_tayka,Siloli,UYUO01,2", "clave_tayka,Siloli,UYUO01,dos"))).toThrow(/el día del Overland/);
  });

  it("todos sus códigos están en el catálogo", () => {
    expect(() => verificarSenales(leerSenalesJournaway(TEXTO), catalogoJournawayDePrueba().catalogo)).not.toThrow();
  });

  it("un código que no existe falla con un mensaje claro", () => {
    const roto = leerSenalesJournaway(TEXTO.replace("nota_tour,Half-day tour to the Argentinean side,IGRE01", "nota_tour,Half-day tour to the Argentinean side,IGRE99"));
    expect(() => verificarSenales(roto, catalogoJournawayDePrueba().catalogo)).toThrow(
      "data/journaway-senales.csv, fila 16: el código IGRE99 no está en el catálogo. No se procesó el mail.",
    );
  });

  it("una señal desconocida o un día del Overland sin número fallan al leer", () => {
    expect(() => leerSenalesJournaway(`${TEXTO}otra_cosa,x,,,\n`)).toThrow(/señal «otra_cosa» desconocida/);
    expect(() => leerSenalesJournaway(TEXTO.replace("UYUO01,1,", "UYUO01,,"))).toThrow(/falta el día/);
  });
});
