import { describe, expect, it } from "vitest";
import { WORD_ARCH31 } from "./fixtures";
import { leerItinerario, parrafosDeDocumentXml } from "./word";

describe("lectura del itinerario del Word (spec M1-05 §3 #2-#3)", () => {
  it("ubica el tour por el código del título y lee nombre y noches", () => {
    const it8 = leerItinerario(WORD_ARCH31, "ARCH31");
    expect(it8).not.toBeNull();
    expect(it8!.nombre).toBe("Patagonia Highlights");
    expect(it8!.noches).toBe(8);
    expect(it8!.problemas).toEqual([]);
  });

  it("no confunde un código con otro que empieza igual (ARCH31R)", () => {
    expect(leerItinerario(["ARCH31R - PATAGONIA HIGHLIGHTS ", "DAY 1: El Chalten"], "ARCH31")).toBeNull();
  });

  it("lee los DAY N con su título y su texto, y corta en el tour siguiente", () => {
    const it8 = leerItinerario(WORD_ARCH31, "ARCH31")!;
    expect(it8.dias.map((d) => d.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(it8.dias[3].titulo).toBe("El Chalten - El Calafate:");
    expect(it8.dias[3].texto).toContain("8 am bus");
  });

  it("lee las estadías y los buses del What's Included, en orden, con su destino", () => {
    const it8 = leerItinerario(WORD_ARCH31, "ARCH31")!;
    expect(
      it8.items.map((i) => (i.tipo === "estadia" ? `${i.noches}n ${i.destino}` : `bus ${i.desde}-${i.hasta}`)),
    ).toEqual(["bus FTE-CHA", "3n CHA", "bus CHA-FTE", "3n FTE", "bus FTE-PNT", "2n PNT", "bus PNT-FTE"]);
  });

  it("toma las noches de un título en días: (7 DAYS) = 6 noches", () => {
    const r = leerItinerario(
      ["BOCHI04R- OVERLAND UYUNI TO SAN PEDRO DE ATACAMA BEGINNING IN LA PAZ (7 DAYS) ", "Included:", "Not included:"],
      "BOCHI04R",
    );
    expect(r!.noches).toBe(6);
  });

  it("acepta el título sin guion (CHB31 Overland … (6 nights))", () => {
    const r = leerItinerario(["CHB31 Overland San Pedro de Atacama to Uyuni, end in La Paz (6 nights)", "Included", "Not Included"], "CHB31");
    expect(r!.noches).toBe(6);
    expect(r!.nombre).toBe("Overland San Pedro de Atacama to Uyuni, end in La Paz");
  });

  it("marca nocturno el bus que el Included llama Night / PM / overnight", () => {
    const r = leerItinerario(
      [
        "X01- Prueba (3 nights)",
        "Included",
        "-PM Night Bus from La Paz to Uyuni",
        "PM Bus from Uyuni to La Paz",
        "-Night Bus from Valparaiso to Calama",
        "Bus from Calama to San Pedro de Atacama",
        "Not Included",
      ],
      "X01",
    )!;
    expect(r.items.map((i) => (i.tipo === "bus" ? [i.desde, i.hasta, i.nocturnoTexto] : null))).toEqual([
      ["LPB", "UYU", true],
      ["UYU", "LPB", true],
      ["VLP", "CJC", true],
      ["CJC", "SPA", false],
    ]);
  });

  it("las noches de un Overland ('1 night accommodation in Salt Hostel') van al destino del encabezado", () => {
    const r = leerItinerario(
      [
        "X02- Prueba (5 nights)",
        "Included",
        "3 nights Accommodation in San Pedro de Atacama at selected room",
        "San Pedro to Uyuni Overland including:",
        "1 night accommodation in Family Hostel Dorm or private DBL room",
        "1 night accommodation in Salt Hostel in Dorm or private DBL room.",
        "Not Included",
      ],
      "X02",
    )!;
    expect(r.items.map((i) => (i.tipo === "estadia" ? `${i.noches}n ${i.destino}` : "bus"))).toEqual([
      "3n SPA",
      "1n UYU",
      "1n UYU",
    ]);
  });

  it("si no hay What's Included lo deja como problema (no inventa)", () => {
    const r = leerItinerario(["X03- Prueba (2 nights)", "DAY 1: Mendoza", "X04- Otro (3 nights)"], "X03")!;
    expect(r.problemas.join(" ")).toMatch(/Included/);
  });

  it("arma los párrafos del document.xml (runs, entidades)", () => {
    const xml =
      '<w:body><w:p><w:r><w:t>AR08- Atlantic Patagonia </w:t></w:r><w:r><w:t xml:space="preserve">&amp; Glaciers</w:t></w:r></w:p>' +
      "<w:p><w:r><w:tab/><w:t>DAY 1: Buenos Aires</w:t></w:r></w:p><w:p></w:p></w:body>";
    expect(parrafosDeDocumentXml(xml)).toEqual(["AR08- Atlantic Patagonia & Glaciers", "DAY 1: Buenos Aires"]);
  });
});
