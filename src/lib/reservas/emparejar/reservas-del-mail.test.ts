import { describe, expect, it, vi } from "vitest";
import { catalogoDePrueba, detallePorId, fichaDePrueba, idDe, noCargadosDePrueba, proveedorPatagoniaPlanet } from "./__fixtures__/cargar";
import type { ProponerProducto } from "./emparejar";
import type { ProductoIA } from "../esquema-ficha";
import { armarReservas, type DependenciasReservas } from "./reservas-del-mail";

/**
 * Spec M2-03 filas 7, 8, 13 y 14: de la ficha de M2-02 a las reservas (una
 * por producto), con su estado y todos sus motivos. Catálogo real (foto), IA
 * simulada, sin base.
 */

function deps(proponer?: ProponerProducto): DependenciasReservas {
  return {
    catalogo: catalogoDePrueba(),
    detalle: detallePorId,
    proponer,
    proveedorTransferPNT: proveedorPatagoniaPlanet(),
  };
}

const llamadaFalsa = {
  tarea: "propuesta_producto" as const,
  modelo: "modelo-de-prueba",
  versionInstrucciones: "propuesta-producto.v1",
  tokensIn: 2000,
  tokensOut: 100,
  costoUsd: 0.005,
  resultado: "ok" as const,
  mailRecibidoId: "m-1",
  dePrueba: true,
};

const iaQueDice = (codigo: string | null, confianza: number) =>
  vi.fn<ProponerProducto>(async () => ({
    resultado: { tipo: "respuesta", codigo, confianza, motivo: "simulada" },
    llamada: llamadaFalsa,
    costo: 0.005,
  }));

describe("M2-03 fila 14 — estado final", () => {
  it("el Kilroy de OD010D con vuelos completos → recibida, origen código, sin motivos", async () => {
    const [r] = await armarReservas(fichaDePrueba("kilroy-od010d-dk1564627"), deps());
    expect(r.entrada).toMatchObject({
      agencia: "Kilroy",
      bookingId: "DK1564627",
      productoId: idDe("OD010D"),
      estado: "recibida",
      motivosRevision: [],
      origenEmparejado: "codigo",
      confianzaEmparejado: 1,
      fechaInicio: "2026-09-06",
      fechaFin: "2026-09-09",
      pax: 2,
    });
    expect(r.entrada.vuelos).toHaveLength(2);
    expect(r.entrada.datosExtraidos).toBeTruthy();
  });

  it("owner 2026-10-16: el PDF del Overland → CHB31 por IA, recibida, con el aviso de que falta el vuelo", async () => {
    const proponer = iaQueDice("CHB31", 0.95);
    const [r] = await armarReservas(fichaDePrueba("tourradar-overland-1376833"), deps(proponer));
    expect(r.entrada.productoId).toBe(idDe("CHB31"));
    expect(r.entrada.origenEmparejado).toBe("ia");
    expect(r.entrada.confianzaEmparejado).toBe(0.95);
    expect(r.entrada.estado).toBe("recibida");
    expect(r.entrada.motivosRevision).toEqual([]);
    expect(r.avisos).toEqual(["Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030"]);
    // Las partes del tour, desde el 11 Oct.
    expect(r.entrada.componentes?.[0]).toMatchObject({ productoId: idDe("OD030"), fechaInicio: "2026-10-11" });
    // La llamada a la IA queda para registrarla con la reserva.
    expect(r.llamadas).toEqual([llamadaFalsa]);
    expect(r.costo).toBe(0.005);
  });

  it("con la confianza baja: sin producto, con la sugerencia guardada aparte", async () => {
    const [r] = await armarReservas(fichaDePrueba("tourradar-overland-1376833"), deps(iaQueDice("CHB31", 0.7)));
    expect(r.entrada.productoId).toBeNull();
    expect(r.entrada.origenEmparejado).toBeNull();
    expect(r.entrada.sugerenciaProductoId).toBe(idDe("CHB31"));
    expect(r.entrada.componentes).toEqual([]);
    expect(r.entrada.estado).toBe("para_revision");
    expect(r.entrada.motivosRevision[0]).toMatch(/^No se pudo reconocer con seguridad/);
  });

  it("producto no cargado: para revisión, sin IA, con el texto de la agencia guardado", async () => {
    const proponer = iaQueDice("ARCH33", 0.99);
    const [r] = await armarReservas(fichaDePrueba("kilroy-arch-exp-dk1586168"), deps(proponer));
    expect(r.entrada.estado).toBe("para_revision");
    expect(r.entrada.motivosRevision).toEqual([
      "El producto HI_TRAVEL_ARCH_EXP-677 (Patagonia, Trekking Paradise with W-Trek EXPRESS) no está en el catálogo",
    ]);
    expect(r.entrada.productoTextoAgencia).toContain("HI_TRAVEL_ARCH_EXP-677");
    expect(proponer).not.toHaveBeenCalled();
    expect(r.costo).toBe(0);
  });

  it("owner 2026-10-14: ARCH33EXP (conocido, no cargado) → para revisión con el motivo 'no cargado' y 0 llamadas a la IA", async () => {
    const proponer = iaQueDice("ARCH33", 0.99);
    const [r] = await armarReservas(fichaDePrueba("kilroy-arch-exp-dk1586168"), { ...deps(proponer), noCargados: noCargadosDePrueba() });
    expect(r.entrada.estado).toBe("para_revision");
    expect(r.entrada.motivosRevision).toEqual([
      "El producto ARCH33EXP (Patagonia, Trekking Paradise with W-Trek EXPRESS) existe en el catálogo de HI Travel pero todavía no está cargado en el sistema.",
    ]);
    expect(proponer).not.toHaveBeenCalled();
    expect(r.llamadas).toEqual([]);
    expect(r.costo).toBe(0);
  });
});

