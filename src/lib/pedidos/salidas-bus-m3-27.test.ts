/**
 * M3-27 — el calendario del bus Bariloche ↔ El Chaltén (`data/salidas-bus.csv`), del Excel
 * `Insumos/Calendario_Buses_BRC_CHA_Nov2026_Feb2027.xlsx` (owner 2026-10-29: "dejalo como está").
 * Sin base ni red (#3).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { cargarReglasItinerario } from "./cargar";
import { sumarDias } from "./formato";
import { avisosDeDiasDeBus, leerSalidasDeBus, salidasDelBus } from "./itinerario";

const reglas = cargarReglasItinerario();
const EXCEL = join(process.cwd(), "Insumos/Calendario_Buses_BRC_CHA_Nov2026_Feb2027.xlsx");

function dias(desde: string, hasta: string, paso = 1): string[] {
  const out: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, paso)) out.push(f);
  return out;
}

// Lo que dice la spec (y la hoja "Reglas y notas" del Excel), escrito a mano.
const BRC_CHA = ["2026-11-03", "2026-11-06", "2026-11-09", "2026-11-12", ...dias("2026-11-14", "2026-11-30", 2), ...dias("2026-12-02", "2027-02-28")];
const CHA_BRC = ["2026-11-01", "2026-11-04", "2026-11-07", "2026-11-10", ...dias("2026-11-12", "2026-11-30", 2), ...dias("2026-12-01", "2027-02-28")];

describe("M3-27 — el CSV del calendario (data/salidas-bus.csv)", () => {
  it("da las salidas de la spec para los dos sentidos", () => {
    expect(salidasDelBus(reglas, "BRC", "CHA")).toEqual(BRC_CHA);
    expect(salidasDelBus(reglas, "CHA", "BRC")).toEqual(CHA_BRC);
  });

  it.skipIf(!existsSync(EXCEL))("da exactamente las fechas SI del Excel (120 filas, 1/11/2026 a 28/02/2027)", () => {
    const libro = XLSX.read(readFileSync(EXCEL));
    const filas = XLSX.utils.sheet_to_json<string[]>(libro.Sheets["Calendario diario"], { header: 1, raw: false }).slice(1);
    const conFecha = filas.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f[0] ?? "")));
    expect(conFecha.length).toBe(120);
    expect(conFecha[0][0]).toBe("2026-11-01");
    expect(conFecha[119][0]).toBe("2027-02-28");
    const si = (col: number) => conFecha.filter((f) => String(f[col]).trim().toUpperCase() === "SI").map((f) => String(f[0]));
    expect(salidasDelBus(reglas, "BRC", "CHA")).toEqual(si(2));
    expect(salidasDelBus(reglas, "CHA", "BRC")).toEqual(si(5));
  });

  it("rechaza una cabecera o una regla que no conoce, con la fila", () => {
    expect(() => leerSalidasDeBus("origen,destino,desde\nBRC,CHA,2026-11-01\n")).toThrow(/primera fila/);
    const cab = "origen,destino,desde,hasta,regla,proveedor,nota\n";
    expect(() => leerSalidasDeBus(`${cab}BRC,CHA,2026-11-01,2026-11-13,a veces,Chalten Travel,\n`)).toThrow(/fila 2/);
    expect(() => leerSalidasDeBus(`${cab}BRC,CHA,1/11/2026,2026-11-13,todos los días,Chalten Travel,\n`)).toThrow(/fila 2/);
    expect(() => leerSalidasDeBus(`${cab}BRC,CHA,2026-11-13,2026-11-01,todos los días,Chalten Travel,\n`)).toThrow(/fila 2/);
    expect(() => leerSalidasDeBus(`${cab}BRC,CHA,2026-11-01,2026-11-13,3 6 40,Chalten Travel,\n`)).toThrow(/fila 2/);
  });
});

describe("M3-27 — aviso si el bus no sale ese día", () => {
  it("Bariloche → El Chaltén el lun 2 nov 2026 avisa; el 3 nov no; el 15 dic no (diario)", () => {
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus Bariloche – El Chaltén", fecha: "2026-11-02" })).toEqual([
      "El bus Bariloche → El Chaltén cae el lun 2 nov 2026 y ese día no sale (sale 3, 6, 9 nov…).",
    ]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus Bariloche – El Chaltén", fecha: "2026-11-03" })).toEqual([]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus Bariloche – El Chaltén", fecha: "2026-12-15" })).toEqual([]);
  });

  it("El Chaltén → Bariloche el 2 nov avisa; el 1 nov no", () => {
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus El Chaltén – Bariloche", fecha: "2026-11-02" })).toEqual([
      "El bus El Chaltén → Bariloche cae el lun 2 nov 2026 y ese día no sale (sale 4, 7, 10 nov…).",
    ]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus El Chaltén – Bariloche", fecha: "2026-11-01" })).toEqual([]);
  });

  it("las próximas salidas que cruzan de mes llevan cada mes (1 dic desde Bariloche)", () => {
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bariloche – El Chaltén", fecha: "2026-12-01" })).toEqual([
      "El bus Bariloche → El Chaltén cae el mar 1 dic 2026 y ese día no sale (sale 2, 3, 4 dic…).",
    ]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bariloche – El Chaltén", fecha: "2026-11-29" })).toEqual([
      "El bus Bariloche → El Chaltén cae el dom 29 nov 2026 y ese día no sale (sale 30 nov, 2, 3 dic…).",
    ]);
  });
});

describe("M3-27 — fuera de la cobertura (1/11/2026 a 28/02/2027)", () => {
  it("Bariloche → El Chaltén el 5 mar 2027 avisa que el calendario no está cargado", () => {
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus Bariloche – El Chaltén", fecha: "2027-03-05" })).toEqual([
      "Calendario del bus Bariloche ↔ El Chaltén sin cargar para el vie 5 mar 2027: confirmar con Chalten Travel.",
    ]);
  });

  it("antes del 1/11/2026 también; en los dos sentidos se nombra igual", () => {
    expect(avisosDeDiasDeBus(reglas, { ruta: "El Chaltén – Bariloche", fecha: "2026-10-31" })).toEqual([
      "Calendario del bus Bariloche ↔ El Chaltén sin cargar para el sáb 31 oct 2026: confirmar con Chalten Travel.",
    ]);
  });

  it("los demás buses siguen igual (RGL → USH, PUQ → USH, El Calafate → Río Gallegos)", () => {
    expect(avisosDeDiasDeBus(reglas, { ruta: "Río Gallegos – Ushuaia", fecha: "2027-03-09" })).toEqual([
      "El bus Río Gallegos → Ushuaia cae martes 9 mar 2027; según la planilla sale lun/mié/vie.",
    ]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "Bus Punta Arenas to Ushuaia", fecha: "2027-03-07" })).toEqual([]);
    expect(avisosDeDiasDeBus(reglas, { ruta: "El Calafate – Río Gallegos", fecha: "2027-03-05" })).toEqual([]);
  });
});
