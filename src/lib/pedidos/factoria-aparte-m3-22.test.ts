/**
 * M3-22: el alojamiento en Factoria (Puerto Natales) se le pide a Factoria, no a Vértice (owner,
 * 2026-10-23; Factoria lo reconfirmó el 2026-10-26). En el Excel de paquetes Factoria "se le pide a
 * Vertice"; la regla de `data/alojamiento-se-pide-a.csv` lo manda al proveedor "Factoria (hostel de
 * Vertice)" del directorio, al armar (sin recargar el catálogo). El W Trek que va a Vértice sigue
 * yendo a Vértice, en su propio pedido.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { ARCHIVO_ALOJAMIENTO_SE_PIDE_A, ARCHIVO_HOSTEL_SEGUN_HABITACION, conProveedorDelAlojamiento, leerAlojamientoSePideA, leerHostelSegunHabitacion } from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { catalogoCon, componente, parte, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { DetalleProducto } from "@/lib/catalogo/tipos";
import type { CatalogoParaPedidos, ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const reglas = leerAlojamientoSePideA(readFileSync(ARCHIVO_ALOJAMIENTO_SE_PIDE_A, "utf8"));
const hostels = leerHostelSegunHabitacion(readFileSync(ARCHIVO_HOSTEL_SEGUN_HABITACION, "utf8"));

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const H = {
  puma: proveedor("prov-puma", "Puma Hostel", ["info@pumahouse.test"]),
  lastHope: proveedor("prov-lasthope", "Last Hope", ["hostel.last.hope@test.test"]),
  vertice: proveedor("prov-vertice", "VERTICE Travel: W Trek Standard con Grey", ["ventas@vertice.test"]),
  factoria: proveedor("prov-factoria", "Factoria (hostel de Vertice)", ["reservas@factoria.test"]),
  chalten: proveedor("prov-chalten", "Chalten Travel", ["agencias@chaltentravel.test"]),
};
/** El directorio de proveedores (para resolver la regla por nombre). */
const DIRECTORIO = Object.values(H);

/** El paquete de Puerto Natales con los tres hostels como en el Excel (Factoria "se le pide a Vertice"). */
function paquetePnt(codigo: string, conTrekAVertice = false, destino = "PNT"): DetalleProducto {
  const id = `prod-${codigo}`;
  const supl = [H.puma, H.lastHope, H.vertice];
  return producto(
    id,
    codigo,
    [
      ...["Puma Hostel", "Last Hope", "Factoria"].map((n, i) =>
        servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, prioridad: i + 1, serviceProviderNombre: n, bookingSupplierNombre: i === 2 ? "Vertice" : n, bookingSupplier: supl[i] }),
      ),
      ...(conTrekAVertice
        ? [servicio({ productoId: id, tipo: "otro", orden: 2, descripcion: "W Trek Standard. Booking Supplier: Vertice", serviceProviderNombre: "W Trek Standard", bookingSupplierNombre: "Vertice", bookingSupplier: H.vertice, tramosNoches: [{ nocheDesde: 2, noches: 3, lugar: "refugios" }] })]
        : [servicio({ productoId: id, tipo: "excursion", orden: 2, descripcion: "Full day Torres del Paine", bookingSupplier: H.chalten })]),
    ],
    { destino },
  );
}

function catalogo(prods: DetalleProducto[], extra: Partial<CatalogoParaPedidos> = {}): CatalogoParaPedidos {
  return {
    ...catalogoCon(prods, [], [{ codigo: prods[prods.length - 1].codigo, orden: 2, dia: 2 }]),
    hostelSegunHabitacion: hostels,
    alojamientoSePideA: conProveedorDelAlojamiento(reglas, DIRECTORIO),
    ...extra,
  };
}

const delAlojamiento = (r: ReturnType<typeof ok>) => r.pedidos.filter((p) => p.cuerpo.includes("Alojamiento:"));

