import { describe, expect, it } from "vitest";
import { etiquetasTransferEnTour } from "./reglas";
import type { AjusteEnTour, ComponenteTour, Servicio } from "./tipos";

// Spec M1-09 §3 #4: dentro de un tour, "Transfer de llegada / de salida" de
// cada paquete no contradice lo que se pide de verdad (ajustes de M1-08).

let n = 0;
function servicio(parcial: Partial<Servicio>): Servicio {
  n += 1;
  return {
    id: `s${n}`,
    productoId: "p",
    tipo: "traslado",
    nivel: null,
    orden: n,
    prioridad: 1,
    descripcion: null,
    opcional: false,
    reservaManual: false,
    sinResolver: false,
    paraRevisar: false,
    nota: null,
    filaExcel: null,
    serviceProviderNombre: null,
    bookingSupplierNombre: null,
    serviceProvider: null,
    bookingSupplier: null,
    ...parcial,
  };
}

function traslado(sentido: Servicio["sentido"], accion?: AjusteEnTour["accion"]): Servicio {
  return servicio({
    tipo: "traslado",
    sentido,
    ...(accion ? { ajusteTour: { accion, texto: null, motivo: "x", origen: "regla" } } : {}),
  });
}

function paquete(
  codigo: string,
  dia: number,
  opciones: { in?: boolean; out?: boolean; destino?: string; servicios?: Servicio[]; componentes?: ComponenteTour[]; esTour?: boolean } = {},
): ComponenteTour {
  return {
    orden: dia,
    tipo: "paquete",
    diaDesde: dia,
    noches: 2,
    nocturno: null,
    transferIn: opciones.in ?? false,
    transferOut: opciones.out ?? false,
    descripcionRuta: null,
    producto: {
      id: codigo,
      codigo,
      nombre: codigo,
      ciudades: [],
      destino: opciones.destino ?? "XXX",
      updatedAt: "2026-10-10T00:00:00Z",
      esTour: opciones.esTour ?? false,
      servicios: opciones.servicios ?? [],
      ...(opciones.componentes ? { componentes: opciones.componentes } : {}),
    },
  };
}

function bus(dia: number): ComponenteTour {
  return { orden: dia, tipo: "tramo_bus", diaDesde: dia, noches: null, nocturno: false, transferIn: false, transferOut: false, descripcionRuta: "A – B", producto: null };
}

function busDelTour(dia: number): Servicio {
  return servicio({ tipo: "bus", descripcion: `Bus Puerto Natales – Punta Arenas (diurno, sale el día ${dia} del tour). Booking Supplier: Kupos.cl` });
}

/** "OD033 IN" / "OD017" (las etiquetas que quedan, por paquete, en orden). */
function etiquetas(componentes: ComponenteTour[]): string[] {
  return componentes.flatMap((c) => {
    if (!c.producto) return [];
    const propia = [c.producto.codigo, c.transferIn ? "IN" : "", c.transferOut ? "OUT" : ""].filter(Boolean).join(" ");
    return [propia, ...etiquetas(c.producto.componentes ?? [])];
  });
}

