/**
 * M3-25 (owner, 2026-10-27, segunda revisión de M3-04 con la TourRadar #1389186, AR10):
 * 1. OD027 (Salta): el traslado de La Ciénaga es solo de llegada; el renglón no puede decir el round trip.
 * 2. OD022 (Ushuaia): el traslado de Rumbo Sur es solo de salida (el inverso).
 * 3. Una excursión "sin transfer" (el Beagle de OD022) no lleva datos de pick up.
 * 4. El bus Bariloche → El Chaltén de AR10 se le pide a Chalten Travel (data/tramos-se-piden-a.csv),
 *    en el mismo mail del OD033, con su fecha; El Chaltén → El Calafate sigue en ese mail.
 * 5. Greeters reserva por su sistema: su traslado queda como tarea a mano, sin mail
 *    (data/equivalencias-proveedores.csv, modo manual, como Kupos o COT online).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leerCsv } from "@/lib/importador-productos/csv";
import { armarPedidos } from "./armar";
import { ARCHIVO_BUSES_EL_CHALTEN, ARCHIVO_TRAMOS_SE_PIDEN_A, leerBusesElChalten, leerTramosSePidenA } from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoCon, componente, parte, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { ComponenteTour, Servicio } from "@/lib/catalogo/tipos";
import type { ResultadoArmado, TramoSePideA } from "./tipos";

const plantilla = cargarPlantilla();
const buses = leerBusesElChalten(readFileSync(ARCHIVO_BUSES_EL_CHALTEN, "utf8"));
const tramosDelArchivo = leerTramosSePidenA(readFileSync(ARCHIVO_TRAMOS_SE_PIDEN_A, "utf8"));

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

/** Un servicio del pedido (sin la numeración "1) "), desde su primer renglón hasta la línea en blanco. */
function bloque(cuerpo: string, primerRenglon: string): string[] {
  const l = cuerpo.split("\n").map((x) => x.replace(/^\d+\) /, ""));
  const i = l.indexOf(primerRenglon);
  if (i < 0) throw new Error(`No está "${primerRenglon}" en:\n${cuerpo}`);
  const fin = l.indexOf("", i);
  return l.slice(i, fin < 0 ? undefined : fin);
}

const PR = {
  cienaga: proveedor("prov-cienaga", "la Cienaga", ["cienaga@test"]),
  rumbo: proveedor("prov-rumbo", "Rumbo Sur", ["rumbosur@test"]),
  anum: proveedor("prov-anum", "Anum", ["anum@test"]),
  trota: proveedor("prov-trota", "Trotamundos Hostel", ["trota@test"]),
  greeters: proveedor("prov-greeters", "GREETERS", ["info@greeters.test"]),
};

const regla = (accion: "solo_llegada" | "solo_salida", motivo: string, texto: string | null = null): Servicio["ajusteTour"] => ({ accion, texto, motivo, origen: "regla" });

// --- AR10 en chico (como la #1389186: 2 pax, Double Hostel, sale el 19 dic 2026) ----------------

const od027 = producto(
  "prod-od027",
  "OD027",
  [
    servicio({ productoId: "prod-od027", tipo: "alojamiento", orden: 1, nivel: "Hostel", serviceProviderNombre: "Trotamundos Salta", bookingSupplier: PR.trota }),
    servicio({ productoId: "prod-od027", tipo: "excursion", orden: 6, descripcion: "Excursion: Salinas y Purmamarca. Booking Supplier: La Cienaga", serviceProviderNombre: "Salinas y Purmamarca", bookingSupplier: PR.cienaga }),
    servicio({
      productoId: "prod-od027",
      tipo: "traslado",
      orden: 7,
      sentido: "ida_y_vuelta",
      descripcion: "Transfer SLA - Accommodation - SLA. Booking Supplier: La Cienaga",
      serviceProviderNombre: "SLA - Accommodation - SLA",
      bookingSupplier: PR.cienaga,
      ajusteTour: regla("solo_llegada", "Sale en bus a Mendoza."),
    }),
  ],
  { destino: "SLA" },
);

