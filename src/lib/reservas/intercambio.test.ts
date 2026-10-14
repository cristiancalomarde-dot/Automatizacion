import { describe, expect, it } from "vitest";
import { detalleDePrueba, fichaDePrueba } from "./emparejar/__fixtures__/cargar";
import { MOTIVOS_EMPAREJADO as M } from "./emparejar/motivos";
import { motivosDeVuelos } from "./emparejar/vuelos-requeridos";
import type { VueloIA } from "./esquema-ficha";
import {
  armarCambios,
  cargoExtraDelMail,
  claveProductoAgencia,
  decidirPedido,
  MOTIVOS_INTERCAMBIO as MI,
  mismoProducto,
  type PedidoIntercambio,
  type ReservaExistente,
} from "./intercambio";

/**
 * Spec M2-04, verificación 1: la decisión por pedido (filas 3-10) y completar
 * sin pisar (filas 4, 5 y 12), con datos en memoria. Nada toca la base ni la IA.
 */

const AHORA = new Date("2026-10-14T12:00:00Z");
const haceDias = (d: number) => new Date(AHORA.getTime() - d * 86_400_000).toISOString();

let n = 0;
function reserva(cambios: Partial<ReservaExistente> = {}): ReservaExistente {
  n += 1;
  return {
    id: `r${n}`,
    agencia: "Kilroy",
    booking_id: "DK1594100",
    producto_id: "p-chb31",
    producto_clave_agencia: "hi_argentina_overland_7days",
    producto_texto_agencia: "Overland",
    fecha_inicio: "2027-01-18",
    fecha_fin: "2027-01-24",
    pax: 2,
    pasajeros: [],
    vuelos: [],
    habitacion: null,
    pedidos_especiales: null,
    estado: "recibida",
    motivos_revision: [],
    de_prueba: true,
    created_at: haceDias(1),
    ...cambios,
  };
}

function pedido(cambios: Partial<PedidoIntercambio> = {}): PedidoIntercambio {
  return {
    agencia: "Kilroy",
    bookingId: "DK1594100",
    productoId: "p-chb31",
    claveAgencia: "hi_argentina_overland_7days",
    fechaInicio: "2027-01-18",
    pax: 2,
    dePrueba: true,
    ...cambios,
  };
}

const decidir = (p: PedidoIntercambio, existentes: ReservaExistente[]) => decidirPedido(p, existentes, { ahora: AHORA });

describe("claveProductoAgencia y mismoProducto", () => {
  it("el código de la agencia en minúsculas y sin el sufijo -677; si no hay código, el nombre", () => {
    expect(claveProductoAgencia({ codigo: "HI_ARGENTINA_OVERLAND_7DAYS-677", nombre: "Overland" })).toBe(
      "hi_argentina_overland_7days",
    );
    expect(claveProductoAgencia({ codigo: null, nombre: "  Patagonia   Adventure Tour " })).toBe("patagonia adventure tour");
    expect(claveProductoAgencia({ codigo: null, nombre: "" })).toBeNull();
  });
  it("mismo producto del catálogo si los dos emparejaron; si alguno no, el código o nombre de la agencia", () => {
    expect(mismoProducto(pedido(), reserva({ producto_clave_agencia: "otra" }))).toBe(true);
    expect(mismoProducto(pedido({ productoId: "p-ar09" }), reserva())).toBe(false);
    expect(mismoProducto(pedido({ productoId: null }), reserva())).toBe(true);
    expect(mismoProducto(pedido({ productoId: null, claveAgencia: "otra" }), reserva())).toBe(false);
    expect(mismoProducto(pedido({ productoId: null, claveAgencia: null }), reserva())).toBe(false);
  });
});

