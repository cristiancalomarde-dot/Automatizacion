import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { diagnosticarPaquetes } from "@/lib/importador-productos/diagnostico";
import { parsearEquivalencias } from "@/lib/importador-productos/equivalencias";
import { leerFilasPaquetes } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { crearIndiceProveedores } from "@/lib/importador-productos/proveedores";
import { armarPedidos } from "@/lib/pedidos/armar";
import { catalogoCon, componente, parte, producto, reserva } from "@/lib/pedidos/fixtures.test-utils";
import { cargarPlantilla } from "@/lib/pedidos/plantilla";
import { armarTour, type EntradaArmado, type PaqueteConocido, type TourArmado } from "./armado";
import { destinoDeEncabezado, nombreDestino, primeraCiudad } from "./ciudades";
import { parsearIncluidosTour, parsearTramosConProveedor, type IncluidoTour } from "./datos";
import { fila } from "./fixtures";
import { resolverProveedorTramo } from "./proveedor-tramo";
import { leerTourRutas } from "./rutas";
import { leerItinerario } from "./word";

// Spec M3-46: lo que deja listo el catálogo para BR18, sin los bloques nuevos
// del owner. El Word y RutasenBus son recortes reales; COMPBR99 es un bloque de
// noche extra de prueba (el código real lo pone el owner en el Excel, M3-47).

const RAIZ = process.cwd();
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");

const WORD_BR18 = [
  "BR18- Salvador and Chapada Diamantina Eco Adventure – 7 nights",
  "Day 1: Salvador",
  "Arrival to Salvador de Bahia Airport and private transfer to your accommodation.",
  "Day 2: Salvador",
  "Day 3: Salvador",
  "Pick up for a Full Day in Praia do Forte.",
  "Day 4: Lençóis",
  "Check out, go on your own to the bus station (Rodoviaria) to take the bus to Lencois, at the heart of Chapada Diamantina.",
  "Day 5: Lençóis",
  "Day 6: Lençóis",
  "Day 7: Day 7: Salvador",
  "Then, got to the bus station to take the bus back to Salvador.",
  "Day 8: End of Itinerary",
  "Check out. Transfer to Salvador de Bahia airport to fly to your next destination.",
  "What's Included?",
  "4 Nights accommodation in Salvador at selected room with breakfast in Hotel, NO breakfast in Hostel",
  "Bus round trip from Salvador de Bahia to Lencois at Chapada Diamantina",
  "3 Nights accommodation in Lencois at selected room with breakfast in Hotel, NO breakfast in Hostel",
  "What's Not Included?",
  "BR19- Otro tour (5 nights)",
];

function rutas(extra: string | null): string[][] {
  return [
    fila({ A: "BR18", B: "Salvador and Chapada Diamantina Eco Adventure", I: "Salvador and Chapada Diamantina Eco Adventure" }),
    fila({ C: "ODBR15", ...(extra ? { E: extra } : {}), F: "COMPBR04", G: "2026-27" }),
    fila({ B: "Net Prices:", C: "Salvador Arrival", D: "Bus SSA LEN SSA", E: "Extra night SSA", F: "Chapada", G: "TOTAL", I: "Net Prices:" }),
    fila({ B: "Dorm Hostel ", C: "253", D: "119", E: "26", F: "166", G: " 564 ", I: "Dorm Hostel " }),
    fila({}),
  ];
}

const PAQUETES: PaqueteConocido[] = [
  { codigo: "ODBR15", destino: "SSA", nochesBase: 3, cubrePuntas: true, rutasPropias: [] },
  { codigo: "COMPBR04", destino: "CHAP", nochesBase: 3, cubrePuntas: false, rutasPropias: [] },
  { codigo: "COMPBR99", destino: "SSA", nochesBase: 1, cubrePuntas: true, rutasPropias: [] },
];

const INCLUIDOS: IncluidoTour[] = parsearIncluidosTour(dato("incluidos-tour.csv"));
const TRAMOS = parsearTramosConProveedor(dato("tramos-con-proveedor.csv"));

