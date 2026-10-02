import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { diagnosticarPaquetes, sugerirProveedores } from "./diagnostico";
import { parsearPaquetesPiloto } from "./paquetes-piloto";

// Spec M1-04c §3 #1, #3, #4, #5, #8: el diagnóstico corre todo el análisis
// (bloques, servicios, niveles, prioridades, emparejado contra el directorio y
// las equivalencias) sin escribir nada, sobre la lista de códigos del CSV.

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

const HOJA = grilla({
  A3: "BUE",
  B3: "BUENOS AIRES, TANGO CITY OD018",
  F4: "Buenos Aires, Tango City OD018",
  B5: "Accommodation: Milhouse Avenue. Booking Supplier: Milhouse",
  B6: "Dorm ensuite",
  B7: "Accommodation: Merit San Telmo / Loi Flats. Booking Supplier: Merit / Loi Suites",
  B8: "DBL",
  B9: "Accommodation: Hotel 4* Grand Brizo. Booking Supplier: Alvarez Arguelles",
  B11: "Excursion: City Tour / Bike Tour. Booking Supplier: Grupo Summa / La Bicicleta Naranja",
  B12: "Transfers: Remis. Booking Booking Supplier: Remis",
  B13: "Excursions en Natales",
  F10: "Net Prices:",
  F11: "Milhouse Hostel Dorm",
  G11: "200",
  F12: "Hotel 3* Merit DBL",
  G12: "300",
  F13: "Hotel 4* Brizo DBL",
  G13: "400",
  B16: "Buenos Aires, Tango City OD018",
  // Otro paquete del mismo destino, a la derecha.
  R3: "BUENOS AIRES + Uruguay OD020",
  V4: "BUENOS AIRES + Uruguay OD020",
  R5: "Accommodation: Hostel Milhouse Avenue. Booking Supplier: Milhouse",
  R6: "Excursion: Colonia Day Trip. Booking Supplier: Buquebus",
  V11: "Hostel Dorm",
  W11: "200",
  V12: "Budget Hotel DBL",
  W12: "250",
  R16: "BUENOS AIRES + Uruguay OD020",
  // Un tercero que NO está en la lista: no se toca.
  AH3: "Otro paquete OD021",
  AH5: "Accommodation: Hostel X. Booking Supplier: Nadie",
  AH8: "Paquetes otro",
  A30: "MDZ",
});

const DIRECTORIO = [
  { id: "p-summa", nombre: "Grupo Summa", nombre_normalizado: "grupo summa", ciudad: "BUENOS AIRES" },
  { id: "p-naranja", nombre: "La Bicicleta Naranja", nombre_normalizado: "la bicicleta naranja", ciudad: "BUENOS AIRES" },
  { id: "p-milhouse", nombre: "Milhouse Hostel Avenue", nombre_normalizado: "milhouse hostel avenue", ciudad: "BUENOS AIRES" },
  { id: "p-merit", nombre: "Merit San Telmo", nombre_normalizado: "merit san telmo", ciudad: "BUENOS AIRES" },
  { id: "p-buquebus", nombre: "Buquebus", nombre_normalizado: "buquebus", ciudad: "BUENOS AIRES" },
  { id: "p-otro", nombre: "Cuenca Del Plata (Natalia )", nombre_normalizado: "cuenca del plata (natalia )", ciudad: "IGUAZU" },
];
const ALIAS = [
  { alias_normalizado: "alvarez arguelles", proveedor_id: "p-otro", estado: "confirmado", nota: null },
  { alias_normalizado: "loi suites", proveedor_id: null, estado: "para_revisar", nota: "Se reserva por WhatsApp" },
];

/** Supabase falso: responde por la tabla de la URL; registra el método de cada pedido. */
function supabaseFalso(tablas: Record<string, unknown[]>) {
  const metodos: string[] = [];
  const fetchFalso = vi.fn(async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    metodos.push((opciones?.method ?? "GET").toUpperCase());
    const url = new URL(String(entrada));
    const tabla = url.pathname.split("/").pop()!;
    return new Response(JSON.stringify(tablas[tabla] ?? []), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const admin = createClient("http://localhost:54321", "clave-falsa-de-test", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchFalso as unknown as typeof fetch },
  });
  return { admin, metodos };
}

async function correr(csv: string, extra: { producto?: unknown[]; omitirCargados?: boolean } = {}) {
  const { admin, metodos } = supabaseFalso({ proveedor: DIRECTORIO, proveedor_alias: ALIAS, producto: extra.producto ?? [] });
  const d = await diagnosticarPaquetes({
    admin,
    filas: HOJA,
    archivo: "paquetes.xls",
    paquetes: parsearPaquetesPiloto(csv),
    omitirCargados: extra.omitirCargados,
  });
  return { d, metodos };
}