describe("etiquetas de transfer dentro de un tour (spec M1-09 §3 #4)", () => {
  it("ARCH31: OD017 al final sin 'Transfer de salida' (sale con el bus del tour a Punta Arenas); OD033 conserva la llegada", () => {
    const componentes = [
      paquete("OD033", 1, { in: true, servicios: [traslado("llegada")] }),
      paquete("OD016", 4, { servicios: [traslado("llegada", "anular")] }),
      bus(7),
      paquete("OD017", 7, { out: true, servicios: [traslado("llegada", "anular")] }),
    ];
    expect(etiquetas(etiquetasTransferEnTour(componentes, [busDelTour(9)]))).toEqual(["OD033 IN", "OD016", "OD017"]);
  });

  it("ARCH33: CH10 sin 'Transfer de salida' (no tiene traslados y sale con el bus del tour)", () => {
    const componentes = [paquete("OD033", 1, { in: true, servicios: [traslado("llegada")] }), bus(6), paquete("CH10", 6, { out: true })];
    expect(etiquetas(etiquetasTransferEnTour(componentes, [busDelTour(12)]))).toEqual(["OD033 IN", "CH10"]);
  });

  it("sin bus del tour al final, la marca del último paquete se mantiene", () => {
    const componentes = [paquete("OD033", 1, { in: true }), bus(4), paquete("OD022", 4, { out: true })];
    expect(etiquetas(etiquetasTransferEnTour(componentes, []))).toEqual(["OD033 IN", "OD022 OUT"]);
  });

  it("un bus del tour antes del primer paquete saca su 'Transfer de llegada' (BOCHI04R: bus La Paz – Uyuni el día 1)", () => {
    const componentes = [paquete("COMPBO20", 1, { in: true }), paquete("OD030", 3, { out: true, servicios: [traslado("llegada", "invertir")] })];
    expect(etiquetas(etiquetasTransferEnTour(componentes, [busDelTour(1)]))).toEqual(["COMPBO20", "OD030 OUT"]);
  });

  it("un traslado que queda de un lado muestra ese lado aunque se llegue en bus (OD031 desde la terminal, OD022 solo salida)", () => {
    const componentes = [
      paquete("OD018", 1, { in: true, servicios: [traslado("ida_y_vuelta", "solo_llegada")] }),
      bus(4),
      paquete("OD031", 4, { in: true, servicios: [traslado("llegada", "reemplazar")] }),
      bus(7),
      paquete("OD022", 7, { out: true, servicios: [traslado("ida_y_vuelta", "solo_salida")] }),
    ];
    expect(etiquetas(etiquetasTransferEnTour(componentes, []))).toEqual(["OD018 IN", "OD031 IN", "OD022 OUT"]);
  });

  it("Iguazú conserva sus marcas en el medio del tour (el transfer va dentro del 105 Premium)", () => {
    const componentes = [paquete("OD032", 1, { in: true, servicios: [traslado("llegada")] }), bus(4), paquete("OD010D", 5, { in: true, out: true, destino: "IGR" }), bus(8), paquete("OD020", 9)];
    expect(etiquetas(etiquetasTransferEnTour(componentes, []))).toEqual(["OD032 IN", "OD010D IN OUT", "OD020"]);
  });

  it("en el medio del tour la marca sola no alcanza: se llega y se sale en bus", () => {
    const componentes = [paquete("A", 1, { in: true }), paquete("B", 3, { in: true, out: true }), paquete("C", 5, { out: true })];
    expect(etiquetas(etiquetasTransferEnTour(componentes, []))).toEqual(["A IN", "B", "C OUT"]);
  });

  it("un tour dentro de otro se mira desplegado: OD030 de CHB31 en el medio de 5C01 pierde la llegada anulada; COMPBO20 la salida", () => {
    const chb31 = paquete("CHB31", 22, {
      esTour: true,
      servicios: [servicio({ tipo: "bus", descripcion: "Bus Uyuni – La Paz (nocturno, sale el día 6 del tour). Booking Supplier: Imperio Inca" })],
      componentes: [paquete("OD030", 1, { in: true, servicios: [traslado("llegada", "anular")] }), bus(4), paquete("COMPBO20", 4, { out: true })],
    });
    const componentes = [paquete("OD032", 1, { in: true, servicios: [traslado("llegada")] }), bus(20), chb31, paquete("OD031", 28, { in: true, servicios: [traslado("llegada", "reemplazar")] })];
    expect(etiquetas(etiquetasTransferEnTour(componentes, []))).toEqual(["OD032 IN", "CHB31", "OD030", "COMPBO20", "OD031 IN"]);
  });

  it("no toca el paquete fuera del tour ni un tour sin paquetes", () => {
    expect(etiquetasTransferEnTour([], [])).toEqual([]);
  });
});