function entrada(cambios: { extra?: string | null; incluidos?: IncluidoTour[] } = {}): EntradaArmado {
  return {
    codigo: "BR18",
    excel: leerTourRutas(rutas(cambios.extra === undefined ? "COMPBR99" : cambios.extra), "BR18"),
    word: leerItinerario(WORD_BR18, "BR18"),
    paquetes: new Map(PAQUETES.map((p) => [p.codigo, p])),
    codigosTour: new Set(["BR18"]),
    tours: new Map(),
    tramosConProveedor: TRAMOS,
    incluidosTour: cambios.incluidos ?? INCLUIDOS,
  };
}

function armado(t: TourArmado): Extract<TourArmado, { estado: "armado" }> {
  if (t.estado !== "armado") throw new Error(`para revisar: ${t.motivos.join(" | ")}`);
  return t;
}

describe("M3-46 punto 1 — destinos de Salvador y Lençóis", () => {
  it.each([
    ["Lençóis", "CHAP"],
    ["Lencois", "CHAP"],
    ["Chapada Diamantina", "CHAP"],
    ["Salvador", "SSA"],
    ["Salvador de Bahia", "SSA"],
  ])("%s → %s", (texto, destino) => {
    expect(primeraCiudad(texto)).toBe(destino);
    expect(destinoDeEncabezado(texto)).toBe(destino);
  });

  it("tienen nombre para mostrar", () => {
    expect(nombreDestino("SSA")).toBe("Salvador");
    expect(nombreDestino("CHAP")).toBe("Lençóis");
  });

  it("'Bahia Transfers' o 'Bahia de Todos los Santos' solos no son un destino", () => {
    expect(primeraCiudad("Bahia Transfers")).toBeNull();
    expect(primeraCiudad("Bahia de Todos los Santos Schooner tour")).toBeNull();
  });

  it("el Word de BR18 ya dice en qué destino es cada cosa", () => {
    const w = leerItinerario(WORD_BR18, "BR18")!;
    expect(w.items).toMatchObject([
      { tipo: "estadia", noches: 4, destino: "SSA" },
      { tipo: "bus", desde: "SSA", hasta: "CHAP" },
      { tipo: "estadia", noches: 3, destino: "CHAP" },
    ]);
  });
});

describe("M3-46 punto 2 — ODBR15 y COMPBR04 con nivel en todas sus líneas de alojamiento", () => {
  it("están en data/paquetes-piloto.csv con su destino", () => {
    expect(parsearPaquetesPiloto(dato("paquetes-piloto.csv"))).toEqual(
      expect.arrayContaining([
        { codigo: "ODBR15", destino: "SSA" },
        { codigo: "COMPBR04", destino: "CHAP" },
      ]),
    );
  });

  it.skipIf(!existsSync(RUTA_PAQUETES))("el diagnóstico en memoria los encuentra, sin alojamientos sin nivel", async () => {
    const vacio = { data: [], error: null };
    const consulta = { select: () => ({ range: async () => vacio }) };
    const d = await diagnosticarPaquetes({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- base en memoria, sin directorio
      admin: { from: () => consulta } as any,
      filas: leerFilasPaquetes(RUTA_PAQUETES),
      archivo: "paquetes.xls",
      paquetes: [
        { codigo: "ODBR15", destino: "SSA" },
        { codigo: "COMPBR04", destino: "CHAP" },
      ],
      nivelesConfirmados: parsearNivelesConfirmados(dato("niveles-confirmados.csv")),
    });
    for (const codigo of ["ODBR15", "COMPBR04"]) {
      const p = d.paquetes.find((x) => x.codigo === codigo)!;
      expect(p.encontrado).toBe(true);
      const alojamientos = p.servicios.filter((s) => s.tipo === "alojamiento");
      expect(alojamientos.map((s) => s.nivel).sort()).toEqual(["Hostel", "Hotel 3*"]);
    }
  });
});

