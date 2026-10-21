import { describe, expect, it } from "vitest";
import { armarTour, rutasDeServicios, type EntradaArmado, type PaqueteConocido, type TourArmado } from "./armado";
import { ciudadesEnTexto, nombreDestino } from "./ciudades";
import { fila } from "./fixtures";
import { leerTourRutas } from "./rutas";
import { leerItinerario } from "./word";

// Spec M3-10: los tours nuevos de Uruguay (ARUY01) y Buenos Aires – Río
// (ARBR23). Recortes reales del Word de Multi Destination y de la hoja
// "Tours 2027" de RutasenBus.

const WORD_ARUY01 = [
  "ARUY01- Argentina and Uruguay, heart of the River Plate – 6 nights",
  "DAY 1: Buenos Aires",
  "Arrival to Buenos Aires. Private transfer from Ezeiza International Airport.",
  "DAY 2: Buenos Aires",
  "DAY 4: Buenos Aires-Colonia",
  "Breakfast and check out. During the day, ferry crossing to Colonia del Sacramento (2 or 3 times available).",
  "DAY 5: Colonia - Montevideo ",
  "Check out. Go walking to the bus station to take the bus to Montevideo 3 Cruces bus station.",
  "DAY 6: Montevideo",
  "DAY 7: Montevideo",
  "Check out, regular transfer to Montevideo Carrasco Airport to take a flight. End of services.",
  "Included",
  "- 3 nights Accommodation in Buenos Aires at selected room with breakfast. ",
  "- Ezeiza International Airport pickup.",
  "- Ferry from Buenos Aires port to Colonia del Sacramento Port",
  "-1 night accommodation at selected room in Colonia del Sacramento (no dorm available in Colonia, SGL   room will be booked)",
  "- Regular bus from Colonia to Montevideo",
  "- 2 nights accommodation at selected room in Montevideo",
  "- Montevideo Airport drop off in regular shared service.",
  "Not Included",
  "CH08 All Chile from South to North - With W-Trek and Navimag (25 Nights) ",
];

const RUTAS_ARUY01 = [
  fila({ A: "ARUY01", B: "Argentina and Uruguay 6 nights" }),
  fila({ C: "OD040", D: "COMPUY03", E: "OD018", G: "2026-27" }),
  fila({ B: "Net Prices:", C: "2 Nts MVD", D: "Extension COL", E: "Bue 3 nts", F: "Ferry Bue COL", G: "TTL" }),
  fila({ B: "Dorm Hostel", C: "140", D: "66", E: "366", F: " 78 ", G: " 650 " }),
  fila({ B: "DBL Hotel", C: "163", D: "75", E: "396", F: " 78 ", G: " 711 " }),
  fila({}),
];

const WORD_ARBR23 = [
  "ARBR23- From Buenos Aires to RIO (11 nights)",
  "DAY 1: Buenos Aires",
  "DAY 2: Buenos Aires",
  "DAY 4: Buenos Aires-Puerto Iguazu",
  "Breakfast and check out at 11 am. In the evening, departure to Puerto Iguazú by bus.",
  "DAY 5: Puerto Iguazu",
  "Arrival in Puerto Iguazu at about mid day. Transfer to selected accommodation and check in.  Free day.",
  "DAY 6: Puerto Iguazu",
  "DAY 7: Puerto Iguazu",
  "DAY 8: Puerto Iguazu – Rio de Janeiro",
  "Breakfast. 11 am: Check out. Transfer to Puerto Iguazu Bus Station to take the overnight bus to RIO.",
  "DAY 9: Rio de Janeiro",
  "Day 10: Rio de Janeiro",
  "DAY 11: Rio de Janeiro.",
  "DAY 12: Rio de Janeiro",
  "Included:",
  "3 nights Accommodation in Buenos Aires at selected room with breakfast.",
  "Bus from Buenos Aires to Iguazu OW",
  "3 night Accommodation in Puerto Iguazu (Argentina) at selected room with breakfast.",
  "Bus from Puerto Iguazu to Rio de Janeiro",
  "3 nights accommodation in Rio de Janeiro at selected room with breakfast",
  "Not Included:",
];

const RUTAS_ARBR23 = [
  fila({ A: "ARBR23", B: "BUE + Iguazu + RIO", D: "11 Nights" }),
  fila({ C: "OD018", D: " OD010A", G: "OD032 ", H: "2026-27" }),
  fila({ B: "Net Prices:", C: "BUE 3 nts", D: "IGR 3", E: "BUE IGR 1 nt", F: "IGU RIO 1 nt", G: "RIO 3 nts", H: "TTL" }),
  fila({ B: "Dorm Hostel 8 bed", C: "366", D: "167", E: " 153 ", F: " 187 ", G: " 226 ", H: " 1,099 " }),
  fila({ B: "DBL Hotel 3*", C: "396", D: "248", E: " 153 ", F: " 187 ", G: " 325 ", H: " 1,308 " }),
  fila({}),
];

