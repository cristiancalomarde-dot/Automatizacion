/**
 * M3-20 (owner, 2026-10-23, DK1594177 y DK1592913): entre el aeropuerto de El Calafate y El Chaltén
 * no hay traslado, hay un bus regular de Chalten Travel. El round trip de AR34 sale en dos renglones
 * (ida = llegada a El Chaltén, vuelta = salida de El Chaltén); el "Transfer El Calafate Airport to
 * El Chalten" de OD033 sale como bus regular con el vuelo; la vuelta El Chaltén → El Calafate dice
 * "Horario: 8:00 am"; un vuelo que llega a FTE después de las 17 hs deja un aviso interno en el
 * borrador (no en el texto). Las reglas son las del archivo real `data/buses-el-chalten.csv`.
 * M3-26 (owner, 2026-10-28): el renglón del vuelo va completo (sale y llega).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { ARCHIVO_BUSES_EL_CHALTEN, leerBusesElChalten } from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoCon, componente, parte, producto, reserva, servicio } from "./fixtures.test-utils";
import type { ResultadoArmado, VueloDeReserva } from "./tipos";

const plantilla = cargarPlantilla();
const buses = leerBusesElChalten(readFileSync(ARCHIVO_BUSES_EL_CHALTEN, "utf8"));
const AVISO =
  "El vuelo llega después de las 17 hs: puede no haber bus a El Chaltén. Revisalo con el vendedor de la agencia (traslado privado, más caro; o shuttle de Las Lengas).";
const IDA = "Bus regular El Calafate Airport → El Chaltén (terminal)";
const VUELTA = "Bus regular El Chaltén → El Calafate (ciudad)";

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const vuelo = (fecha: string, hora: string): VueloDeReserva => ({
  numero: "AR1840",
  origen: "AEP",
  destino: "FTE",
  fecha_salida: fecha,
  hora_salida: "05:30",
  fecha_llegada: fecha,
  hora_llegada: hora,
});

/** Un servicio del pedido (sin la numeración "1) "), desde su primer renglón hasta la línea en blanco. */
function bloque(cuerpo: string, primerRenglon: string): string[] {
  const l = cuerpo.split("\n").map((x) => x.replace(/^\d+\) /, ""));
  const i = l.indexOf(primerRenglon);
  if (i < 0) throw new Error(`No está "${primerRenglon}" en:\n${cuerpo}`);
  const fin = l.indexOf("", i);
  return l.slice(i, fin < 0 ? undefined : fin);
}

// --- AR34 (como DK1594177: del 5 al 10 mar 2027) -------------------------------------------------

const ar34 = producto(
  "prod-ar34",
  "AR34",
  [
    servicio({ productoId: "prod-ar34", tipo: "traslado", orden: 9, sentido: "salida", descripcion: "Transfer El Calafate - FTE Airport. Booking Supplier: Chalten Travel", serviceProviderNombre: "El Calafate - FTE Airport", bookingSupplier: P.chalten }),
    servicio({ productoId: "prod-ar34", tipo: "excursion", orden: 10, descripcion: "Excursion: Perito Moreno Glaciar Excursion. Booking Supplier: Chalten Travel", serviceProviderNombre: "Perito Moreno Glaciar Excursion", bookingSupplier: P.chalten }),
    servicio({ productoId: "prod-ar34", tipo: "otro", orden: 11, descripcion: "Regular Bus Round Trip FTE Airport - CHA - FTE city. Booking Supplier: Chalten Travel", serviceProviderNombre: "Regular Bus Round Trip FTE Airport - CHA - FTE city", bookingSupplier: P.chalten }),
  ],
  { destino: "FTE" },
);

function pedidoAr34(vuelos: VueloDeReserva[]) {
  const catalogo = { ...catalogoCon([ar34]), busesElChalten: buses };
  const r = ok(armarPedidos(reserva({ productoId: ar34.id, fechaInicio: "2027-03-05", fechaFin: "2027-03-10", vuelos }), catalogo, plantilla));
  return r.pedidos.find((p) => p.destinatarios.includes("agencias@chaltentravel.test"))!;
}

