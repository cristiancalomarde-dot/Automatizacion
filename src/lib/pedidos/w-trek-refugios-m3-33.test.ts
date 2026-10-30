/**
 * M3-33: el pedido del W Trek dice dónde duerme cada noche ("Refugios: Central (1 mar) – Francés (2 mar)
 * – Francés (3 mar)") según la variante, desde `data/w-trek-refugios.csv` (owner 2026-10-28). Si la
 * variante no está en el CSV no se inventa: sin renglón y con un aviso interno. El renglón de M3-19
 * (tipo de alojamiento) y lo demás no cambian.
 */
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { cargarWTrekRefugios, leerWTrekRefugios } from "./cargar";
import { claveDelWTrek } from "./formato";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoCon, producto, reserva, servicio } from "./fixtures.test-utils";
import type { ResultadoArmado, WTrekRefugios } from "./tipos";

const plantilla = cargarPlantilla();
const REFUGIOS = cargarWTrekRefugios();

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const trek = (codigo: string, nombre: string, noches: number) =>
  producto("prod-wtrek", codigo, [
    servicio({ productoId: "prod-wtrek", tipo: "otro", orden: 1, descripcion: `${nombre}. Booking Supplier: Las Torres`, serviceProviderNombre: nombre, bookingSupplier: P.cuenca, tramosNoches: [{ nocheDesde: 1, noches, lugar: "refugios" }] }),
  ], { destino: "PNT" });

function pedidoDelTrek(codigo: string, nombre: string, noches: number, opciones: { refugios?: readonly WTrekRefugios[]; inicio?: string | null } = {}) {
  const inicio = opciones.inicio === undefined ? "2027-03-01" : opciones.inicio;
  const fin = inicio ? `2027-03-0${1 + noches}` : null;
  const catalogo = { ...catalogoCon([trek(codigo, nombre, noches)]), wTrekRefugios: "refugios" in opciones ? opciones.refugios : REFUGIOS };
  const r = ok(armarPedidos(reserva({ productoId: "prod-wtrek", habitacion: "Double Room - Hostel and W-Trek Tent", fechaInicio: inicio, fechaFin: fin }), catalogo, plantilla));
  return r.pedidos.find((p) => p.cuerpo.includes(nombre))!;
}

const lineas = (cuerpo: string) => cuerpo.split("\n").map((l) => l.replace(/^\d+\) /, ""));

describe("data/w-trek-refugios.csv (fila 1)", () => {
  it("tiene las 3 variantes con sus refugios en orden", () => {
    expect(REFUGIOS.map((f) => [f.servicio, f.refugios])).toEqual([
      ["W Trek Express", ["Central", "Francés", "Francés"]],
      ["W Trek Standard", ["Central", "Central", "Francés", "Paine Grande"]],
      ["W-Trek Standard with Grey Glacier", ["Central", "Francés", "Paine Grande", "Grey"]],
    ]);
    for (const f of REFUGIOS) expect(f.nota).toMatch(/owner/i);
  });

  it("la cabecera equivocada o una fila sin refugios es un error claro", () => {
    expect(() => leerWTrekRefugios("variante,noches\nW Trek Express,Central\n")).toThrow(/servicio,refugios,nota/);
    expect(() => leerWTrekRefugios("servicio,refugios,nota\nW Trek Express,,x\n")).toThrow(/fila 2/);
  });

  it("el nombre se compara sin mayúsculas, guiones ni el sufijo «N nights / N days»", () => {
    expect(claveDelWTrek("W-Trek Express 3 nights / 4 days")).toBe(claveDelWTrek("W Trek Express"));
    expect(claveDelWTrek("W-Trek Standard with Grey Glacier 4 nights / 5 days")).toBe(claveDelWTrek("w trek standard with grey glacier"));
    expect(claveDelWTrek("W Trek Standard")).not.toBe(claveDelWTrek("W Trek Express"));
  });
});

describe("armarPedidos — el renglón de los refugios (fila 2)", () => {
  it("CH11 (W Trek Express): debajo del renglón de M3-19, cada noche con su fecha", () => {
    const p = pedidoDelTrek("CH11", "W Trek Express", 3);
    const l = lineas(p.cuerpo);
    const i = l.indexOf("Alojamiento en el trek: Tent DBL");
    expect(i).toBeGreaterThan(0);
    expect(l[i + 1]).toBe("Refugios: Central (1 mar) – Francés (2 mar) – Francés (3 mar)");
    expect(p.avisos.filter((a) => /refugios/i.test(a))).toEqual([]);
  });

  it.each([
    ["CH10", "W Trek Standard", 4, "Refugios: Central (1 mar) – Central (2 mar) – Francés (3 mar) – Paine Grande (4 mar)"],
    ["PNTW01", "W-Trek Standard with Grey Glacier 4 nights / 5 days", 4, "Refugios: Central (1 mar) – Francés (2 mar) – Paine Grande (3 mar) – Grey (4 mar)"],
    ["PNTW02", "W-Trek Express 3 nights / 4 days", 3, "Refugios: Central (1 mar) – Francés (2 mar) – Francés (3 mar)"],
  ])("%s (%s) → %s", (codigo, nombre, noches, esperado) => {
    const l = lineas(pedidoDelTrek(codigo, nombre, noches).cuerpo);
    expect(l.filter((x) => x.startsWith("Refugios:"))).toEqual([esperado]);
  });

  it("las fechas cruzan el fin de mes", () => {
    const p = pedidoDelTrek("CH10", "W Trek Standard", 4, { inicio: "2027-02-27" });
    expect(lineas(p.cuerpo).filter((x) => x.startsWith("Refugios:"))).toEqual(["Refugios: Central (27 feb) – Central (28 feb) – Francés (1 mar) – Paine Grande (2 mar)"]);
  });

  it("un servicio «otro» que no es el W Trek no lleva el renglón", () => {
    const p = pedidoDelTrek("PNT99", "Navegación Glaciar Grey", 1);
    expect(p.cuerpo).not.toContain("Refugios:");
    expect(p.avisos.filter((a) => /refugios/i.test(a))).toEqual([]);
  });
});

describe("variante no reconocida (fila 4)", () => {
  it("no está en el CSV: sin renglón y con el aviso interno", () => {
    const p = pedidoDelTrek("CH99", "W Trek Full Circuit", 7);
    expect(p.cuerpo).not.toContain("Refugios:");
    expect(p.avisos).toContain("Refugios del W Trek sin cargar para W Trek Full Circuit: completarlos a mano");
    // El aviso es interno: no va en el texto del pedido.
    expect(p.cuerpo).not.toContain("sin cargar");
  });

  it("sin la lista (catálogo sin las reglas): como antes, sin renglón ni aviso", () => {
    const p = pedidoDelTrek("CH11", "W Trek Express", 3, { refugios: undefined });
    expect(p.cuerpo).not.toContain("Refugios:");
    expect(p.avisos.filter((a) => /refugios/i.test(a))).toEqual([]);
  });
});
