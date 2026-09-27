import { describe, expect, it } from "vitest";
import { leerSeccion1, nivelesDelResumen, textoDelBloque, ubicarBloques, ubicarDestino } from "./bloque";

// Spec M1-04 §3 #1, #2, #9, #10: ubicar el destino y los bloques de producto
// de la hoja "Analisis a Mayo 2026" y leer solo la sección 1.

/** Arma una grilla (filas × columnas, como la devuelve SheetJS) desde celdas "B3" → texto. */
function grilla(celdas: Record<string, string>): string[][] {
  const filas: string[][] = [];
  for (const [ref, valor] of Object.entries(celdas)) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
    const col = m[1].split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
    const fila = Number(m[2]) - 1;
    while (filas.length <= fila) filas.push([]);
    while (filas[fila].length <= col) filas[fila].push("");
    filas[fila][col] = valor;
  }
  for (const f of filas) while (f.length < 20) f.push("");
  return filas;
}

// Réplica chica del bloque real de Iguazú: dos productos lado a lado (B y J),
// sección 3 (resumen) en F/N, filas en blanco intercaladas, y otro destino abajo.
const HOJA = grilla({
  A3: "IGR",
  B3: "IGUAZU  OD010A",
  F3: "Iguazu Falls on a Shoestring Argentina OD010A",
  J3: "Foz do Iguacu OD010B",
  N3: "Iguazu Falls on a Shoestring Brasil OD010B",
  B4: "Tarifas",
  C4: "",
  F4: "Day 1",
  G4: "Puerto Iguazu Airport or Bus Station Pickup",
  B5: "Accommodation: Beer Hostel. Booking Supplier Beer Hostel",
  C5: "Netos USD",
  B6: "Dorm",
  C6: "19",
  B7: "DBL / SGL Alta temporada",
  C7: "65",
  // fila 8, 9: en blanco a propósito
  B10: "Accommodation Hotel 3* El Pueblito. Booking Supplier: Cuenca del Plata",
  B11: "DBL",
  C11: "77",
  B12: "Budget Hotel",
  B13: "Extra glamping x pax",
  F10: "Beer Hostel Dorm",
  F11: "Budget Hotel DBL",
  F12: "Hotel El Pueblito 3* sup  DBL ",
  F13: "Hotel La Aldea 4* SGL",
  F14: "Supplement private transfer p/person arriving to Foz do Iguazu, Brazil Side",
  // fila 13: en blanco
  B14: "Excursions",
  B15: "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata",
  C15: "70",
  B16: "Includes: Transfer in + Out, Excursion Cataratas Argentinas",
  B18: "Paquetes Iguazu Falls on a Shoestring Argentina p/person",
  B19: "Accommodation: No Debe Leerse. Booking Supplier: Seccion Dos",
  J4: "Tarifas",
  J5: "Accommodation: Bambu Hostel Foz / Tetris. Booking Supplier: Bambu Hostel Foz / Tetris",
  J6: "SGL / DBL Baja",
  J8: "Accommodation: Dann Inn Foz. Booking Supplier: Nacional Inn",
  J18: "Paquetes Iguazu Falls on a Shoestring Brazil p/person",
  A30: "MDZ",
  B30: "MENDOZA, Mountains and Wineries OD019",
  B31: "Accommodation: Otro Destino. Booking Supplier: Otro",
});

describe("ubicarDestino / ubicarBloques (spec M1-04 §3 #1)", () => {
  it("el destino IGR va desde su fila de encabezado hasta el próximo destino", () => {
    expect(ubicarDestino(HOJA, "IGR")).toEqual({ desde: 2, hasta: 29 });
    expect(ubicarDestino(HOJA, "XXX")).toBeNull();
  });

  it("encuentra solo los bloques de los códigos pedidos, con su columna de sección 1 y su nombre", () => {
    const rango = ubicarDestino(HOJA, "IGR")!;
    const { bloques, noEncontrados } = ubicarBloques(HOJA, rango, ["OD010A", "OD010B", "OD011", "OD019"]);
    expect(bloques.map((b) => [b.codigo, b.columna, b.nombre, b.destino])).toEqual([
      ["OD010A", 1, "Iguazu Falls on a Shoestring Argentina", "IGR"],
      ["OD010B", 9, "Iguazu Falls on a Shoestring Brasil", "IGR"],
    ]);
    // OD019 existe en la hoja pero en otro destino: no se toca. OD011 no está en esta réplica.
    expect(noEncontrados).toEqual(["OD011", "OD019"]);
  });

  it("\"OD010\" no confunde \"OD010A\" (el código se busca como palabra entera)", () => {
    const rango = ubicarDestino(HOJA, "IGR")!;
    expect(ubicarBloques(HOJA, rango, ["OD010"]).bloques).toEqual([]);
  });
});