const od033 = producto(
  "prod-od033",
  "OD033",
  [
    servicio({ productoId: "prod-od033", tipo: "alojamiento", orden: 1, nivel: "Hostel", serviceProviderNombre: "Rancho Grande", bookingSupplier: P.chalten }),
    servicio({ productoId: "prod-od033", tipo: "bus", orden: 5, descripcion: "Public Bus El Chalten Bus Station - El Calafate Bus Station. Booking Supplier: Chalten Travel", serviceProviderNombre: "El Chalten Bus Station - El Calafate Bus Station", bookingSupplier: P.chalten }),
  ],
  { destino: "CHA" },
);

const od022 = producto(
  "prod-od022",
  "OD022",
  [
    servicio({ productoId: "prod-od022", tipo: "alojamiento", orden: 1, nivel: "Hostel", serviceProviderNombre: "Anum", bookingSupplier: PR.anum }),
    servicio({ productoId: "prod-od022", tipo: "excursion", orden: 5, descripcion: "Excursion: Beagle Channel Boat Trip, 3 hours, no transfer to port. Booking Supplier: Rumbo Sur", serviceProviderNombre: "Beagle Channel Boat Trip, 3 hours, no transfer to port", bookingSupplier: PR.rumbo }),
    servicio({ productoId: "prod-od022", tipo: "excursion", orden: 6, descripcion: "Excursion: Tierra del Fuego National Park half Day. Booking Supplier: Rumbo Sur", serviceProviderNombre: "Tierra del Fuego National Park half Day", bookingSupplier: PR.rumbo }),
    servicio({
      productoId: "prod-od022",
      tipo: "traslado",
      orden: 7,
      sentido: "ida_y_vuelta",
      descripcion: "Transfer Round Trip: Rumbo Sur. Booking Supplier: Rumbo Sur",
      serviceProviderNombre: "Round Trip: Rumbo Sur",
      bookingSupplier: PR.rumbo,
      ajusteTour: regla("solo_salida", "Llega en bus desde El Calafate."),
    }),
  ],
  { destino: "USH" },
);

const tramo = (id: string, orden: number, dia: number, ruta: string, nocturno: boolean): ComponenteTour => ({
  id,
  orden,
  tipo: "tramo_bus",
  diaDesde: dia,
  noches: null,
  nocturno,
  transferIn: false,
  transferOut: false,
  descripcionRuta: ruta,
  producto: null,
});

const ar10 = producto("prod-ar10", "AR10", [], {
  esTour: true,
  componentes: [
    componente("c-027", 1, 1, 4, od027),
    tramo("c-bus1", 2, 12, "Bariloche – El Chaltén", true),
    componente("c-033", 3, 13, 2, od033),
    tramo("c-bus2", 4, 18, "El Calafate – Río Gallegos", false),
    componente("c-022", 5, 18, 3, od022),
  ],
});

const dias = [
  { codigo: "OD027", orden: 6, dia: 2 },
  { codigo: "OD022", orden: 6, dia: 2 },
  { codigo: "OD022", orden: 5, dia: 3 },
];

function armarAr10(tramos: readonly TramoSePideA[] = tramosConChalten) {
  const catalogo = { ...catalogoCon([ar10, od027, od033, od022], [], dias), busesElChalten: buses, tramosSePidenA: tramos };
  const r = reserva({
    agencia: "TourRadar",
    productoId: ar10.id,
    habitacion: "Double Hostel",
    fechaInicio: "2026-12-19",
    fechaFin: "2027-01-08",
    partes: [
      parte({ id: "p1", orden: 1, tipo: "paquete", productoId: od027.id, productoComponenteId: "c-027", fechaInicio: "2026-12-19", fechaFin: "2026-12-23" }),
      parte({ id: "p2", orden: 2, tipo: "tramo_bus", esTarea: true, descripcionRuta: "Bariloche – El Chaltén", fechaInicio: "2026-12-30", fechaFin: "2026-12-31" }),
      parte({ id: "p3", orden: 3, tipo: "paquete", productoId: od033.id, productoComponenteId: "c-033", fechaInicio: "2026-12-31", fechaFin: "2027-01-02" }),
      parte({ id: "p4", orden: 4, tipo: "tramo_bus", esTarea: true, descripcionRuta: "El Calafate – Río Gallegos", fechaInicio: "2027-01-05", fechaFin: "2027-01-05" }),
      parte({ id: "p5", orden: 5, tipo: "paquete", productoId: od022.id, productoComponenteId: "c-022", fechaInicio: "2027-01-05", fechaFin: "2027-01-08" }),
    ],
  });
  return ok(armarPedidos(r, catalogo, plantilla));
}
const tramosConChalten: TramoSePideA[] = tramosDelArchivo.map((t) => ({ ...t, proveedorDelDirectorio: t.proveedor === "Chalten Travel" ? P.chalten : null }));
const pedidoA = (r: ResultadoArmado & { ok: true }, mail: string) => r.pedidos.find((p) => p.destinatarios.includes(mail))!;

