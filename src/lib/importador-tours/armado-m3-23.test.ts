import { describe, expect, it } from "vitest";
import { armarTour, rutasDeServicios, type EntradaArmado, type PaqueteConocido, type TourArmado } from "./armado";
import { ciudadesEnTexto, nombreDestino } from "./ciudades";
import { fila } from "./fixtures";
import { leerTourRutas } from "./rutas";
import { leerItinerario } from "./word";

// Spec M3-23: AR10 Full Argentina Adventure – Route 40. Recortes reales del
// Word de Multi Destination (con sus detalles de formato: "DAY 8" y "DAY 11"
// pegados al párrafo anterior, "Night in the BUS" el día 12) y de la hoja
// "Tours 2027" de RutasenBus (fila 96 corregida por el owner el 2026-10-26).

const WORD_AR10 = [
  "AR10- Full Argentina Adventure – Route 40 (20 nights)",
  "DAY 1: Salta",
  "Arrival to Salta NOT on Tuesdays. Transfer from Airport to accommodation and check in. Free day. ",
  "DAY 2: Salta - Purmamarca",
  "Breakfast. Salt Flats/Purmamarca Excursion. You'll spend the night in Purmamarca.",
  "DAY 3: Purmamarca - Salta",
  "Breakfast. Humahuaca Full Day Excursion:",
  "Arrival to Salta at 7 – 8 pm ",
  "DAY 4: Salta",
  "DAY 5: Salta-Mendoza",
  "Breakfast.  Check Out. In the evening: take the nigh bus to Mendoza. ",
  "DAY 6: Mendoza",
  "Arrival in Mendoza. Check in at selected accommodation. At 2.30 pm, Half Day Winery Tour.",
  "DAY 7: Mendoza",
  "Breakfast. 7 am: Aconcagua Valley Day Trip (Alta Montaña). Back to town at 7 - 8 pmDAY 8: Mendoza-Bariloche",
  "Breakfast. Check out at 11 am. In the evening, take the night bus to Bariloche. ",
  "DAY 9: Bariloche",
  "Arrival in Bariloche in the evening. Check in at selected accommodation. ",
  "DAY 10: Bariloche",
  "Breakfast. At 2.30 pm, Mt Campanario and Circuito Chico Half Day excursion. At km40 you will reach the famous Panoramic Point. DAY 11: Bariloche",
  "Breakfast. At around 9.00 am hotel pick up to do the Isla Victoria y Bosque de Arrayanes Boat Trip. Back to accommodation. ",
  "DAY 12: Bariloche-El Chalten",
  "Check out. Departure to El Chalten. Night in the BUS. Note: the time of the bus between Bariloche and El Chalten changes every year, so be prepared for timetable adaptions. ",
  "DAY 13: El Chalten",
  "DAY 14: El Chalten",
  "DAY 15: El Chalten – El Calafate",
  "Check out, in the morning, go on your own to the bus station to take the bus to El Calafate, 3 hours ride.",
  "DAY 16: Calafate – Torres del Paine – Calafate",
  "DAY 17: Calafate",
  "DAY 18: Calafate-Rio Gallegos-Ushuaia",
  "Check out 2 am. At 3 am, departure to Rio Gallegos, connecting another bus to Ushuaia at 8.30 –  9 am.",
  "DAY 19: Ushuaia",
  "DAY 20: Ushuaia",
  "DAY 21: Ushuaia",
  "Breakfast. Check out and Airport Drop Off. End of adventure !",
  "Included",
  "3 nights Accommodation in Salta at selected room with breakfast.",
  "1 night Accommodation in Purmamarca at selected room",
  "Bus from Salta to Mendoza. Cama service.",
  "2 nights Accommodation in Mendoza at selected room with breakfast.",
  "Bus from Mendoza to Bariloche. Cama service.",
  "3 nights Accommodation in Bariloche at selected room with breakfast.",
  "Bus from Bariloche to El Chalten. Standard Service.",
  "2 nights Accommodation in El Chalten, no breakfast.",
  "Bus from El Chalten to Calafate. Standard Service.",
  "3 nights Accommodation in Calafate at selected room with breakfast.",
  "Bus from Calafate to Rio Gallegos. Standard service.",
  "Bus from Rio Gallegos to Ushuaia. Standard Service",
  "3 nights Accommodation in Ushuaia at selected room with breakfast.",
  "Not Included",
  "AR11- Otro tour (5 nights)",
];

const RUTAS_AR10 = [
  fila({ A: "AR10", B: "Salta + Mendoza + Bariloche + El Chalten + El Calafate & Torres del Paine + Ushuaia  - 20 nights  Full Argentina Adventure Route 40", N: "ok" }),
  fila({ C: " OD013 (menos 1 noche)", E: "OD033 (menos 1 noche)", F: "OD022", G: "OD027", I: "OD019 (menos 1 noche)", K: "OD024", M: "2026-27" }),
  fila({ B: "Net Prices:", C: "FTE 3 n", D: "BUS FTE RGL USH", E: "2 NT CHA", F: "USH ", G: "SLA", H: "BUS SLA MDZ", I: "MDZ", J: "BUS MDZ BRC", K: "BRC", L: "BUS BRC CHA FTE", M: "TOTAL" }),
  fila({ B: "Dorm Hostel", C: "396", D: "124", E: "93", F: "287", G: "443", H: "153", I: "192", J: "194", K: "292", L: "306", M: "2480" }),
  fila({ B: "DBL Hotel", C: "498", D: "124", E: "188", F: "419", G: "342", H: "153", I: "258", J: "194", K: "349", L: "306", M: "2831" }),
  fila({ B: "DBL 4*", C: "629", D: "124", E: "188", F: "513", G: "469", H: "153", I: "311", J: "194", K: "406", L: "306", M: "3292" }),
  fila({}),
];