const PAQUETES: PaqueteConocido[] = [
  { codigo: "OD018", destino: "BUE", nochesBase: 3, cubrePuntas: true, rutasPropias: [] },
  { codigo: "OD010A", destino: "IGR", nochesBase: 3, rutasPropias: [] },
  { codigo: "OD032", destino: "RIO", nochesBase: 3, cubrePuntas: true, rutasPropias: [] },
  { codigo: "OD040", destino: "MVD", nochesBase: 2, cubrePuntas: true, rutasPropias: [] },
  {
    codigo: "COMPUY03",
    destino: "COL",
    nochesBase: 1,
    cubrePuntas: true,
    rutasPropias: rutasDeServicios(["Bus Regular Montevideo Bus Station - Colonia Bus Station. Booking Supplier: COT online"]),
  },
];

function entrada(codigo: string, filas: string[][], word: string[]): EntradaArmado {
  return {
    codigo,
    excel: leerTourRutas(filas, codigo),
    word: leerItinerario(word, codigo),
    paquetes: new Map(PAQUETES.map((p) => [p.codigo, p])),
    codigosTour: new Set(["ARUY01", "ARBR23"]),
    tours: new Map(),
    tramosConProveedor: [],
  };
}

function resumen(t: TourArmado) {
  if (t.estado !== "armado") throw new Error(`para revisar: ${t.motivos.join(" | ")}`);
  return t.componentes.map((c) =>
    c.tipo === "paquete"
      ? `${c.orden} ${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}`
      : `${c.orden} ${c.descripcionRuta} d${c.diaDesde}${c.nocturno ? " noct" : ""}`,
  );
}

describe("ciudades de Uruguay (spec M3-10)", () => {
  it("Colonia del Sacramento y Montevideo son destinos (COL, MVD), con su nombre", () => {
    expect(ciudadesEnTexto("Ferry from Buenos Aires port to Colonia del Sacramento Port").map((c) => c.destino)).toEqual(["BUE", "COL"]);
    expect(ciudadesEnTexto("Regular bus from Colonia to Montevideo").map((c) => c.destino)).toEqual(["COL", "MVD"]);
    expect([nombreDestino("COL"), nombreDestino("MVD")]).toEqual(["Colonia del Sacramento", "Montevideo"]);
  });
});

describe("Word de ARUY01: el ferry es un tramo (spec M3-10)", () => {
  it("lee el ferry Buenos Aires → Colonia como tramo y las estadías en Colonia y Montevideo con su destino", () => {
    const w = leerItinerario(WORD_ARUY01, "ARUY01")!;
    expect(w.noches).toBe(6);
    expect(w.items.map((i) => (i.tipo === "estadia" ? `${i.noches}n ${i.destino}` : `${i.ferry ? "ferry" : "bus"} ${i.desde}-${i.hasta}`))).toEqual([
      "3n BUE",
      "ferry BUE-COL",
      "1n COL",
      "bus COL-MVD",
      "2n MVD",
    ]);
  });
});

describe("armado de ARUY01 y ARBR23 (spec M3-10)", () => {
  it("ARUY01 = OD018 → ferry a Colonia (tramo de HI Travel) → COMPUY03 → OD040; el bus a Montevideo es el de COMPUY03", () => {
    const t = armarTour(entrada("ARUY01", RUTAS_ARUY01, WORD_ARUY01));
    expect(resumen(t)).toEqual([
      "1 OD018 d1 3n IN",
      "2 Ferry Buenos Aires – Colonia del Sacramento d4",
      "3 COMPUY03 d4 1n",
      "4 OD040 d5 2n OUT",
    ]);
    if (t.estado !== "armado") return;
    expect(t.noches).toBe(6);
    expect(t.ciudades).toEqual(["Buenos Aires", "Colonia del Sacramento", "Montevideo"]);
    expect(t.notas.join(" ")).toContain("lo trae el paquete COMPUY03");
  });

  it("ARBR23 = OD018 → bus nocturno → OD010A → bus nocturno → OD032 (11 noches): \"in the evening … by bus\" es nocturno", () => {
    const t = armarTour(entrada("ARBR23", RUTAS_ARBR23, WORD_ARBR23));
    expect(resumen(t)).toEqual([
      "1 OD018 d1 3n IN",
      "2 Buenos Aires – Iguazú d4 noct",
      "3 OD010A d5 3n IN OUT",
      "4 Iguazú – Río de Janeiro d8 noct",
      "5 OD032 d9 3n OUT",
    ]);
  });
});
