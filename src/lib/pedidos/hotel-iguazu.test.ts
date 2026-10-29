// Spec M3-12 — el pedido del paquete 105 Premium de Iguazú (Cuenca del Plata) lleva el hotel de
// cada día (TRF IN, cada excursión, el día del cruce, TRF OUT) y deja claro que es Premium.
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoCon, componente, parte, producto, reserva, servicio } from "./fixtures.test-utils";
import type { ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const ALOJAMIENTO_PENDIENTE = "Les pasamos el alojamiento para el pick up apenas lo tengamos.";

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const PAQUETE_105 =
  "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata\nIncludes: Transfer in + Out, Excursion Cataratas Argentinas, Excursion Cataratas Brasileras";

/** OD010A como en el catálogo: el hotel 3* El Pueblito (a Cuenca del Plata) y el Paquete 105 Premium. */
function od010a(id = "prod-od010a") {
  return producto(id, "OD010A", [
    servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Beer Hostel", bookingSupplier: P.ajiVerde }),
    servicio({ productoId: id, tipo: "alojamiento", nivel: "Hotel 3*", orden: 2, serviceProviderNombre: "Hotel 3* El Pueblito", bookingSupplier: P.pueblito }),
    servicio({ productoId: id, tipo: "excursion", orden: 4, descripcion: PAQUETE_105, serviceProviderNombre: "Paquete Receptvo 105 Premium", bookingSupplier: P.cuenca }),
  ], { destino: "IGR" });
}

const reservaOd010a = (extra: Parameters<typeof reserva>[0] = {}) =>
  reserva({ productoId: "prod-od010a", fechaInicio: "2026-10-03", fechaFin: "2026-10-06", habitacion: "Double Room - Hotel 3*", ...extra });

const pedidoCuenca = (r: ReturnType<typeof ok>) => r.pedidos.find((p) => p.cuerpo.includes("TRF IN"))!;
const renglon = (cuerpo: string, empieza: string) => cuerpo.split("\n").find((l) => l.startsWith(empieza)) ?? "";

describe("M3-12 — Iguazú: el pedido a Cuenca del Plata lleva el hotel de cada día", () => {
  const p = pedidoCuenca(ok(armarPedidos(reservaOd010a(), catalogoCon([od010a()]), plantilla)));

  it("1. TRF IN con el hotel de la primera noche (drop off)", () => {
    expect(renglon(p.cuerpo, "TRF IN")).toBe(
      // M3-28 (owner, 2026-10-28): en el 105 Premium los transfers no dicen "regular".
      "TRF IN: 3 oct 2026 · Bus o vuelo pendiente · Drop off: Hotel 3* El Pueblito (Iguazú) · hotel a confirmar",
    );
  });

  it("2. cada excursión con el hotel de esa noche (pick up y drop off)", () => {
    expect(renglon(p.cuerpo, "Lado argentino")).toBe(
      "Lado argentino, Premium, en inglés: 4 oct 2026 · Pick up y drop off: Hotel 3* El Pueblito (Iguazú) · hotel a confirmar",
    );
    expect(renglon(p.cuerpo, "Lado brasileño")).toBe(
      "Lado brasileño, Premium, en inglés: 5 oct 2026 · Pick up y drop off: Hotel 3* El Pueblito (Iguazú) · hotel a confirmar",
    );
  });

  it("4. TRF OUT con el hotel de la última noche (pick up)", () => {
    expect(renglon(p.cuerpo, "TRF OUT")).toBe(
      "TRF OUT: 6 oct 2026 · Bus o vuelo pendiente · Pick up: Hotel 3* El Pueblito (Iguazú) · hotel a confirmar",
    );
  });

  it("el título dice Paquete 105 Premium y ninguna excursión dice 'regular'", () => {
    expect(p.cuerpo).toContain("Paquete 105 Premium");
    expect(p.cuerpo).not.toMatch(/Lado (argentino|brasileño), regular/);
  });

  it("3. combinado (OD010D): el día del cruce pick up en el hotel de Brasil y drop off en el de Argentina", () => {
    const id = "prod-od010d";
    const od010d = producto(id, "OD010D", [
      servicio({
        productoId: id, tipo: "alojamiento", nivel: "Hotel 3*", orden: 3, serviceProviderNombre: "Nacional inn Foz", bookingSupplier: P.dannInn,
        tramosNoches: [{ nocheDesde: 1, noches: 2, lugar: "Foz do Iguaçu (lado brasileño)" }],
      }),
      servicio({
        productoId: id, tipo: "alojamiento", nivel: "Hotel 3*", orden: 4, serviceProviderNombre: "El Pueblito", bookingSupplier: P.pueblito,
        tramosNoches: [{ nocheDesde: 3, noches: 1, lugar: "Puerto Iguazú (lado argentino)" }],
      }),
      servicio({ productoId: id, tipo: "excursion", orden: 7, descripcion: PAQUETE_105.replace("Premium.", "Premium x Foz."), serviceProviderNombre: "Paquete Receptvo 105 Premium x Foz", bookingSupplier: P.cuenca }),
    ], { destino: "IGR" });
    const c = pedidoCuenca(ok(armarPedidos(reservaOd010a({ productoId: id }), catalogoCon([od010d]), plantilla))).cuerpo;
    expect(renglon(c, "TRF IN")).toContain("· Drop off: Nacional inn Foz (Foz do Iguaçu) · hotel a confirmar");
    expect(renglon(c, "Lado brasileño")).toBe(
      "Lado brasileño, Premium, en inglés: 4 oct 2026 · Pick up y drop off: Nacional inn Foz (Foz do Iguaçu) · hotel a confirmar",
    );
    expect(renglon(c, "Lado argentino")).toBe(
      "Lado argentino, Premium, en inglés: 5 oct 2026 · Pick up: Nacional inn Foz (Foz do Iguaçu) · hotel a confirmar · Drop off: El Pueblito (Puerto Iguazú) · hotel a confirmar",
    );
    expect(c).toContain("Ese día cruzan: el drop off es en el hotel de Argentina. Los pasajeros hacen check out y llevan el equipaje");
    expect(renglon(c, "TRF OUT")).toContain("· Pick up: El Pueblito (Puerto Iguazú) · hotel a confirmar");
  });

  it("M3-36. combinado al revés (OD010C, Argentina → Brasil): el día del cruce pick up en el hotel de Argentina y drop off en el de Brasil", () => {
    const id = "prod-od010c";
    const od010c = producto(id, "OD010C", [
      servicio({
        productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Beer", bookingSupplier: P.ajiVerde,
        tramosNoches: [{ nocheDesde: 1, noches: 2, lugar: "Puerto Iguazú (lado argentino)" }],
      }),
      servicio({
        productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 2, serviceProviderNombre: "Bambu", bookingSupplier: P.dannInn,
        tramosNoches: [{ nocheDesde: 3, noches: 1, lugar: "Foz do Iguaçu (lado brasileño)" }],
      }),
      servicio({ productoId: id, tipo: "excursion", orden: 7, descripcion: PAQUETE_105, serviceProviderNombre: "Paquete Receptvo 105 Premium", bookingSupplier: P.cuenca }),
    ], { destino: "IGR" });
    const r = ok(
      armarPedidos(
        reservaOd010a({ productoId: id, fechaInicio: "2027-01-30", fechaFin: "2027-02-02", habitacion: "Double Room - Hostel" }),
        catalogoCon([od010c]),
        plantilla,
      ),
    );
    const c = pedidoCuenca(r).cuerpo;
    const beer = "Beer (Puerto Iguazú) · hotel a confirmar";
    const bambu = "Bambu (Foz do Iguaçu) · hotel a confirmar";
    expect(renglon(c, "TRF IN")).toBe(`TRF IN: 30 ene 2027 · Bus o vuelo pendiente · Drop off: ${beer}`);
    expect(renglon(c, "Lado argentino")).toBe(`Lado argentino, Premium, en inglés: 31 ene 2027 · Pick up y drop off: ${beer}`);
    expect(renglon(c, "Lado brasileño")).toBe(`Lado brasileño, Premium, en inglés: 1 feb 2027 · Pick up: ${beer} · Drop off: ${bambu}`);
    expect(c).toContain("Ese día cruzan: el drop off es en el hotel de Brasil. Los pasajeros hacen check out y llevan el equipaje");
    expect(c).not.toContain("el drop off es en el hotel de Argentina");
    expect(c.indexOf("Ese día cruzan")).toBeGreaterThan(c.indexOf("Lado brasileño"));
    expect(renglon(c, "TRF OUT")).toBe(`TRF OUT: 2 feb 2027 · Bus o vuelo pendiente · Pick up: ${bambu}`);
  });

  it("5a. hotel que reserva la agencia: sale sin 'a confirmar'", () => {
    const r = ok(
      armarPedidos(
        reservaOd010a({ hotelesAgencia: [{ nombre: "Hotel Saint George", desde: "2026-10-03", hasta: "2026-10-06" }] }),
        catalogoCon([od010a()]),
        plantilla,
      ),
    );
    const c = pedidoCuenca(r).cuerpo;
    expect(renglon(c, "TRF IN")).toMatch(/· Drop off: Hotel Saint George$/);
    expect(renglon(c, "Lado argentino")).toMatch(/· Pick up y drop off: Hotel Saint George$/);
    expect(renglon(c, "TRF OUT")).toMatch(/· Pick up: Hotel Saint George$/);
    expect(c).not.toContain("hotel a confirmar");
  });

  it("5b. sin hotel conocido: 'alojamiento a confirmar' y el pendiente de alojamiento (una vez)", () => {
    // Sin nivel en la habitación: no se elige hotel y no hay estadía.
    const r = ok(armarPedidos(reservaOd010a({ habitacion: null }), catalogoCon([od010a()]), plantilla));
    const pedido = pedidoCuenca(r);
    expect(renglon(pedido.cuerpo, "TRF IN")).toContain("· Drop off: alojamiento a confirmar");
    expect(renglon(pedido.cuerpo, "Lado argentino")).toContain("· Pick up y drop off: alojamiento a confirmar");
    expect(renglon(pedido.cuerpo, "TRF OUT")).toContain("· Pick up: alojamiento a confirmar");
    expect(pedido.cuerpo.split(ALOJAMIENTO_PENDIENTE)).toHaveLength(2);
  });

  it("si la agencia mandó un pick up, manda ese (como hoy)", () => {
    const r = ok(
      armarPedidos(
        reservaOd010a({ partes: [parte({ id: "p1", orden: 1, tipo: "paquete", productoId: "prod-od010a", fechaInicio: "2026-10-03", fechaFin: "2026-10-06", pickUp: "Hotel Sol" })] }),
        catalogoCon([od010a()]),
        plantilla,
      ),
    );
    const c = pedidoCuenca(r).cuerpo;
    expect(c).toContain("Pick up: Hotel Sol");
    expect(c).not.toContain("El Pueblito (Iguazú)");
  });

  it("6. dentro de BRARCH26 (llega y sale en bus, ajuste 'reemplazar'): también lleva el hotel y dice Premium", () => {
    const base = od010a();
    const conAjuste = {
      ...base,
      servicios: base.servicios.map((s) =>
        s.tipo === "excursion"
          ? { ...s, ajusteTour: { accion: "reemplazar" as const, texto: "Paquete Receptvo 105 Premium con transfer in desde la Rodoviaria de Foz y transfer out a la terminal de buses de Puerto Iguazú", motivo: "Llega en bus a Foz y sigue en bus desde Puerto Iguazú.", origen: "excepcion" as const } }
          : s,
      ),
    };
    const comp = componente("comp-od010a", 3, 5, 3, conAjuste);
    const tour = producto("prod-brarch26", "BRARCH26", [], { esTour: true, componentes: [comp] });
    const r = ok(
      armarPedidos(
        reserva({
          productoId: tour.id,
          fechaInicio: "2027-03-01",
          fechaFin: "2027-03-17",
          habitacion: "Double Room - Hotel 3*",
          partes: [parte({ id: "p3", orden: 3, tipo: "paquete", productoId: base.id, productoComponenteId: comp.id, fechaInicio: "2027-03-05", fechaFin: "2027-03-08" })],
        }),
        catalogoCon([tour, base]),
        plantilla,
      ),
    );
    const c = pedidoCuenca(r).cuerpo;
    expect(c).toContain("Paquete 105 Premium con transfer in desde la Rodoviaria de Foz");
    expect(renglon(c, "TRF IN")).toBe("TRF IN: 5 mar 2027 · Bus o vuelo pendiente · Drop off: Hotel 3* El Pueblito (Iguazú) · hotel a confirmar");
    expect(renglon(c, "Lado argentino")).toBe("Lado argentino, Premium, en inglés: 6 mar 2027 · Pick up y drop off: Hotel 3* El Pueblito (Iguazú) · hotel a confirmar");
    expect(renglon(c, "TRF OUT")).toBe("TRF OUT: 8 mar 2027 · Bus o vuelo pendiente · Pick up: Hotel 3* El Pueblito (Iguazú) · hotel a confirmar");
  });

  it("si el paquete no es Premium, las excursiones quedan como hoy ('regular')", () => {
    const id = "prod-otro";
    const otro = producto(id, "IGX01", [
      servicio({ productoId: id, tipo: "excursion", orden: 1, descripcion: "Excursion: Paquete Receptivo 104. Booking Supplier: Cuenca del Plata\nIncludes: Transfer in + Out, Excursion Cataratas Argentinas, Excursion Cataratas Brasileras", serviceProviderNombre: "Paquete Receptivo 104", bookingSupplier: P.cuenca }),
    ], { destino: "IGR" });
    const c = pedidoCuenca(ok(armarPedidos(reservaOd010a({ productoId: id }), catalogoCon([otro]), plantilla))).cuerpo;
    expect(c).toContain("Paquete 104");
    expect(c).not.toContain("Premium");
    expect(renglon(c, "Lado argentino")).toMatch(/^Lado argentino, regular en inglés: 4 oct 2026 · /);
    // M3-28: solo el Premium deja de decir "regular" en los transfers.
    expect(renglon(c, "TRF IN")).toMatch(/^TRF IN, regular: /);
    expect(renglon(c, "TRF OUT")).toMatch(/^TRF OUT, regular: /);
  });
});
