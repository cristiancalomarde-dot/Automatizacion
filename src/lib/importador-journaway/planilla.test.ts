import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { HOJA_JOURNAWAY, RUTA_PLANILLA_JOURNAWAY, abrirPlanillaJournaway, destinoDeLaPlanilla, leerPlanillaJournaway } from "./planilla";

// Spec M2-08 §3 #1: la planilla del owner, con sus colores.

const RUTA = resolve(__dirname, "..", "..", "..", RUTA_PLANILLA_JOURNAWAY);
const HAY_PLANILLA = existsSync(RUTA);

const SIN_COLOR = ["SPAT01", "SPAE01", "SPAE02", "SPAE03", "SPAE04", "SPAE06", "SPAE07", "SPAT02"];

(HAY_PLANILLA ? describe : describe.skip)("leerPlanillaJournaway con el archivo real", () => {
  const libro = abrirPlanillaJournaway(RUTA);
  const filas = leerPlanillaJournaway(libro);

  it("52 filas: 44 en celeste y las 8 sin color de la spec", () => {
    expect(filas).toHaveLength(52);
    expect(filas.filter((f) => f.celeste)).toHaveLength(44);
    expect(filas.filter((f) => !f.celeste).map((f) => f.codigo).sort()).toEqual([...SIN_COLOR].sort());
  });

  it("SPAE05 está en celeste y SPAE01 no", () => {
    expect(filas.find((f) => f.codigo === "SPAE05")!.celeste).toBe(true);
    expect(filas.find((f) => f.codigo === "SPAE01")!.celeste).toBe(false);
  });

  it("guarda código, tipo, destino, nombres, proveedor confirmado y comentario por fila", () => {
    expect(filas.find((f) => f.codigo === "BUS04")).toMatchObject({
      fila: 26,
      tipo: "Bus",
      destino: "El Calafate / El Chaltén",
      nombreTarifario: "Bus El Calafate - El Chaltén, y vuelta",
      proveedorSugerido: "Chalten Travel",
      confirmado: "ok",
      comentario: "exacto, cuenca",
    });
    expect(filas.find((f) => f.codigo === "SPAE03")!.nombreMail).toBe("Tour through the Moon Valley (parte de un PKT)");
  });
});

function libroDe(filas: unknown[][], hoja = HOJA_JOURNAWAY): XLSX.WorkBook {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), hoja);
  return libro;
}

const ENCABEZADO = [
  "Código sugerido",
  "Tipo",
  "Destino",
  "Nombre en el tarifario de Journaway",
  "Nombre como llega en los mails de Journaway",
  "Qué incluye / notas del tarifario",
  "Proveedor sugerido (del directorio)",
  "De dónde sale el proveedor",
  "PROVEEDOR CONFIRMADO (completar)",
  "Comentario del owner",
];

describe("leerPlanillaJournaway: lo que falta corta antes de escribir", () => {
  it("sin la columna PROVEEDOR CONFIRMADO → error claro", () => {
    const sinConfirmado = ENCABEZADO.filter((c) => !c.startsWith("PROVEEDOR CONFIRMADO"));
    expect(() => leerPlanillaJournaway(libroDe([sinConfirmado, ["FTEE01", "Excursión", "El Calafate"]]))).toThrow(
      /falta la columna «PROVEEDOR CONFIRMADO»/,
    );
  });

  it("sin la hoja «Productos Journaway» → error claro", () => {
    expect(() => leerPlanillaJournaway(libroDe([ENCABEZADO], "Otra"))).toThrow(/no tiene la hoja «Productos Journaway»/);
  });

  it("las filas sin código se saltean; un código repetido es un error", () => {
    const fila = ["FTEE01", "Excursión", "El Calafate", "Perito Moreno", "", "", "Chalten Travel", "", "ok", ""];
    expect(leerPlanillaJournaway(libroDe([ENCABEZADO, fila, []]))).toHaveLength(1);
    expect(() => leerPlanillaJournaway(libroDe([ENCABEZADO, fila, fila]))).toThrow(/FTEE01.*repetido/);
  });
});

describe("destinoDeLaPlanilla", () => {
  it("traduce el destino escrito al código de destino y sus ciudades", () => {
    expect(destinoDeLaPlanilla("San Pedro de Atacama")).toEqual({ destino: "SPA", ciudades: ["SPA"] });
    expect(destinoDeLaPlanilla("Iguazú")).toEqual({ destino: "IGR", ciudades: ["IGR"] });
    expect(destinoDeLaPlanilla("Punta Arenas / Ushuaia")).toEqual({ destino: "PUQ", ciudades: ["PUQ", "USH"] });
    expect(destinoDeLaPlanilla("San Pedro de Atacama + Uyuni")).toEqual({ destino: "SPA", ciudades: ["SPA", "UYU"] });
    expect(destinoDeLaPlanilla("Torres del Paine")).toEqual({ destino: "PNT", ciudades: ["PNT"] });
    expect(destinoDeLaPlanilla("Isla de Pascua")).toEqual({ destino: "IPC", ciudades: ["IPC"] });
  });

  it("un destino desconocido → error (no se adivina)", () => {
    expect(() => destinoDeLaPlanilla("Marte")).toThrow(/«Marte»/);
  });
});
