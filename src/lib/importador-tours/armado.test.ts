import { describe, expect, it } from "vitest";
import { armarTour, type EntradaArmado, type TourArmado } from "./armado";
import type { TramoConProveedor } from "./datos";
import { fila, PAQUETES, RUTAS_5C01, RUTAS_ARCH31, RUTAS_CHB31, WORD_5C01, WORD_ARCH31, WORD_CHB31 } from "./fixtures";
import { leerTourRutas } from "./rutas";
import { leerItinerario } from "./word";

const TOURS = new Set(["CHB31", "BOCHI04R", "ARCH31", "ARCH33", "AR09", "BRARCH26", "5C01"]);
const IMPERIO: TramoConProveedor[] = [
  { tour: "CHB31", desde: "UYU", hasta: "LPB", ruta: "Bus Uyuni – La Paz", bookingSupplier: "Imperio Inca" },
  { tour: "BOCHI04R", desde: "UYU", hasta: "LPB", ruta: "Bus Uyuni – La Paz", bookingSupplier: "Imperio Inca" },
];

function entrada(codigo: string, filas: string[][], word: string[], extra: Partial<EntradaArmado> = {}): EntradaArmado {
  return {
    codigo,
    excel: leerTourRutas(filas, codigo),
    word: leerItinerario(word, codigo),
    paquetes: new Map(PAQUETES.map((p) => [p.codigo, p])),
    codigosTour: TOURS,
    tours: new Map(),
    tramosConProveedor: IMPERIO,
    ...extra,
  };
}

function resumen(t: TourArmado) {
  if (t.estado !== "armado") throw new Error(`para revisar: ${t.motivos.join(" | ")}`);
  return t.componentes.map((c) =>
    c.tipo === "paquete"
      ? `${c.orden} ${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}`
      : `${c.orden} bus ${c.desde}-${c.hasta} d${c.diaDesde}${c.nocturno ? " noct" : ""}`,
  );
}