describe("M3-46 punto 3 — los buses con Plataforma10", () => {
  const alias = parsearEquivalencias(dato("equivalencias-proveedores.csv")).map((f) => ({
    destino: f.destino,
    alias_normalizado: f.alias_normalizado,
    proveedor_id: null,
    modo: f.modo,
    estado: f.estado,
    nota: f.nota ?? null,
  }));
  const indice = crearIndiceProveedores([], alias);

  it("BR18 tiene su ruta en tramos-con-proveedor, en los dos sentidos", () => {
    const delTour = TRAMOS.filter((t) => t.tour === "BR18");
    expect(delTour).toEqual([
      expect.objectContaining({ desde: "SSA", hasta: "CHAP", bookingSupplier: "Plataforma10", ambosSentidos: true }),
    ]);
  });

  it("Plataforma10 está marcado manual en SSA y en CHAP (no por 'cualquier destino')", () => {
    const manuales = alias.filter((a) => a.alias_normalizado === "plataforma10" && a.modo === "manual").map((a) => a.destino);
    expect(manuales).toEqual(expect.arrayContaining(["SSA", "CHAP"]));
    expect(resolverProveedorTramo("Plataforma10", indice, ["SSA", "CHAP"])).toMatchObject({ id: null, manual: true });
    expect(resolverProveedorTramo("Plataforma10", indice, ["CHAP", "SSA"])).toMatchObject({ id: null, manual: true });
  });

  it("salen los dos buses (días 4 y 7, uno por sentido) y no se agrega un tercero al final", () => {
    const t = armado(armarTour(entrada()));
    expect(t.serviciosPropios.map((s) => [s.sentido, s.diaDesde, s.nocturno])).toEqual([
      ["Salvador – Lençóis", 4, false],
      ["Lençóis – Salvador", 7, false],
    ]);
  });

  it("dan tareas 'Emitir pasaje', sin pedido a proveedor", () => {
    const br18 = producto("prod-br18", "BR18", [], { esTour: true, componentes: [componente("c-1", 1, 1, 3, producto("prod-x", "ODBR15", []))] });
    const r = armarPedidos(
      reserva({
        productoId: br18.id,
        fechaInicio: "2027-01-28",
        fechaFin: "2027-02-04",
        partes: [
          parte({ id: "ida", orden: 1, tipo: "tramo_bus", esTarea: true, descripcionRuta: "Bus Salvador – Lençóis", fechaInicio: "2027-01-31", fechaFin: "2027-01-31" }),
          parte({ id: "vuelta", orden: 2, tipo: "tramo_bus", esTarea: true, descripcionRuta: "Bus Lençóis – Salvador", fechaInicio: "2027-02-03", fechaFin: "2027-02-03" }),
        ],
      }),
      catalogoCon([br18]),
      cargarPlantilla(),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.pedidos).toEqual([]);
    expect(r.tareas.filter((x) => x.tipo === "emitir_boleto").map((x) => x.texto)).toEqual([
      "Emitir pasaje: Bus Salvador – Lençóis, 31 ene 2027",
      "Emitir pasaje: Bus Lençóis – Salvador, 3 feb 2027",
    ]);
  });
});