describe("data/alojamiento-se-pide-a.csv (fila 4)", () => {
  it("trae la regla de Factoria en Puerto Natales, al proveedor del directorio con su nombre nuevo", () => {
    expect(reglas.map(({ destino, alojamiento, proveedor }) => ({ destino, alojamiento, proveedor }))).toEqual([
      { destino: "PNT", alojamiento: "Factoria", proveedor: "Factoria (hostel de Vertice)" },
    ]);
    // #2: ningún mail en la regla.
    expect(readFileSync(ARCHIVO_ALOJAMIENTO_SE_PIDE_A, "utf8")).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
  });

  it("rechaza un archivo mal armado", () => {
    expect(() => leerAlojamientoSePideA("otra,cosa\n")).toThrow(/primera fila/);
    expect(() => leerAlojamientoSePideA("destino,alojamiento,proveedor,nota\nPNT,,Factoria,x\n")).toThrow(/fila 2/);
    expect(() => leerAlojamientoSePideA("destino,alojamiento,proveedor,nota\nPNT,Factoria,,x\n")).toThrow(/fila 2/);
  });

  it("resuelve el proveedor por nombre, sin mayúsculas ni acentos; null si no está", () => {
    expect(conProveedorDelAlojamiento(reglas, [proveedor("x", "FACTORIA (Hostel de Vértice)", ["a@b.test"])])[0].proveedorDelDirectorio?.id).toBe("x");
    expect(conProveedorDelAlojamiento(reglas, [H.vertice])[0].proveedorDelDirectorio).toBeNull();
  });
});