describe("leerSeccion1 (spec M1-04 §3 #2, #9)", () => {
  const rango = ubicarDestino(HOJA, "IGR")!;
  const { bloques } = ubicarBloques(HOJA, rango, ["OD010A", "OD010B"]);

  it("lee los servicios de la sección 1 y se detiene en \"Paquetes…\" (sección 2 ignorada)", () => {
    const l = leerSeccion1(HOJA, bloques[0], rango);
    expect(l.estructuraOk).toBe(true);
    expect(l.servicios.map((s) => [s.fila, s.tipo, s.opciones[0].serviceProvider])).toEqual([
      [5, "alojamiento", "Beer Hostel"],
      [10, "alojamiento", "Hotel 3* El Pueblito"],
      [15, "excursion", "Paquete Receptvo 105 Premium"],
    ]);
  });

  it("filas en blanco entre servicios: ni servicios vacíos ni servicios salteados", () => {
    const l = leerSeccion1(HOJA, bloques[0], rango);
    expect(l.servicios).toHaveLength(3);
    expect(l.servicios.every((s) => s.opciones.every((o) => o.serviceProvider.length > 0))).toBe(true);
  });

  it("\"Includes: …\" queda como detalle del servicio anterior, no como servicio aparte", () => {
    const l = leerSeccion1(HOJA, bloques[0], rango);
    expect(l.servicios[2].descripcion).toBe(
      "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata\nIncludes: Transfer in + Out, Excursion Cataratas Argentinas",
    );
  });

  it("las líneas que no calzan quedan como dudosas, con su fila", () => {
    const l = leerSeccion1(HOJA, bloques[0], rango);
    expect(l.dudosas).toEqual([{ fila: 13, texto: "Extra glamping x pax", motivo: "no calza con ningún patrón conocido" }]);
  });

  it("una línea que es solo un nivel (\"Budget Hotel\") queda como nivel sin proveedor, no como servicio", () => {
    const l = leerSeccion1(HOJA, bloques[0], rango);
    expect(l.nivelesSinProveedor).toEqual([{ fila: 12, texto: "Budget Hotel", nivel: "Budget Hotel" }]);
    expect(l.servicios.map((s) => s.nivel)).toEqual(["Hostel", "Hotel 3*", null]);
  });

  it("niveles del resumen (sección 3): solo sus etiquetas, para controlar la sección 1", () => {
    const l = leerSeccion1(HOJA, bloques[0], rango);
    expect(bloques[0].columnaResumen).toBe(5);
    expect(nivelesDelResumen(HOJA, bloques[0], rango, l.filaFin)).toEqual([
      "Hostel",
      "Budget Hotel",
      "Hotel 3*",
      "Hotel 4*",
    ]);
  });

  it("bloque de al lado: opciones \"/\" y SP ≠ BS", () => {
    const l = leerSeccion1(HOJA, bloques[1], rango);
    expect(l.dudosas).toEqual([]);
    expect(l.servicios.map((s) => s.opciones.map((o) => `${o.prioridad}:${o.serviceProvider}>${o.bookingSupplier}`))).toEqual([
      ["1:Bambu Hostel Foz>Bambu Hostel Foz", "2:Tetris>Tetris"],
      ["1:Dann Inn Foz>Nacional Inn"],
    ]);
  });
});

describe("estructura que no calza — columnas corridas (spec M1-04 §3 #10)", () => {
  // El encabezado quedó en S, pero el cuerpo del bloque se corrió una columna (T).
  const CORRIDA = grilla({
    A3: "IGR",
    S3: "Iguazu Falls Combined (2 Nts ARG + 1 Nt BRA) OD010C",
    T4: "Tarifas",
    T5: "Accommodation 2 Nights Beer + 1 night Bambu. Booking Supplier Beer + Bambu",
    T6: "Dorm",
    T20: "Paquete Iguazu Combined 2 Nights Argentina 1 night Brazil",
  });
  const rango = ubicarDestino(CORRIDA, "IGR")!;
  const [bloque] = ubicarBloques(CORRIDA, rango, ["OD010C"]).bloques;

  it("la columna del encabezado no tiene ni servicios ni el fin de sección → estructuraOk = false", () => {
    const l = leerSeccion1(CORRIDA, bloque, rango);
    expect(l.estructuraOk).toBe(false);
    expect(l.servicios).toEqual([]);
  });

  it("el texto del bloque para la IA incluye las columnas vecinas (donde quedó el cuerpo corrido)", () => {
    const texto = textoDelBloque(CORRIDA, bloque, rango);
    expect(texto).toContain("Accommodation 2 Nights Beer + 1 night Bambu. Booking Supplier Beer + Bambu");
    expect(texto).toContain("OD010C");
  });
});