describe("fila 3: mismo booking_id + mismo producto → se suma a la que existe", () => {
  it("el Overland DK1594100 que vuelve en el documento 'varias' se suma, no crea otra", () => {
    const overland = reserva();
    expect(decidir(pedido(), [overland])).toEqual({ tipo: "sumar_a", reservaId: overland.id });
  });
  it("los 2 estados de cuenta de TourRadar 1377598: mismo título, sin producto del catálogo", () => {
    const tr = reserva({ agencia: "TourRadar", booking_id: "1377598", producto_id: null, producto_clave_agencia: "patagonia adventure tour" });
    const p = pedido({ agencia: "TourRadar", bookingId: "1377598", productoId: null, claveAgencia: "patagonia adventure tour" });
    expect(decidir(p, [tr])).toEqual({ tipo: "sumar_a", reservaId: tr.id });
  });
  it("el booking_id se compara dentro de la misma agencia", () => {
    const jw = reserva({ agencia: "Journaway", booking_id: "1377598", producto_clave_agencia: "patagonia adventure tour" });
    const p = pedido({ agencia: "TourRadar", bookingId: "1377598", productoId: null, claveAgencia: "patagonia adventure tour" });
    expect(decidir(p, [jw]).tipo).toBe("nueva");
  });
});

describe("fila 6: mismo booking_id + producto distinto → reserva nueva, enlazada", () => {
  it("'varias' con el Overland ya cargado: Iguazú OD010D es nueva, con la misma referencia que el Overland", () => {
    const overland = reserva();
    const d = decidir(pedido({ productoId: "p-od010d", claveAgencia: "hi_argentina_od010d", fechaInicio: "2027-01-06" }), [overland]);
    expect(d).toEqual({ tipo: "nueva", mismaReferencia: [overland.id] });
  });
});

describe("fila 7: mismo booking_id y el mail no dice el producto", () => {
  const sinProducto = pedido({ productoId: null, claveAgencia: null, bookingId: "DK1586168", fechaInicio: null, pax: null });
  it("una sola reserva con esa referencia → se suma a ella", () => {
    const una = reserva({ booking_id: "DK1586168" });
    expect(decidir(sinProducto, [una])).toEqual({ tipo: "sumar_a", reservaId: una.id });
  });
  it("varias (ARCH33 y el Overland de DK1576932) → para revisión con las dos enlazadas, sin elegir", () => {
    const arch33 = reserva({ booking_id: "DK1576932", producto_id: "p-arch33" });
    const chb31 = reserva({ booking_id: "DK1576932" });
    const d = decidir({ ...sinProducto, bookingId: "DK1576932" }, [arch33, chb31]);
    expect(d).toEqual({ tipo: "revision_ambigua", reservaIds: [arch33.id, chb31.id] });
  });
});

