// Spec M3-34 — verificación 1 (unitarios): todo pedido con al menos una excursión pide que
// reconfirmen el horario, después del bloque de servicios y antes de los pasajeros. Singular
// con una sola excursión; sin excursiones (hotel, traslado, bus), sin renglón.
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { cargarPlantilla } from "./plantilla";
import {
  P,
  catalogoChb31,
  catalogoCon,
  od010b,
  parte,
  producto,
  reserva,
  reservaChb31,
  reservaOd010b,
  servicio,
} from "./fixtures.test-utils";
import type { ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const PLURAL = "¿Nos confirman el horario de las excursiones, por favor?";
const SINGULAR = "¿Nos confirman el horario de la excursión, por favor?";

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const pedidoA = (r: ReturnType<typeof ok>, mail: string) => {
  const p = r.pedidos.find((x) => x.destinatarios.includes(mail));
  if (!p) throw new Error(`No hay pedido a ${mail}`);
  return p;
};

describe("M3-34 fila 1 — el pedido con excursiones pide el horario", () => {
  it("Cuenca del Plata (OD010B: El Pueblito + Paquete 105 Premium): el renglón va entre el paquete y los pax", () => {
    const p = pedidoA(ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla)), "reservas8@cuencadelplata.com");
    expect(p.cuerpo).toContain(PLURAL);
    const i = p.cuerpo.indexOf(PLURAL);
    expect(p.cuerpo.indexOf("TRF OUT")).toBeLessThan(i);
    expect(p.cuerpo.indexOf("Lado brasileño")).toBeLessThan(i);
    expect(i).toBeLessThan(p.cuerpo.indexOf("Pasajeros:"));
    // Un renglón propio, con un blanco antes y después.
    expect(p.cuerpo).toMatch(new RegExp(`\\n\\n${PLURAL.replace(/[?¿]/g, "\\$&")}\\n\\nPasajeros:`));
  });

  it("OD010A (hostel + 105 Premium, a Cuenca del Plata) también lo lleva", () => {
    const od010a = producto("prod-od010a", "OD010A", od010b.servicios.map((s) => ({ ...s, productoId: "prod-od010a" })), { destino: "IGR" });
    const p = pedidoA(ok(armarPedidos({ ...reservaOd010b, productoId: od010a.id }, catalogoCon([od010a]), plantilla)), "reservas8@cuencadelplata.com");
    expect(p.cuerpo).toContain(PLURAL);
  });
});

describe("M3-34 fila 2 — singular con una sola excursión", () => {
  it("CHB31: el pedido a Horizonte (solo Geisers del Tatio) va en singular", () => {
    const p = pedidoA(ok(armarPedidos(reservaChb31, catalogoChb31, plantilla)), "reservas@horizonte.test");
    expect(p.cuerpo).toContain(SINGULAR);
    expect(p.cuerpo).not.toContain(PLURAL);
    expect(p.cuerpo.indexOf("Geisers")).toBeLessThan(p.cuerpo.indexOf(SINGULAR));
    expect(p.cuerpo.indexOf(SINGULAR)).toBeLessThan(p.cuerpo.indexOf("Pasajeros:"));
  });

  it("dos excursiones sueltas al mismo proveedor → plural", () => {
    const prod = producto("prod-exc2", "EXC2", [
      servicio({ productoId: "prod-exc2", tipo: "excursion", orden: 1, descripcion: "Excursion: Valle de la Luna. Booking Supplier: Horizonte Atacama", serviceProviderNombre: "Valle de la Luna", bookingSupplier: P.horizonte }),
      servicio({ productoId: "prod-exc2", tipo: "excursion", orden: 2, descripcion: "Excursion: Lagunas Altiplanicas. Booking Supplier: Horizonte Atacama", serviceProviderNombre: "Lagunas Altiplanicas", bookingSupplier: P.horizonte }),
    ], { destino: "SPA" });
    const r = ok(armarPedidos(reserva({ productoId: prod.id, fechaInicio: "2027-01-18", fechaFin: "2027-01-21" }), catalogoCon([prod]), plantilla));
    const p = pedidoA(r, "reservas@horizonte.test");
    expect(p.cuerpo).toContain(PLURAL);
    expect(p.cuerpo).not.toContain(SINGULAR);
  });
});

describe("M3-34 fila 3 — sin excursiones, sin renglón", () => {
  it("CHB31: el pedido de solo hotel (Don Raul) y el del Overland no lo llevan", () => {
    const r = ok(armarPedidos({ ...reservaChb31, habitacion: "Double Room - Hotel 3*" }, catalogoChb31, plantilla));
    const hotel = pedidoA(r, "reservas@donraul.test");
    expect(hotel.cuerpo).not.toMatch(/horario de la/);
    expect(pedidoA(r, "reservas@imperioinca.test").cuerpo).not.toMatch(/horario de la/);
  });

  it("un pedido de solo traslado no lo lleva", () => {
    const prod = producto("prod-trf", "TRF01", [
      servicio({ productoId: "prod-trf", tipo: "traslado", orden: 1, sentido: "llegada", descripcion: "Transfer in CJC - Accommodation in San Pedro de Atacama. Booking Supplier: Horizonte Atacama", bookingSupplier: P.horizonte }),
    ], { destino: "SPA" });
    const r = ok(
      armarPedidos(
        reserva({ productoId: prod.id, partes: [parte({ id: "t", orden: 1, tipo: "paquete", productoId: prod.id, fechaInicio: "2027-01-18", fechaFin: "2027-01-21" })] }),
        catalogoCon([prod]),
        plantilla,
      ),
    );
    const p = pedidoA(r, "reservas@horizonte.test");
    expect(p.cuerpo).toContain("Traslado de llegada");
    expect(p.cuerpo).not.toMatch(/horario de la/);
  });
});