describe("M3-46 punto 4 — la excepción de lo que incluye el Word (data/incluidos-tour.csv)", () => {
  it("el archivo trae BR18 con la secuencia real (M3-48 suma BR03 y BR04)", () => {
    expect(INCLUIDOS.map((x) => x.tour)).toEqual(["BR18", "BR03", "BR04"]);
    expect(INCLUIDOS[0].items).toMatchObject([
      { tipo: "estadia", noches: 3, destino: "SSA" },
      { tipo: "bus", desde: "SSA", hasta: "CHAP" },
      { tipo: "estadia", noches: 3, destino: "CHAP" },
      { tipo: "bus", desde: "CHAP", hasta: "SSA" },
      { tipo: "estadia", noches: 1, destino: "SSA" },
    ]);
  });

  it("con la fila y el bloque de noche extra: armado, 7 noches y días 1, 4, 4, 7, 7", () => {
    const t = armado(armarTour(entrada()));
    expect(t.noches).toBe(7);
    expect(t.componentes.map((c) => `${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}`)).toEqual([
      "ODBR15 d1 3n IN",
      "COMPBR04 d4 3n",
      "COMPBR99 d7 1n OUT",
    ]);
    const dias = [...t.componentes.map((c) => c.diaDesde), ...t.serviciosPropios.map((s) => s.diaDesde)].sort((a, b) => a - b);
    expect(dias).toEqual([1, 4, 4, 7, 7]);
    expect(t.ciudades).toEqual(["Salvador", "Lençóis"]);
    expect(t.notas.join(" ")).toContain("data/incluidos-tour.csv");
  });

  it("sin Plataforma10 en tramos, los mismos días son tramos de bus entre componentes", () => {
    const t = armado(armarTour({ ...entrada(), tramosConProveedor: [] }));
    expect(t.componentes.map((c) => c.diaDesde)).toEqual([1, 4, 4, 7, 7]);
    expect(t.componentes.map((c) => c.descripcionRuta ?? c.codigo)).toEqual([
      "ODBR15",
      "Salvador – Lençóis",
      "COMPBR04",
      "Lençóis – Salvador",
      "COMPBR99",
    ]);
  });

  it("sin la fila, con el bloque: sigue en revisión, con el motivo 'ambiguo' de siempre", () => {
    const t = armarTour(entrada({ incluidos: [] }));
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") {
      expect(t.motivos.join(" | ")).toContain("Salvador está en más de un componente (ODBR15, COMPBR99): el orden es ambiguo");
    }
  });

  it("sin la fila, un paquete repetido separado sigue con su motivo de siempre", () => {
    const word = leerItinerario(WORD_BR18, "BR18")!;
    const t = armarTour({
      ...entrada({ extra: null, incluidos: [] }),
      word: { ...word, items: INCLUIDOS[0].items },
    });
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") {
      expect(t.motivos.join(" | ")).toContain("ODBR15 aparece dos veces separado en el itinerario: el orden es ambiguo");
    }
  });

  it("la fila de otro tour no cambia nada", () => {
    const t = armarTour(entrada({ incluidos: [{ ...INCLUIDOS[0], tour: "BR19" }] }));
    expect(t.estado).toBe("para_revisar");
  });

  it("con la fila y sin el bloque del owner (hoy): en revisión, y dice qué falta", () => {
    const t = armarTour(entrada({ extra: null }));
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") {
      expect(t.motivos.join(" | ")).toContain(
        "data/incluidos-tour.csv tiene 2 estadías en Salvador y RutasenBus solo 1 componente de ese destino (ODBR15)",
      );
      expect(t.motivos.join(" | ")).not.toContain("el Word no tiene noches");
    }
  });

  it("si la noche extra del Excel no es de 1 noche, las noches no cierran (no se adivina)", () => {
    const otro = { ...PAQUETES[2], nochesBase: 2 };
    const t = armarTour({ ...entrada(), paquetes: new Map([...PAQUETES.slice(0, 2), otro].map((p) => [p.codigo, p])) });
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") expect(t.motivos.join(" | ")).toContain("COMPBR99: el Word dice 1 noche");
  });

  describe("parsearIncluidosTour", () => {
    it("agrupa las filas por tour, en el orden del archivo", () => {
      const r = parsearIncluidosTour(
        "tour,incluye,nota\nX1,2 nights accommodation in Salta,\nY2,1 night accommodation in Mendoza,\nX1,Bus from Salta to Mendoza,\n",
      );
      expect(r.map((x) => [x.tour, x.items.length])).toEqual([["X1", 2], ["Y2", 1]]);
    });

    it("una fila que no se entiende o sin destino es un error con su número de fila", () => {
      expect(() => parsearIncluidosTour("tour,incluye,nota\nX1,Lo que sea,\n")).toThrow(/incluidos-tour\.csv, fila 2/);
      expect(() => parsearIncluidosTour("tour,incluye,nota\nX1,2 nights accommodation in Atlantida,\n")).toThrow(/fila 2.*destino/);
      expect(() => parsearIncluidosTour("tour,incluye,nota\nX1,Bus from Atlantida to Salta,\n")).toThrow(/fila 2.*ciudades/);
      expect(() => parsearIncluidosTour("tour,incluye,nota\n,Bus from Salta to Mendoza,\n")).toThrow(/fila 2/);
    });

    it("sin las columnas es un error", () => {
      expect(() => parsearIncluidosTour("tour,texto\nX1,algo\n")).toThrow(/incluye/);
    });
  });
});
