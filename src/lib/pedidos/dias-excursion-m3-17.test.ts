/**
 * M3-17 (owner 2026-10-23, feedback de operaciones G3): cada excursión va un día fijo de la
 * estadía en ese destino (día 1 = el de llegada), también dentro de los tours, con las reglas
 * reales de `data/dias-servicio.csv`. Si la estadía es más corta que el día, queda "a coordinar".
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { ARCHIVO_DIAS, leerDiasServicio } from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoCon, componente, parte, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { DetalleProducto } from "@/lib/catalogo/tipos";
import type { ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const dias = leerDiasServicio(readFileSync(ARCHIVO_DIAS, "utf8"));

const PR = {
  patagonia: proveedor("prov-pp", "Patagonia Planet", ["reservas@patagoniaplanet.test"]),
  rumbo: proveedor("prov-rumbo", "Rumbo Sur", ["reservas@rumbosur.test"]),
  madero: proveedor("prov-madero", "Madero Tango", ["reservas@maderotango.test"]),
  south: proveedor("prov-south", "South Road", ["reservas@southroad.test"]),
  chalten: proveedor("prov-chalten", "Chalten Travel", ["agencias@chaltentravel.test"]),
  peninsula: proveedor("prov-peninsula", "All Peninsula", ["reservas@allpeninsula.test"]),
  hostel: proveedor("prov-hostel", "Hostel de prueba", ["reservas@hostel.test"]),
};

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}
const a = (r: ReturnType<typeof ok>, mail: string) => r.pedidos.find((p) => p.destinatarios.includes(mail));
const renglon = (cuerpo: string, empieza: string) => cuerpo.split("\n").find((l) => l.startsWith(empieza)) ?? "";

/** Un componente con su hostel (orden 1) y sus excursiones como en el catálogo de pruebas. */
function prod(codigo: string, excursiones: Array<{ orden: number; nombre: string; proveedor: ReturnType<typeof proveedor> }>, destino: string): DetalleProducto {
  const id = `prod-${codigo.toLowerCase()}`;
  return producto(
    id,
    codigo,
    [
      servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: `Hostel ${codigo}`, bookingSupplier: PR.hostel }),
      ...excursiones.map((e) =>
        servicio({
          productoId: id,
          tipo: "excursion",
          orden: e.orden,
          descripcion: `Excursion: ${e.nombre}. Booking Supplier: ${e.proveedor.nombre}`,
          serviceProviderNombre: e.nombre,
          bookingSupplier: e.proveedor,
        }),
      ),
    ],
    { destino },
  );
}

const od017 = prod("OD017", [{ orden: 4, nombre: "Torres del Paine Full Day from Puerto Natales", proveedor: PR.patagonia }], "PNT");
const od022 = prod(
  "OD022",
  [
    { orden: 5, nombre: "Beagle Channel Boat Trip, 3 hours, no transfer to port", proveedor: PR.rumbo },
    { orden: 6, nombre: "Tierra del Fuego National Park half Day", proveedor: PR.rumbo },
  ],
  "USH",
);
const od018 = prod("OD018", [{ orden: 7, nombre: "Tango Show with dinner, drinks and transfers", proveedor: PR.madero }], "BUE");
const od013 = prod(
  "OD013",
  [
    { orden: 6, nombre: "Perito Moreno Glaciar Excursion", proveedor: PR.chalten },
    { orden: 7, nombre: "Torres del Paine Full Day from El Calafate", proveedor: PR.south },
  ],
  "FTE",
);
const od025 = prod("OD025", [{ orden: 5, nombre: "Peninsula Valdes Full Day", proveedor: PR.peninsula }], "PMY");

function suelto(p: DetalleProducto, desde: string, hasta: string) {
  const r = reserva({ productoId: p.id, habitacion: "Hostel Dorm", fechaInicio: desde, fechaFin: hasta });
  return ok(armarPedidos(r, catalogoCon([p], [], dias), plantilla));
}

