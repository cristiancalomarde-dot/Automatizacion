// Spec M3-26 — verificación 1 (unitarios): los datos del vuelo completos y bien leídos.
// Fila 1: el vuelo completo en el traslado (salida y llegada), lo que falta se omite.
// Fila 2: el vuelo sin número de Kilroy ("Pax will be arriving at IGU airport at 20FEB2027 at 16:45"):
// la lectura lo guarda, el armado y el control de recepción lo toman. Fila 3: sin vuelo, como hoy.
import { describe, expect, it } from "vitest";
import { fichaGrabada, mailDePrueba } from "@/lib/reservas/__fixtures__/cargar";
import { pedidosAAvisar } from "@/lib/reservas/corregir/vuelos";
import { motivosDeVuelos } from "@/lib/reservas/emparejar/vuelos-requeridos";
import type { FichaIA, VueloIA } from "@/lib/reservas/esquema-ficha";
import { limpiarFicha, vuelosSinNumeroDelTexto } from "@/lib/reservas/limpiar-ficha";
import { sinDatoDeLlegada } from "@/lib/reservas/llegada-iguazu";
import { armarPedidos, buscarVuelo } from "./armar";
import { catalogoCon, od010b, P, producto, reserva, reservaOd010b, servicio } from "./fixtures.test-utils";
import { cargarPlantilla } from "./plantilla";
import { renglonDelVuelo } from "./renglon-vuelo";
import type { ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const COMPLETO = {
  numero: "AR 1234",
  aerolinea: null,
  origen: "AEP",
  destino: "IGR",
  fecha_salida: "2027-03-18",
  hora_salida: "08:30",
  fecha_llegada: "2027-03-18",
  hora_llegada: "10:20",
};

describe("M3-26 fila 1 — el renglón del vuelo completo", () => {
  it("con todos los datos: sale y llega, con ciudad, código, día y hora", () => {
    expect(renglonDelVuelo(COMPLETO)).toBe("Vuelo: AR 1234 – sale Buenos Aires (AEP) 18 mar 08:30 hs – llega Puerto Iguazú (IGR) 18 mar 10:20 hs");
  });

  it("con la aerolínea, va al lado del número", () => {
    expect(renglonDelVuelo({ ...COMPLETO, aerolinea: "Aerolíneas Argentinas" })).toBe(
      "Vuelo: AR 1234 (Aerolíneas Argentinas) – sale Buenos Aires (AEP) 18 mar 08:30 hs – llega Puerto Iguazú (IGR) 18 mar 10:20 hs",
    );
  });

  it("sin hora de salida: se omite, sin huecos", () => {
    expect(renglonDelVuelo({ ...COMPLETO, hora_salida: null })).toBe("Vuelo: AR 1234 – sale Buenos Aires (AEP) 18 mar – llega Puerto Iguazú (IGR) 18 mar 10:20 hs");
  });

  it("sin aeropuerto de origen: se omite, sin 'null'", () => {
    const r = renglonDelVuelo({ ...COMPLETO, origen: null });
    expect(r).toBe("Vuelo: AR 1234 – sale 18 mar 08:30 hs – llega Puerto Iguazú (IGR) 18 mar 10:20 hs");
    expect(r).not.toMatch(/null|undefined|\(\)/);
  });

  it("sin nada de la salida: solo la llegada; un aeropuerto que no es de un traslado va con su código", () => {
    expect(renglonDelVuelo({ ...COMPLETO, origen: null, fecha_salida: null, hora_salida: null })).toBe("Vuelo: AR 1234 – llega Puerto Iguazú (IGR) 18 mar 10:20 hs");
    expect(renglonDelVuelo({ ...COMPLETO, origen: "MAD" })).toMatch(/^Vuelo: AR 1234 – sale MAD 18 mar 08:30 hs – llega/);
  });

  it("como NO1595016: LA383 con origen CJC y sin destino", () => {
    expect(renglonDelVuelo({ numero: "LA383", origen: "CJC", fecha_salida: "2027-01-12", hora_salida: "10:05" })).toBe("Vuelo: LA383 – sale Calama (CJC) 12 ene 10:05 hs");
  });

  it("sin número: 'Llegada:' o 'Salida:' con '(sin número de vuelo)'", () => {
    expect(renglonDelVuelo({ numero: null, destino: "IGU", fecha_llegada: "2027-02-20", hora_llegada: "16:45" })).toBe(
      "Llegada: Foz do Iguaçu (IGU) 20 feb 16:45 hs (sin número de vuelo)",
    );
    expect(renglonDelVuelo({ numero: null, origen: "IGR", fecha_salida: "2027-02-23", hora_salida: "13:30" })).toBe(
      "Salida: Puerto Iguazú (IGR) 23 feb 13:30 hs (sin número de vuelo)",
    );
  });

  it("en el pedido y en la tarea del traslado va el vuelo completo", () => {
    const trf = producto("prod-trf", "OD016", [
      servicio({ productoId: "prod-trf", tipo: "traslado", sentido: "llegada", descripcion: "Transfer FTE Airport - El Calafate Accommodation", bookingSupplier: P.chalten }),
    ], { destino: "FTE" });
    const vuelo = { numero: "AR1850", origen: "AEP", destino: "FTE", fecha_salida: "2027-01-24", hora_salida: "17:10", fecha_llegada: "2027-01-24", hora_llegada: "20:05" };
    const r = ok(armarPedidos(reserva({ productoId: trf.id, fechaInicio: "2027-01-24", fechaFin: "2027-01-28", vuelos: [vuelo] }), catalogoCon([trf]), plantilla));
    expect(r.pedidos[0].cuerpo).toContain(
      "Traslado de llegada: Transfer FTE Airport - El Calafate Accommodation\nFecha: 24 ene 2027\nVuelo: AR1850 – sale Buenos Aires (AEP) 24 ene 17:10 hs – llega El Calafate (FTE) 24 ene 20:05 hs",
    );

    const manual = producto("prod-man", "OD030", [
      servicio({ productoId: "prod-man", tipo: "traslado", sentido: "llegada", reservaManual: true, descripcion: "Transfer in CJC - Accommodation in San Pedro de Atacama", bookingSupplierNombre: "Transvip" }),
    ], { destino: "SPA" });
    const llegaCjc = { numero: "LA148", origen: "SCL", destino: "CJC", fecha_salida: "2027-01-18", hora_salida: "14:00", fecha_llegada: "2027-01-18", hora_llegada: "16:11" };
    const t = ok(armarPedidos(reserva({ productoId: manual.id, fechaInicio: "2027-01-18", fechaFin: "2027-01-21", vuelos: [llegaCjc] }), catalogoCon([manual]), plantilla));
    const tarea = t.tareas.find((x) => x.tipo === "reservar_a_mano");
    expect(tarea?.texto).toMatch(/18 ene 2027 · Vuelo: LA148 – sale Santiago de Chile \(SCL\) 18 ene 14:00 hs – llega Calama \(CJC\) 18 ene 16:11 hs$/);
  });
});

// --- Fila 2: el vuelo sin número de Kilroy (DK1597924) ----------------------------------------------

const mailDk = mailDePrueba("kilroy-dk1597924");
const textoDk = `${mailDk.asunto ?? ""}\n${mailDk.cuerpoTexto ?? ""}`;
const fichaSinVuelos = { ...(fichaGrabada("kilroy-od010d") as unknown as FichaIA), vuelos: [] };
const contextoDk = { agencia: "Kilroy", textoVerificable: textoDk, seMandoPdf: false, adjuntosNoLeidos: [] };

const LLEGADA_IGU: VueloIA = {
  numero: null,
  aerolinea: null,
  origen: null,
  destino: "IGU",
  fecha_salida: null,
  hora_salida: null,
  fecha_llegada: "2027-02-20",
  hora_llegada: "16:45",
  confianza: 1,
};
const SALIDA_IGR: VueloIA = {
  numero: null,
  aerolinea: null,
  origen: "IGR",
  destino: null,
  fecha_salida: "2027-02-23",
  hora_salida: "13:30",
  fecha_llegada: null,
  hora_llegada: null,
  confianza: 1,
};

describe("M3-26 fila 2 — la lectura: los renglones de Kilroy sin número", () => {
  it("DK1597924: la IA no trajo vuelos → se guardan los 2 sin número", () => {
    const f = limpiarFicha(fichaSinVuelos, contextoDk);
    expect(f.vuelos).toEqual([LLEGADA_IGU, SALIDA_IGR]);
    expect(f.datos_dudosos).not.toContain("vuelos");
  });

  it("el reconocimiento es fijo: lee las dos formas y la hora con punto", () => {
    expect(vuelosSinNumeroDelTexto("Pax will be arriving at IGU airport at 20FEB2027 at 16:45")).toEqual([LLEGADA_IGU]);
    expect(vuelosSinNumeroDelTexto("pax will be departing from IGR airport at 23FEB2027 at 13.30")).toEqual([SALIDA_IGR]);
    expect(vuelosSinNumeroDelTexto("Pax will be arriving at the airport soon")).toEqual([]);
  });

  it("si la IA ya trajo ese vuelo, no se repite", () => {
    const f = limpiarFicha({ ...fichaSinVuelos, vuelos: [{ ...LLEGADA_IGU, confianza: 0.9 }] }, contextoDk);
    expect(f.vuelos).toHaveLength(2);
    expect(f.vuelos.filter((v) => v.destino === "IGU")).toHaveLength(1);
    expect(f.vuelos[1]).toEqual(SALIDA_IGR);
  });

  it("si la IA trajo la llegada con número, no se suma la sin número", () => {
    const conNumero: VueloIA = { ...LLEGADA_IGU, numero: "G3 1234", confianza: 0.9 };
    const texto = `${textoDk}\nFlight G3 1234`;
    const f = limpiarFicha({ ...fichaSinVuelos, vuelos: [conNumero] }, { ...contextoDk, textoVerificable: texto });
    expect(f.vuelos.map((v) => v.numero)).toEqual(["G3 1234", null]);
  });

  it("un mail sin esos renglones no suma nada", () => {
    const mail = mailDePrueba("kilroy-od010d");
    const f = limpiarFicha(fichaSinVuelos, { ...contextoDk, textoVerificable: `${mail.asunto}\n${mail.cuerpoTexto}` });
    expect(f.vuelos).toEqual([]);
  });
});

describe("M3-26 fila 2 — el armado y el control toman el vuelo sin número", () => {
  const vuelos = limpiarFicha(fichaSinVuelos, contextoDk).vuelos;
  const dk = { ...reservaOd010b, numero: "DK1597924/abcd", fechaInicio: "2027-02-20", fechaFin: "2027-02-23", vuelos };

  it("TRF IN y TRF OUT con la llegada y la salida, sin pendiente", () => {
    const p = ok(armarPedidos(dk, catalogoCon([od010b]), plantilla)).pedidos[0];
    const trf = p.cuerpo.split("\n").filter((l) => /^TRF (IN|OUT)/.test(l));
    expect(trf[0]).toMatch(/^TRF IN: 20 feb 2027 · Llegada: Foz do Iguaçu \(IGU\) 20 feb 16:45 hs \(sin número de vuelo\)( · |$)/);
    expect(trf[1]).toMatch(/^TRF OUT: 23 feb 2027 · Salida: Puerto Iguazú \(IGR\) 23 feb 13:30 hs \(sin número de vuelo\)( · |$)/);
    expect(p.cuerpo).not.toMatch(/vuelo pendiente|todavía no (lo tenemos|sabemos)/i);
  });

  it("buscarVuelo: sin número sirve solo con aeropuerto y hora del lado del traslado", () => {
    expect(buscarVuelo(vuelos, "in", ["IGR", "IGU"], "2027-02-20")).toEqual(LLEGADA_IGU);
    expect(buscarVuelo(vuelos, "out", ["IGR", "IGU"], "2027-02-23")).toEqual(SALIDA_IGR);
    expect(buscarVuelo([{ ...LLEGADA_IGU, hora_llegada: null }], "in", ["IGU"], "2027-02-20")).toBeNull();
    expect(buscarVuelo([{ ...LLEGADA_IGU, destino: null }], "in", ["IGU"], "2027-02-20")).toBeNull();
  });

  it("control de recepción: Iguazú ya tiene dato de llegada", () => {
    expect(sinDatoDeLlegada({ productoCodigo: "OD010B", vuelos, pedidos: null })).toBe(false);
    expect(sinDatoDeLlegada({ productoCodigo: "OD010B", vuelos: [], pedidos: null })).toBe(true);
    expect(sinDatoDeLlegada({ productoCodigo: "OD010B", vuelos: [{ ...LLEGADA_IGU, hora_llegada: null }], pedidos: null })).toBe(true);
  });

  it("control de recepción: un traslado IGU/IGR no pide 'falta vuelo' con los sin número", () => {
    const trf = producto("prod-trf-igu", "TRFIGU", [
      servicio({ productoId: "prod-trf-igu", tipo: "traslado", sentido: "ida_y_vuelta", orden: 1, descripcion: "Transfer IGU Airport - Hotel - IGR Airport" }),
    ], { destino: "IGR" });
    const datos = { pedidos: [], producto: { nombre: "x", opcionales: [], fecha_inicio: "2027-02-20", fecha_fin: "2027-02-23" }, finalPuertoNatales: false };
    expect(motivosDeVuelos(trf, { ...datos, vuelos })).toEqual([]);
    expect(motivosDeVuelos(trf, { ...datos, vuelos: [] })).toHaveLength(2);
    expect(motivosDeVuelos(trf, { ...datos, vuelos: [{ ...LLEGADA_IGU, destino: null }, SALIDA_IGR] })).toHaveLength(1);
  });
});

describe("M3-26 fila 3 — sin vuelo sigue igual", () => {
  it("Iguazú: 'Bus o vuelo pendiente'; otro destino: 'Vuelo pendiente'", () => {
    const p = ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("TRF IN: 3 oct 2026 · Bus o vuelo pendiente");
    const trf = producto("prod-trf", "OD016", [
      servicio({ productoId: "prod-trf", tipo: "traslado", sentido: "llegada", descripcion: "Transfer FTE Airport - El Calafate Accommodation", bookingSupplier: P.chalten }),
    ], { destino: "FTE" });
    const r = ok(armarPedidos(reserva({ productoId: trf.id, fechaInicio: "2027-01-24", fechaFin: "2027-01-28" }), catalogoCon([trf]), plantilla));
    expect(r.pedidos[0].cuerpo).toContain("Fecha: 24 ene 2027\nVuelo pendiente");
  });
});

describe("M3-26 — un pedido ya enviado con el renglón nuevo (M3-07 fila 6 sigue andando)", () => {
  const vuelo: VueloIA = { ...COMPLETO, destino: "FTE", confianza: 1 };
  const cuerpo = `Traslado de llegada: Transfer FTE\nFecha: 18 mar 2027\n${renglonDelVuelo(vuelo)}`;
  const pedidos = [{ id: "p1", estado: "enviado", proveedores: ["Chalten Travel"], cuerpo }];

  it("si el vuelo del renglón cambió → avisar", () => {
    expect(pedidosAAvisar(pedidos, [vuelo], [{ ...vuelo, hora_llegada: "11:00" }])).toEqual([{ pedidoId: "p1", proveedores: ["Chalten Travel"] }]);
  });

  it("si el vuelo del renglón sigue igual (se sumó otro) → no avisar", () => {
    expect(pedidosAAvisar(pedidos, [vuelo], [vuelo, { ...vuelo, numero: "AR 9999" }])).toEqual([]);
  });
});