describe("fila 8: sin booking_id que coincida → marca blanda 'posible duplicada'", () => {
  const iguazuArg = (c: Partial<ReservaExistente> = {}) =>
    reserva({
      agencia: "Journaway",
      booking_id: null,
      producto_id: null,
      producto_clave_agencia: "from foz do iguacu: half-day tour to the argentinean side of iguazu falls",
      fecha_inicio: "2027-06-14",
      pax: 2,
      ...c,
    });
  const pedidoArg = (c: Partial<PedidoIntercambio> = {}) =>
    pedido({
      agencia: "Journaway",
      bookingId: null,
      productoId: null,
      claveAgencia: "from foz do iguacu: half-day tour to the argentinean side of iguazu falls",
      fechaInicio: "2027-06-14",
      pax: 2,
      ...c,
    });

  it("un mail de Journaway reenviado (mismo tour, fecha y pax) → nueva, marcada y enlazada a la otra", () => {
    const original = iguazuArg();
    expect(decidir(pedidoArg(), [original])).toEqual({ tipo: "nueva_posible_duplicada", duplicadaDe: original.id, mismaReferencia: [] });
  });
  it("los Gallien: Brazilian Side 13/06 y Argentina Side 14/06 → sin marca", () => {
    const brasil = iguazuArg({ producto_clave_agencia: "half-day tour to the brazilian iguazu falls", fecha_inicio: "2027-06-13" });
    expect(decidir(pedidoArg(), [brasil])).toEqual({ tipo: "nueva", mismaReferencia: [] });
  });
  it("la otra entró hace 61 días → sin marca; hace 59, con marca", () => {
    expect(decidir(pedidoArg(), [iguazuArg({ created_at: haceDias(61) })]).tipo).toBe("nueva");
    expect(decidir(pedidoArg(), [iguazuArg({ created_at: haceDias(59) })]).tipo).toBe("nueva_posible_duplicada");
  });
  it("otra cantidad de pax u otra fecha → sin marca; sin fecha o sin pax no se compara", () => {
    expect(decidir(pedidoArg({ pax: 3 }), [iguazuArg()]).tipo).toBe("nueva");
    expect(decidir(pedidoArg({ fechaInicio: "2027-06-15" }), [iguazuArg()]).tipo).toBe("nueva");
    expect(decidir(pedidoArg({ pax: null }), [iguazuArg({ pax: null })]).tipo).toBe("nueva");
  });
  it("el remitente es la agencia: otra agencia con lo mismo no marca", () => {
    expect(decidir(pedidoArg({ agencia: "TourRadar" }), [iguazuArg()]).tipo).toBe("nueva");
  });
});

describe("fila 10: las de prueba y las reales no se cruzan", () => {
  it("una reserva real DK1594100 no es candidata para un mail de prueba (ni al revés)", () => {
    const real = reserva({ de_prueba: false });
    expect(decidir(pedido({ dePrueba: true }), [real])).toEqual({ tipo: "nueva", mismaReferencia: [] });
    expect(decidir(pedido({ dePrueba: false }), [reserva({ de_prueba: true })])).toEqual({ tipo: "nueva", mismaReferencia: [] });
  });
});

// --- completar sin pisar ---------------------------------------------------------------

const vuelo = (v: Partial<VueloIA>): VueloIA => ({
  numero: null,
  aerolinea: null,
  origen: null,
  destino: null,
  fecha_salida: null,
  hora_salida: null,
  fecha_llegada: null,
  hora_llegada: null,
  confianza: 1,
  ...v,
});

function entrante(c: Partial<Parameters<typeof armarCambios>[1]> = {}): Parameters<typeof armarCambios>[1] {
  return {
    fechaInicio: "2027-01-18",
    fechaFin: "2027-01-24",
    pax: 2,
    pasajeros: [],
    vuelos: [],
    habitacion: null,
    pedidosEspeciales: null,
    esCancelacion: false,
    vuelosDudosos: false,
    ...c,
  };
}

describe("fila 3: completa solo los datos vacíos", () => {
  it("vuelos, pasajeros y pedidos especiales vacíos se completan; la reserva recibida sigue recibida", () => {
    const pasajeros = [{ nombre: "Pasajero", apellido: "Uno", nacionalidad: "DK", fecha_nacimiento: null, confianza: 1 }];
    const v = vuelo({ numero: "LA800", origen: "SCL", destino: "CJC", fecha_llegada: "2027-01-18", hora_llegada: "10:00" });
    const c = armarCambios(reserva(), entrante({ pasajeros, vuelos: [v], pedidosEspeciales: "vegetariano" }), {});
    expect(c.completar).toEqual({ pasajeros, vuelos: [v], pedidos_especiales: "vegetariano" });
    expect(c.completados).toEqual(["pasajeros", "vuelos", "pedidos_especiales"]);
    expect(c.distintos).toEqual([]);
    expect(c).toMatchObject({ estado: "recibida", motivos: [] });
  });
  it("los datos del pasaporte se suman al pasajero que ya estaba, sin pisar lo que tenía", () => {
    const antes = [{ nombre: "Ana", apellido: "Prueba", nacionalidad: null, fecha_nacimiento: "2005-02-21", confianza: 1 }];
    const ahora = [{ nombre: "ANA", apellido: "Prueba", nacionalidad: "DK", fecha_nacimiento: "2005-02-22", confianza: 1 }];
    const c = armarCambios(reserva({ pasajeros: antes }), entrante({ pasajeros: ahora }), {});
    expect(c.completar.pasajeros).toEqual([{ ...antes[0], nacionalidad: "DK" }]);
  });
  it("un mail sin nada nuevo no cambia nada", () => {
    const c = armarCambios(reserva(), entrante(), {});
    expect(c).toMatchObject({ completar: {}, completados: [], distintos: [], estado: "recibida", motivos: [], nota: null });
  });
});

