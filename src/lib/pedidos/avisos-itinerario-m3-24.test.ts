/**
 * M3-24 — el armado (M3-01) calcula los avisos del itinerario: blackouts de la salida y de cada parte,
 * fechas especiales de las excursiones, traslados y buses, y buses que no salen ese día. Salen en
 * `itinerario` (para el bloque "Revisar antes de pedir") y como aviso interno en los borradores
 * afectados. Sin las reglas, todo como antes.
 */
import { describe, expect, it } from "vitest";
import { armarPedidos, itinerarioDeLaReserva } from "./armar";
import { cargarReglasItinerario } from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { catalogoCon, componente, parte, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { CatalogoParaPedidos, ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const reglas = cargarReglasItinerario();
const huentata = proveedor("prov-huentata", "Huentata", ["huentata@test"]);
const lagares = proveedor("prov-lagares", "Lagares Hostel", ["lagares@test"]);
const rumbo = proveedor("prov-rumbo", "Rumbo Sur", ["rumbo@test"]);
const glaciar = proveedor("prov-glaciar", "Del Glaciar", ["glaciar@test"]);

const od019 = producto(
  "prod-od019",
  "OD019",
  [
    servicio({ productoId: "prod-od019", tipo: "alojamiento", orden: 1, nivel: "Hostel", serviceProviderNombre: "Lagares Hostel", bookingSupplier: lagares }),
    servicio({ productoId: "prod-od019", tipo: "excursion", orden: 2, serviceProviderNombre: "Bodegas half Day", descripcion: "Excursion: Bodegas half Day. Booking Supplier: Huentata", bookingSupplier: huentata }),
    servicio({ productoId: "prod-od019", tipo: "excursion", orden: 3, serviceProviderNombre: "Alta Montaña", descripcion: "Excursion: Alta Montaña. Booking Supplier: Huentata", bookingSupplier: huentata }),
  ],
  { destino: "MDZ" },
);
const od022 = producto(
  "prod-od022",
  "OD022",
  [
    servicio({ productoId: "prod-od022", tipo: "alojamiento", orden: 1, nivel: "Hostel", serviceProviderNombre: "Anum", bookingSupplier: rumbo }),
    servicio({ productoId: "prod-od022", tipo: "excursion", orden: 2, serviceProviderNombre: "PN Tierra del Fuego", descripcion: "Excursion: PN Tierra del Fuego. Booking Supplier: Rumbo Sur", bookingSupplier: rumbo }),
  ],
  { destino: "USH" },
);
const od013 = producto(
  "prod-od013",
  "OD013",
  [
    servicio({ productoId: "prod-od013", tipo: "alojamiento", orden: 1, nivel: "Hostel", serviceProviderNombre: "Hostel del Glaciar", bookingSupplier: glaciar }),
  ],
  { destino: "FTE" },
);
const ar10 = producto("prod-ar10", "AR10", [], {
  esTour: true,
  componentes: [componente("comp-od019", 1, 6, 2, od019), componente("comp-od013", 2, 15, 3, od013), componente("comp-od022", 3, 18, 3, od022)],
});
const dias = [
  { codigo: "OD019", orden: 2, dia: 1 },
  { codigo: "OD019", orden: 3, dia: 2 },
  { codigo: "OD022", orden: 2, dia: 2 },
];

/** Una AR10 recortada como la #1389186 (2 pax, salida sábado 19 dic 2026), corrida `dias` días. */
function ar10Desde(inicio: string, corrida = 0) {
  const f = (d: string) => {
    const x = new Date(`${d}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + corrida);
    return x.toISOString().slice(0, 10);
  };
  return reserva({
    agencia: "TourRadar",
    productoId: ar10.id,
    habitacion: "Double Hostel",
    fechaInicio: inicio,
    fechaFin: f("2027-01-08"),
    partes: [
      parte({ id: "p-bus-sla", orden: 1, tipo: "tramo_bus", esTarea: true, descripcionRuta: "Salta – Mendoza", fechaInicio: f("2026-12-23"), fechaFin: f("2026-12-24") }),
      parte({ id: "p-od019", orden: 2, tipo: "paquete", productoId: od019.id, productoComponenteId: "comp-od019", fechaInicio: f("2026-12-24"), fechaFin: f("2026-12-26") }),
      parte({ id: "p-bus-brc", orden: 3, tipo: "tramo_bus", esTarea: true, descripcionRuta: "Bariloche – El Chaltén", fechaInicio: f("2026-12-30"), fechaFin: f("2026-12-31") }),
      parte({ id: "p-od013", orden: 4, tipo: "paquete", productoId: od013.id, productoComponenteId: "comp-od013", fechaInicio: f("2027-01-02"), fechaFin: f("2027-01-05") }),
      parte({ id: "p-bus-fte", orden: 5, tipo: "tramo_bus", esTarea: true, descripcionRuta: "El Calafate – Río Gallegos", fechaInicio: f("2027-01-05") }),
      parte({ id: "p-bus-rgl", orden: 6, tipo: "tramo_bus", esTarea: true, descripcionRuta: "Río Gallegos – Ushuaia", fechaInicio: f("2027-01-05") }),
      parte({ id: "p-od022", orden: 7, tipo: "paquete", productoId: od022.id, productoComponenteId: "comp-od022", fechaInicio: f("2027-01-05"), fechaFin: f("2027-01-08") }),
    ],
  });
}

const catalogo = (conReglas = true): CatalogoParaPedidos => ({
  ...catalogoCon([ar10, od019, od013, od022], [], dias),
  ...(conReglas ? { itinerario: reglas } : {}),
});

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const NAVIDAD_BODEGAS = "Bodegas half Day (Mendoza) cae jueves 24 dic 2026, Navidad: confirmá con el proveedor que opera.";
const NAVIDAD_ALTA = "Alta Montaña (Mendoza) cae viernes 25 dic 2026, Navidad: confirmá con el proveedor que opera.";
const BUS_RGL = "El bus Río Gallegos → Ushuaia cae martes 5 ene 2027; según la planilla sale lun/mié/vie.";

describe("M3-24 — los avisos del itinerario al armar (AR10 como la #1389186)", () => {
  const r = ok(armarPedidos(ar10Desde("2026-12-19"), catalogo(), plantilla));

  it("salen los tres tipos de aviso, en orden de fecha, y ningún blackout (19 dic)", () => {
    expect(r.itinerario).toEqual([NAVIDAD_BODEGAS, NAVIDAD_ALTA, BUS_RGL]);
  });

  it("el borrador a Huentata lleva los dos avisos de Navidad; los demás, ninguno", () => {
    const aHuentata = r.pedidos.find((p) => p.destinatarios.includes("huentata@test"))!;
    expect(aHuentata.avisos).toEqual(expect.arrayContaining([NAVIDAD_BODEGAS, NAVIDAD_ALTA]));
    for (const p of r.pedidos.filter((x) => x !== aHuentata)) {
      expect(p.avisos.filter((a) => r.itinerario.includes(a))).toEqual([]);
    }
  });

  it("los avisos no van en el texto del pedido (son internos)", () => {
    for (const p of r.pedidos) expect(p.cuerpo).not.toMatch(/Navidad|según la planilla/);
  });

  it("sin las reglas, todo como antes (sin avisos nuevos)", () => {
    const antes = ok(armarPedidos(ar10Desde("2026-12-19"), catalogo(false), plantilla));
    expect(antes.itinerario).toEqual([]);
    expect(antes.pedidos.map((p) => ({ ...p, avisos: p.avisos }))).toEqual(
      r.pedidos.map((p) => ({ ...p, avisos: p.avisos.filter((a) => !r.itinerario.includes(a)) })),
    );
    expect(antes.tareas).toEqual(r.tareas);
    expect(antes.avisos).toEqual(r.avisos);
  });
});

describe("M3-24 — blackouts de la salida y de cada parte", () => {
  it("AR10 en junio avisa en el itinerario y en todos los borradores", () => {
    const r = ok(armarPedidos(ar10Desde("2027-06-12", 175), catalogo(), plantilla));
    const aviso = "AR10 empieza el sábado 12 jun 2027, dentro de su blackout (temporada de invierno: del 1 abr al 30 sep 2027).";
    expect(r.itinerario[0]).toBe(aviso);
    expect(r.pedidos.length).toBeGreaterThan(1);
    for (const p of r.pedidos) expect(p.avisos).toContain(aviso);
  });

  it("una parte que empieza en su blackout avisa solo en sus borradores (OD013 en agosto)", () => {
    // Corrida para que AR10 salga el 4 oct 2026: OD013 empieza el 18 oct, fuera de su blackout; y el 1 sep 2026 sí.
    const fuera = ok(armarPedidos(ar10Desde("2026-10-04", -76), catalogo(), plantilla));
    expect(fuera.itinerario.filter((a) => a.startsWith("OD013"))).toEqual([]);
    const reserva = ar10Desde("2026-09-01", -76);
    reserva.partes = reserva.partes.map((p) => (p.id === "p-od013" ? { ...p, fechaInicio: "2026-09-15", fechaFin: "2026-09-18" } : p));
    const r = ok(armarPedidos(reserva, catalogo(), plantilla));
    const aviso = "OD013 empieza el martes 15 sep 2026, dentro de su blackout (temporada de invierno (Torres del Paine cerrado): del 1 abr al 30 sep 2026).";
    expect(r.itinerario).toContain(aviso);
    expect(r.pedidos.find((p) => p.destinatarios.includes("glaciar@test"))!.avisos).toContain(aviso);
    expect(r.pedidos.find((p) => p.destinatarios.includes("huentata@test"))!.avisos).not.toContain(aviso);
  });

  it("un paquete suelto: su salida (OD032 en Carnaval 2027)", () => {
    const od032 = producto("prod-od032", "OD032", [servicio({ productoId: "prod-od032", tipo: "alojamiento", orden: 1, serviceProviderNombre: "Hostel Rio", bookingSupplier: lagares })], { destino: "RIO" });
    const r = ok(
      armarPedidos(reserva({ productoId: od032.id, fechaInicio: "2027-02-05", fechaFin: "2027-02-08" }), { ...catalogoCon([od032]), itinerario: reglas }, plantilla),
    );
    expect(r.itinerario).toEqual(["OD032 empieza el viernes 5 feb 2027, dentro de su blackout (Carnaval en Río: del 4 al 15 feb 2027)."]);
    expect(r.pedidos[0].avisos).toContain(r.itinerario[0]);
  });
});

describe("M3-24 — itinerarioDeLaReserva (el bloque del detalle)", () => {
  it("da los mismos avisos que el armado, también en una reserva para revisión", () => {
    expect(itinerarioDeLaReserva(ar10Desde("2026-12-19"), catalogo())).toEqual([NAVIDAD_BODEGAS, NAVIDAD_ALTA, BUS_RGL]);
    expect(itinerarioDeLaReserva({ ...ar10Desde("2026-12-19"), estado: "para_revision" }, catalogo())).toEqual([NAVIDAD_BODEGAS, NAVIDAD_ALTA, BUS_RGL]);
  });

  it("sin reglas o sin producto, nada", () => {
    expect(itinerarioDeLaReserva(ar10Desde("2026-12-19"), catalogo(false))).toEqual([]);
    expect(itinerarioDeLaReserva(reserva(), { ...catalogoCon([]), itinerario: reglas })).toEqual([]);
  });
});
