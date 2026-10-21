import { describe, expect, it } from "vitest";
import { planificarProductos } from "./plan";
import { parsearRenglonesAgregados } from "./renglones-agregados";

// Spec M3-10 (respuesta 2 del owner, 2026-10-21): el Fitz Camp opcional de AR34
// todavía no es un renglón del bloque en el Excel; se carga igual desde
// `data/renglones-agregados.csv`, leído con las mismas reglas que el Excel.

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

const FITZ = "Optional: 2nd Night at Fitz Camp. Booking Suplier: Receptivo Chalten";
const BLOQUE = {
  A3: "FTE",
  B3: "El Chalten + El Calafate AR34",
  F3: "El Chalten + El Calafate, Glaciers and Trekking AR34",
  B5: "Accommodation: Hostel Rancho Grande. Booking Supplier: Chalten Travel",
  B6: "Dorm",
  B10: "Excursion: Perito Moreno Glaciar Excursion. Booking Supplier: Chalten Travel",
  B18: "Paquetes AR34 p/person",
};
const CSV = `paquete,renglon,nota\nAR34,${FITZ},"Owner (2026-10-21): el Fitz Camp opcional"\n`;

describe("parsearRenglonesAgregados", () => {
  it("lee paquete y renglón (la nota es solo registro)", () => {
    expect(parsearRenglonesAgregados(CSV)).toEqual([{ paquete: "AR34", renglon: FITZ }]);
  });

  it("un renglón que las reglas no entienden corta con un mensaje claro (nunca se adivina)", () => {
    expect(() => parsearRenglonesAgregados("paquete,renglon,nota\nAR34,Fitz Camp sin proveedor,x\n")).toThrow(
      "renglones-agregados.csv, fila 2: no entiendo el renglón",
    );
  });

  it("faltan paquete o renglón → error", () => {
    expect(() => parsearRenglonesAgregados("paquete,renglon,nota\n,algo,x\n")).toThrow("renglones-agregados.csv, fila 2: faltan paquete o renglon.");
  });
});

describe("planificarProductos con renglones agregados", () => {
  it("el renglón se suma al final del bloque como un servicio más, opcional y con su proveedor", async () => {
    const plan = await planificarProductos({
      filas: grilla(BLOQUE),
      destino: "FTE",
      codigos: ["AR34"],
      interpretarIA: null,
      renglonesAgregados: parsearRenglonesAgregados(CSV),
    });
    const [p] = plan.productos;
    expect(p.servicios.map((s) => s.tipo)).toEqual(["alojamiento", "excursion", "otro"]);
    expect(p.servicios[2]).toMatchObject({
      opcional: true,
      fila: 0,
      descripcion: FITZ,
      opciones: [{ prioridad: 1, serviceProvider: "2nd Night at Fitz Camp", bookingSupplier: "Receptivo Chalten" }],
    });
    expect(p.renglonesAgregadosYaEnElExcel).toEqual([]);
  });

  it("si el owner ya lo agregó al Excel, no se duplica y se avisa", async () => {
    const plan = await planificarProductos({
      filas: grilla({ ...BLOQUE, B11: FITZ }),
      destino: "FTE",
      codigos: ["AR34"],
      interpretarIA: null,
      renglonesAgregados: parsearRenglonesAgregados(CSV),
    });
    const [p] = plan.productos;
    expect(p.servicios.filter((s) => s.descripcion === FITZ)).toHaveLength(1);
    expect(p.servicios.find((s) => s.descripcion === FITZ)!.fila).toBe(11);
    expect(p.renglonesAgregadosYaEnElExcel).toEqual([FITZ]);
  });

  it("los renglones de otro paquete no se tocan", async () => {
    const plan = await planificarProductos({
      filas: grilla(BLOQUE),
      destino: "FTE",
      codigos: ["AR34"],
      interpretarIA: null,
      renglonesAgregados: [{ paquete: "OD033", renglon: FITZ }],
    });
    expect(plan.productos[0].servicios).toHaveLength(2);
  });
});