describe("M3-25 fila 1 — OD027 en AR10: el traslado de La Ciénaga es solo de llegada", () => {
  // M3-28 (owner, 2026-10-28): "Transfer in Aeropuerto <ciudad> - Alojamiento", con guion y el nombre de la ciudad.
  it("el renglón dice solo el in (aeropuerto - alojamiento), no el SLA – accommodation – SLA", () => {
    const cuerpo = pedidoA(armarAr10(), "cienaga@test").cuerpo;
    expect(bloque(cuerpo, "Traslado de llegada: Transfer in Aeropuerto Salta - Alojamiento")).toEqual([
      "Traslado de llegada: Transfer in Aeropuerto Salta - Alojamiento",
      "Fecha: 19 dic 2026",
      "Vuelo pendiente",
    ]);
    expect(cuerpo).not.toContain("Accommodation - SLA");
    expect(cuerpo).not.toContain("Traslado de salida");
  });

  it("vendido solo, OD027 sigue pidiendo la llegada y la salida con el nombre del catálogo", () => {
    // Suelto, el paquete no trae el ajuste del tour (ese lo pone el tour, M1-08).
    const suelto = { ...od027, servicios: od027.servicios.map((s) => ({ ...s, ajusteTour: undefined })) };
    const r = ok(armarPedidos(reserva({ productoId: suelto.id, fechaInicio: "2026-12-19", fechaFin: "2026-12-23" }), catalogoCon([suelto], [], dias), plantilla));
    const cuerpo = pedidoA(r, "cienaga@test").cuerpo;
    expect(cuerpo).toContain("Traslado de llegada: Transfer SLA - Accommodation - SLA");
    expect(cuerpo).toContain("Traslado de salida: Transfer SLA - Accommodation - SLA");
  });

  it("si el ajuste del tour trae su texto, va ese", () => {
    const conTexto = producto("prod-od027t", "OD027", od027.servicios.map((s) => (s.tipo === "traslado" ? { ...s, productoId: "prod-od027t", ajusteTour: regla("solo_llegada", "Sale en bus.", "Transfer aeropuerto de Salta - alojamiento") } : { ...s, productoId: "prod-od027t" })), { destino: "SLA" });
    const tour = producto("prod-t", "AR10", [], { esTour: true, componentes: [componente("c-t", 1, 1, 4, conTexto), tramo("c-b", 2, 5, "Salta – Mendoza", true)] });
    const r = ok(
      armarPedidos(
        reserva({ productoId: tour.id, fechaInicio: "2026-12-19", fechaFin: "2026-12-24", partes: [parte({ id: "x", orden: 1, tipo: "paquete", productoId: conTexto.id, productoComponenteId: "c-t", fechaInicio: "2026-12-19", fechaFin: "2026-12-23" })] }),
        catalogoCon([tour, conTexto], [], dias),
        plantilla,
      ),
    );
    expect(pedidoA(r, "cienaga@test").cuerpo).toContain("Traslado de llegada: Transfer aeropuerto de Salta - alojamiento\nFecha: 19 dic 2026");
  });
});

