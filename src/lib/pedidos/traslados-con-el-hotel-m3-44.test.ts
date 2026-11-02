/**
 * M3-44 #1 (owner, 2026-11-01, tercera ronda de M3-04): todo traslado nombra el hotel. El lugar genérico
 * ("accommodation", "La Paz Accommodation", "alojamiento en La Paz") se cambia por el hotel de la reserva en
 * esa ciudad (el que entra la fecha de la llegada / sale la de la salida, la búsqueda de M3-42). Sin hotel, igual.
 */
import { describe, expect, it } from "vitest";
import { armarPedidos, lugarGenericoDelTraslado } from "./armar";
import { cargarPlantilla } from "./plantilla";
import { catalogoCon, parte, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { DetalleProducto } from "@/lib/catalogo/tipos";
import type { ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const CL_MUNDO = proveedor("prov-clmundo", "CL Mundo", ["reservas@clmundo.test"]);
const IMPERIO = proveedor("prov-imperio44", "Imperio Inca", ["reservas@imperioinca.test"]);
const TRANSVIP = proveedor("prov-transvip", "Transvip", ["reservas@transvip.test"]);
const HOSTAL = proveedor("prov-providencia", "Hostal Providencia", ["reservas@providencia.test"]);
const BREW = proveedor("prov-brew", "The Adventure Brew Hostel", ["reservas@brew.test"]);
const BACKPACKERS = proveedor("prov-bp44", "San Pedro Backpackers", ["reservas@bp.test"]);

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

function cuerpoA(r: ReturnType<typeof ok>, mail: string): string {
  const p = r.pedidos.find((x) => x.destinatarios.includes(mail));
  if (!p) throw new Error(`No hay pedido a ${mail}`);
  return p.cuerpo;
}

/** Un paquete con su hotel (o sin él) y un traslado, armado del `desde` al `hasta`. */
function armar(prod: DetalleProducto, desde: string, hasta: string) {
  return ok(
    armarPedidos(
      reserva({ productoId: prod.id, partes: [parte({ id: "p", orden: 1, tipo: "paquete", productoId: prod.id, fechaInicio: desde, fechaFin: hasta })] }),
      catalogoCon([prod]),
      plantilla,
    ),
  );
}

function paquete(id: string, codigo: string, destino: string, traslado: Parameters<typeof servicio>[0], hotel: { nombre: string; prov: typeof HOSTAL } | null) {
  const servicios = [
    ...(hotel
      ? [servicio({ productoId: id, tipo: "alojamiento", orden: 1, descripcion: `Accommodation: ${hotel.nombre}. Booking Supplier: ${hotel.nombre}`, serviceProviderNombre: hotel.nombre, bookingSupplier: hotel.prov })]
      : []),
    servicio({ ...traslado, productoId: id, orden: 2 }),
  ];
  return producto(id, codigo, servicios, { destino });
}

describe("M3-44 #1 — el lugar genérico del traslado", () => {
  it.each([
    ["Transfer SCL - accommodation", "Transfer SCL - Hotel X"],
    ["Transfer La Paz Airport - La Paz Accommodation", "Transfer La Paz Airport - Hotel X"],
    ["Transfer in CJC - Accommodation in San Pedro de Atacama", "Transfer in CJC - Hotel X"],
    ["Transfer terminal de buses de La Paz - alojamiento en La Paz", "Transfer terminal de buses de La Paz - Hotel X"],
    ["Transfer alojamiento en San Pedro de Atacama - aeropuerto de Calama (CJC)", "Transfer Hotel X - aeropuerto de Calama (CJC)"],
    ["Transfer regular alojamiento en Montevideo - aeropuerto de Carrasco (MVD)", "Transfer regular Hotel X - aeropuerto de Carrasco (MVD)"],
    ["Transfer SLA – Accommodation – SLA", "Transfer SLA – Hotel X – SLA"],
  ])("%s → %s", (texto, esperado) => {
    expect(lugarGenericoDelTraslado(texto)?.con("Hotel X")).toBe(esperado);
  });

  it("dice si el alojamiento está al principio (salida) o después (llegada)", () => {
    expect(lugarGenericoDelTraslado("Transfer alojamiento en La Paz - aeropuerto")?.alPrincipio).toBe(true);
    expect(lugarGenericoDelTraslado("Transfer SCL - accommodation")?.alPrincipio).toBe(false);
  });

  it.each(["Transfer SCL - Hostal Providencia", "Paquete Receptvo 105 Premium con transfer in desde la Rodoviaria de Foz", "Transfer EZE o AEP - Hotel - EZE o AEP"])(
    "%s no tiene lugar genérico",
    (texto) => expect(lugarGenericoDelTraslado(texto)).toBeNull(),
  );
});

describe("M3-44 #1 — el renglón del traslado con el hotel de la reserva", () => {
  it("CL Mundo (UK1598158): Transfer SCL - accommodation → Transfer SCL - Hostal Providencia", () => {
    const od029 = paquete(
      "prod-od029",
      "OD029",
      "SCL",
      { tipo: "traslado", productoId: "", sentido: "llegada", descripcion: "Transfer SCL - accommodation. Booking Supplier: CL Mundo", bookingSupplier: CL_MUNDO },
      { nombre: "Hostal Providencia", prov: HOSTAL },
    );
    const r = armar(od029, "2026-12-01", "2026-12-03");
    expect(cuerpoA(r, "reservas@clmundo.test")).toContain("Traslado de llegada: Transfer SCL - Hostal Providencia\n");
    // El pedido al hotel no cambia.
    expect(cuerpoA(r, "reservas@providencia.test")).toContain("Alojamiento: Hostal Providencia");
  });

  it("Imperio Inca: Transfer La Paz Airport - La Paz Accommodation → con el hotel en La Paz", () => {
    const od031 = paquete(
      "prod-od031",
      "OD031",
      "LPB",
      { tipo: "traslado", productoId: "", sentido: "llegada", descripcion: "Transfer La Paz Airport - La Paz Accommodation. Booking Supplier: Imperio Inca", bookingSupplier: IMPERIO },
      { nombre: "The Adventure Brew Hostel", prov: BREW },
    );
    expect(cuerpoA(armar(od031, "2026-12-01", "2026-12-03"), "reservas@imperioinca.test")).toContain(
      "Traslado de llegada: Transfer La Paz Airport - The Adventure Brew Hostel\n",
    );
  });

  it("salida: el hotel que sale ese día (Transfer alojamiento en San Pedro de Atacama - aeropuerto de Calama)", () => {
    const od030 = paquete(
      "prod-od030-44",
      "OD030",
      "SPA",
      { tipo: "traslado", productoId: "", sentido: "salida", descripcion: "Transfer alojamiento en San Pedro de Atacama - aeropuerto de Calama (CJC). Booking Supplier: Transvip", bookingSupplier: TRANSVIP },
      { nombre: "San Pedro Backpackers", prov: BACKPACKERS },
    );
    expect(cuerpoA(armar(od030, "2026-12-01", "2026-12-03"), "reservas@transvip.test")).toContain(
      "Traslado de salida: Transfer San Pedro Backpackers - aeropuerto de Calama (CJC)\n",
    );
  });

  it("sin hotel en la reserva, el texto queda como hoy", () => {
    const od029 = paquete(
      "prod-od029b",
      "OD029",
      "SCL",
      { tipo: "traslado", productoId: "", sentido: "llegada", descripcion: "Transfer SCL - accommodation. Booking Supplier: CL Mundo", bookingSupplier: CL_MUNDO },
      null,
    );
    expect(cuerpoA(armar(od029, "2026-12-01", "2026-12-03"), "reservas@clmundo.test")).toContain("Traslado de llegada: Transfer SCL - accommodation\n");
  });

  it("el hotel de otra ciudad no se usa", () => {
    const od029 = paquete(
      "prod-od029c",
      "OD029",
      "LPB",
      { tipo: "traslado", productoId: "", sentido: "llegada", descripcion: "Transfer SCL - accommodation. Booking Supplier: CL Mundo", bookingSupplier: CL_MUNDO },
      { nombre: "The Adventure Brew Hostel", prov: BREW },
    );
    expect(cuerpoA(armar(od029, "2026-12-01", "2026-12-03"), "reservas@clmundo.test")).toContain("Traslado de llegada: Transfer SCL - accommodation\n");
  });
});