describe("M3-17 — la fecha fija sale en el pedido (fila 2)", () => {
  it("OD017: llegada 16 mar → Torres del Paine el 17 mar, sin 'a coordinar' ni aviso de fecha", () => {
    const pp = a(suelto(od017, "2027-03-16", "2027-03-19"), "reservas@patagoniaplanet.test")!;
    expect(pp.cuerpo).toContain("Excursión: Torres del Paine Full Day from Puerto Natales\nFecha: 17 mar 2027\n");
    expect(pp.cuerpo).not.toContain("a coordinar");
    expect(pp.avisos.join("\n")).not.toMatch(/Falta la fecha/);
  });

  it("OD022: llegada el 1 → Beagle el 2 y Parque Nacional el 3", () => {
    const rumbo = a(suelto(od022, "2027-03-01", "2027-03-04"), "reservas@rumbosur.test")!;
    expect(rumbo.cuerpo).toContain("Excursión: Beagle Channel Boat Trip, 3 hours, no transfer to port\nFecha: 2 mar 2027\n");
    expect(rumbo.cuerpo).toContain("Excursión: Tierra del Fuego National Park half Day\nFecha: 3 mar 2027\n");
    expect(rumbo.cuerpo).not.toContain("a coordinar");
  });
});

describe("M3-17 — el Tango va de noche (fila 3)", () => {
  it("OD018: Tango el día 3, por la noche", () => {
    const madero = a(suelto(od018, "2027-03-18", "2027-03-21"), "reservas@maderotango.test")!;
    expect(madero.cuerpo).toContain("Excursión: Tango Show with dinner, drinks and transfers\nFecha: 20 mar 2027, por la noche\n");
  });
});

describe("M3-17 — estadía más corta que el día pedido (fila 6)", () => {
  it("OD013 con 2 noches: Torres del Paine (día 3) queda a coordinar con aviso; Perito Moreno (día 2) sale", () => {
    const r = suelto(od013, "2027-03-10", "2027-03-12");
    const south = a(r, "reservas@southroad.test")!;
    expect(south.cuerpo).toContain("Fecha: a coordinar (estadía del 10 al 12 mar 2027)");
    expect(south.avisos.join("\n")).toMatch(/Falta la fecha de Torres del Paine/);
    expect(a(r, "agencias@chaltentravel.test")!.cuerpo).toContain("Excursión: Perito Moreno Glaciar Excursion\nFecha: 11 mar 2027\n");
  });

  it("OD013 con 3 noches: Torres del Paine el día 3", () => {
    const south = a(suelto(od013, "2027-03-10", "2027-03-13"), "reservas@southroad.test")!;
    expect(south.cuerpo).toContain("Excursión: Torres del Paine Full Day from El Calafate\nFecha: 12 mar 2027\n");
  });
});

describe("M3-17 — dentro de un tour, desde el inicio de ese componente (fila 5)", () => {
  // AR09 (sintético): Puerto Madryn, El Calafate y Ushuaia.
  const ar09 = producto("prod-ar09", "AR09", [], {
    esTour: true,
    componentes: [componente("c-od025", 1, 1, 3, od025), componente("c-od013", 2, 4, 3, od013), componente("c-od022", 3, 7, 3, od022)],
  });
  const r = ok(
    armarPedidos(
      reserva({
        productoId: ar09.id,
        habitacion: "Hostel Dorm",
        fechaInicio: "2027-04-01",
        fechaFin: "2027-04-10",
        partes: [
          parte({ id: "p1", orden: 1, tipo: "paquete", productoId: od025.id, productoComponenteId: "c-od025", fechaInicio: "2027-04-01", fechaFin: "2027-04-04" }),
          parte({ id: "p2", orden: 2, tipo: "paquete", productoId: od013.id, productoComponenteId: "c-od013", fechaInicio: "2027-04-04", fechaFin: "2027-04-07" }),
          parte({ id: "p3", orden: 3, tipo: "paquete", productoId: od022.id, productoComponenteId: "c-od022", fechaInicio: "2027-04-07", fechaFin: "2027-04-10" }),
        ],
      }),
      catalogoCon([ar09, od025, od013, od022], [], dias),
      plantilla,
    ),
  );

  it("Península Valdés el 2 abr (día 2 de Madryn)", () => {
    expect(a(r, "reservas@allpeninsula.test")!.cuerpo).toContain("Excursión: Peninsula Valdes Full Day\nFecha: 2 abr 2027\n");
  });
  it("Torres del Paine desde El Calafate el 6 abr (día 3 de El Calafate)", () => {
    expect(a(r, "reservas@southroad.test")!.cuerpo).toContain("Excursión: Torres del Paine Full Day from El Calafate\nFecha: 6 abr 2027\n");
  });
  it("Beagle el 8 abr y Parque Nacional el 9 abr (días 2 y 3 de Ushuaia)", () => {
    const rumbo = a(r, "reservas@rumbosur.test")!.cuerpo;
    expect(rumbo).toContain("Excursión: Beagle Channel Boat Trip, 3 hours, no transfer to port\nFecha: 8 abr 2027\n");
    expect(rumbo).toContain("Excursión: Tierra del Fuego National Park half Day\nFecha: 9 abr 2027\n");
    expect(rumbo).not.toContain("a coordinar");
  });
});