const PAQUETES: PaqueteConocido[] = [
  { codigo: "OD027", destino: "SLA", nochesBase: 4, cubrePuntas: true, rutasPropias: [] },
  { codigo: "OD019", destino: "MDZ", nochesBase: 3, cubrePuntas: false, rutasPropias: [] },
  { codigo: "OD024", destino: "BRC", nochesBase: 3, cubrePuntas: true, rutasPropias: [] },
  {
    codigo: "OD033",
    destino: "CHA",
    nochesBase: 3,
    cubrePuntas: true,
    rutasPropias: rutasDeServicios([
      "Transfer El Calafate Airport to El Chalten. Booking Supplier: Chalten Travel / Transporte Las Lengas",
      "Public Bus El Chalten Bus Station - El Calafate Bus Station. Booking Supplier: Chalten Travel",
    ]),
  },
  { codigo: "OD013", destino: "FTE", nochesBase: 4, cubrePuntas: true, rutasPropias: [] },
  { codigo: "OD022", destino: "USH", nochesBase: 3, cubrePuntas: true, rutasPropias: [] },
];

function entrada(): EntradaArmado {
  return {
    codigo: "AR10",
    excel: leerTourRutas(RUTAS_AR10, "AR10"),
    word: leerItinerario(WORD_AR10, "AR10"),
    paquetes: new Map(PAQUETES.map((p) => [p.codigo, p])),
    codigosTour: new Set(["AR10"]),
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

describe("ciudades de AR10 (spec M3-23)", () => {
  it("Salta y Purmamarca son el destino de OD027 (SLA); Bariloche, el de OD024 (BRC)", () => {
    expect(ciudadesEnTexto("Bus from Salta to Mendoza").map((c) => c.destino)).toEqual(["SLA", "MDZ"]);
    expect(ciudadesEnTexto("1 night Accommodation in Purmamarca").map((c) => c.destino)).toEqual(["SLA"]);
    expect(ciudadesEnTexto("Bus from Bariloche to El Chalten").map((c) => c.destino)).toEqual(["BRC", "CHA"]);
    expect([nombreDestino("SLA"), nombreDestino("BRC")]).toEqual(["Salta", "Bariloche"]);
  });
});

describe("Word de AR10: los detalles de formato (spec M3-23)", () => {
  it("un \"DAY N:\" pegado al final del párrafo anterior empieza su propio día", () => {
    const w = leerItinerario(WORD_AR10, "AR10")!;
    expect(w.dias.map((d) => d.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    const dia8 = w.dias.find((d) => d.numero === 8)!;
    expect(dia8.titulo).toBe("Mendoza-Bariloche");
    expect(dia8.texto).toContain("take the night bus to Bariloche");
    expect(w.dias.find((d) => d.numero === 7)!.texto).not.toContain("DAY 8");
    expect(w.dias.find((d) => d.numero === 11)!.titulo).toBe("Bariloche");
    expect(w.dias.find((d) => d.numero === 10)!.texto).not.toContain("DAY 11");
  });

  it("el texto de un día que no es encabezado no se parte (\"see day 3: …\" en minúsculas no es un día)", () => {
    const w = leerItinerario(["X1- Prueba (2 nights)", "DAY 1: Salta", "Free day, see day 3: details", "DAY 2: Salta", "DAY 3: Salta"], "X1")!;
    expect(w.dias.map((d) => d.numero)).toEqual([1, 2, 3]);
    expect(w.dias[0].texto).toContain("see day 3: details");
  });
});

describe("armado de AR10 (spec M3-23, fila 3)", () => {
  it("20 noches = 17 en alojamientos + 3 en bus (días 5, 8 y 12); cada parte empieza el día del Word", () => {
    const t = armarTour(entrada());
    expect(resumen(t)).toEqual([
      "1 OD027 d1 4n IN",
      "2 Salta – Mendoza d5 noct",
      "3 OD019 d6 2n",
      "4 Mendoza – Bariloche d8 noct",
      "5 OD024 d9 3n",
      "6 Bariloche – El Chaltén d12 noct",
      "7 OD033 d13 2n",
      "8 OD013 d15 3n",
      "9 El Calafate – Río Gallegos d18",
      "10 Río Gallegos – Ushuaia d18",
      "11 OD022 d18 3n OUT",
    ]);
    if (t.estado !== "armado") return;
    expect(t.noches).toBe(20);
    expect(t.ciudades).toEqual(["Salta", "Mendoza", "Bariloche", "El Chaltén", "El Calafate", "Río Gallegos", "Ushuaia"]);
    // El bus El Chaltén → El Calafate lo trae OD033 (Chalten Travel).
    expect(t.notas.join(" ")).toContain("lo trae el paquete OD033");
  });

  it("\"Night in the BUS\" (día 12) es un bus nocturno", () => {
    const t = armarTour(entrada());
    if (t.estado !== "armado") throw new Error(t.motivos.join(" | "));
    const bus = t.componentes.find((c) => c.descripcionRuta === "Bariloche – El Chaltén")!;
    expect(bus.nocturno).toBe(true);
  });
});