describe("armarPedidos — el pedido de Factoria va a Factoria (filas 1 a 3)", () => {
  it("fila 1: ARCH31 como DK1592913 (OD017 dentro del tour, doble) → un pedido a Factoria con su alojamiento; ninguno a Vértice", () => {
    const od017 = paquetePnt("OD017");
    const arch31 = producto("prod-ARCH31", "ARCH31", [], { esTour: true, componentes: [componente("comp-od017", 1, 1, 3, od017)] });
    const res = reserva({
      productoId: arch31.id,
      habitacion: "Double Room - Hostel",
      fechaInicio: "2027-03-16",
      fechaFin: "2027-03-19",
      partes: [parte({ id: "parte-1", orden: 1, tipo: "paquete", productoId: od017.id, productoComponenteId: "comp-od017", fechaInicio: "2027-03-16", fechaFin: "2027-03-19" })],
    });
    const r = ok(armarPedidos(res, catalogo([arch31, od017]), plantilla));
    const [p, ...otros] = delAlojamiento(r);
    expect(otros).toEqual([]);
    expect(p.proveedores.map((x) => x.nombre)).toEqual(["Factoria (hostel de Vertice)"]);
    expect(p.destinatarios).toEqual(["reservas@factoria.test"]);
    expect(p.cuerpo).toContain("Alojamiento: Factoria");
    expect(r.pedidos.some((x) => x.proveedores.some((y) => y.id === H.vertice.id))).toBe(false);
    expect(r.pedidos.some((x) => x.destinatarios.includes("ventas@vertice.test"))).toBe(false);
  });

  it("fila 2: con un W Trek que va a Vértice, dos pedidos: Factoria con el alojamiento y Vértice con el trek", () => {
    const ch10 = paquetePnt("CH10", true);
    const r = ok(armarPedidos(reserva({ productoId: ch10.id, habitacion: "Double Room - Hostel", fechaInicio: "2027-03-01", fechaFin: "2027-03-06" }), catalogo([ch10]), plantilla));
    const factoria = r.pedidos.filter((p) => p.proveedores.some((x) => x.id === H.factoria.id));
    const vertice = r.pedidos.filter((p) => p.proveedores.some((x) => x.id === H.vertice.id));
    expect(factoria).toHaveLength(1);
    expect(vertice).toHaveLength(1);
    expect(factoria[0]).not.toBe(vertice[0]);
    expect(factoria[0].cuerpo).toContain("Alojamiento: Factoria");
    expect(factoria[0].cuerpo).not.toContain("W Trek");
    expect(vertice[0].cuerpo).toContain("W Trek Standard");
    expect(vertice[0].cuerpo).not.toContain("Alojamiento: Factoria");
    expect(vertice[0].destinatarios).toEqual(["ventas@vertice.test"]);
  });

  it.each(["Double Room - Hostel", "Twin Room - Hostel", "Single Room - Hostel", "Triple Room - Hostel"])(
    "fila 3: %s → Factoria elegida por M3-11, pedida a Factoria",
    (habitacion) => {
      const od017 = paquetePnt("OD017");
      const r = ok(armarPedidos(reserva({ productoId: od017.id, habitacion, fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogo([od017]), plantilla));
      const [p] = delAlojamiento(r);
      expect(p.cuerpo).toContain("Alojamiento: Factoria");
      expect(p.destinatarios).toEqual(["reservas@factoria.test"]);
      // M3-11 sigue avisando las otras opciones.
      expect(p.avisos.join("\n")).toContain("otras: Last Hope, Puma Hostel)");
    },
  );

  it("dorm → Puma Hostel: la regla de Factoria no toca a los otros hostels", () => {
    const od017 = paquetePnt("OD017");
    const r = ok(armarPedidos(reserva({ productoId: od017.id, habitacion: "Dormitory - Hostel", fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogo([od017]), plantilla));
    expect(delAlojamiento(r).map((p) => p.destinatarios)).toEqual([["info@pumahouse.test"]]);
  });
});

describe("si Factoria no está en el directorio (fila 5)", () => {
  it("el pedido queda como hoy (a Vértice), sin inventar un mail, y con un aviso", () => {
    const od017 = paquetePnt("OD017");
    const sinFactoria = conProveedorDelAlojamiento(reglas, DIRECTORIO.filter((p) => p !== H.factoria));
    const r = ok(armarPedidos(reserva({ productoId: od017.id, habitacion: "Double Room - Hostel", fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogo([od017], { alojamientoSePideA: sinFactoria }), plantilla));
    const [p] = delAlojamiento(r);
    expect(p.destinatarios).toEqual(["ventas@vertice.test"]);
    expect(p.avisos.join("\n")).toContain('"Factoria (hostel de Vertice)" no está en el directorio de proveedores');
  });
});

describe("lo demás no cambia (fila 6)", () => {
  it("sin la regla cargada, Factoria sigue yendo a Vértice como antes", () => {
    const od017 = paquetePnt("OD017");
    const r = ok(armarPedidos(reserva({ productoId: od017.id, habitacion: "Double Room - Hostel", fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogo([od017], { alojamientoSePideA: [] }), plantilla));
    const [p] = delAlojamiento(r);
    expect(p.destinatarios).toEqual(["ventas@vertice.test"]);
    expect(p.avisos.join("\n")).not.toContain("directorio");
  });

  it("un Factoria en otro destino no se toca", () => {
    const otro = paquetePnt("OD099", false, "FTE");
    const r = ok(armarPedidos(reserva({ productoId: otro.id, habitacion: null, fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogo([otro], { hostelSegunHabitacion: [] }), plantilla));
    // Sin habitación va la primera opción (Puma); se fuerza Factoria primero con una regla de hostel de ese destino.
    expect(delAlojamiento(r).map((p) => p.destinatarios)).toEqual([["info@pumahouse.test"]]);
    const conRegla = ok(
      armarPedidos(
        reserva({ productoId: otro.id, habitacion: "Double Room - Hostel", fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }),
        catalogo([otro], { hostelSegunHabitacion: [{ destino: "FTE", habitacion: "privada", orden: ["Factoria"] }] }),
        plantilla,
      ),
    );
    expect(delAlojamiento(conRegla).map((p) => p.destinatarios)).toEqual([["ventas@vertice.test"]]);
  });
});
