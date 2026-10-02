import { describe, expect, it } from "vitest";
import {
  leerSeccion1,
  nivelesConPrecioEnResumen,
  nivelesDelResumen,
  ubicarBloques,
  ubicarBloquesEnHoja,
  ubicarDestino,
} from "./bloque";

// Spec M1-04c §3 #2 y Anexo técnico: en el Excel vigente (.xls) cada paquete
// tiene su código en el título del bloque, pero no siempre en la fila de
// encabezado del destino (ej. El Chaltén OD033 está más abajo, sin destino en
// la columna A). Se ubica el bloque por su código en toda la hoja; el código
// repetido en el mismo bloque (título, resumen, subtítulo de la sección 2) es
// un solo bloque; en dos bloques distintos, un duplicado; y si el código
// aparece solo, sin nombre, no es un título: se reporta, no se adivina.

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
  for (const f of filas) while (f.length < 30) f.push("");
  return filas;
}

const IGUAZU = {
  A3: "IGR",
  B3: "IGUAZU  OD010A",
  F3: "Iguazu Falls on a Shoestring Argentina OD010A",
  J3: "Foz do Iguacu OD010B",
  N3: "Iguazu Falls on a Shoestring Brasil OD010B",
  B5: "Accommodation: Beer Hostel. Booking Supplier Beer Hostel",
  B9: "Budget Hotel",
  B12: "Accommodation Hotel 3* El Pueblito. Booking Supplier: Cuenca del Plata",
  F9: "Net Prices:",
  F10: "Beer Hostel Dorm",
  G10: "167",
  F15: "Budget Hotel DBL",
  G15: "-",
  F17: "Hotel El Pueblito 3* sup DBL",
  G17: "248",
  B20: "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata",
  B24: "Paquetes Iguazu Falls on a Shoestring Argentina p/person",
  J5: "Accommodation: Dann Inn Foz. Booking Supplier: Nacional Inn",
  J25: "Paquetes Iguazu Falls on a Shoestring Brazil p/person",
};

const BUE = {
  A40: "BUE",
  B40: "BUENOS AIRES, TANGO CITY OD018",
  F41: "Buenos Aires, Tango City OD018",
  B42: "Accommodation: Milhouse Avenue. Booking Supplier: Milhouse",
  B43: "Dorm ensuite",
  B45: "Excursion: City Tour / Bike Tour. Booking Supplier: Grupo Summa / La Bicicleta Naranja",
  // Sección 2: el subtítulo repite el código (no es otro bloque).
  B48: "Buenos Aires, Tango City OD018",
  B49: "Accommodation: No Debe Leerse. Booking Supplier: Seccion Dos",
  // El Chaltén, más abajo, sin destino en la columna A.
  B60: "El Chalten Starter Package OD033",
  F62: "El Chalten Starter Package OD033",
  B63: "Accommodation: Rancho Grande. Booking Supplier: Chalten Travel",
  B66: "El Chalten Starter Package OD033",
  B67: "Accommodation: Tampoco. Booking Supplier: Seccion Dos",
};

const MDZ = {
  A80: "MDZ",
  B80: "MENDOZA, Mountains and Wineries OD019",
  F82: "Mendoza Mountains and Wineries OD019",
  B83: "Accommodation: Lagares Hostel. Booking Supplier: Lagares Hostel",
  // Sección 2 sin código ni "Paquetes": su título es el nombre del paquete.
  B88: "Mendoza Mountains and Wineries",
  B89: "Transfers: No Debe Leerse. Booking Supplier: Seccion Dos",
  // Un código que aparece solo, encima de una columna de costos (no es un título).
  A95: "CHB31",
  B95: "Overland Tour San Pedro - Uyuni",
  B96: "Net Rates",
  C96: "COMPBO20",
  D96: "COMPBO20",
  B97: "Overland Sab Pedro to Uyuni. Booking Supplier: Imperio Inca",
  // São Paulo: el resumen trae solo el código; su nombre y su tabla están a la izquierda.
  A110: "SSA",
  B110: "Sao Paulo Extra Night COMPBR10",
  F111: "Sao Paulo 2 nights Sample",
  G111: "COMPBR10",
  B112: "Accommodation: Fujima Hostel. Booking Supplier: Fujima Hostel",
  F113: "Hotel 3* DBL",
  G113: "77",
  B115: "Paquetes Sao Paulo",
};

const HOJA = grilla({ ...IGUAZU, ...BUE, ...MDZ });

function paquetes(...codigos: Array<[string, string]>) {
  return codigos.map(([codigo, destino]) => ({ codigo, destino }));
}

