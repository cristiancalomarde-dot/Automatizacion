import { describe, expect, it, vi } from "vitest";
import { planificarProductos, type InterpretarBloque } from "./plan";

// Spec M1-04 §3 #1, #3, #10: de la hoja a "qué productos y servicios cargar",
// con reglas simples primero y la IA solo para lo que no calza.

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

const LIMPIO = {
  A3: "IGR",
  B3: "IGUAZU  OD010A",
  F3: "Iguazu Falls on a Shoestring Argentina OD010A",
  B5: "Accommodation: Beer Hostel. Booking Supplier Beer Hostel",
  B6: "Dorm",
  B10: "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata",
  B18: "Paquetes Iguazu Falls on a Shoestring Argentina p/person",
};

// Bloque con el cuerpo corrido una columna respecto del encabezado (S → T).
const CORRIDO = {
  S3: "Iguazu Falls Combined (2 Nts ARG + 1 Nt BRA) OD010C",
  T5: "Accommodation 2 Nights Beer + 1 night Bambu. Booking Supplier Beer + Bambu",
  T20: "Paquete Iguazu Combined 2 Nights Argentina 1 night Brazil",
};

const LINEA_CORRIDA = "Accommodation 2 Nights Beer + 1 night Bambu. Booking Supplier Beer + Bambu";
const CODIGOS = ["OD010A", "OD010C"];

describe("planificarProductos — reglas simples (spec M1-04 §3 #1, #3)", () => {
  it("un bloque limpio se resuelve sin llamar a la IA", async () => {
    const ia = vi.fn<InterpretarBloque>();
    const plan = await planificarProductos({
      filas: grilla(LIMPIO),
      destino: "IGR",
      codigos: ["OD010A"],
      interpretarIA: ia,
    });
    expect(ia).not.toHaveBeenCalled();
    expect(plan.productos).toHaveLength(1);
    expect(plan.productos[0]).toMatchObject({
      codigo: "OD010A",
      nombre: "Iguazu Falls on a Shoestring Argentina",
      destino: "IGR",
      origen: "reglas",
      bloqueParaRevisar: false,
    });
    expect(plan.productos[0].servicios).toHaveLength(2);
    expect(plan.bloquesQueNecesitanIA).toEqual([]);
  });

  it("destino inexistente → ningún producto (no se toca el resto de la hoja)", async () => {
    const plan = await planificarProductos({
      filas: grilla(LIMPIO),
      destino: "XXX",
      codigos: CODIGOS,
      interpretarIA: null,
    });
    expect(plan.productos).toEqual([]);
    expect(plan.destinoEncontrado).toBe(false);
    expect(plan.codigosNoEncontrados).toEqual(CODIGOS);
  });
});

describe("planificarProductos — columnas corridas: respaldo de IA (spec M1-04 §3 #10)", () => {
  const filas = grilla({ ...LIMPIO, ...CORRIDO });

  it("sin IA: el producto se crea igual pero queda 'para revisar', sin servicios inventados", async () => {
    const plan = await planificarProductos({ filas, destino: "IGR", codigos: CODIGOS, interpretarIA: null });
    const od010c = plan.productos.find((p) => p.codigo === "OD010C")!;
    expect(od010c).toMatchObject({ bloqueParaRevisar: true, servicios: [] });
    expect(od010c.nombre).toBe("Iguazu Falls Combined (2 Nts ARG + 1 Nt BRA)");
    expect(plan.bloquesQueNecesitanIA).toEqual(["OD010C"]);
  });

  it("con IA: le pasa el bloque puntual y usa su lectura si es confiable y literal", async () => {
    const ia = vi.fn<InterpretarBloque>(async () => ({
      servicios: [
        { linea: LINEA_CORRIDA, tipo: "alojamiento", opciones: [{ service_provider: "Beer", booking_supplier: "Beer" }] },
        { linea: LINEA_CORRIDA, tipo: "alojamiento", opciones: [{ service_provider: "Bambu", booking_supplier: "Bambu" }] },
      ],
      lineas_sin_servicio: [],
      confianza: 0.9,
    }));
    const plan = await planificarProductos({ filas, destino: "IGR", codigos: CODIGOS, interpretarIA: ia });

    expect(ia).toHaveBeenCalledTimes(1); // solo el bloque que no calza, no OD010A
    const consulta = ia.mock.calls[0][0];
    expect(consulta.codigo).toBe("OD010C");
    expect(consulta.lineasDudosas).toBeNull();
    expect(consulta.textoBloque).toContain("T5: Accommodation 2 Nights Beer");

    const od010c = plan.productos.find((p) => p.codigo === "OD010C")!;
    expect(od010c).toMatchObject({ origen: "ia", bloqueParaRevisar: false });
    expect(od010c.servicios.map((s) => s.opciones.map((o) => `${o.serviceProvider}>${o.bookingSupplier}`))).toEqual([
      ["Beer>Beer"],
      ["Bambu>Bambu"],
    ]);
    expect(od010c.servicios[0].descripcion).toBe(LINEA_CORRIDA);
  });

  it("con IA que inventa un proveedor que no está escrito en el bloque → se descarta, queda para revisar", async () => {
    const ia: InterpretarBloque = async () => ({
      servicios: [
        {
          linea: LINEA_CORRIDA,
          tipo: "alojamiento",
          opciones: [{ service_provider: "Hotel Inventado", booking_supplier: "Beer" }],
        },
      ],
      lineas_sin_servicio: [],
      confianza: 0.99,
    });
    const plan = await planificarProductos({ filas, destino: "IGR", codigos: CODIGOS, interpretarIA: ia });
    const od010c = plan.productos.find((p) => p.codigo === "OD010C")!;
    expect(od010c).toMatchObject({ bloqueParaRevisar: true, servicios: [] });
  });

  it("con IA de confianza baja (o que no responde: techo agotado) → para revisar", async () => {
    const respuestas: InterpretarBloque[] = [
      async () => ({ servicios: [], lineas_sin_servicio: [], confianza: 0.3 }),
      async () => null,
    ];
    for (const ia of respuestas) {
      const plan = await planificarProductos({ filas, destino: "IGR", codigos: CODIGOS, interpretarIA: ia });
      expect(plan.productos.find((p) => p.codigo === "OD010C")).toMatchObject({
        bloqueParaRevisar: true,
        servicios: [],
      });
    }
  });
});