describe("fila 4: un dato distinto no pisa al que está", () => {
  it("2 pax y el mail dice 3 → sigue con 2, anota los dos valores y pasa a revisión", () => {
    const c = armarCambios(reserva(), entrante({ pax: 3 }), {});
    expect(c.completar).toEqual({});
    expect(c.distintos).toEqual([{ campo: "pax", agencia: "3", reserva: "2", texto: "La agencia mandó 3 pasajeros, la reserva dice 2" }]);
    expect(c).toMatchObject({ estado: "para_revision", motivos: [MI.datosDistintos] });
  });
  it("otra fecha de salida → 'la agencia mandó salida 12/03, la reserva dice 06/03'", () => {
    const c = armarCambios(reserva({ fecha_inicio: "2027-03-06" }), entrante({ fechaInicio: "2027-03-12" }), {});
    expect(c.distintos[0].texto).toBe("La agencia mandó salida 12/03, la reserva dice 06/03");
  });
  it("otro vuelo para el mismo tramo es un dato distinto, no se suma", () => {
    const v1 = vuelo({ numero: "LA800", origen: "SCL", destino: "CJC" });
    const v2 = vuelo({ numero: "JA301", origen: "SCL", destino: "CJC" });
    const c = armarCambios(reserva({ vuelos: [v1] }), entrante({ vuelos: [v2] }), {});
    expect(c.completar).toEqual({});
    expect(c.distintos.map((d) => d.campo)).toEqual(["vuelos"]);
  });
  it("en para revisión suma el motivo sin perder los que tenía", () => {
    const c = armarCambios(reserva({ estado: "para_revision", motivos_revision: ["otro"] }), entrante({ pax: 3 }), {});
    expect(c.motivos).toEqual(["otro", MI.datosDistintos]);
  });
});

