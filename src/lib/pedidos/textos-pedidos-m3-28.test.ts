// Spec M3-28 — verificación 1 (unitarios): los textos de los pedidos de la segunda
// revisión del owner (2026-10-28). El asunto lleva "x N" con los pax de la reserva
// (sin cantidad, sin "x N" y con aviso); sin códigos internos; el paquete 105
// Premium de Cuenca del Plata no dice "regular" en los transfers; Transvip con una p.
import { describe, expect, it } from "vitest";
import { borradorAMano } from "./a-mano-borrador";
import { armarPedidos } from "./armar";
import { cargarPlantilla, completarAsunto } from "./plantilla";
import { catalogoChb31, catalogoCon, od010b, reservaChb31, reservaOd010b } from "./fixtures.test-utils";
import type { ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const AVISO_SIN_PAX = "La reserva no trae la cantidad de pasajeros: completala en el asunto (\"x N\") y en el texto.";

describe("M3-28 fila 1 — el asunto con los pax", () => {
  const pasajeros = [
    { nombre: "Ana", apellido: "Gómez" },
    { nombre: "Luis", apellido: "Pérez" },
    { nombre: "Eva", apellido: "Ruiz" },
  ];

  it.each([1, 2, 3])("%i pax → 'Ana Gómez x %i'", (pax) => {
    const r = ok(armarPedidos({ ...reservaOd010b, pax, pasajeros: pasajeros.slice(0, pax) }, catalogoCon([od010b]), plantilla));
    expect(r.pedidos[0].asunto).toBe(`Solicitud de reserva – Ana Gómez x ${pax} – 3 al 6 oct 2026`);
    expect(r.avisos).not.toContain(AVISO_SIN_PAX);
  });

  it("sin pax, cuenta los pasajeros de la reserva", () => {
    const r = ok(armarPedidos({ ...reservaOd010b, pax: null, pasajeros: pasajeros.slice(0, 3) }, catalogoCon([od010b]), plantilla));
    expect(r.pedidos[0].asunto).toBe("Solicitud de reserva – Ana Gómez x 3 – 3 al 6 oct 2026");
  });

  it("sin cantidad: sin 'x N' y con aviso", () => {
    const r = ok(armarPedidos({ ...reservaOd010b, pax: null, pasajeros: [] }, catalogoCon([od010b]), plantilla));
    expect(r.pedidos[0].asunto).toBe("Solicitud de reserva – sin nombre – 3 al 6 oct 2026");
    expect(r.avisos).toContain(AVISO_SIN_PAX);
  });

  it("sin fechas: 'x N' al final, sin guion colgando", () => {
    const p = ok(armarPedidos({ ...reservaOd010b, fechaInicio: null, fechaFin: null, partes: [] }, catalogoCon([od010b]), plantilla)).pedidos[0];
    expect(p.asunto).toBe("Solicitud de reserva – Ana Gómez x 2");
  });

  it("en todos los pedidos de la reserva (CHB31: cada proveedor)", () => {
    const r = ok(armarPedidos(reservaChb31, catalogoChb31, plantilla));
    expect(r.pedidos.length).toBeGreaterThan(1);
    for (const p of r.pedidos) expect(p.asunto).toMatch(/^Solicitud de reserva – Ana Gómez x 2 – \d/);
  });

  it("el pedido a mano también", () => {
    const base = { numero: "DK1592913", pasajeros: [{ nombre: "Ana", apellido: "Prueba" }] };
    expect(borradorAMano({ ...base, pax: 1, fechaInicio: "2027-03-05", fechaFin: "2027-03-10" }, plantilla).asunto).toBe(
      "Solicitud de reserva – Ana Prueba x 1 – 5 al 10 mar 2027",
    );
    expect(borradorAMano({ numero: null, pax: null, pasajeros: [] }, plantilla).asunto).toBe("Solicitud de reserva – sin nombre");
  });

  it("completarAsunto: un {{pax}} vacío se lleva su 'x'", () => {
    expect(completarAsunto("Solicitud de reserva – {{pasajero}} x {{pax}} – {{fechas}}", { pasajero: "Ana", pax: "", fechas: "5 mar 2027" })).toBe(
      "Solicitud de reserva – Ana – 5 mar 2027",
    );
    expect(completarAsunto("Reserva {{pasajero}} x{{pax}}", { pasajero: "Ana", pax: "" })).toBe("Reserva Ana");
  });
});

describe("M3-28 fila 2 — sin códigos internos en el asunto (reserva como DK1595221)", () => {
  it("con número de Kilroy y dos productos, ningún asunto lleva el número ni los códigos", () => {
    const r = ok(
      armarPedidos({ ...reservaChb31, numero: "DK1595221/ab12", otrosProductos: [od010b.id] }, { ...catalogoChb31, detalles: new Map([...catalogoChb31.detalles, [od010b.id, od010b]]) }, plantilla),
    );
    for (const p of r.pedidos) expect(p.asunto).not.toMatch(/DK1595221|CHB31|OD030|COMPBO20|OD010B|Ref\./);
  });
});

describe("M3-28 fila 3 — el 105 Premium de Cuenca del Plata no dice 'regular'", () => {
  const renglones = (cuerpo: string) => cuerpo.split("\n").filter((l) => /^TRF (IN|OUT)/.test(l));

  it.each(["OD010A", "OD010B"])("%s: los transfers in y out sin 'regular'", (codigo) => {
    const prod = { ...od010b, id: `prod-${codigo}`, codigo, servicios: od010b.servicios.map((s) => ({ ...s, productoId: `prod-${codigo}` })) };
    const p = ok(armarPedidos({ ...reservaOd010b, productoId: prod.id }, catalogoCon([prod]), plantilla)).pedidos[0];
    const trf = renglones(p.cuerpo);
    expect(trf).toHaveLength(2);
    for (const l of trf) expect(l).not.toMatch(/regular/i);
    expect(trf[0]).toMatch(/^TRF IN: 3 oct 2026 · Bus o vuelo pendiente/);
    expect(trf[1]).toMatch(/^TRF OUT: 6 oct 2026 · Bus o vuelo pendiente/);
    expect(p.cuerpo).not.toMatch(/regular/i);
  });
});

describe("M3-28 fila 4 — Transvip con una p", () => {
  it("la tarea del traslado de Transvip dice 'Transvip' aunque el Excel diga 'Transvipp'", () => {
    const r = ok(armarPedidos(reservaChb31, catalogoChb31, plantilla));
    const manual = r.tareas.filter((t) => t.tipo === "reservar_a_mano");
    expect(manual).toHaveLength(1);
    expect(manual[0].texto).toMatch(/^Reservar a mano en Transvip: /);
    expect(JSON.stringify(r)).not.toMatch(/Transvipp/i);
  });
});
