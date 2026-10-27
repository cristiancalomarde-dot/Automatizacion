/**
 * M3-24 — las reglas de los avisos del itinerario (blackouts, fechas especiales y días de los buses),
 * leídas de los `data/*.csv` reales. Sin base ni red (#3).
 */
import { describe, expect, it } from "vitest";
import { cargarReglasItinerario } from "./cargar";
import {
  avisosDeBlackout,
  avisosDeDiasDeBus,
  avisosDeFechaEspecial,
  leerBlackouts,
  leerDiasDeBus,
  leerFechasEspeciales,
  pascua,
} from "./itinerario";

const reglas = cargarReglasItinerario();

describe("M3-24 — Pascua (computus)", () => {
  it.each([
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2029, "2029-04-01"],
  ])("%i → %s", (anio, fecha) => expect(pascua(anio)).toBe(fecha));
});

describe("M3-24 — blackouts del producto (data/blackouts.csv)", () => {
  it("AR10 en junio avisa", () => {
    expect(avisosDeBlackout(reglas, "AR10", "2027-06-12")).toEqual([
      "AR10 empieza el sábado 12 jun 2027, dentro de su blackout (temporada de invierno: del 1 abr al 30 sep 2027).",
    ]);
  });

  it("AR10 el 19 dic no avisa (sábado, fuera de la temporada de invierno)", () => {
    expect(avisosDeBlackout(reglas, "AR10", "2026-12-19")).toEqual([]);
  });

  it("AR10 un martes avisa (Arrival to Salta NOT on Tuesdays); el 1 oct ya vale", () => {
    expect(avisosDeBlackout(reglas, "AR10", "2026-12-22")).toEqual([
      "AR10 empieza un martes (22 dic 2026): según el Word no puede llegar a Salta un martes.",
    ]);
    expect(avisosDeBlackout(reglas, "AR10", "2027-10-01")).toEqual([]);
    expect(avisosDeBlackout(reglas, "AR10", "2027-09-30")).toHaveLength(1);
  });

  it("un \"Can't begin Tuesdays\" (BRARCH26) en martes avisa", () => {
    expect(avisosDeBlackout(reglas, "BRARCH26", "2027-01-05")).toEqual([
      "BRARCH26 empieza un martes (5 ene 2027): según el Word no puede empezar los martes.",
    ]);
    expect(avisosDeBlackout(reglas, "BRARCH26", "2027-01-06")).toEqual([]);
  });

  it("los rangos que cruzan el año (Reveillon) muestran las fechas del año que corresponde", () => {
    expect(avisosDeBlackout(reglas, "OD032", "2027-01-01")).toEqual([
      "OD032 empieza el viernes 1 ene 2027, dentro de su blackout (Reveillon en Río: del 28 dic 2026 al 2 ene 2027).",
    ]);
    expect(avisosDeBlackout(reglas, "OD032", "2026-12-29")).toEqual([
      "OD032 empieza el martes 29 dic 2026, dentro de su blackout (Reveillon en Río: del 28 dic 2026 al 2 ene 2027).",
    ]);
  });

  it("Carnaval en Río relativo a la Pascua: 4-15 feb en 2027, 24 feb – 6 mar en 2028", () => {
    expect(avisosDeBlackout(reglas, "OD032", "2027-02-04")).toEqual([
      "OD032 empieza el jueves 4 feb 2027, dentro de su blackout (Carnaval en Río: del 4 al 15 feb 2027).",
    ]);
    expect(avisosDeBlackout(reglas, "OD032", "2027-02-16")).toEqual([]);
    expect(avisosDeBlackout(reglas, "OD032", "2027-02-26")).toEqual([]);
    expect(avisosDeBlackout(reglas, "OD032", "2028-02-26")).toEqual([
      "OD032 empieza el sábado 26 feb 2028, dentro de su blackout (Carnaval en Río: del 24 feb al 6 mar 2028).",
    ]);
  });

  it("ARBR23: Semana Santa corrida (12 – 20 mar 2027)", () => {
    expect(avisosDeBlackout(reglas, "ARBR23", "2027-03-12")).toHaveLength(1);
    expect(avisosDeBlackout(reglas, "ARBR23", "2027-03-20")).toHaveLength(1);
    expect(avisosDeBlackout(reglas, "ARBR23", "2027-03-22")).toEqual([]);
  });

  it("ARCH33 sale desde el 1 oct (owner); IGRE03 solo lun/mié/sáb; SPAE05 no opera el 31 dic", () => {
    expect(avisosDeBlackout(reglas, "ARCH33", "2026-10-01")).toEqual([]);
    expect(avisosDeBlackout(reglas, "ARCH33", "2026-09-30")).toHaveLength(1);
    expect(avisosDeBlackout(reglas, "IGRE03", "2027-01-04")).toEqual([]);
    expect(avisosDeBlackout(reglas, "IGRE03", "2027-01-05")).toEqual([
      "IGRE03 empieza un martes (5 ene 2027): según el Word sale solo lunes, miércoles y sábados.",
    ]);
    expect(avisosDeBlackout(reglas, "SPAE05", "2026-12-31")).toHaveLength(1);
    expect(avisosDeBlackout(reglas, "SPAE05", "2026-12-30")).toEqual([]);
  });

  it("un producto sin reglas o sin fecha no avisa", () => {
    expect(avisosDeBlackout(reglas, "OD019", "2026-12-24")).toEqual([]);
    expect(avisosDeBlackout(reglas, "AR10", null)).toEqual([]);
  });
});