describe("fila 5: los vuelos que llegan después resuelven el 'falta el vuelo'", () => {
  // Kilroy ARCH33 (DK1576932, "flights after tour are from Puerto Natales"): pide el vuelo
  // de llegada a El Calafate y el de salida de Puerto Natales (catálogo real).
  const ficha = fichaDePrueba("kilroy-dk1576932");
  const llegada = vuelo({ numero: "AR1874", origen: "AEP", destino: "FTE", fecha_llegada: "2027-02-23", hora_llegada: "12:30" });
  const salida = vuelo({ numero: "LA290", origen: "PNT", destino: "SCL", fecha_salida: "2027-03-06", hora_salida: "15:00" });
  const recheck = (vuelos: VueloIA[]) =>
    motivosDeVuelos(detalleDePrueba("ARCH33"), {
      vuelos,
      pedidos: ficha.pedidos_especiales.map((p) => p.texto),
      producto: ficha.productos[0],
      finalPuertoNatales: true,
    });
  const motivosSinVuelo = recheck([]);
  const enRevision = (c: Partial<ReservaExistente> = {}) =>
    reserva({
      booking_id: "DK1576932",
      producto_id: "p-arch33",
      fecha_inicio: "2027-02-23",
      fecha_fin: "2027-03-06",
      estado: "para_revision",
      motivos_revision: motivosSinVuelo,
      ...c,
    });
  const conVuelos = (vuelos: VueloIA[], c: Partial<Parameters<typeof armarCambios>[1]> = {}) =>
    entrante({ fechaInicio: "2027-02-23", fechaFin: "2027-03-06", vuelos, ...c });
  const opciones = { recheckVuelos: recheck, fechaMail: "2026-10-09T08:38:00Z" };

  it("sin vuelos, ARCH33 con final en Puerto Natales pide los dos", () => {
    expect(motivosSinVuelo).toEqual([
      "Falta el vuelo de llegada a El Calafate (FTE) para el traslado de OD033",
      "Falta el vuelo de salida de Puerto Natales (PNT) para el traslado al aeropuerto de Puerto Natales",
    ]);
  });
  it("(a) solo faltaba el vuelo y llegan los dos con confianza alta → recibida, con la nota", () => {
    const c = armarCambios(enRevision(), conVuelos([llegada, salida]), opciones);
    expect(c).toMatchObject({ estado: "recibida", motivos: [], completados: ["vuelos"] });
    expect(c.nota).toBe("Pasó a recibida porque llegaron los vuelos (mail del 09/10)");
  });
  it("(b) llega solo el de llegada y el producto también tiene traslado de salida → sigue en revisión", () => {
    const c = armarCambios(enRevision(), conVuelos([llegada]), opciones);
    expect(c.estado).toBe("para_revision");
    expect(c.motivos).toEqual([...motivosSinVuelo, MI.llegaronVuelos]);
  });
  it("(c) había otro motivo más (producto con baja confianza) → sigue en revisión, con la nota", () => {
    const c = armarCambios(enRevision({ motivos_revision: [...motivosSinVuelo, "No se pudo reconocer con seguridad el producto X"] }), conVuelos([llegada, salida]), opciones);
    expect(c.estado).toBe("para_revision");
    expect(c.motivos).toContain(MI.llegaronVuelos);
    expect(c.motivos).toContain("No se pudo reconocer con seguridad el producto X");
  });
  it("(d) vuelos con confianza baja → sigue en revisión", () => {
    const bajos = [llegada, salida].map((v) => ({ ...v, confianza: 0.5 }));
    expect(armarCambios(enRevision(), conVuelos(bajos), opciones).estado).toBe("para_revision");
    expect(armarCambios(enRevision(), conVuelos([llegada, salida], { vuelosDudosos: true }), opciones).estado).toBe("para_revision");
  });
  it("con un dato distinto en el mismo mail tampoco pasa sola", () => {
    expect(armarCambios(enRevision(), conVuelos([llegada, salida], { pax: 3 }), opciones).estado).toBe("para_revision");
  });
  it("sin poder volver a chequear (no hay producto) → sigue en revisión", () => {
    expect(armarCambios(enRevision(), conVuelos([llegada, salida]), { fechaMail: null }).estado).toBe("para_revision");
  });
});

describe("fila 9: cancelación de la agencia", () => {
  it("la reserva recibida pasa a revisión con el motivo; nunca a descartada ni cerrada", () => {
    const c = armarCambios(reserva(), entrante({ esCancelacion: true }), {});
    expect(c).toMatchObject({ estado: "para_revision", motivos: [MI.cancelacion] });
  });
  it("en una cancelación los vuelos que vengan no la pasan a recibida", () => {
    const c = armarCambios(reserva({ estado: "para_revision", motivos_revision: ["Falta el vuelo de llegada a X"] }), entrante({ esCancelacion: true }), {
      recheckVuelos: () => [],
    });
    expect(c.estado).toBe("para_revision");
    expect(c.motivos).toContain(MI.cancelacion);
  });
});