describe("M3-25 fila 2 — OD022 en AR10: el traslado de Rumbo Sur es solo de salida", () => {
  // M3-28 (owner, 2026-10-28): "Transfer out Alojamiento en <ciudad> - Aeropuerto <ciudad>" (el owner escribió USH; va la ciudad, parejo con el in).
  it("el renglón dice solo el out (alojamiento - aeropuerto), no el Round Trip", () => {
    const cuerpo = pedidoA(armarAr10(), "rumbosur@test").cuerpo;
    expect(bloque(cuerpo, "Traslado de salida: Transfer out Alojamiento en Ushuaia - Aeropuerto Ushuaia")).toEqual([
      "Traslado de salida: Transfer out Alojamiento en Ushuaia - Aeropuerto Ushuaia",
      "Fecha: 8 ene 2027",
      "Vuelo pendiente",
    ]);
    expect(cuerpo).not.toContain("Round Trip");
    expect(cuerpo).not.toContain("Traslado de llegada");
  });
});

describe("M3-25 fila 3 — una excursión sin transfer no lleva pick up", () => {
  it("el Beagle de OD022 (no transfer to port): fecha y servicio, sin renglón de pick up", () => {
    const cuerpo = pedidoA(armarAr10(), "rumbosur@test").cuerpo;
    expect(bloque(cuerpo, "Excursión: Beagle Channel Boat Trip, 3 hours, no transfer to port")).toEqual([
      "Excursión: Beagle Channel Boat Trip, 3 hours, no transfer to port",
      "Fecha: 7 ene 2027",
      "Servicio: regular · Idioma: inglés",
    ]);
  });

  it("la otra excursión del mismo pedido sigue con su pick up", () => {
    const cuerpo = pedidoA(armarAr10(), "rumbosur@test").cuerpo;
    expect(bloque(cuerpo, "Excursión: Tierra del Fuego National Park half Day")).toContain("Pick up y drop off: Anum (Ushuaia) · hotel a confirmar");
  });

  it("sin el alojamiento en la reserva, el Beagle no deja el pendiente del alojamiento para el pick up", () => {
    const soloBeagle = producto("prod-beagle", "OD022", [od022.servicios[1]], { destino: "USH" });
    const r = ok(armarPedidos(reserva({ productoId: soloBeagle.id, fechaInicio: "2027-01-05", fechaFin: "2027-01-08" }), catalogoCon([soloBeagle], [], dias), plantilla));
    const p = pedidoA(r, "rumbosur@test");
    expect(p.cuerpo).not.toMatch(/Pick up/);
    expect(p.cuerpo).not.toContain("Les pasamos el alojamiento para el pick up");
  });
});

