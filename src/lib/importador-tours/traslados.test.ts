import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sentidoDelTraslado } from "@/lib/importador-productos/sentido";
import { ajustesDeTraslados, parsearTrasladosTour, validarExcepcionesTraslado, type PaqueteEnTour, type ServicioDePaquete } from "./traslados";

// Los traslados (y buses) de los paquetes de los 7 tours, con los textos reales del Excel.
function s(orden: number, tipo: string, serviceProviderNombre: string, descripcion: string): ServicioDePaquete {
  return { orden, prioridad: 1, tipo, serviceProviderNombre, descripcion, sentido: tipo === "traslado" ? sentidoDelTraslado(descripcion) : null };
}
const SERVICIOS = new Map<string, ServicioDePaquete[]>([
  ["OD032", [s(3, "traslado", "GIG - Accommodation in Rio", "Transfer GIG - Accommodation in Rio. Booking Supplier: Buzios Transfers / Alex")]],
  ["COMPBR10", [s(1, "alojamiento", "Soos Hotel Collection", "Accommodation: Soos Hotel Collection")]],
  ["OD010D", [s(7, "excursion", "Paquete Receptvo 105 Premium x Foz", "Excursion: Paquete Receptvo 105 Premium x Foz. Booking Supplier: Cuenca del Plata\nIncludes: Transfer in + Out")]],
  ["OD010A", [s(4, "excursion", "Paquete Receptvo 105 Premium", "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata\nIncludes: Transfer in + Out")]],
  ["OD018", [s(6, "traslado", "EZE o AEP - Hotel - EZE o AEP", "Transfer EZE o AEP - Hotel - EZE o AEP. Booking Supplier: Greeters")]],
  ["OD020", [s(6, "traslado", "EZE o AEP - Hotel - EZE o AEP", "Transfer EZE o AEP - Hotel - EZE o AEP. Booking Supplier: Greeters")]],
  ["OD019", [s(4, "traslado", "Remis Mendoza", "Transfers: Remis Mendoza. Booking Booking Supplier: Remis Mendoza")]],
  ["OD029", [s(5, "traslado", "SCL - accommodation", "Transfer SCL - accommodation: Booking Supplier: CL Mundo")]],
  ["COMPCH01", [s(3, "bus", "Santiago - Valparaiso - Santiago", "Public Bus Santiago - Valparaiso - Santiago. Booking Supplier: Kupos.cl")]],
  ["OD030", [s(3, "traslado", "in CJC - Accommodation in San Pedro de Atacama", "Transfer in CJC - Accommodation in San Pedro de Atacama. Booking Supplier: Transvipp")]],
  ["COMPBO20", [s(1, "otro", "Overland San Pedro de Atacama to Uyuni", "Overland San Pedro de Atacama to Uyuni. Booking Supplier: Imperio Inca")]],
  ["OD031", [s(3, "traslado", "La Paz Airport - La Paz Accommodation", "Transfer La Paz Airport - La Paz Accommodation: Booking Supplier: Imperio Inca")]],
  ["OD025", [s(4, "traslado", "REL - accommodation", "Transfer REL - accommodation. Bookinkg Supplier: All Peninsula")]],
  ["OD013", [s(5, "traslado", "Round Trip", "Transfer Round Trip. Booking Supplier: Chalten Travel")]],
  ["OD022", [s(4, "traslado", "Round Trip: Rumbo Sur", "Transfer Round Trip: Rumbo Sur.Booking Supplier: Rumbo Sur")]],
  ["OD033", [
    s(4, "traslado", "El Calafate Airport to El Chalten", "Transfer El Calafate Airport to El Chalten. Booking Supplier: Chalten Travel / Transporte Las Lengas"),
    s(5, "bus", "El Chalten Bus Station - El Calafate Bus Station", "Public Bus El Chalten Bus Station - El Calafate Bus Station. Booking Supplier: Chalten Travel"),
  ]],
  ["OD016", [s(5, "traslado", "El Calafate Accommodation - FTE Airport", "Transfer El Calafate Accommodation - FTE Airport. Booking Supplier: Chalten Travel")]],
  ["OD017", [s(3, "bus", "Punta Arenas - Puerto Natales", "Bus Punta Arenas - Puerto Natales. Booking Supplier: Kupos")]],
  ["CH10", [s(3, "otro", "W Trek Standard", "W Trek Standard. Booking Supplier: Las Torres")]],
]);
const DESTINO: Record<string, string> = {
  OD032: "RIO", COMPBR10: "SAO", OD010D: "IGR", OD010A: "IGR", OD018: "BUE", OD020: "BUE", OD019: "MDZ", OD029: "SCL",
  COMPCH01: "VLP", OD030: "SPA", COMPBO20: "UYU", OD031: "LPB", OD025: "PMY", OD013: "FTE", OD022: "USH", OD033: "CHA",
  OD016: "FTE", OD017: "PNT", CH10: "PNT",
};
const sec = (...codigos: string[]): PaqueteEnTour[] => codigos.map((codigo) => ({ codigo, destino: DESTINO[codigo] }));
const SECUENCIAS: Record<string, PaqueteEnTour[]> = {
  "5C01": sec("OD032", "COMPBR10", "OD010D", "OD020", "OD019", "OD029", "COMPCH01", "OD030", "COMPBO20", "OD031"),
  BRARCH26: sec("OD032", "OD010A", "OD018", "OD019", "OD029"),
  AR09: sec("OD018", "OD025", "OD013", "OD022"),
  ARCH31: sec("OD033", "OD016", "OD017"),
  ARCH33: sec("OD033", "OD016", "CH10"),
  BOCHI04R: sec("COMPBO20", "OD030"),
  CHB31: sec("OD030", "COMPBO20"),
};