describe("AR34: el round trip sale en dos renglones (filas 1 y 3)", () => {
  it("ida el 5 mar con el vuelo y horario según el vuelo; vuelta el día que sale de El Chaltén (8 mar) a las 8:00 am", () => {
    const p = pedidoAr34([vuelo("2027-03-05", "08:40")]);
    expect(bloque(p.cuerpo, IDA)).toEqual([IDA, "Fecha: 5 mar 2027 · Horario: según la llegada del vuelo", "Vuelo: AR1840 – sale Buenos Aires (AEP) 5 mar 05:30 hs – llega El Calafate (FTE) 5 mar 08:40 hs"]);
    expect(bloque(p.cuerpo, VUELTA)).toEqual([VUELTA, "Fecha: 8 mar 2027 · Horario: 8:00 am"]);
    expect(p.cuerpo).not.toContain("Round Trip FTE Airport");
    expect(p.cuerpo).not.toContain("Desde: 5 mar 2027 · Hasta: 10 mar 2027");
  });

  it("sin vuelo: el pendiente del vuelo como hoy", () => {
    const p = pedidoAr34([]);
    expect(bloque(p.cuerpo, IDA)).toEqual([IDA, "Fecha: 5 mar 2027 · Horario: según la llegada del vuelo", "Vuelo pendiente"]);
    expect(p.cuerpo).toContain("El vuelo todavía no lo tenemos: se lo pasamos apenas nos llegue.");
  });

  it("lo demás del pedido no cambia: el Perito Moreno y el traslado de salida al aeropuerto", () => {
    const p = pedidoAr34([vuelo("2027-03-05", "08:40")]);
    expect(p.cuerpo).toContain("Excursión: Perito Moreno Glaciar Excursion");
    expect(bloque(p.cuerpo, "Traslado de salida: Transfer El Calafate - FTE Airport")).toEqual(["Traslado de salida: Transfer El Calafate - FTE Airport", "Fecha: 10 mar 2027", "Vuelo pendiente"]);
  });
});

// --- OD033 dentro de ARCH31 (como DK1592913: El Chaltén del 10 al 13 mar 2027) ---------------------

const od033 = producto(
  "prod-od033",
  "OD033",
  [
    servicio({ productoId: "prod-od033", tipo: "traslado", orden: 4, sentido: "llegada", descripcion: "Transfer El Calafate Airport to El Chalten. Booking Supplier: Chalten Travel / Transporte Las Lengas", serviceProviderNombre: "El Calafate Airport to El Chalten", bookingSupplier: P.chalten }),
    servicio({ productoId: "prod-od033", tipo: "bus", orden: 5, descripcion: "Public Bus El Chalten Bus Station - El Calafate Bus Station. Booking Supplier: Chalten Travel", serviceProviderNombre: "El Chalten Bus Station - El Calafate Bus Station", bookingSupplier: P.chalten }),
  ],
  { destino: "CHA" },
);
const arch31 = producto("prod-arch31", "ARCH31", [], { esTour: true, componentes: [componente("c-033", 1, 1, 3, od033)] });

function armarOd033(vuelos: VueloDeReserva[], enTour = true, conReglas = true) {
  const base = enTour ? catalogoCon([arch31, od033]) : catalogoCon([od033]);
  const catalogo = conReglas ? { ...base, busesElChalten: buses } : base;
  const r = enTour
    ? reserva({
        productoId: arch31.id,
        fechaInicio: "2027-03-10",
        fechaFin: "2027-03-20",
        vuelos,
        partes: [parte({ id: "o", orden: 1, tipo: "paquete", productoId: od033.id, productoComponenteId: "c-033", fechaInicio: "2027-03-10", fechaFin: "2027-03-13" })],
      })
    : reserva({ productoId: od033.id, fechaInicio: "2027-03-10", fechaFin: "2027-03-13", vuelos });
  return ok(armarPedidos(r, catalogo, plantilla));
}
const pedidoOd033 = (vuelos: VueloDeReserva[], enTour = true) => armarOd033(vuelos, enTour).pedidos.find((p) => p.destinatarios.includes("agencias@chaltentravel.test"))!;

describe("OD033: la llegada desde el aeropuerto FTE es bus regular y la vuelta 8:00 am (filas 2 y 3)", () => {
  it.each([
    ["dentro de ARCH31", true],
    ["suelto", false],
  ])("%s: bus regular con el vuelo de DK1592913 (10 mar, AR1840 08:40); el public bus del 13 mar a las 8:00 am", (_, enTour) => {
    const p = pedidoOd033([vuelo("2027-03-10", "08:40")], enTour);
    expect(bloque(p.cuerpo, IDA)).toEqual([IDA, "Fecha: 10 mar 2027 · Horario: según la llegada del vuelo", "Vuelo: AR1840 – sale Buenos Aires (AEP) 10 mar 05:30 hs – llega El Calafate (FTE) 10 mar 08:40 hs"]);
    expect(p.cuerpo).not.toContain("Traslado de llegada");
    expect(bloque(p.cuerpo, "Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station")).toEqual([
      "Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station",
      "Fecha: 13 mar 2027 · Horario: 8:00 am",
    ]);
  });
});