describe("ubicarBloquesEnHoja — el código en toda la hoja (spec M1-04c §3 #2)", () => {
  it("en Iguazú ubica lo mismo que ubicarBloques (el bloque, su sección 1, su resumen y su nombre)", () => {
    const rango = ubicarDestino(HOJA, "IGR")!;
    const viejos = ubicarBloques(HOJA, rango, ["OD010A", "OD010B"]).bloques;
    const { ubicados, noUbicados, duplicados } = ubicarBloquesEnHoja(HOJA, paquetes(["OD010A", "IGR"], ["OD010B", "IGR"]));
    expect(noUbicados).toEqual([]);
    expect(duplicados).toEqual([]);
    expect(ubicados.map((u) => u.bloque)).toEqual(viejos);
    expect(ubicados.map((u) => u.rango)).toEqual([rango, rango]);
    expect(ubicados.map((u) => [u.celda, u.destinoExcel])).toEqual([
      ["B3", "IGR"],
      ["J3", "IGR"],
    ]);
  });

  it("un bloque fuera de la fila del destino y sin destino en la columna A se encuentra igual", () => {
    const { ubicados } = ubicarBloquesEnHoja(HOJA, paquetes(["OD033", "CHA"]));
    expect(ubicados).toHaveLength(1);
    const [u] = ubicados;
    expect(u.celda).toBe("B60");
    expect(u.destinoExcel).toBeNull();
    expect(u.bloque).toMatchObject({
      codigo: "OD033",
      destino: "CHA",
      columna: 1,
      columnaResumen: 5,
      nombre: "El Chalten Starter Package",
    });
    expect(u.rango).toEqual({ desde: 59, hasta: 79 }); // hasta el próximo destino (MDZ, fila 80)
  });

  it("el resumen en otra fila que el título (F41 vs B40) es el mismo bloque", () => {
    const { ubicados, duplicados } = ubicarBloquesEnHoja(HOJA, paquetes(["OD018", "BUE"]));
    expect(duplicados).toEqual([]);
    expect(ubicados[0].bloque).toMatchObject({ columna: 1, columnaResumen: 5, nombre: "Buenos Aires, Tango City" });
  });

  it("si el resumen trae solo el código, el nombre y la tabla de precios son los de la celda de la izquierda", () => {
    const { ubicados } = ubicarBloquesEnHoja(HOJA, paquetes(["COMPBR10", "SAO"]));
    expect(ubicados[0].bloque).toMatchObject({ columna: 1, columnaResumen: 5, nombre: "Sao Paulo 2 nights Sample" });
    expect(ubicados[0].destinoExcel).toBe("SSA");
  });

  it("el código solo, sin nombre, no es un título: 'no encontrado', con dónde aparece y el texto de alrededor", () => {
    const { ubicados, noUbicados } = ubicarBloquesEnHoja(HOJA, paquetes(["COMPBO20", "UYU"]));
    expect(ubicados).toEqual([]);
    expect(noUbicados).toHaveLength(1);
    expect(noUbicados[0].codigo).toBe("COMPBO20");
    expect(noUbicados[0].motivo).toMatch(/solo el código/);
    expect(noUbicados[0].apariciones.map((a) => a.celda)).toEqual(["C96", "D96"]);
    expect(noUbicados[0].contexto.map((a) => a.texto)).toEqual(
      expect.arrayContaining([
        "Overland Tour San Pedro - Uyuni",
        "Overland Sab Pedro to Uyuni. Booking Supplier: Imperio Inca",
      ]),
    );
  });

  it("un código que no está en la hoja → 'no encontrado'", () => {
    const { noUbicados } = ubicarBloquesEnHoja(HOJA, paquetes(["OD099", "XXX"]));
    expect(noUbicados).toEqual([
      { codigo: "OD099", motivo: "el código no aparece en la hoja", apariciones: [], contexto: [] },
    ]);
  });

  it("el mismo código en dos bloques distintos → duplicado (se usa el primero y se reporta)", () => {
    const hoja = grilla({
      ...IGUAZU,
      AD3: "Otro paquete con el mismo código OD010A",
      AD5: "Accommodation: X. Booking Supplier: X",
    });
    const { ubicados, duplicados } = ubicarBloquesEnHoja(hoja, paquetes(["OD010A", "IGR"]));
    expect(ubicados.map((u) => u.celda)).toEqual(["B3"]);
    expect(duplicados).toEqual([{ codigo: "OD010A", celdaUsada: "B3", otrasCeldas: ["AD3"] }]);
  });
});

describe("leerSeccion1 — dónde termina la sección 1 en el Excel vigente (spec M1-04c)", () => {
  it("termina en la fila que repite el código del bloque (subtítulo de la sección 2)", () => {
    const [u] = ubicarBloquesEnHoja(HOJA, paquetes(["OD018", "BUE"])).ubicados;
    const l = leerSeccion1(HOJA, u.bloque, u.rango);
    expect(l.filaFin).toBe(47);
    expect(l.estructuraOk).toBe(true);
    expect(l.servicios.map((s) => s.fila)).toEqual([42, 45]);
  });

  it("termina en la fila que repite el nombre del paquete aunque no traiga el código", () => {
    const [u] = ubicarBloquesEnHoja(HOJA, paquetes(["OD019", "MDZ"])).ubicados;
    const l = leerSeccion1(HOJA, u.bloque, u.rango);
    expect(l.filaFin).toBe(87);
    expect(l.servicios.map((s) => s.fila)).toEqual([83]);
  });
});

describe("nivelesConPrecioEnResumen (spec M1-04c §3 #5)", () => {
  it("solo los niveles de la tabla de precios que tienen un precio de verdad (no '-' ni vacío)", () => {
    const [u] = ubicarBloquesEnHoja(HOJA, paquetes(["OD010A", "IGR"])).ubicados;
    const l = leerSeccion1(HOJA, u.bloque, u.rango);
    expect(nivelesDelResumen(HOJA, u.bloque, u.rango, l.filaFin)).toEqual(["Hostel", "Budget Hotel", "Hotel 3*"]);
    expect(nivelesConPrecioEnResumen(HOJA, u.bloque, u.rango, l.filaFin)).toEqual(["Hostel", "Hotel 3*"]);
  });
});