describe("M3-24 — fechas especiales (data/fechas-especiales.csv)", () => {
  it("Bodegas 24/12 y Alta Montaña 25/12 en Mendoza avisan (Navidad)", () => {
    expect(avisosDeFechaEspecial(reglas, { tipo: "excursion", nombre: "Bodegas half Day", fecha: "2026-12-24", destino: "MDZ" })).toEqual([
      "Bodegas half Day (Mendoza) cae jueves 24 dic 2026, Navidad: confirmá con el proveedor que opera.",
    ]);
    expect(avisosDeFechaEspecial(reglas, { tipo: "excursion", nombre: "Alta Montaña", fecha: "2026-12-25", destino: "MDZ" })).toEqual([
      "Alta Montaña (Mendoza) cae viernes 25 dic 2026, Navidad: confirmá con el proveedor que opera.",
    ]);
  });

  it("Carnaval 2027 calculado bien: lunes 8 y martes 9 feb en Argentina; 4 al 15 feb en Río", () => {
    const en = (fecha: string, destino: string) => avisosDeFechaEspecial(reglas, { tipo: "excursion", nombre: "Tour", fecha, destino });
    expect(en("2027-02-07", "BUE")).toEqual([]);
    expect(en("2027-02-08", "BUE")).toEqual(["Tour (Buenos Aires) cae lunes 8 feb 2027, Carnaval: confirmá con el proveedor que opera."]);
    expect(en("2027-02-09", "IGR")).toHaveLength(1);
    expect(en("2027-02-10", "BUE")).toEqual([]);
    expect(en("2027-02-04", "RIO")).toEqual(["Tour (Río de Janeiro) cae jueves 4 feb 2027, Carnaval: confirmá con el proveedor que opera."]);
    expect(en("2027-02-15", "RIO")).toHaveLength(1);
    expect(en("2027-02-16", "RIO")).toEqual([]);
  });

  it("Semana Santa 2027 de jueves a domingo (25-28 mar); en Río desde el martes 23", () => {
    const en = (fecha: string, destino: string) => avisosDeFechaEspecial(reglas, { tipo: "traslado", nombre: "Traslado", fecha, destino });
    expect(en("2027-03-24", "MDZ")).toEqual([]);
    expect(en("2027-03-25", "MDZ")).toEqual(["Traslado (Mendoza) cae jueves 25 mar 2027, Semana Santa: confirmá con el proveedor que opera."]);
    expect(en("2027-03-28", "LPB")).toHaveLength(1);
    expect(en("2027-03-23", "RIO")).toHaveLength(1);
  });

  it("São Paulo, Uruguay y Chile: nada", () => {
    for (const destino of ["SAO", "MVD", "COL", "SCL", "PNT", "SPA"]) {
      expect(avisosDeFechaEspecial(reglas, { tipo: "excursion", nombre: "Tour", fecha: "2026-12-25", destino })).toEqual([]);
    }
  });

  it("los buses avisan solo si salen el 25 dic o el 1 ene (no el 24, el 31, Carnaval ni Semana Santa)", () => {
    const bus = (fecha: string, destino = "MDZ") => avisosDeFechaEspecial(reglas, { tipo: "bus", nombre: "Mendoza – Bariloche", fecha, destino });
    expect(bus("2026-12-24")).toEqual([]);
    expect(bus("2026-12-31")).toEqual([]);
    expect(bus("2027-02-08")).toEqual([]);
    expect(bus("2027-03-26")).toEqual([]);
    expect(bus("2026-12-25")).toEqual(["El bus Mendoza – Bariloche sale viernes 25 dic 2026, Navidad: confirmá que sale."]);
    expect(bus("2027-01-01")).toEqual(["El bus Mendoza – Bariloche sale viernes 1 ene 2027, Año Nuevo: confirmá que sale."]);
    expect(bus("2027-01-01", "PNT")).toEqual([]);
  });
});

