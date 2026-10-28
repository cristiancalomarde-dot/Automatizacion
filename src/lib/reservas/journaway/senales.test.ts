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
  });

  it("todos sus códigos están en el catálogo", () => {
    expect(() => verificarSenales(leerSenalesJournaway(TEXTO), catalogoJournawayDePrueba().catalogo)).not.toThrow();
  });

  it("un código que no existe falla con un mensaje claro", () => {
    const roto = leerSenalesJournaway(TEXTO.replace("nota_tour,Half-day tour to the Argentinean side,IGRE01", "nota_tour,Half-day tour to the Argentinean side,IGRE99"));
    expect(() => verificarSenales(roto, catalogoJournawayDePrueba().catalogo)).toThrow(
      "data/journaway-senales.csv, fila 15: el código IGRE99 no está en el catálogo. No se procesó el mail.",
    );
  });

  it("una señal desconocida o un día del Overland sin número fallan al leer", () => {
    expect(() => leerSenalesJournaway(`${TEXTO}otra_cosa,x,,,\n`)).toThrow(/señal «otra_cosa» desconocida/);
    expect(() => leerSenalesJournaway(TEXTO.replace("UYUO01,1,", "UYUO01,,"))).toThrow(/falta el día/);
  });
});