describe("diagnosticarPaquetes — la lista sale del CSV (spec M1-04c §3 #1)", () => {
  it("con un CSV de 2 códigos procesa exactamente esos 2, en ese orden", async () => {
    const { d } = await correr("codigo,destino\nOD020,BUE\nOD018,BUE\n");
    expect(d.paquetes.map((p) => p.codigo)).toEqual(["OD020", "OD018"]);
    expect(d.paquetes.every((p) => p.encontrado)).toBe(true);
  });

  it("omitirCargados: salta los que ya están en la base y lo informa", async () => {
    const { d } = await correr("codigo,destino\nOD020,BUE\nOD018,BUE\n", {
      producto: [{ codigo: "OD020" }],
      omitirCargados: true,
    });
    expect(d.paquetes.map((p) => p.codigo)).toEqual(["OD018"]);
    expect(d.omitidosPorYaCargados).toEqual(["OD020"]);
  });
});

describe("diagnosticarPaquetes — solo leer (spec M1-04c §3 #3)", () => {
  it("todos los pedidos a la base son lecturas (GET/HEAD)", async () => {
    const { metodos } = await correr("codigo,destino\nOD018,BUE\n");
    expect(metodos.length).toBeGreaterThan(0);
    expect(metodos.every((m) => m === "GET" || m === "HEAD")).toBe(true);
  });
});

describe("diagnosticarPaquetes — servicios, niveles y emparejado (spec M1-04c §3 #4)", () => {
  it("cada opción trae su Service Provider y Booking Supplier del Excel y cómo emparejó", async () => {
    const { d } = await correr("codigo,destino\nOD018,BUE\n");
    const [p] = d.paquetes;
    expect(p).toMatchObject({ codigo: "OD018", nombre: "Buenos Aires, Tango City", celda: "B3", destinoExcel: "BUE" });
    const opciones = p.servicios.flatMap((s) =>
      s.opciones.map((o) => [s.fila, o.prioridad, o.serviceProvider, o.bookingSupplier, o.emparejado]),
    );
    expect(opciones).toEqual([
      [5, 1, "Milhouse Avenue", "Milhouse", "sin_emparejar"],
      [7, 1, "Merit San Telmo", "Merit", "sin_emparejar"],
      [7, 2, "Loi Flats", "Loi Suites", "sin_emparejar"],
      [9, 1, "Hotel 4* Grand Brizo", "Alvarez Arguelles", "por_equivalencia"],
      [11, 1, "City Tour", "Grupo Summa", "exacto"],
      [11, 2, "Bike Tour", "La Bicicleta Naranja", "exacto"],
      [13, 1, "en Natales", null, "sin_booking_supplier"],
    ]);
    const brizo = p.servicios.find((s) => s.fila === 9)!.opciones[0];
    expect(brizo.proveedorDirectorio).toBe("Cuenca Del Plata (Natalia )");
    const loi = p.servicios.find((s) => s.fila === 7)!.opciones[1];
    expect(loi.nota).toBe("Se reserva por WhatsApp");
  });

  it("los niveles salen de la línea; la que no dice nivel queda sin nivel", async () => {
    const { d } = await correr("codigo,destino\nOD018,BUE\n");
    expect(d.paquetes[0].servicios.filter((s) => s.tipo === "alojamiento").map((s) => [s.fila, s.nivel])).toEqual([
      [5, null],
      [7, null],
      [9, "Hotel 4*"],
    ]);
  });
});