describe("M3-17 — Iguazú: lado argentino día 2 y brasileño día 3, desde data/ (fila 4)", () => {
  const PAQUETE_105 =
    "Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata\nIncludes: Transfer in + Out, Excursion Cataratas Argentinas, Excursion Cataratas Brasileras";
  const iguazu = (codigo: string, orden: number) => {
    const id = `prod-${codigo.toLowerCase()}`;
    return producto(
      id,
      codigo,
      [
        servicio({ productoId: id, tipo: "alojamiento", nivel: "Hotel 3*", orden: 2, serviceProviderNombre: "Hotel 3* El Pueblito", bookingSupplier: P.pueblito }),
        servicio({ productoId: id, tipo: "excursion", orden, descripcion: PAQUETE_105, serviceProviderNombre: "Paquete Receptvo 105 Premium", bookingSupplier: P.cuenca }),
      ],
      { destino: "IGR" },
    );
  };
  const cuerpo = (p: DetalleProducto, desde: string, hasta: string, reglas = dias) =>
    ok(armarPedidos(reserva({ productoId: p.id, fechaInicio: desde, fechaFin: hasta, habitacion: "Double Room - Hotel 3*" }), catalogoCon([p], [], reglas), plantilla)).pedidos.find((x) =>
      x.cuerpo.includes("TRF IN"),
    )!;

  it.each([
    ["OD010A", 4],
    ["OD010B", 5],
    ["OD011", 3],
  ] as const)("%s: llegada 3 oct → lado argentino el 4 y brasileño el 5", (codigo, orden) => {
    const c = cuerpo(iguazu(codigo, orden), "2026-10-03", "2026-10-06").cuerpo;
    expect(renglon(c, "Lado argentino")).toContain(": 4 oct 2026 ·");
    expect(renglon(c, "Lado brasileño")).toContain(": 5 oct 2026 ·");
  });

  it("el día sale de data/dias-servicio.csv (con otra regla, otro día)", () => {
    const otra = [
      { codigo: "OD010A", orden: 4, dia: 3, servicio: "Cataratas Argentinas" },
      { codigo: "OD010A", orden: 4, dia: 2, servicio: "Cataratas Brasileras" },
    ];
    const c = cuerpo(iguazu("OD010A", 4), "2026-10-03", "2026-10-06", otra).cuerpo;
    expect(renglon(c, "Lado argentino")).toContain(": 5 oct 2026 ·");
    expect(renglon(c, "Lado brasileño")).toContain(": 4 oct 2026 ·");
  });

  it("con 2 noches, el lado brasileño (día 3) queda a coordinar con aviso", () => {
    const p = cuerpo(iguazu("OD010A", 4), "2026-10-03", "2026-10-05");
    expect(renglon(p.cuerpo, "Lado argentino")).toContain(": 4 oct 2026 ·");
    expect(renglon(p.cuerpo, "Lado brasileño")).toContain(": a coordinar");
    expect(p.avisos.join("\n")).toMatch(/Falta la fecha del lado brasileño/);
  });

  it("OD010D (combinado que empieza en Brasil): respeta el cruce, brasileño el día 2 y argentino el 3", () => {
    expect(dias.filter((d) => d.codigo === "OD010D")).toEqual([]);
    const c = cuerpo(iguazu("OD010D", 7), "2026-10-03", "2026-10-06").cuerpo;
    expect(renglon(c, "Lado brasileño")).toContain(": 4 oct 2026 ·");
    expect(renglon(c, "Lado argentino")).toContain(": 5 oct 2026 ·");
  });
});
