/**
 * M3-19: el pedido del W Trek (servicio «otro», a Las Torres) dice el tipo de alojamiento del trek
 * (owner, 2026-10-23, DK1594177): Refugio Dorm a compartir · Tent DBL · Tent SGL. Si no se puede
 * saber, "a confirmar" con las tres opciones y un aviso. El Overland, los alojamientos de Puerto
 * Natales, las excursiones y los traslados no cambian.
 */
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { alojamientoDelTrek } from "./formato";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoChb31, catalogoCon, producto, reserva, reservaChb31, servicio } from "./fixtures.test-utils";
import type { ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const A_CONFIRMAR = "a confirmar (Refugio Dorm a compartir / Tent DBL / Tent SGL)";

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

describe("alojamientoDelTrek (fila 1: un caso por fila de la tabla)", () => {
  it.each([
    // tent/carpa + doble/twin/matrimonial → Tent DBL (la habitación de DK1594177)
    ["Double Room - Hostel and W-Trek Tent", "Tent DBL"],
    ["Twin Room - Tent", "Tent DBL"],
    ["Carpa matrimonial", "Tent DBL"],
    // tent/carpa + single → Tent SGL
    ["Single Room - Hostel and W-Trek Tent", "Tent SGL"],
    ["Carpa single", "Tent SGL"],
    // dorm / refugio / shared → Refugio Dorm a compartir
    ["Dormitory - Hostel", "Refugio Dorm a compartir"],
    ["Refugio", "Refugio Dorm a compartir"],
    ["Shared room", "Refugio Dorm a compartir"],
    // doble/single sin tent ni refugio → la única opción privada del trek
    ["Double Room - Hostel", "Tent DBL"],
    ["Double Room - Hotel 3*", "Tent DBL"],
    // M3-21: un single que no menciona el trek no se asume Tent SGL (es mucho más caro)
    ["Single Room - Hostel", A_CONFIRMAR],
    // no se puede saber
    [null, A_CONFIRMAR],
    ["   ", A_CONFIRMAR],
    ["Triple Room - Hotel 3*", A_CONFIRMAR],
    ["Budget Hotel", A_CONFIRMAR],
    // la parte del trek manda: dorm en el hostel, carpa sin decir de cuántos en el trek
    ["Dormitory - Hostel and W-Trek Tent", A_CONFIRMAR],
  ])("%s → %s", (habitacion, esperado) => {
    expect(alojamientoDelTrek(habitacion)).toBe(esperado);
  });
});

const trek = (nombre: string) =>
  producto("prod-wtrek", "CH11", [
    servicio({ productoId: "prod-wtrek", tipo: "otro", orden: 1, descripcion: `${nombre}. Booking Supplier: Las Torres`, serviceProviderNombre: nombre, bookingSupplier: P.cuenca, tramosNoches: [{ nocheDesde: 1, noches: 3, lugar: "refugios" }] }),
  ], { destino: "PNT" });

function pedidoDelTrek(nombre: string, habitacion: string | null) {
  const r = ok(armarPedidos(reserva({ productoId: "prod-wtrek", habitacion, fechaInicio: "2027-03-01", fechaFin: "2027-03-04" }), catalogoCon([trek(nombre)]), plantilla));
  return r.pedidos.find((p) => p.cuerpo.includes(nombre))!;
}

const renglonTrek = (cuerpo: string) => cuerpo.split("\n").filter((l) => l.startsWith("Alojamiento en el trek:"));

describe("armarPedidos — el renglón del W Trek (filas 1 y 2)", () => {
  it("W Trek Express con la habitación de DK1594177 → Tent DBL, después de las fechas", () => {
    const p = pedidoDelTrek("W Trek Express", "Double Room - Hostel and W-Trek Tent");
    const l = p.cuerpo.split("\n");
    const i = l.findIndex((x) => x.startsWith("Desde: 1 mar 2027 · Hasta: 4 mar 2027"));
    expect(i).toBeGreaterThan(0);
    expect(l[i + 1]).toBe("Alojamiento en el trek: Tent DBL");
    expect(p.avisos.filter((a) => /trek/i.test(a))).toEqual([]);
  });

  it.each([
    ["W Trek Standard", "Single Room - Hostel and W-Trek Tent", "Alojamiento en el trek: Tent SGL"],
    ["W-Trek Express", "Dormitory - Hostel", "Alojamiento en el trek: Refugio Dorm a compartir"],
  ])("%s con %s → %s", (nombre, habitacion, esperado) => {
    expect(renglonTrek(pedidoDelTrek(nombre, habitacion).cuerpo)).toEqual([esperado]);
  });

  it("sin habitación: a confirmar con las tres opciones y un aviso para completarlo", () => {
    const p = pedidoDelTrek("W Trek Express", null);
    expect(renglonTrek(p.cuerpo)).toEqual([`Alojamiento en el trek: ${A_CONFIRMAR}`]);
    expect(p.avisos).toContain("Falta el tipo de alojamiento del W Trek Express: completalo antes de enviar.");
  });

  it("un servicio «otro» que no es el W Trek no lleva el renglón", () => {
    const p = pedidoDelTrek("Navegación Glaciar Grey", "Double Room - Hostel");
    expect(p.cuerpo).not.toContain("Alojamiento en el trek");
  });
});

describe("lo demás no cambia (filas 3 y 4)", () => {
  it("el Overland no lleva el renglón del trek y sigue con su habitación", () => {
    const r = ok(armarPedidos({ ...reservaChb31, habitacion: "Double Room - Hostel" }, catalogoChb31, plantilla));
    const cuerpo = r.pedidos.map((p) => p.cuerpo).join("\n");
    expect(cuerpo).not.toContain("Alojamiento en el trek");
    expect(cuerpo).toContain("Habitación: DBL con baño compartido");
  });
});