function ajustes(tour: string, excepciones = parsearTrasladosTour("tour,paquete,servicio,accion,texto,nota\n")) {
  return ajustesDeTraslados({ tour, secuencia: SECUENCIAS[tour], servicios: SERVICIOS, excepciones });
}
const de = (tour: string, paquete: string, excepciones?: Parameters<typeof ajustes>[1]) =>
  ajustes(tour, excepciones).filter((a) => a.paquete === paquete).map((a) => [a.orden, a.accion, a.origen]);

describe("la regla general de traslados en un tour (spec M1-08 §3 #2)", () => {
  it("OD020 en 5C01 sin Greeters (llega y sale en bus)", () => {
    expect(de("5C01", "OD020")).toEqual([[6, "anular", "regla"]]);
    expect(ajustes("5C01").find((a) => a.paquete === "OD020")!.motivo).toBe("llega en bus desde Iguazú y sale en bus a Mendoza");
  });

  it("OD019 en 5C01 y BRARCH26 sin Remis Mendoza (aunque el texto no diga el sentido)", () => {
    expect(de("5C01", "OD019")).toEqual([[4, "anular", "regla"]]);
    expect(de("BRARCH26", "OD019")).toEqual([[4, "anular", "regla"]]);
  });

  it("OD025 y OD013 en AR09 sin traslados", () => {
    expect(de("AR09", "OD025")).toEqual([[4, "anular", "regla"]]);
    expect(de("AR09", "OD013")).toEqual([[5, "anular", "regla"]]);
  });

  it("OD016 en ARCH31 y ARCH33 sin traslados", () => {
    expect(de("ARCH31", "OD016")).toEqual([[5, "anular", "regla"]]);
    expect(de("ARCH33", "OD016")).toEqual([[5, "anular", "regla"]]);
  });

  it("OD018 en AR09 con Greeters solo de llegada; OD022 solo de salida (Rumbo Sur)", () => {
    expect(de("AR09", "OD018")).toEqual([[6, "solo_llegada", "regla"]]);
    expect(de("AR09", "OD022")).toEqual([[4, "solo_salida", "regla"]]);
    expect(ajustes("AR09").find((a) => a.paquete === "OD018")!.motivo).toBe("sale en bus a Puerto Madryn: solo se pide la llegada");
  });

  it("el primer paquete conserva la llegada; los buses y lo que no es traslado no se tocan", () => {
    expect(de("5C01", "OD032")).toEqual([]);
    expect(de("ARCH31", "OD033")).toEqual([]);
    expect(de("CHB31", "OD030")).toEqual([]);
    expect(de("5C01", "COMPCH01")).toEqual([]);
    expect(de("ARCH31", "OD017")).toEqual([]);
  });

  it("Iguazú conserva los suyos aunque esté en el medio (el 105 Premium se cambia solo por excepción)", () => {
    expect(de("5C01", "OD010D")).toEqual([]);
  });
});