describe("planificarProductos — líneas sueltas que no calzan (spec M1-04 §3 #10)", () => {
  const filas = grilla({ ...LIMPIO, B8: "Green + Dann Inn", B9: "Extra glamping x pax" });

  it("sin IA: el resto del bloque se carga por reglas y esas líneas quedan para revisar", async () => {
    const plan = await planificarProductos({ filas, destino: "IGR", codigos: ["OD010A"], interpretarIA: null });
    const p = plan.productos[0];
    expect(p.servicios).toHaveLength(2);
    expect(p.bloqueParaRevisar).toBe(false);
    expect(p.lineasParaRevisar.map((l) => [l.fila, l.texto])).toEqual([
      [8, "Green + Dann Inn"],
      [9, "Extra glamping x pax"],
    ]);
    expect(plan.bloquesQueNecesitanIA).toEqual(["OD010A"]);
  });

  it("con IA: solo se le preguntan esas líneas; lo que interpreta se suma en su lugar y lo demás se conserva", async () => {
    const ia = vi.fn<InterpretarBloque>(async () => ({
      servicios: [
        {
          linea: "Green + Dann Inn",
          tipo: "alojamiento",
          opciones: [{ service_provider: "Green", booking_supplier: null }],
        },
      ],
      lineas_sin_servicio: ["Extra glamping x pax"],
      confianza: 0.85,
    }));
    const plan = await planificarProductos({ filas, destino: "IGR", codigos: ["OD010A"], interpretarIA: ia });
    expect(ia.mock.calls[0][0].lineasDudosas).toEqual(["Green + Dann Inn", "Extra glamping x pax"]);
    const p = plan.productos[0];
    expect(p.origen).toBe("reglas+ia");
    expect(p.servicios.map((s) => [s.fila, s.opciones[0].serviceProvider])).toEqual([
      [5, "Beer Hostel"],
      [8, "Green"],
      [10, "Paquete Receptvo 105 Premium"],
    ]);
    expect(p.lineasParaRevisar).toEqual([]);
    expect(plan.lineasDescartadasPorIA).toEqual([{ codigo: "OD010A", fila: 9, texto: "Extra glamping x pax" }]);
  });
});