describe("fila 12: solo se toca el estado de las reservas recibidas o para revisión", () => {
  it("reserva en 'pedido a proveedor' + datos distintos → el evento queda y el estado sigue igual", () => {
    const c = armarCambios(reserva({ estado: "pedido_a_proveedor" }), entrante({ pax: 3, pedidosEspeciales: "nuevo" }), {});
    expect(c).toMatchObject({ estado: "pedido_a_proveedor", motivos: [] });
    expect(c.distintos).toHaveLength(1);
    expect(c.completar).toEqual({ pedidos_especiales: "nuevo" });
  });
  it("una cancelación tampoco le cambia el estado", () => {
    expect(armarCambios(reserva({ estado: "confirmada" }), entrante({ esCancelacion: true }), {}).estado).toBe("confirmada");
  });
});

describe("cargo extra de TourRadar (owner, 2026-10-14): manda la reserva a revisión", () => {
  const tr = (c: Partial<ReservaExistente> = {}) =>
    reserva({ agencia: "TourRadar", booking_id: "1377598", producto_id: "p-ar09", producto_clave_agencia: "patagonia adventure tour 16 days", ...c });
  const cargo = (importe: number | null = 102, moneda: string | null = "USD") =>
    entrante({ fechaInicio: null, fechaFin: null, pax: null, cargoExtra: { importe, moneda } });

  it("el motivo lleva el monto si el estado de cuenta lo trae", () => {
    expect(M.cargoExtra({ importe: 102, moneda: "USD" })).toBe("TourRadar mandó un cargo extra (+102 USD): puede ser un servicio nuevo. Revisar.");
    expect(M.cargoExtra({ importe: 45.5, moneda: "GBP" })).toBe("TourRadar mandó un cargo extra (+45.50 GBP): puede ser un servicio nuevo. Revisar.");
    expect(M.cargoExtra({ importe: null, moneda: null })).toBe("TourRadar mandó un cargo extra: puede ser un servicio nuevo. Revisar.");
  });

  it("un cargo que se une a una reserva recibida la pasa a revisión con ese motivo", () => {
    const c = armarCambios(tr(), cargo(), {});
    expect(c).toMatchObject({ estado: "para_revision", motivos: [M.cargoExtra({ importe: 102, moneda: "USD" })] });
  });

  it("en para revisión suma el motivo sin perder los que tenía", () => {
    const c = armarCambios(tr({ estado: "para_revision", motivos_revision: ["otro"] }), cargo(null, null), {});
    expect(c.motivos).toEqual(["otro", M.cargoExtra({ importe: null, moneda: null })]);
  });

  it("fila 12: en una reserva ya pedida al proveedor no le cambia el estado", () => {
    expect(armarCambios(tr({ estado: "pedido_a_proveedor" }), cargo(), {})).toMatchObject({ estado: "pedido_a_proveedor", motivos: [] });
  });

  it("sin cargo, el mismo mail no la manda a revisión", () => {
    expect(armarCambios(tr(), entrante({ fechaInicio: null, fechaFin: null, pax: null }), {}).estado).toBe("recibida");
  });
});

describe("cargoExtraDelMail: qué mail es un cargo extra de TourRadar", () => {
  it("el statement de cargo de TourRadar 1377598 ('Other 102.00 USD') es un cargo extra", () => {
    expect(cargoExtraDelMail({ agencia: "TourRadar", tipoMail: "cambio_o_cargo", esCancelacion: false })).toEqual({ importe: null, moneda: null });
  });
  it("no lo es: una cancelación, una reserva nueva u otra agencia", () => {
    expect(cargoExtraDelMail({ agencia: "TourRadar", tipoMail: "cambio_o_cargo", esCancelacion: true })).toBeNull();
    expect(cargoExtraDelMail({ agencia: "TourRadar", tipoMail: "reserva_nueva", esCancelacion: false })).toBeNull();
    expect(cargoExtraDelMail({ agencia: "Kilroy", tipoMail: "cambio_o_cargo", esCancelacion: false })).toBeNull();
    expect(cargoExtraDelMail({ agencia: "TourRadar", tipoMail: null, esCancelacion: false })).toBeNull();
  });
});