describe("aviso interno si el vuelo llega a FTE después de las 17 hs (fila 4)", () => {
  it("llegada 18:30 → aviso en el borrador, no en el texto al proveedor", () => {
    const p = pedidoOd033([vuelo("2027-03-10", "18:30")]);
    expect(p.avisos).toContain(AVISO);
    expect(p.cuerpo).not.toContain("17 hs");
    expect(bloque(p.cuerpo, IDA)).toContain("Vuelo: AR1840 – sale Buenos Aires (AEP) 10 mar 05:30 hs – llega El Calafate (FTE) 10 mar 18:30 hs");
  });

  it("también en AR34", () => {
    expect(pedidoAr34([vuelo("2027-03-05", "18:30")]).avisos).toContain(AVISO);
  });

  it.each([
    ["llegada 08:40", [vuelo("2027-03-10", "08:40")]],
    ["llegada 17:00 justo", [vuelo("2027-03-10", "17:00")]],
    ["sin vuelo", []],
  ])("%s → sin este aviso", (_, vuelos) => {
    const r = armarOd033(vuelos);
    expect(r.pedidos.flatMap((p) => p.avisos)).not.toContain(AVISO);
    expect(r.avisos).not.toContain(AVISO);
  });
});

describe("lo demás no cambia (fila 6)", () => {
  it("un traslado de aeropuerto sin regla sigue como traslado de llegada", () => {
    const od016 = producto("prod-od016", "OD016", [
      servicio({ productoId: "prod-od016", tipo: "traslado", orden: 5, sentido: "llegada", descripcion: "Transfer FTE Airport - El Calafate Accommodation. Booking Supplier: Chalten Travel", serviceProviderNombre: "FTE Airport - El Calafate Accommodation", bookingSupplier: P.chalten }),
    ], { destino: "FTE" });
    const r = ok(armarPedidos(reserva({ productoId: od016.id, fechaInicio: "2027-03-13", fechaFin: "2027-03-15", vuelos: [vuelo("2027-03-13", "18:30")] }), { ...catalogoCon([od016]), busesElChalten: buses }, plantilla));
    expect(r.pedidos[0].cuerpo).toContain("Traslado de llegada: Transfer FTE Airport - El Calafate Accommodation\nFecha: 13 mar 2027\nVuelo: AR1840 – sale Buenos Aires (AEP) 13 mar 05:30 hs – llega El Calafate (FTE) 13 mar 18:30 hs");
    expect(r.pedidos[0].avisos).not.toContain(AVISO);
  });

  it("sin las reglas, OD033 sale como antes", () => {
    const p = armarOd033([vuelo("2027-03-10", "08:40")], true, false).pedidos[0];
    expect(p.cuerpo).toContain("Traslado de llegada: Transfer El Calafate Airport to El Chalten\nFecha: 10 mar 2027\nVuelo: AR1840 – sale Buenos Aires (AEP) 10 mar 05:30 hs – llega El Calafate (FTE) 10 mar 08:40 hs");
    expect(p.cuerpo).toContain("Bus: Public Bus El Chalten Bus Station - El Calafate Bus Station\nFecha: 13 mar 2027");
    expect(p.cuerpo).not.toContain("Horario");
  });
});

describe("data/buses-el-chalten.csv (fila 5)", () => {
  it("tiene la ida y la vuelta de AR34 y de OD033, con la hora límite 17:00 en la ida", () => {
    expect(buses.map((b) => [b.codigo, b.orden, b.tramo, b.dia, b.horario, b.vueloDespuesDe])).toEqual([
      ["AR34", 11, "ida", 1, "según la llegada del vuelo", "17:00"],
      ["AR34", 11, "vuelta", 4, "8:00 am", null],
      ["OD033", 4, "ida", null, "según la llegada del vuelo", "17:00"],
      ["OD033", 5, "vuelta", null, "8:00 am", null],
    ]);
  });

  it("una fila sin código, orden, tramo u horario frena con un mensaje claro", () => {
    expect(() => leerBusesElChalten("codigo,orden,tramo,dia,aeropuerto,renglon,horario,vuelo_despues_de,aviso,nota\nAR34,,ida,1,FTE,x,y,,,")).toThrow(/fila 2/);
    expect(() => leerBusesElChalten("codigo,orden\nAR34,11")).toThrow(/primera fila/);
  });
});