describe("M3-24 — días de los buses (data/dias-bus.csv)", () => {
  it("Río Gallegos → Ushuaia el martes 5 ene 2027 avisa; el lunes 4 no", () => {
    expect(avisosDeDiasDeBus(reglas, { ruta: "Río Gallegos – Ushuaia", fecha: "2027-01-05" })).toEqual([
      "El bus Río Gallegos → Ushuaia cae martes 5 ene 2027; según la planilla sale lun/mié/vie.",
    ]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus Río Gallegos – Ushuaia", fecha: "2027-01-04" })).toEqual([]);
  });

  it("un tramo sin días (Bariloche ↔ El Chaltén, El Calafate → Río Gallegos) no avisa", () => {
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bariloche – El Chaltén", fecha: "2026-12-30" })).toEqual([]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "El Calafate – Río Gallegos", fecha: "2027-01-05" })).toEqual([]);
  });

  it("días pares / impares (BUS02 de Journaway)", () => {
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus Punta Arenas to Ushuaia", fecha: "2027-01-07" })).toEqual([]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus Punta Arenas to Ushuaia", fecha: "2027-01-08" })).toEqual([
      "El bus Punta Arenas → Ushuaia cae viernes 8 ene 2027; según la planilla sale los días impares.",
    ]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus Ushuaia to Punta Arenas", fecha: "2027-01-08" })).toEqual([]);
  });
});

describe("M3-24 — lectura de los CSV", () => {
  it("rechaza una cabecera o un tipo que no conoce, con la fila", () => {
    expect(() => leerBlackouts("producto,desde\nAR10,04-01\n")).toThrow(/primera fila/);
    expect(() => leerBlackouts("producto,tipo,desde,hasta,motivo,nota\nAR10,otro,04-01,09-30,x,\n")).toThrow(/fila 2/);
    expect(() => leerBlackouts("producto,tipo,desde,hasta,motivo,nota\nAR10,rango,4-1,09-30,x,\n")).toThrow(/fila 2/);
    expect(() => leerBlackouts("producto,tipo,desde,hasta,motivo,nota\nAR10,dia_semana,martes,,x,\n")).toThrow(/fila 2/);
    expect(() => leerFechasEspeciales("feriado,donde,regla,desde,hasta,bus_desde,bus_hasta,nota\nNavidad,*,pascua,12-24,12-25,,,\n")).toThrow(/fila 2/);
    expect(() => leerDiasDeBus("origen,destino,dias,nota\nRGL,USH,lunes,\n")).toThrow(/fila 2/);
  });

  it("los CSV reales se leen enteros", () => {
    expect(reglas.blackouts.length).toBeGreaterThanOrEqual(28);
    expect(reglas.fechasEspeciales.length).toBe(11);
    expect(reglas.diasBus.length).toBe(6);
  });
});