describe("TourRadar (owner 2026-10-16): un número de reserva = UNA reserva", () => {
  // La noche de hotel extra del statement (1363612: "Hotel La Aldea 4*") va dentro de la
  // misma reserva, como pedido especial, no como otra reserva.
  const conHotelExtra = (base: string, extra: Partial<ProductoIA> = {}) => {
    const ficha = fichaDePrueba(base);
    ficha.productos = [
      ...ficha.productos,
      {
        nombre: "Hotel La Aldea 4*",
        codigo: null,
        fecha_inicio: null,
        fecha_fin: null,
        noches: null,
        habitacion: "SGL",
        punto_recogida: null,
        opcionales: [],
        confianza: 0.7,
        ...extra,
      },
    ];
    return ficha;
  };

  it("la cancelación 1363612 (tour + noche de hotel extra) deja una sola reserva, con el hotel como pedido especial", async () => {
    const rs = await armarReservas(conHotelExtra("tourradar-cancelacion-1363612"), deps());
    expect(rs).toHaveLength(1);
    expect(rs[0].entrada.productoTextoAgencia).toBe("Iguazu Falls on a Shoestring (3N)");
    expect(rs[0].entrada.pedidosEspeciales).toBe("También en el estado de cuenta: Hotel La Aldea 4* (SGL)");
    expect(rs[0].productoIA?.nombre).toBe("Iguazu Falls on a Shoestring (3N)");
  });

  it("una reserva nueva con un extra con fechas: se empareja solo el tour (una llamada a la IA) y el extra dice sus fechas", async () => {
    const proponer = iaQueDice("CHB31", 0.95);
    const ficha = conHotelExtra("tourradar-overland-1376833", { fecha_inicio: "2026-10-10", fecha_fin: "2026-10-11", noches: 1 });
    ficha.pedidos_especiales = [{ texto: "Vegetarian", confianza: 0.9 }];
    const rs = await armarReservas(ficha, deps(proponer));
    expect(rs).toHaveLength(1);
    expect(rs[0].entrada.productoId).toBe(idDe("CHB31"));
    expect(proponer).toHaveBeenCalledTimes(1);
    expect(rs[0].entrada.pedidosEspeciales).toBe(
      "Vegetarian\nTambién en el estado de cuenta: Hotel La Aldea 4* (SGL, 1 noche, 10/10/2026 al 11/10/2026)",
    );
  });

  it("el tour es el que empieza en la fecha de inicio del statement, aunque no venga primero", async () => {
    const ficha = conHotelExtra("tourradar-cancelacion-1363612");
    ficha.productos = [...ficha.productos].reverse();
    const [r] = await armarReservas(ficha, deps());
    expect(r.entrada.productoTextoAgencia).toBe("Iguazu Falls on a Shoestring (3N)");
  });

  it("Kilroy no cambia: un mail con dos productos del mismo número sigue dando dos reservas", async () => {
    expect(await armarReservas(fichaDePrueba("kilroy-dk1576932"), deps())).toHaveLength(2);
  });
});