describe("planificarProductos — niveles de alojamiento (pedido del owner, 2026-09-27)", () => {
  // Réplica de la columna B de OD010A + su resumen (F) y de S de OD010C + su resumen (W).
  const filas = grilla({
    A3: "IGR",
    B3: "IGUAZU  OD010A",
    F3: "Iguazu Falls on a Shoestring Argentina OD010A",
    S3: "Iguazu Falls Combined (2 Nts ARG + 1 Nt BRA) OD010C",
    W3: "Iguazu Falls Combined (2 Nts ARG + 1 Nt BRA) OD010C",
    B5: "Accommodation: Beer Hostel. Booking Supplier Beer Hostel",
    B6: "Dorm",
    B9: "Budget Hotel ",
    B12: "Accommodation Hotel 3* El Pueblito 7  Botanica. Booking Supplier: Cuenca del Plata",
    B15: "Accommodation Hotel 4*: La Aldea de la Selva. Booking Supplier: Cuenca del Plata",
    B20: "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata",
    B24: "Paquetes Iguazu Falls on a Shoestring Argentina p/person",
    F10: "Beer Hostel Dorm",
    F15: "Budget Hotel DBL",
    F17: "Hotel El Pueblito 3* sup  DBL ",
    F19: "Hotel La Aldea 4*  DBL ",
    S5: "Accommodation 2 Nights Beer + 1 night Bambu. Booking Supplier Beer + Bambu",
    S12: "Accommodation: 2 Nights El Pueblito + 1 night Nacional inn Foz. Booking Supplier: Cuenca del Plana + Nacional Inn",
    S20: "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata",
    S24: "Paquete Iguazu Combined 2 Nights Argentina 1 night Brazil",
    W10: "Beer + Bambu Dorm",
    W17: "Hotel 3*  DBL ",
  });

  it("OD010A: 3 niveles de alojamiento con su etiqueta y sus propios proveedores (no son prioridad \"/\")", async () => {
    const plan = await planificarProductos({ filas, destino: "IGR", codigos: ["OD010A"], interpretarIA: null });
    const alojamientos = plan.productos[0].servicios.filter((s) => s.tipo === "alojamiento");
    expect(
      alojamientos.map((s) => [s.nivel, s.opciones.length, s.opciones[0].serviceProvider, s.opciones[0].bookingSupplier]),
    ).toEqual([
      ["Hostel", 1, "Beer Hostel", "Beer Hostel"],
      ["Hotel 3*", 2, "Hotel 3* El Pueblito", "Cuenca del Plata"],
      ["Hotel 4*", 1, "Hotel 4*: La Aldea de la Selva", "Cuenca del Plata"],
    ]);
  });

  it("OD010A: nivel 3* \"El Pueblito 7 Botanica\" → 2 opciones en orden (el \"7\" es una \"/\" mal tipeada, owner)", async () => {
    const plan = await planificarProductos({ filas, destino: "IGR", codigos: ["OD010A"], interpretarIA: null });
    const p = plan.productos[0];
    const nivel3 = p.servicios.filter((s) => s.nivel === "Hotel 3*");
    expect(nivel3).toHaveLength(1);
    expect(nivel3[0].opciones).toEqual([
      { prioridad: 1, serviceProvider: "Hotel 3* El Pueblito", bookingSupplier: "Cuenca del Plata" },
      { prioridad: 2, serviceProvider: "Botanica", bookingSupplier: "Cuenca del Plata" },
    ]);
    expect(p.correcciones).toEqual([
      { fila: 12, texto: "Accommodation Hotel 3* El Pueblito 7 Botanica. Booking Supplier: Cuenca del Plata", correccion: "\"7\" leído como \"/\"" },
    ]);
  });

  it("OD010A: Budget Hotel figura solo en la tabla de precios → nivel NO ofrecido (ni se carga ni va a revisar)", async () => {
    const plan = await planificarProductos({ filas, destino: "IGR", codigos: ["OD010A"], interpretarIA: null });
    const p = plan.productos[0];
    expect(p.servicios.some((s) => s.nivel === "Budget Hotel")).toBe(false);
    expect(p.nivelesNoOfrecidos).toEqual(["Budget Hotel"]);
    expect(p.nivelesParaRevisar).toEqual([]);
    expect(p.lineasParaRevisar).toEqual([]); // es un patrón conocido, no hace falta la IA
    expect(plan.bloquesQueNecesitanIA).toEqual([]);
  });

  it("OD010C: 2 hoteles por nivel (\"2 Nights X + 1 night Y\") → 2 alojamientos de la misma línea/nivel; sin etiqueta escrita → para revisar", async () => {
    const plan = await planificarProductos({ filas, destino: "IGR", codigos: ["OD010C"], interpretarIA: null });
    const p = plan.productos[0];
    const alojamientos = p.servicios.filter((s) => s.tipo === "alojamiento");
    expect(alojamientos.map((s) => [s.fila, s.noches, s.opciones[0].serviceProvider, s.nivel])).toEqual([
      [5, 2, "Beer", null],
      [5, 1, "Bambu", null],
      [12, 2, "El Pueblito", null],
      [12, 1, "Nacional inn Foz", null],
    ]);
    // "Hotel 3*" del resumen puede ser una de esas líneas sin etiqueta: no se lo da por no ofrecido.
    expect(p.nivelesParaRevisar.map((n) => [n.nivel, n.fila, n.motivo])).toEqual([
      [null, 5, "alojamiento sin etiqueta de nivel escrita en la línea"],
      [null, 12, "alojamiento sin etiqueta de nivel escrita en la línea"],
      ["Hotel 3*", null, "nivel del resumen que puede corresponder a una línea de alojamiento sin etiqueta"],
    ]);
    expect(p.nivelesNoOfrecidos).toEqual([]);
  });
});
