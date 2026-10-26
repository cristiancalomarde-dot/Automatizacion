/**
 * M3-23 (owner 2026-10-26): en OD027 (Salta and Jujuy) la noche en Purmamarca es en el mismo
 * hotel para todos los niveles (Posta de Purmamarca / Casa de Adobe). El alojamiento con nivel
 * "Todos los niveles" (data/niveles-confirmados.csv) se pide con cualquier nivel elegido, en su
 * noche, y no cuenta como un nivel más para elegir.
 */
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { cargarPlantilla } from "./plantilla";
import { catalogoCon, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { ResultadoArmado } from "./tipos";
import { NIVEL_TODOS } from "@/lib/catalogo/reglas";

const plantilla = cargarPlantilla();
const PR = {
  trotamundos: proveedor("prov-trota", "Trotamundos Hostel", ["trotamundos@test"]),
  inkai: proveedor("prov-inkai", "Inkai Hotel", ["inkai@test"]),
  posta: proveedor("prov-posta", "Ecohotel Posta de Purmamarca", ["posta@test"]),
};
const tramos = (...t: Array<[number, number, string]>) => t.map(([nocheDesde, noches, lugar]) => ({ nocheDesde, noches, lugar }));
const od027 = producto(
  "prod-od027",
  "OD027",
  [
    servicio({ productoId: "prod-od027", tipo: "alojamiento", orden: 1, nivel: "Hostel", serviceProviderNombre: "Trotamundos Salta", bookingSupplier: PR.trotamundos, tramosNoches: tramos([1, 1, "Salta"], [3, 2, "Salta"]) }),
    servicio({ productoId: "prod-od027", tipo: "alojamiento", orden: 2, nivel: "Hotel 3*", serviceProviderNombre: "Hotel 3* Inkai", bookingSupplier: PR.inkai, tramosNoches: tramos([1, 1, "Salta"], [3, 2, "Salta"]) }),
    servicio({ productoId: "prod-od027", tipo: "alojamiento", orden: 3, nivel: NIVEL_TODOS, serviceProviderNombre: "Posta de Purmamarca", bookingSupplier: PR.posta, tramosNoches: tramos([2, 1, "Purmamarca"]) }),
  ],
  { destino: "SLA" },
);

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}
const armar = (habitacion: string) =>
  ok(armarPedidos(reserva({ productoId: od027.id, habitacion, pax: 2, fechaInicio: "2026-12-19", fechaFin: "2026-12-23" }), catalogoCon([od027]), plantilla));

describe("M3-23 — un alojamiento para todos los niveles (Purmamarca)", () => {
  it.each([
    ["Double Room - Hotel 3*", "inkai@test", "trotamundos@test"],
    ["Double Hostel", "trotamundos@test", "inkai@test"],
  ])("%s: Salta del nivel elegido (noches 1 y 3-4) y Purmamarca la noche 2", (habitacion, elegido, otro) => {
    const r = armar(habitacion);
    const salta = r.pedidos.find((p) => p.destinatarios.includes(elegido))!;
    expect(salta.cuerpo).toContain("IN: 19 dic 2026\nOUT: 20 dic 2026 (1 noche)");
    expect(salta.cuerpo).toContain("IN: 21 dic 2026\nOUT: 23 dic 2026 (2 noches)");
    const posta = r.pedidos.find((p) => p.destinatarios.includes("posta@test"))!;
    expect(posta.cuerpo).toContain("Alojamiento: Posta de Purmamarca\nIN: 20 dic 2026\nOUT: 21 dic 2026 (1 noche)");
    expect(r.pedidos.some((p) => p.destinatarios.includes(otro))).toBe(false);
    expect(r.tareas.map((t) => t.texto).join("\n")).not.toMatch(/Elegir el hotel/);
  });

  it("sin nivel en la habitación sigue pidiendo elegir el hotel, sin contar 'Todos los niveles' como opción", () => {
    const r = armar("Double Room");
    const tarea = r.tareas.map((t) => t.texto).find((t) => /Elegir el hotel/.test(t))!;
    expect(tarea).toContain("(Hostel, Hotel 3*)");
  });
});

describe("M3-23 — excursión el día que cambia de alojamiento (Salta ↔ Purmamarca)", () => {
  const cienaga = proveedor("prov-cienaga", "la Cienaga", ["cienaga@test"]);
  const conExcursiones = producto(
    "prod-od027x",
    "OD027",
    [
      ...od027.servicios.map((s) => ({ ...s, productoId: "prod-od027x" })),
      servicio({ productoId: "prod-od027x", tipo: "excursion", orden: 5, serviceProviderNombre: "Humahuaca", descripcion: "Excursion: Humahuaca. Booking Supplier: La Cienaga", bookingSupplier: cienaga }),
      servicio({ productoId: "prod-od027x", tipo: "excursion", orden: 6, serviceProviderNombre: "Salinas y Purmamarca", descripcion: "Excursion: Salinas y Purmamarca. Booking Supplier: La Cienaga", bookingSupplier: cienaga }),
    ],
    { destino: "SLA" },
  );
  const dias = [
    { codigo: "OD027", orden: 6, dia: 2 },
    { codigo: "OD027", orden: 5, dia: 3 },
  ];
  const r = ok(
    armarPedidos(
      reserva({ productoId: conExcursiones.id, habitacion: "Double Room - Hotel 3*", pax: 2, fechaInicio: "2026-12-19", fechaFin: "2026-12-23" }),
      catalogoCon([conExcursiones], [], dias),
      plantilla,
    ),
  );
  const cuerpo = r.pedidos.find((p) => p.destinatarios.includes("cienaga@test"))!.cuerpo;

  it("Salinas (día 2): pick up en el hotel de Salta y drop off en Purmamarca, con la ciudad de cada uno", () => {
    expect(cuerpo).toContain("Excursión: Salinas y Purmamarca\nFecha: 20 dic 2026\nServicio: regular · Idioma: inglés\nPick up: Hotel 3* Inkai (Salta) · hotel a confirmar · Drop off: Posta de Purmamarca (Purmamarca) · hotel a confirmar\n");
  });

  it("Humahuaca (día 3): pick up en Purmamarca y drop off en el hotel de Salta", () => {
    expect(cuerpo).toContain("Excursión: Humahuaca\nFecha: 21 dic 2026\nServicio: regular · Idioma: inglés\nPick up: Posta de Purmamarca (Purmamarca) · hotel a confirmar · Drop off: Hotel 3* Inkai (Salta) · hotel a confirmar\n");
  });
});
