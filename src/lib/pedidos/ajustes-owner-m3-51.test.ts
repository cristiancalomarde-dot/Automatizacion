/**
 * M3-51: lo que cambia en los pedidos con BR20 (owner, 2026-11-06), con los archivos reales de `data/`:
 * la salida de Foz sin traslado, los traslados de Agmar con su fecha, el desayuno y el portugués.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parsearTrasladosTour } from "@/lib/importador-tours/traslados";
import type { AjusteEnTour } from "@/lib/catalogo/tipos";
import { armarPedidos } from "./armar";
import { ARCHIVO_DIAS, cargarAlojamientosSinDesayuno, cargarCiudadesPortugues, leerDiasServicio } from "./cargar";
import { catalogoCon, od010b, producto, proveedor, reserva, reservaOd010b, servicio } from "./fixtures.test-utils";
import { cargarPlantilla } from "./plantilla";
import type { CatalogoParaPedidos, ResultadoArmado } from "./tipos";

const RAIZ = process.cwd();
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const EXCEPCIONES = parsearTrasladosTour(dato("traslados-tour.csv"));
const DIAS = leerDiasServicio(readFileSync(resolve(RAIZ, ARCHIVO_DIAS), "utf-8"));
const plantilla = cargarPlantilla();
const plantillaPt = cargarPlantilla(undefined, "pt");

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(r.error);
  return r;
}

function excepcion(tour: string, paquete: string): AjusteEnTour {
  const x = EXCEPCIONES.find((e) => e.tour === tour && e.paquete === paquete)!;
  return { accion: x.accion, texto: x.texto ?? null, motivo: x.motivo, origen: "excepcion" };
}

describe("punto 5 — Foz sin traslado de salida en BR20", () => {
  const cuerpo = (ajusteTour: AjusteEnTour | undefined) => {
    const p = { ...od010b, servicios: od010b.servicios.map((s) => (s.orden === 5 ? { ...s, ajusteTour } : s)) };
    const r = ok(armarPedidos({ ...reservaOd010b, habitacion: "Double Room at Hostel and Jungle Lodge" }, catalogoCon([p]), plantilla));
    return r.pedidos.find((x) => /TRF IN/.test(x.cuerpo))!.cuerpo;
  };

  it("con la excepción de BR20: el 105 Premium lleva el TRF IN y las dos excursiones, sin TRF OUT", () => {
    const c = cuerpo(excepcion("BR20", "OD010B"));
    expect(c).toMatch(/TRF IN: 3 oct 2026 · Bus o vuelo pendiente/);
    expect(c).toMatch(/Lado argentino/);
    expect(c).toMatch(/Lado brasileño/);
    expect(c).not.toMatch(/TRF OUT/);
  });

  it("OD010B vendido solo y en BR04 siguen con su TRF OUT", () => {
    expect(cuerpo(undefined)).toMatch(/TRF OUT: 6 oct 2026 · Bus o vuelo pendiente/);
    expect(cuerpo(excepcion("BR04", "OD010B"))).toMatch(/TRF OUT: 6 oct 2026 · Rodoviaria de Foz/);
  });
});

describe("punto 4 — los traslados de Agmar (WhatsApp), cada uno con su fecha", () => {
  const agmar = { ...proveedor("prov-agmar", "Agmar", [], "whatsapp"), ciudad: "BONITO" };
  const ygarape = { ...proveedor("prov-yg", "Ygarape", ["ygarape@ygarape.test"]), ciudad: "BONITO" };
  const bonitoHostel = { ...proveedor("prov-bh", "Bonito HI Hostel", ["reserva@bonitohostel.test"]), ciudad: "BONITO" };

  function bonito(ajusteTour: AjusteEnTour | undefined) {
    const id = "prod-COMPBR06";
    return producto(
      id,
      "COMPBR06",
      [
        servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Bonito HI Hostel", bookingSupplier: bonitoHostel }),
        servicio({ productoId: id, tipo: "excursion", orden: 3, descripcion: "Excursion: Floating Rio da Prata w/lunch. Booking Supplier: Ygarape", serviceProviderNombre: "Floating Rio da Prata w/lunch", bookingSupplier: ygarape }),
        servicio({ productoId: id, tipo: "traslado", orden: 4, sentido: "sin_sentido", ajusteTour, descripcion: "Transfer for the 2 days of Excursions. Booking Supplier: Agmar", serviceProviderNombre: "for the 2 days of Excursions", bookingSupplier: agmar }),
      ],
      { destino: "BON" },
    );
  }

  function armar(ajusteTour: AjusteEnTour | undefined, dias: CatalogoParaPedidos["dias"]) {
    const p = bonito(ajusteTour);
    const catalogo: CatalogoParaPedidos = { ...catalogoCon([p], [], dias), ciudadesPortugues: cargarCiudadesPortugues(), sinDesayuno: cargarAlojamientosSinDesayuno(RAIZ) };
    return ok(armarPedidos(reserva({ productoId: p.id, habitacion: "Double Room at Hostel and Jungle Lodge", fechaInicio: "2027-02-23", fechaFin: "2027-02-25" }), catalogo, plantilla, plantillaPt));
  }

  it("con la excepción de BR20 y el día de data/dias-servicio.csv: un solo traslado, el día de la excursión", () => {
    const r = armar(excepcion("BR20", "COMPBR06"), DIAS);
    expect(r.tareas.filter((t) => t.tipo === "whatsapp").map((t) => t.texto)).toEqual([
      expect.stringMatching(/Agmar.*Transfer privado ida y vuelta a la excursión Floating Rio da Prata, 24 feb 2027/),
    ]);
    expect(r.tareas.map((t) => t.texto).join(" ")).not.toMatch(/vuelo pendiente|23 feb 2027.*Transfer|25 feb 2027/);
    const excursion = r.pedidos.find((p) => p.destinatarios.includes("ygarape@ygarape.test"))!.cuerpo;
    expect(excursion).toContain("Data: 24 fev 2027");
  });

  it("sin día fijo, el traslado sin sentido sigue como antes (ida y vuelta)", () => {
    const r = armar(excepcion("BR20", "COMPBR06"), []);
    const agmarTexto = r.tareas.find((t) => t.tipo === "whatsapp")!.texto;
    expect(agmarTexto).toMatch(/23 feb 2027/);
    expect(agmarTexto).toMatch(/25 feb 2027/);
  });

  it("el privado del Lodge (ODBR50, tipo otro): el texto del owner, de la llegada a la salida", () => {
    const id = "prod-ODBR50";
    const lodge = { ...proveedor("prov-pjl", "pantanal jungle lodge", ["reserva@pantanaljunglelodge.test"]), ciudad: "BRASIL" };
    const p = producto(
      id,
      "ODBR50",
      [
        servicio({ productoId: id, tipo: "alojamiento", nivel: "Todos los niveles", orden: 1, serviceProviderNombre: "Pantanal Jungle Lodge", bookingSupplier: lodge }),
        servicio({ productoId: id, tipo: "otro", orden: 2, ajusteTour: excepcion("BR20", "ODBR50"), descripcion: "Private Transfer Campo Grande - Pantanal - Campo Grande for 1 to 4 pax. Booking Supplier: Agmar", serviceProviderNombre: "Private Transfer Campo Grande - Pantanal - Campo Grande for 1 to 4 pax", bookingSupplier: agmar }),
      ],
      { destino: "PTL" },
    );
    const catalogo: CatalogoParaPedidos = { ...catalogoCon([p]), ciudadesPortugues: cargarCiudadesPortugues(), sinDesayuno: cargarAlojamientosSinDesayuno(RAIZ) };
    const r = ok(armarPedidos(reserva({ productoId: p.id, habitacion: "Double Room at Hostel and Jungle Lodge", fechaInicio: "2027-02-25", fechaFin: "2027-02-28" }), catalogo, plantilla, plantillaPt));
    expect(r.tareas.filter((t) => t.tipo === "whatsapp").map((t) => t.texto)).toEqual([
      expect.stringContaining(
        "Transfer privado alojamiento en Bonito - Pantanal Jungle Lodge (llegada) y Pantanal Jungle Lodge - Rodoviaria de Campo Grande (salida, bus nocturno a São Paulo), del 25 al 28 feb 2027",
      ),
    ]);
    const lodgePedido = r.pedidos.find((x) => x.destinatarios.includes("reserva@pantanaljunglelodge.test"))!.cuerpo;
    expect(lodgePedido).toContain("Escrevemos da HI Travel");
    expect(lodgePedido).toContain("IN: 25 fev 2027\nOUT: 28 fev 2027 (3 noites)");
  });
});

describe("puntos 6 y 7 — Bonito HI Hostel en portugués y sin desayuno", () => {
  it("el mail a Bonito HI Hostel sale en portugués, con sus 2 noches y sin café da manhã", () => {
    const id = "prod-COMPBR06";
    const hostel = { ...proveedor("prov-bh", "Bonito HI Hostel", ["reserva@bonitohostel.test"]), ciudad: "BONITO" };
    const p = producto(id, "COMPBR06", [servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Bonito HI Hostel", bookingSupplier: hostel })], { destino: "BON" });
    const catalogo: CatalogoParaPedidos = { ...catalogoCon([p]), ciudadesPortugues: cargarCiudadesPortugues(), sinDesayuno: cargarAlojamientosSinDesayuno(RAIZ) };
    const { cuerpo } = ok(armarPedidos(reserva({ productoId: id, habitacion: "Double Room at Hostel and Jungle Lodge", fechaInicio: "2027-02-23", fechaFin: "2027-02-25" }), catalogo, plantilla, plantillaPt)).pedidos[0];
    expect(cuerpo).toContain("Escrevemos da HI Travel");
    expect(cuerpo).toContain("IN: 23 fev 2027\nOUT: 25 fev 2027 (2 noites)");
    expect(cuerpo).not.toMatch(/caf[eé] da manh/i);
  });
});
