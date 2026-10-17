import { describe, expect, it } from "vitest";
import { limpiarNombreJournaway, parsearNombres } from "./nombres";

// Spec M2-08 §3 #8: los nombres con que Journaway escribe cada producto.

describe("limpiarNombreJournaway", () => {
  it("saca los prefijos de lugar y de tipo, mayúsculas y acentos", () => {
    expect(limpiarNombreJournaway("San Pedro de Atacama: Tour through the Moon Valley")).toBe("tour through the moon valley");
    expect(limpiarNombreJournaway("From Foz do Iguaçu: Half-day tour to the Argentinean side of Iguazú Falls")).toBe(
      "half-day tour to the argentinean side of iguazu falls",
    );
    expect(limpiarNombreJournaway("Tour: San Pedro de Atacama: Astronomy Tour in the Atacama Desert")).toBe(
      "astronomy tour in the atacama desert",
    );
  });

  it("también los prefijos de los días del Overland y la numeración de la lista del mail", () => {
    expect(limpiarNombreJournaway("6) Tour: Siloli: Full-day tour to the Siloli Desert & the Black Lagoon")).toBe(
      "full-day tour to the siloli desert & the black lagoon",
    );
    expect(limpiarNombreJournaway("From San Pedro: Sol de Mañana Geysers, Licancabur Volcano & Laguna Colorada")).toBe(
      "sol de manana geysers, licancabur volcano & laguna colorada",
    );
  });

  it("espacios de más, espacios raros y punto final no cuentan", () => {
    expect(limpiarNombreJournaway("  Tour  to the Tatio Geysers. ")).toBe("tour to the tatio geysers");
    expect(limpiarNombreJournaway("Tour to the Quepiaco River, Monjes de la Pacana, and the salt flats")).toBe(
      limpiarNombreJournaway("Tour to the Quepiaco River, Monjes de la Pacana, and the Salt Flats"),
    );
  });

  it("lo que lleva números antes de los dos puntos no es un prefijo (Package 1 y Package 2 son distintos)", () => {
    expect(limpiarNombreJournaway("Package 1: Transfers & Excursions in Small Groups")).toBe(
      "package 1: transfers & excursions in small groups",
    );
  });

  it("un nombre sin prefijo queda igual, en minúsculas", () => {
    expect(limpiarNombreJournaway("Beagle Channel Boat Trip")).toBe("beagle channel boat trip");
  });
});

const ENCABEZADO = "codigo,nombre,origen,nota\n";

describe("parsearNombres (data/journaway-nombres.csv)", () => {
  it("lee cada nombre tal cual y su forma limpia", () => {
    const [n] = parsearNombres(`${ENCABEZADO}SPAE03,San Pedro de Atacama: Tour through the Moon Valley,mail de ejemplo,Mail SPAP05\n`);
    expect(n).toEqual({
      fila: 2,
      codigo: "SPAE03",
      nombre: "San Pedro de Atacama: Tour through the Moon Valley",
      limpio: "tour through the moon valley",
      origen: "mail de ejemplo",
    });
  });

  it("el mismo nombre limpio en dos productos → error (antes de escribir)", () => {
    expect(() =>
      parsearNombres(`${ENCABEZADO}SPAE03,Moon Valley Tour,tarifario,\nSPAE02,moon valley tour.,planilla,\n`),
    ).toThrow(/«moon valley tour».*SPAE03.*SPAE02/);
  });

  it("el mismo nombre dos veces en un producto se carga una vez", () => {
    const nombres = parsearNombres(`${ENCABEZADO}SPAE03,Moon Valley Tour,tarifario,\nSPAE03,Moon valley tour,planilla,\n`);
    expect(nombres).toHaveLength(1);
  });

  it("origen desconocido, nombre vacío o columna faltante → error con la fila", () => {
    expect(() => parsearNombres(`${ENCABEZADO}SPAE03,Moon Valley Tour,internet,\n`)).toThrow(/fila 2.*origen/);
    expect(() => parsearNombres(`${ENCABEZADO}SPAE03,,tarifario,\n`)).toThrow(/fila 2.*nombre/);
    expect(() => parsearNombres("codigo,nombre\nSPAE03,Moon\n")).toThrow(/faltan las columnas origen/);
  });
});