describe("armado de un tour compuesto (spec M1-05 §3)", () => {
  it("ARCH31 = OD033 → bus → OD016 (+1 noche) → bus → OD017, con transfers solo en las puntas", () => {
    const t = armarTour(entrada("ARCH31", RUTAS_ARCH31, WORD_ARCH31));
    expect(resumen(t)).toEqual([
      "1 OD033 d1 3n IN",
      "2 bus CHA-FTE d4",
      "3 OD016 d4 3n",
      "4 bus FTE-PNT d7",
      "5 OD017 d7 2n OUT",
    ]);
    if (t.estado !== "armado") return;
    expect(t.componentes[1].descripcionRuta).toBe("El Chaltén – El Calafate");
    expect(t.serviciosPropios).toEqual([]);
    expect(t.ciudades).toEqual(["El Chaltén", "El Calafate", "Puerto Natales"]);
  });

  it("las noches del Word y del Excel no coinciden → el tour queda para revisar, sin componentes", () => {
    const e = entrada("ARCH31", RUTAS_ARCH31, WORD_ARCH31);
    // El Excel dice "OD016 (menos 1 noche)" de un paquete de 3 (espera 2) y el Word dice 3 noches en El Calafate.
    e.excel!.componentes[0].ajusteNoches = -1;
    e.paquetes = new Map([...e.paquetes, ["OD016", { codigo: "OD016", destino: "FTE", nochesBase: 3 }]]);
    const t = armarTour(e);
    expect(t.estado).toBe("para_revisar");
    if (t.estado !== "para_revisar") return;
    expect(t.motivos.join(" ")).toMatch(/OD016.*3 noches.*2/);
    expect("componentes" in t).toBe(false);
  });

  it("CHB31 no tiene tramo_bus: el bus Uyuni – La Paz lo reserva Imperio Inca (servicio propio del tour)", () => {
    const t = armarTour(entrada("CHB31", RUTAS_CHB31, WORD_CHB31));
    expect(resumen(t)).toEqual(["1 OD030 d1 3n IN", "2 COMPBO20 d4 2n OUT"]);
    if (t.estado !== "armado") return;
    expect(t.componentes.some((c) => c.tipo === "tramo_bus")).toBe(false);
    expect(t.serviciosPropios).toEqual([
      expect.objectContaining({ ruta: "Bus Uyuni – La Paz", bookingSupplier: "Imperio Inca", diaDesde: 6, nocturno: true }),
    ]);
    expect(t.noches).toBe(6);
    expect(t.ciudades).toEqual(["San Pedro de Atacama", "Uyuni", "La Paz"]);
  });

  it("5C01 apunta a CHB31 (no copia sus partes), con sus días y noches", () => {
    const chb31 = armarTour(entrada("CHB31", RUTAS_CHB31, WORD_CHB31));
    const t = armarTour(entrada("5C01", RUTAS_5C01, WORD_5C01, { tours: new Map([["CHB31", chb31]]) }));
    expect(resumen(t)).toEqual([
      "1 OD032 d1 3n IN",
      "2 bus RIO-SAO d4",
      "3 COMPBR10 d4 2n",
      "4 bus SAO-IGR d6 noct",
      "5 OD010D d7 3n IN OUT",
      "6 bus IGR-BUE d10 noct",
      "7 OD020 d11 3n",
      "8 bus BUE-MDZ d14 noct",
      "9 OD019 d15 2n",
      "10 bus MDZ-SCL d17",
      "11 OD029 d17 2n",
      "12 bus SCL-VLP d19",
      "13 COMPCH01 d19 2n",
      "14 bus VLP-CJC d21 noct",
      "15 bus CJC-SPA d22",
      "16 CHB31 d22 6n",
      "17 OD031 d28 2n OUT",
    ]);
    if (t.estado !== "armado") return;
    expect(t.componentes[15]).toMatchObject({ codigo: "CHB31", esTour: true });
    expect(t.serviciosPropios).toEqual([]);
    expect(t.noches).toBe(29);
  });

  it("un bus es nocturno si el texto del día lo dice, aunque tenga el typo 'nigh bus'", () => {
    const rutas = [
      fila({ A: "Z01" }),
      fila({ C: "OD019 (menos 1 noche)", E: "OD029" }),
      fila({ B: "Net Prices:", C: "MDZ 2n", D: "Bus MDZ SCL", E: "SCL 2n", F: "TTL" }),
    ];
    const word = [
      "Z01- Prueba (5 nights)",
      "DAY 1: Mendoza",
      "DAY 2: Mendoza",
      "DAY 3: Mendoza - Santiago de Chile",
      "Departure to Santiago by nigh bus.",
      "DAY 4: Santiago de Chile",
      "DAY 5: Santiago de Chile",
      "DAY 6: Santiago de Chile",
      "Included",
      "2 nights Accommodation in Mendoza",
      "Bus from Mendoza to Santiago de Chile",
      "2 nights accommodation in Santiago de Chile",
      "Not Included",
    ];
    const t = armarTour(entrada("Z01", rutas, word, { codigosTour: new Set() }));
    expect(resumen(t)).toEqual(["1 OD019 d1 2n IN", "2 bus MDZ-SCL d3 noct", "3 OD029 d4 2n OUT"]);
  });

  it("si el tour anidado quedó para revisar, el que lo contiene también", () => {
    const chb31: TourArmado = { codigo: "CHB31", nombre: "x", noches: 6, estado: "para_revisar", motivos: ["algo"], notas: [] };
    const t = armarTour(entrada("5C01", RUTAS_5C01, WORD_5C01, { tours: new Map([["CHB31", chb31]]) }));
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") expect(t.motivos.join(" ")).toMatch(/CHB31/);
  });

  it("más de un nivel de anidado va a revisión", () => {
    const chb31 = armarTour(entrada("CHB31", RUTAS_CHB31, WORD_CHB31));
    if (chb31.estado !== "armado") throw new Error("CHB31 debería armarse");
    const anidadoDeOtro: TourArmado = {
      ...chb31,
      componentes: chb31.componentes.map((c, i) => (i === 0 ? { ...c, esTour: true } : c)),
    };
    const t = armarTour(entrada("5C01", RUTAS_5C01, WORD_5C01, { tours: new Map([["CHB31", anidadoDeOtro]]) }));
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") expect(t.motivos.join(" ")).toMatch(/un nivel/);
  });

  it("si falta un paquete, el tour queda para revisar", () => {
    const e = entrada("ARCH31", RUTAS_ARCH31, WORD_ARCH31);
    e.paquetes = new Map([...e.paquetes].filter(([c]) => c !== "OD017"));
    const t = armarTour(e);
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") expect(t.motivos.join(" ")).toMatch(/OD017/);
  });

  it("si la suma no da la duración del título, el tour queda para revisar", () => {
    const word = WORD_ARCH31.map((p) => (p.startsWith("ARCH31-") ? "ARCH31- Patagonia Highlights (9 nights)" : p));
    const t = armarTour(entrada("ARCH31", RUTAS_ARCH31, word));
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") expect(t.motivos.join(" ")).toMatch(/9 noches/);
  });

  it("si el bus no cae el día que dice el itinerario, el tour queda para revisar", () => {
    const word = WORD_ARCH31.map((p) => (p.startsWith("DAY 4:") ? "DAY 4: El Chalten" : p));
    const t = armarTour(entrada("ARCH31", RUTAS_ARCH31, word));
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") expect(t.motivos.join(" ")).toMatch(/día 4/);
  });

  it("si el Word tiene noches en un destino sin paquete en el Excel, va a revisión", () => {
    const e = entrada("ARCH31", RUTAS_ARCH31, WORD_ARCH31);
    e.excel!.componentes = e.excel!.componentes.filter((c) => c.codigo !== "OD033");
    const t = armarTour(e);
    expect(t.estado).toBe("para_revisar");
    if (t.estado === "para_revisar") expect(t.motivos.join(" ")).toMatch(/El Chaltén/);
  });

  it("sin el tour en el Word o en RutasenBus, va a revisión", () => {
    expect(armarTour({ ...entrada("ARCH31", RUTAS_ARCH31, WORD_ARCH31), word: null }).estado).toBe("para_revisar");
    expect(armarTour({ ...entrada("ARCH31", RUTAS_ARCH31, WORD_ARCH31), excel: null }).estado).toBe("para_revisar");
  });
});