describe("M3-25 fila 4 — los buses de El Chaltén de AR10 van a Chalten Travel, en el mail del OD033", () => {
  it("data/tramos-se-piden-a.csv: AR10, Bariloche ↔ El Chaltén con Chalten Travel y los horarios del owner (8:30 am y 21:00)", () => {
    expect(tramosDelArchivo).toContainEqual({ tour: "AR10", ruta: "Bariloche – El Chaltén", proveedor: "Chalten Travel", horario: "8:30 am" });
    expect(tramosDelArchivo).toContainEqual({ tour: "AR10", ruta: "El Chaltén – Bariloche", proveedor: "Chalten Travel", horario: "21:00" });
  });

  it("el mail a Chalten Travel lleva el bus Bariloche → El Chaltén (30 dic, 8:30 am, llega el 31) y el El Chaltén → El Calafate (2 ene, 8 am)", () => {
    const r = armarAr10();
    const chalten = r.pedidos.filter((p) => p.destinatarios.includes("agencias@chaltentravel.test"));
    expect(chalten).toHaveLength(1);
    expect(bloque(chalten[0].cuerpo, "Bus: Bariloche – El Chaltén")).toEqual(["Bus: Bariloche – El Chaltén", "Fecha: 30 dic 2026 · Horario: 8:30 am (llega el 31 dic 2026)"]);
    expect(bloque(chalten[0].cuerpo, "Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station")).toEqual([
      "Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station",
      "Fecha: 2 ene 2027 · Horario: 8:00 am",
    ]);
    expect(chalten[0].cuerpo).toContain("Alojamiento: Rancho Grande");
  });

  it("ya no queda el boleto Bariloche – El Chaltén para HI Travel; los demás buses siguen como tarea", () => {
    const tareas = armarAr10().tareas.map((t) => t.texto);
    expect(tareas).not.toContainEqual(expect.stringContaining("Bariloche – El Chaltén"));
    expect(tareas).toContain("Emitir boleto: El Calafate – Río Gallegos, 5 ene 2027");
  });

  it("una regla escrita al revés (El Chaltén → Bariloche) también vale, pero sin su horario (es el de la otra punta)", () => {
    const alReves: TramoSePideA[] = [{ tour: "AR10", ruta: "El Chaltén – Bariloche", proveedor: "Chalten Travel", horario: "21:00", proveedorDelDirectorio: P.chalten }];
    const r = armarAr10(alReves);
    expect(pedidoA(r, "agencias@chaltentravel.test").cuerpo).toContain("Bus: Bariloche – El Chaltén\nFecha: 30 dic 2026 (nocturno)");
  });

  it("si Chalten Travel no está en el directorio, el boleto queda como hoy, con un aviso", () => {
    const sinDirectorio: TramoSePideA[] = [{ tour: "AR10", ruta: "Bariloche – El Chaltén", proveedor: "Chalten Travel", proveedorDelDirectorio: null }];
    const r = armarAr10(sinDirectorio);
    expect(r.tareas.map((t) => t.texto)).toContain("Emitir boleto: Bariloche – El Chaltén, 30 dic 2026");
    expect(r.avisos.join("\n")).toContain('"Chalten Travel" no está en el directorio de proveedores');
  });

  it("en otro tour, la regla de AR10 no aplica", () => {
    const otro = producto("prod-otro", "AR09", [], { esTour: true, componentes: ar10.componentes });
    const catalogo = { ...catalogoCon([otro, od033], [], dias), busesElChalten: buses, tramosSePidenA: tramosConChalten };
    const r = ok(
      armarPedidos(
        reserva({ productoId: otro.id, partes: [parte({ id: "b", orden: 1, tipo: "tramo_bus", esTarea: true, descripcionRuta: "Bariloche – El Chaltén", fechaInicio: "2026-12-30", fechaFin: "2026-12-31" })] }),
        catalogo,
        plantilla,
      ),
    );
    expect(r.tareas.map((t) => t.texto)).toContain("Emitir boleto: Bariloche – El Chaltén, 30 dic 2026");
  });
});

describe("M3-25 fila 5 — Greeters reserva por su sistema: tarea a mano, sin mail", () => {
  it("data/equivalencias-proveedores.csv marca a Greeters manual en Buenos Aires, con nota", () => {
    const filas = leerCsv(readFileSync("data/equivalencias-proveedores.csv", "utf8"));
    const greeters = filas.filter((f) => f.nombre_en_excel?.trim().toLowerCase() === "greeters");
    expect(greeters).toHaveLength(1);
    expect(greeters[0]).toMatchObject({ destino: "BUE", modo: "manual", estado: "confirmado" });
    expect(greeters[0].nota).toMatch(/Owner \(2026-10-27/);
  });

  it("el traslado de Greeters de OD018 (marcado a mano en el catálogo) va a la lista manual y no genera mail", () => {
    const od018 = producto(
      "prod-od018",
      "OD018",
      [
        servicio({
          productoId: "prod-od018",
          tipo: "traslado",
          orden: 6,
          sentido: "ida_y_vuelta",
          reservaManual: true,
          descripcion: "Transfer EZE o AEP - Hotel - EZE o AEP. Booking Supplier: Greeters",
          serviceProviderNombre: "EZE o AEP - Hotel - EZE o AEP",
          bookingSupplierNombre: "Greeters",
        }),
      ],
      { destino: "BUE" },
    );
    const r = ok(armarPedidos(reserva({ productoId: od018.id, fechaInicio: "2027-02-01", fechaFin: "2027-02-04" }), catalogoCon([od018], [PR.greeters]), plantilla));
    expect(r.pedidos).toEqual([]);
    expect(r.tareas.map((t) => `${t.tipo}: ${t.texto}`)).toEqual([
      "reservar_a_mano: Reservar a mano en Greeters: traslado de llegada Transfer EZE o AEP - Hotel - EZE o AEP, 1 feb 2027 · Vuelo pendiente",
      "reservar_a_mano: Reservar a mano en Greeters: traslado de salida Transfer EZE o AEP - Hotel - EZE o AEP, 4 feb 2027 · Vuelo pendiente",
    ]);
  });
});