describe("excepciones por tour (data/traslados-tour.csv, spec M1-08 §3 #3 y #4)", () => {
  const REAL = parsearTrasladosTour(readFileSync("data/traslados-tour.csv", "utf-8"));

  it("una excepción cambia solo ese servicio en ese tour y pisa la regla", () => {
    const excepciones = parsearTrasladosTour(
      "tour,paquete,servicio,accion,texto,nota\nBOCHI04R,OD030,in CJC - Accommodation in San Pedro de Atacama,invertir,San Pedro → CJC,owner\n",
    );
    expect(de("BOCHI04R", "OD030", excepciones)).toEqual([[3, "invertir", "excepcion"]]);
    expect(de("BOCHI04R", "OD030")).toEqual([[3, "anular", "regla"]]);
    expect(de("CHB31", "OD030", excepciones)).toEqual([]);
  });

  it("(a) OD029 sin el traslado SCL de CL Mundo en 5C01 y BRARCH26", () => {
    expect(de("5C01", "OD029", REAL)).toEqual([[5, "anular", "excepcion"]]);
    expect(de("BRARCH26", "OD029", REAL)).toEqual([[5, "anular", "excepcion"]]);
  });

  it("(b) el 105 Premium con transfer desde la Rodoviaria de Foz y a la terminal de Puerto Iguazú", () => {
    for (const [tour, paquete, orden] of [["5C01", "OD010D", 7], ["BRARCH26", "OD010A", 4]] as const) {
      const [a] = ajustes(tour, REAL).filter((x) => x.paquete === paquete);
      expect(a).toMatchObject({ orden, accion: "reemplazar", origen: "excepcion" });
      expect(a.texto).toMatch(/Rodoviaria de Foz.*terminal de buses de Puerto Iguazú/);
    }
  });

  it("(c) OD031 en 5C01: traslado desde la terminal de buses", () => {
    const [a] = ajustes("5C01", REAL).filter((x) => x.paquete === "OD031");
    expect(a).toMatchObject({ orden: 3, accion: "reemplazar", origen: "excepcion" });
    expect(a.texto).toMatch(/terminal de buses/);
  });

  it("(d) OD030 en BOCHI04R: el Transvip pasa a ser de salida, San Pedro → CJC", () => {
    const [a] = ajustes("BOCHI04R", REAL).filter((x) => x.paquete === "OD030");
    expect(a).toMatchObject({ orden: 3, accion: "invertir", origen: "excepcion" });
    expect(a.texto).toMatch(/San Pedro.*CJC/);
  });

  it("(e) COMPCH01 en 5C01: el bus Kupos solo de ida Santiago → Valparaíso", () => {
    expect(de("5C01", "COMPCH01", REAL)).toEqual([[3, "solo_llegada", "excepcion"]]);
  });

  it("(f) ARCH31: OD017 sin el bus Punta Arenas → Puerto Natales", () => {
    expect(de("ARCH31", "OD017", REAL)).toEqual([[3, "anular", "excepcion"]]);
  });

  it("si nombra un tour, un paquete del tour o un servicio que no existe, falla con un mensaje claro", () => {
    const una = (fila: string) => parsearTrasladosTour(`tour,paquete,servicio,accion,texto,nota\n${fila}\n`);
    expect(() => validarExcepcionesTraslado(una("ZZ99,OD029,SCL - accommodation,anular,,"), Object.keys(SECUENCIAS))).toThrow(
      /traslados-tour.csv.*ZZ99/,
    );
    expect(() => ajustes("AR09", una("AR09,OD029,SCL - accommodation,anular,,"))).toThrow(/traslados-tour.csv.*AR09.*OD029/);
    expect(() => ajustes("5C01", una("5C01,OD029,Transfer de Marte,anular,,"))).toThrow(/traslados-tour.csv.*OD029.*Transfer de Marte/);
  });

  it("el archivo valida lo que escribe: acción conocida y texto en los reemplazos", () => {
    expect(() => parsearTrasladosTour("tour,paquete,servicio,accion,texto,nota\n5C01,OD031,x,borrar,,\n")).toThrow(/fila 2.*acción/);
    expect(() => parsearTrasladosTour("tour,paquete,servicio,accion,texto,nota\n5C01,OD031,x,reemplazar,,\n")).toThrow(/fila 2.*texto/);
  });
});
