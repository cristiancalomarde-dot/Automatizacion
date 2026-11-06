/**
 * M3-48: las respuestas del owner (2026-11-03) sobre BR03 y BR04. Textos literales de las tareas y
 * de los mails, con los archivos reales de `data/`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parsearTramosConProveedor } from "@/lib/importador-tours/datos";
import { parsearTrasladosTour } from "@/lib/importador-tours/traslados";
import { armarPedidos } from "./armar";
import { ARCHIVO_HOSTEL_SEGUN_HABITACION, cargarCiudadesPortugues, cargarPuntosDeEncuentro, leerHostelSegunHabitacion } from "./cargar";
import { catalogoCon, od010b, producto, proveedor, reserva, reservaOd010b, servicio } from "./fixtures.test-utils";
import { cargarPlantilla } from "./plantilla";
import type { AjusteEnTour } from "@/lib/catalogo/tipos";
import type { CatalogoParaPedidos, ResultadoArmado } from "./tipos";

const RAIZ = process.cwd();
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");
const reglasHostel = leerHostelSegunHabitacion(readFileSync(resolve(RAIZ, ARCHIVO_HOSTEL_SEGUN_HABITACION), "utf-8"));
const EXCEPCIONES = parsearTrasladosTour(dato("traslados-tour.csv"));
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

describe("punto 1 — la tarea de Che Lagarto nombra las alternativas", () => {
  function paraty() {
    const id = "prod-COMPBR02";
    const contacto = (n: string, i: number) => proveedor(`prov-${i}`, n, [`${i}@hostel.test`]);
    return producto(
      id,
      "COMPBR02",
      [
        servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, prioridad: 1, serviceProviderNombre: "Che Lagarto", bookingSupplierNombre: "Che Lagarto", bookingSupplier: null, reservaManual: true }),
        ...["Casa do Rio", "Agatha", "Casa Viva"].map((n, i) =>
          servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, prioridad: i + 2, serviceProviderNombre: n, bookingSupplier: contacto(n, i) }),
        ),
      ],
      { destino: "PRY" },
    );
  }

  function armar(habitacion: string | null) {
    const p = paraty();
    const catalogo: CatalogoParaPedidos = { ...catalogoCon([p]), hostelSegunHabitacion: reglasHostel };
    return ok(armarPedidos(reserva({ productoId: p.id, habitacion, fechaInicio: "2027-06-01", fechaFin: "2027-06-03" }), catalogo, plantilla));
  }

  it("con dorm, el texto literal, en el orden de Paraty", () => {
    const r = armar("Dormitory - Hostel");
    expect(r.pedidos).toEqual([]);
    expect(r.tareas.map((t) => [t.tipo, t.texto])).toEqual([
      ["reservar_a_mano", "Reservar a mano en Che Lagarto: Che Lagarto (dorm compartido), IN 1 jun 2027, OUT 3 jun 2027. Si no hay lugar: Casa do Rio, Casa Viva, Agatha"],
    ]);
  });

  it("con habitación privada, igual", () => {
    expect(armar("Single Room - Hostel").tareas[0].texto).toContain("Si no hay lugar: Casa do Rio, Casa Viva, Agatha");
  });

  it("la habitación no dice dorm ni privada: también en el orden de Paraty, no en el del Excel", () => {
    expect(armar("Hostel").tareas[0].texto).toContain("Si no hay lugar: Casa do Rio, Casa Viva, Agatha");
  });

  it("sin alternativas, la tarea no agrega nada", () => {
    const id = "prod-solo";
    const p = producto(id, "COMPBR02", [servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, prioridad: 1, serviceProviderNombre: "Che Lagarto", bookingSupplierNombre: "Che Lagarto", bookingSupplier: null, reservaManual: true })], { destino: "PRY" });
    const r = ok(armarPedidos(reserva({ productoId: id, habitacion: "Dormitory - Hostel", fechaInicio: "2027-06-01", fechaFin: "2027-06-03" }), catalogoCon([p]), plantilla));
    expect(r.tareas[0].texto).toBe("Reservar a mano en Che Lagarto: Che Lagarto (dorm compartido), IN 1 jun 2027, OUT 3 jun 2027");
  });

  it("en PNT, sin habitación, sigue el orden del Excel (las reglas de ese destino dependen de la habitación)", () => {
    const pnt = reglasHostel.filter((r) => r.destino === "PNT");
    expect(new Set(pnt.map((r) => r.orden.join("|"))).size).toBe(2);
  });
});

describe("punto 3 — los buses de BR04 con Plataforma10", () => {
  const tramos = parsearTramosConProveedor(dato("tramos-con-proveedor.csv"));

  it("nombran Plataforma10 y las terminales, en los dos sentidos", () => {
    expect(tramos.filter((t) => t.tour === "BR04" && t.bookingSupplier === "Plataforma10").map((t) => [t.desde, t.hasta, t.ambosSentidos, t.enLaTarea])).toEqual([
      ["IGR", "SAO", true, "Bus Foz do Iguaçu – São Paulo Barra Funda, en Plataforma10"],
      ["SAO", "PRY", true, "Bus São Paulo Tietê – Paraty, en Plataforma10"],
    ]);
  });

  it("los otros tramos no cambian de texto (BR18 sigue sin esa columna; BR20 tiene los suyos, M3-51)", () => {
    expect(tramos.filter((t) => t.enLaTarea && !["BR04", "BR20"].includes(t.tour))).toEqual([]);
  });
});

describe("punto 5a — el traslado invertido dice el sentido de verdad", () => {
  function rioConTraslado(ajusteTour: AjusteEnTour | undefined) {
    const id = "prod-OD032";
    const local55 = { ...proveedor("prov-55", "Rodrigo Perez", ["perez@local55.test"]), ciudad: "BRASIL" };
    const buzios = { ...proveedor("prov-b", "buzios transfer", ["buziostransfer@hotmail.test"]), ciudad: "BRASIL" };
    return producto(
      id,
      "OD032",
      [
        servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Cabanacopa Hostel", bookingSupplier: local55 }),
        servicio({ productoId: id, tipo: "traslado", orden: 3, sentido: "llegada", ajusteTour, descripcion: "Transfer GIG - Accommodation in Rio. Booking Supplier: Buzios Transfers / Alex", serviceProviderNombre: "GIG - Accommodation in Rio", bookingSupplier: buzios }),
      ],
      { destino: "RIO" },
    );
  }

  function traslado(ajuste: AjusteEnTour | undefined) {
    const p = rioConTraslado(ajuste);
    const catalogo: CatalogoParaPedidos = { ...catalogoCon([p]), ciudadesPortugues: cargarCiudadesPortugues() };
    const r = ok(armarPedidos(reserva({ productoId: p.id, habitacion: "Dormitory - Hostel", fechaInicio: "2027-06-06", fechaFin: "2027-06-09" }), catalogo, plantilla, plantillaPt));
    return r.pedidos.find((x) => x.destinatarios.includes("buziostransfer@hotmail.test"))!.cuerpo;
  }

  it("BR04: de salida, del alojamiento al aeropuerto GIG", () => {
    const cuerpo = traslado(excepcion("BR04", "OD032"));
    expect(cuerpo).toContain("Transfer de saída: Transfer Cabanacopa Hostel - Aeropuerto GIG\nData: 9 jun 2027");
    expect(cuerpo).not.toContain("Transfer GIG - ");
  });

  it("ARBR23: la misma corrección con el texto que ya tiene cargado", () => {
    expect(traslado(excepcion("ARBR23", "OD032"))).toContain("Transfer de saída: Transfer Cabanacopa Hostel - aeropuerto de Rio (GIG)\nData: 9 jun 2027");
  });

  it("sin ajuste, como llegada, sigue el texto del Excel", () => {
    expect(traslado(undefined)).toContain("Transfer de chegada: Transfer GIG - Cabanacopa Hostel\nData: 6 jun 2027");
  });
});

describe("punto 5b — el Scuna Netuno, con punto de encuentro en el puerto", () => {
  function scuna(nombre = "Excursion Scuna Netuno 10.30 hs Islas paradisiacas") {
    const id = "prod-COMPBR02";
    const paratyTours = { ...proveedor("prov-pt", "PARATY TOURS", ["reservas@paratytours.test"]), ciudad: "PARATY" };
    const p = producto(
      id,
      "COMPBR02",
      [servicio({ productoId: id, tipo: "excursion", orden: 4, descripcion: `${nombre}. Booking Supplier: Paraty Tours`, serviceProviderNombre: nombre.replace("Excursion ", ""), bookingSupplier: paratyTours })],
      { destino: "PRY" },
    );
    const catalogo: CatalogoParaPedidos = {
      ...catalogoCon([p], [], [{ codigo: "COMPBR02", orden: 4, dia: 2 }]),
      ciudadesPortugues: cargarCiudadesPortugues(),
      puntosDeEncuentro: cargarPuntosDeEncuentro(RAIZ),
    };
    return ok(armarPedidos(reserva({ productoId: id, habitacion: "Dormitory - Hostel", fechaInicio: "2027-06-01", fechaFin: "2027-06-03" }), catalogo, plantilla, plantillaPt)).pedidos[0].cuerpo;
  }

  it("dice el punto de encuentro, sin pick up y sin preguntar el horario", () => {
    const cuerpo = scuna();
    expect(cuerpo).toContain("Ponto de encontro: Porto de Paraty (o passageiro vai direto)");
    expect(cuerpo).not.toMatch(/pick up|drop off/i);
    expect(cuerpo).not.toMatch(/hor[aá]rio/i);
  });

  it("otra excursión sin hora en el nombre sigue preguntando el horario", () => {
    expect(scuna("Excursion Otra de Paraty")).toMatch(/hor[aá]rio/i);
  });
});

describe("punto 5c — el TRF OUT de Foz en BR04", () => {
  const catalogo = (ajusteTour: AjusteEnTour | undefined) => {
    const p = { ...od010b, servicios: od010b.servicios.map((s) => (s.orden === 5 ? { ...s, ajusteTour } : s)) };
    return catalogoCon([p]);
  };
  const cuerpo = (ajuste: AjusteEnTour | undefined) => {
    const r = ok(armarPedidos({ ...reservaOd010b, habitacion: "Dormitory - Hostel" }, catalogo(ajuste), plantilla));
    return r.pedidos.find((p) => /TRF OUT/.test(p.cuerpo))!.cuerpo;
  };

  it("con la excepción de BR04: a la Rodoviaria de Foz, con el bus a São Paulo Barra Funda, sin pendiente", () => {
    const c = cuerpo(excepcion("BR04", "OD010B"));
    expect(c).toMatch(/TRF OUT: 6 oct 2026 · Rodoviaria de Foz \(bus a São Paulo Barra Funda\) · Pick up: /);
    expect(c).not.toMatch(/TRF OUT:[^\n]*pendiente/);
    expect(c).toMatch(/TRF IN: 3 oct 2026 · Bus o vuelo pendiente/);
  });

  it("OD010B vendido solo sigue igual", () => {
    expect(cuerpo(undefined)).toMatch(/TRF OUT: 6 oct 2026 · Bus o vuelo pendiente/);
  });

  it.each(["BRARCH26", "ARBR23"])("el texto de %s (terminal de Puerto Iguazú) sigue igual", (tour) => {
    expect(cuerpo(excepcion(tour, "OD010A"))).toMatch(/TRF OUT: 6 oct 2026 · Bus o vuelo pendiente/);
  });
});

describe("punto 5d — Rio de Janeiro en los mails en portugués", () => {
  it("el mail en portugués no lleva Río con acento", () => {
    const id = "prod-Y";
    const local = { ...proveedor("prov-y", "Local 55", ["y@x.test"]), ciudad: "BRASIL" };
    const p = producto(
      id,
      "OD032",
      [
        servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Cabanacopa Hostel", bookingSupplier: local }),
        servicio({ productoId: id, tipo: "excursion", orden: 4, descripcion: "Big Dude. Booking Supplier: Local 55", serviceProviderNombre: "Big Dude", bookingSupplier: local }),
      ],
      { destino: "RIO" },
    );
    const catalogo: CatalogoParaPedidos = { ...catalogoCon([p], [], [{ codigo: "OD032", orden: 4, dia: 2 }]), ciudadesPortugues: cargarCiudadesPortugues() };
    const { cuerpo } = ok(armarPedidos(reserva({ productoId: id, habitacion: "Dormitory - Hostel", fechaInicio: "2027-06-06", fechaFin: "2027-06-09" }), catalogo, plantilla, plantillaPt)).pedidos[0];
    expect(cuerpo).toContain("Cabanacopa Hostel (Rio de Janeiro)");
    expect(cuerpo).not.toContain("Río");
  });

  it("el mail en castellano no cambia", () => {
    const id = "prod-Z";
    const local = { ...proveedor("prov-z", "Local 55", ["z@x.test"]), ciudad: "MENDOZA" };
    const p = producto(
      id,
      "OD032",
      [
        servicio({ productoId: id, tipo: "alojamiento", nivel: "Hostel", orden: 1, serviceProviderNombre: "Cabanacopa Hostel", bookingSupplier: local }),
        servicio({ productoId: id, tipo: "excursion", orden: 4, descripcion: "Big Dude. Booking Supplier: Local 55", serviceProviderNombre: "Big Dude", bookingSupplier: local }),
      ],
      { destino: "RIO" },
    );
    const catalogo: CatalogoParaPedidos = { ...catalogoCon([p], [], [{ codigo: "OD032", orden: 4, dia: 2 }]), ciudadesPortugues: cargarCiudadesPortugues() };
    const { cuerpo } = ok(armarPedidos(reserva({ productoId: id, habitacion: "Dormitory - Hostel", fechaInicio: "2027-06-06", fechaFin: "2027-06-09" }), catalogo, plantilla, plantillaPt)).pedidos[0];
    expect(cuerpo).toContain("Cabanacopa Hostel (Río de Janeiro)");
  });
});