describe("M2-03 fila 8 — un mail con varios productos", () => {
  it("el Kilroy DK1576932 deja dos reservas: ARCH33 y CHB31, con el mismo booking_id", async () => {
    const rs = await armarReservas(fichaDePrueba("kilroy-dk1576932"), deps());
    expect(rs).toHaveLength(2);
    expect(rs.map((r) => r.entrada.productoId)).toEqual([idDe("ARCH33"), idDe("CHB31")]);
    expect(rs.map((r) => r.entrada.bookingId)).toEqual(["DK1576932", "DK1576932"]);
    // Cada una con su estado y sus fechas.
    expect(rs[0].entrada.fechaInicio).toBe("2027-02-23");
    expect(rs[1].entrada.fechaInicio).toBe("2027-03-06");
    // Owner 2026-10-16: falta el vuelo = aviso; las dos quedan recibidas.
    expect(rs.map((r) => r.entrada.estado)).toEqual(["recibida", "recibida"]);
    expect(rs[0].avisos).toEqual([
      "Falta el vuelo de llegada a El Calafate (FTE) para el traslado de OD033",
      "Falta el vuelo de salida de Puerto Natales (PNT) para el traslado al aeropuerto de Puerto Natales",
    ]);
    // Fila 10: el TOUR 1 termina con el transfer a PNT.
    expect(rs[0].entrada.componentes?.at(-1)?.descripcionRuta).toBe("Transfer al aeropuerto de Puerto Natales (PNT)");
    expect(rs[1].avisos).toEqual(["Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030"]);
    expect(rs[1].entrada.motivosRevision).toEqual([]);
  });
});

describe("M2-03 fila 13 — datos dudosos y tipo de mail", () => {
  it("ficha con fechas dudosas → para revisión con ese motivo, aunque el producto sea seguro", async () => {
    const [r] = await armarReservas(fichaDePrueba("kilroy-od010d-dk1564627", { datosDudosos: ["fechas"] }), deps());
    expect(r.entrada.productoId).toBe(idDe("OD010D"));
    expect(r.entrada.estado).toBe("para_revision");
    expect(r.entrada.motivosRevision).toEqual(["La IA no está segura de: fechas"]);
  });

  it("varios datos dudosos van en un solo motivo", async () => {
    const [r] = await armarReservas(
      fichaDePrueba("kilroy-od010d-dk1564627", { datosDudosos: ["producto", "fechas", "vuelos"] }),
      deps(),
    );
    expect(r.entrada.motivosRevision).toEqual(["La IA no está segura de: producto, fechas, vuelos"]);
  });

  it("el PDF vendorcredit de Iguazú (cancelación) → para revisión, nunca recibida, y sin IA", async () => {
    const proponer = iaQueDice("OD010A", 0.99);
    const rs = await armarReservas(fichaDePrueba("tourradar-cancelacion-1363612"), deps(proponer));
    expect(rs).toHaveLength(1);
    expect(rs[0].entrada.estado).toBe("para_revision");
    expect(rs[0].entrada.motivosRevision).toEqual(["El mail es una cancelación: la resuelve una persona"]);
    expect(rs[0].entrada.componentes).toEqual([]);
    expect(proponer).not.toHaveBeenCalled();
  });

  it("un cambio o cargo también queda para revisión", async () => {
    const [r] = await armarReservas(fichaDePrueba("kilroy-od010d-dk1564627", { tipo: "cambio_o_cargo" }), deps());
    expect(r.entrada.estado).toBe("para_revision");
    expect(r.entrada.motivosRevision[0]).toContain("El mail es un cambio o un cargo");
  });

  it("una reserva nueva sin productos → una reserva para revisión que lo dice", async () => {
    const ficha = fichaDePrueba("kilroy-od010d-dk1564627");
    ficha.productos = [];
    const rs = await armarReservas(ficha, deps());
    expect(rs).toHaveLength(1);
    expect(rs[0].entrada.motivosRevision).toEqual(["El mail no dice qué producto se reserva"]);
  });
});

describe("M2-03 fila 7 — la lectura falló o la IA no está: nunca se pierde la reserva", () => {
  it("si M2-02 no pudo leer el mail, queda una reserva para revisión con ese motivo", async () => {
    const rs = await armarReservas(
      { estado: "para_revision", motivo: "se agotó el presupuesto de IA del mes", costo: 0 },
      deps(),
      { agencia: "TourRadar" },
    );
    expect(rs).toHaveLength(1);
    expect(rs[0].entrada).toMatchObject({
      agencia: "TourRadar",
      productoId: null,
      estado: "para_revision",
      motivosRevision: ["No se pudo leer el mail: se agotó el presupuesto de IA del mes"],
    });
  });

  it("techo agotado en el paso 3 → para revisión con el motivo del techo", async () => {
    const proponer = vi.fn<ProponerProducto>(async () => ({
      resultado: { tipo: "fallo", causa: "techo" },
      llamada: { ...llamadaFalsa, resultado: "sin_presupuesto", costoUsd: 0, tokensIn: 0, tokensOut: 0 },
      costo: 0,
    }));
    const [r] = await armarReservas(fichaDePrueba("tourradar-overland-1376833"), deps(proponer));
    expect(r.entrada.motivosRevision).toEqual(["No se usó la IA: se llegó al techo de gasto del mes"]);
    expect(r.llamadas[0].resultado).toBe("sin_presupuesto");
  });
});