describe("diagnosticarPaquetes — lo que necesito que confirmes (spec M1-04c §3 #5)", () => {
  it("Booking Suppliers sin emparejar: una vez cada nombre, con en qué paquetes aparece", async () => {
    const { d } = await correr("codigo,destino\nOD018,BUE\nOD020,BUE\n");
    const nombres = d.aConfirmar.proveedoresSinEmparejar.map((p) => p.nombre);
    expect(nombres).toEqual(["Loi Suites", "Merit", "Milhouse"]);
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(d.aConfirmar.proveedoresSinEmparejar.find((p) => p.nombre === "Milhouse")!.paquetes).toEqual(["OD018", "OD020"]);
    expect(d.aConfirmar.proveedoresSinEmparejar.find((p) => p.nombre === "Loi Suites")!.nota).toBe("Se reserva por WhatsApp");
  });

  it("sugiere hasta 3 candidatos del directorio por parecido, marcados como sugerencia", async () => {
    const { d } = await correr("codigo,destino\nOD018,BUE\n");
    const milhouse = d.aConfirmar.proveedoresSinEmparejar.find((p) => p.nombre === "Milhouse")!;
    expect(milhouse.sugerencias.length).toBeLessThanOrEqual(3);
    expect(milhouse.sugerencias[0]).toMatchObject({ nombre: "Milhouse Hostel Avenue", ciudad: "BUENOS AIRES" });
    const merit = d.aConfirmar.proveedoresSinEmparejar.find((p) => p.nombre === "Merit")!;
    expect(merit.sugerencias[0].nombre).toBe("Merit San Telmo");
    // La sugerencia nunca se aplica: el servicio sigue sin emparejar.
    expect(d.paquetes[0].servicios.find((s) => s.fila === 5)!.opciones[0].emparejado).toBe("sin_emparejar");
  });

  it("servicios sin Booking Supplier, alojamientos sin nivel (con los niveles de la tabla) y renglones que no entiendo", async () => {
    const { d } = await correr("codigo,destino\nOD018,BUE\n");
    expect(d.aConfirmar.serviciosSinBookingSupplier).toEqual([
      { linea: "Excursions en Natales", donde: [{ codigo: "OD018", fila: 13 }] },
    ]);
    expect(d.aConfirmar.alojamientosSinNivel).toEqual([
      {
        codigo: "OD018",
        lineas: [
          { fila: 5, texto: "Accommodation: Milhouse Avenue. Booking Supplier: Milhouse" },
          { fila: 7, texto: "Accommodation: Merit San Telmo / Loi Flats. Booking Supplier: Merit / Loi Suites" },
        ],
        nivelesDeLaTabla: ["Hostel", "Hotel 3*"],
      },
    ]);
    expect(d.aConfirmar.lineasNoEntendidas).toEqual([
      {
        texto: "Transfers: Remis. Booking Booking Supplier: Remis",
        motivo: "\"Booking Supplier\" mal escrito",
        donde: [{ codigo: "OD018", fila: 12 }],
      },
    ]);
  });

  it("un nivel con precio en la tabla pero sin línea de alojamiento se pregunta", async () => {
    const { d } = await correr("codigo,destino\nOD020,BUE\n");
    // OD020: la única línea de alojamiento dice "Hostel"; la tabla tiene "Budget Hotel" con precio.
    expect(d.aConfirmar.nivelesSoloEnPrecios).toEqual([{ codigo: "OD020", nivel: "Budget Hotel" }]);
  });

  it("bloques no encontrados y destinos a confirmar", async () => {
    const { d } = await correr("codigo,destino\nOD018,BUE\nOD099,XXX\nOD020,URU\n");
    expect(d.aConfirmar.bloquesNoEncontrados).toEqual([
      { codigo: "OD099", motivo: "el código no aparece en la hoja", apariciones: [], contexto: [] },
    ]);
    expect(d.paquetes.find((p) => p.codigo === "OD099")).toMatchObject({ encontrado: false, servicios: [] });
    expect(d.aConfirmar.destinosAConfirmar).toEqual([{ codigo: "OD020", destinoLista: "URU", destinoExcel: "BUE" }]);
  });
});

describe("diagnosticarPaquetes — sin IA (spec M1-04c §3 #8)", () => {
  it("lista los bloques y líneas que habrían necesitado IA, sin llamarla", async () => {
    const { d } = await correr("codigo,destino\nOD018,BUE\nOD020,BUE\n");
    expect(d.habriaNecesitadoIA).toEqual([
      { codigo: "OD018", bloqueEntero: false, lineas: [{ fila: 12, texto: "Transfers: Remis. Booking Booking Supplier: Remis" }] },
    ]);
  });
});

describe("sugerirProveedores", () => {
  it("ordena por parecido, como máximo 3, y deja afuera lo que no se parece", () => {
    const s = sugerirProveedores("Dazzler", [
      { id: "1", nombre: "Dazzler Maipu", nombre_normalizado: "dazzler maipu", ciudad: "BUENOS AIRES" },
      { id: "2", nombre: "Dazzler Puerto Madryn", nombre_normalizado: "dazzler puerto madryn", ciudad: "PUERTO MADRYN" },
      { id: "3", nombre: "Hotel Dazzler San Martin", nombre_normalizado: "hotel dazzler san martin", ciudad: "BUENOS AIRES" },
      { id: "4", nombre: "Dazzler Tower", nombre_normalizado: "dazzler tower", ciudad: "BUENOS AIRES" },
      { id: "5", nombre: "Cuenca del Plata", nombre_normalizado: "cuenca del plata", ciudad: "IGUAZU" },
    ]);
    expect(s).toHaveLength(3);
    expect(s.map((x) => x.nombre)).not.toContain("Cuenca del Plata");
    expect(s.every((x) => x.nombre.includes("Dazzler"))).toBe(true);
  });
});
