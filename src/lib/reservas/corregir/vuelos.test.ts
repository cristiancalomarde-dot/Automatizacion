import { describe, expect, it } from "vitest";
import { TEXTOS } from "@/lib/textos";
import type { VueloIA } from "../esquema-ficha";
import type { VueloDeReserva } from "../tipos";
import {
  aFormulario,
  ladoDelVuelo,
  lineasDeVuelosDelMail,
  pedidosAAvisar,
  validarVuelos,
  vuelosEnHistorial,
  type VueloCorregido,
} from "./vuelos";

/**
 * Spec M3-07 filas 1, 2 y 6 (la parte pura): cada vuelo como llegada o
 * salida, la validación en llano, lo que dice el mail sobre vuelos y qué
 * pedidos ya enviados hay que avisar.
 */

const E = TEXTOS.reserva.corregir.errores;
const FECHAS = { fechaInicio: "2027-03-14", fechaFin: "2027-03-18" };

const vuelo = (extra: Partial<VueloDeReserva>): VueloDeReserva => ({
  numero: null,
  aerolinea: null,
  origen: null,
  destino: null,
  fechaSalida: null,
  horaSalida: null,
  fechaLlegada: null,
  horaLlegada: null,
  ...extra,
});

const fila = (extra: Partial<VueloCorregido> = {}): VueloCorregido => ({
  lado: "salida",
  numero: "H2253",
  aeropuerto: "CJC",
  fecha: "2027-03-18",
  hora: "08:44",
  ...extra,
});

describe("M3-07 fila 1 — cada vuelo como llegada o salida", () => {
  it("con solo el lado de llegada es llegada; con solo el de salida, salida", () => {
    expect(ladoDelVuelo(vuelo({ numero: "H2253", destino: "CJC", fechaLlegada: "2027-03-18", horaLlegada: "08:44" }), FECHAS)).toBe("llegada");
    expect(ladoDelVuelo(vuelo({ numero: "H2253", origen: "CJC", fechaSalida: "2027-03-18", horaSalida: "08:44" }), FECHAS)).toBe("salida");
  });

  it("con los dos lados: llega el día de inicio → llegada; sale el día de fin → salida", () => {
    const llega = vuelo({ numero: "LA148", origen: "SCL", destino: "CJC", fechaSalida: "2027-03-14", horaSalida: "14:00", fechaLlegada: "2027-03-14", horaLlegada: "16:11" });
    expect(ladoDelVuelo(llega, FECHAS)).toBe("llegada");
    const sale = vuelo({ numero: "LA149", origen: "CJC", destino: "SCL", fechaSalida: "2027-03-18", horaSalida: "17:00", fechaLlegada: "2027-03-18", horaLlegada: "19:00" });
    expect(ladoDelVuelo(sale, FECHAS)).toBe("salida");
  });

  it("al formulario: el aeropuerto, la fecha y la hora del lado; el otro extremo se conserva", () => {
    const v = vuelo({ numero: "LA148", aerolinea: "LATAM", origen: "SCL", destino: "CJC", fechaSalida: "2027-03-14", horaSalida: "14:00", fechaLlegada: "2027-03-14", horaLlegada: "16:11" });
    expect(aFormulario(v, FECHAS)).toEqual({
      lado: "llegada",
      ladoOriginal: "llegada",
      numero: "LA148",
      aeropuerto: "CJC",
      fecha: "2027-03-14",
      hora: "16:11",
      aerolinea: "LATAM",
      otroExtremo: { aeropuerto: "SCL", fecha: "2027-03-14", hora: "14:00" },
    });
  });
});

describe("M3-07 fila 2 — validación en llano", () => {
  it("un vuelo bien escrito se guarda con confianza 1, en mayúsculas y con la hora con dos dígitos", () => {
    const r = validarVuelos([fila({ numero: " h2253 ", aeropuerto: "cjc", hora: "8:44" })]);
    expect(r).toEqual({
      ok: true,
      vuelos: [
        {
          numero: "H2253",
          aerolinea: null,
          origen: "CJC",
          destino: null,
          fecha_salida: "2027-03-18",
          hora_salida: "08:44",
          fecha_llegada: null,
          hora_llegada: null,
          confianza: 1,
        },
      ],
    });
  });

  it.each([
    ["sin número", { numero: "  " }, "numero", E.faltaNumero],
    ["número raro", { numero: "vuelo de la tarde" }, "numero", E.numero],
    ["aeropuerto de 4 letras", { aeropuerto: "CJCC" }, "aeropuerto", E.aeropuerto],
    ["aeropuerto vacío", { aeropuerto: "" }, "aeropuerto", E.aeropuerto],
    ["sin fecha", { fecha: "" }, "fecha", E.faltaFecha],
    ["fecha que no existe", { fecha: "2027-02-30" }, "fecha", E.fecha],
    ["fecha con otro formato", { fecha: "18MAR27" }, "fecha", E.fecha],
    ["sin hora", { hora: "" }, "hora", E.faltaHora],
    ["hora con punto", { hora: "08.44" }, "hora", E.hora],
    ["hora imposible", { hora: "25:10" }, "hora", E.hora],
  ] as const)("%s → %s", (_caso, cambio, campo, mensaje) => {
    const r = validarVuelos([fila(), fila(cambio)]);
    expect(r).toEqual({ ok: false, errores: [{ fila: 1, campo, mensaje }] });
  });

  it("cambiar una llegada a salida no arrastra el otro extremo; dejarla igual, sí", () => {
    const otroExtremo = { aeropuerto: "SCL", fecha: "2027-03-18", hora: "06:00" };
    const cambiada = validarVuelos([fila({ lado: "salida", ladoOriginal: "llegada", otroExtremo })]);
    expect(cambiada.ok && cambiada.vuelos[0]).toMatchObject({ origen: "CJC", destino: null, fecha_llegada: null, hora_llegada: null });
    const igual = validarVuelos([fila({ lado: "llegada", ladoOriginal: "llegada", otroExtremo })]);
    expect(igual.ok && igual.vuelos[0]).toMatchObject({ origen: "SCL", destino: "CJC", hora_salida: "06:00", hora_llegada: "08:44" });
  });

  it("el otro extremo que no se puede usar se descarta en silencio (no lo escribió la persona)", () => {
    const r = validarVuelos([fila({ lado: "llegada", ladoOriginal: "llegada", otroExtremo: { aeropuerto: "Santiago", fecha: "mañana", hora: "x" } })]);
    expect(r.ok && r.vuelos[0]).toMatchObject({ origen: null, fecha_salida: null, hora_salida: null });
  });

  it("sin vuelos también se puede guardar (llegan por tierra)", () => {
    expect(validarVuelos([])).toEqual({ ok: true, vuelos: [] });
  });
});

describe("M3-07 fila 1 — lo que dice el mail sobre vuelos", () => {
  it("las líneas del mail que hablan de vuelos, sin repetir", () => {
    const cuerpo = [
      "Dear HI Travel,",
      "Please book BOCHI04R for 2 pax.",
      "Arrival flight: LA2120 ETA 14MAR27 10.05 to LPB",
      "Departure flight: H2253 ETA 18MAR27 08.44 from CJC",
      "Best regards",
    ].join("\n");
    expect(lineasDeVuelosDelMail([cuerpo, "Departure flight: H2253 ETA 18MAR27 08.44 from CJC"])).toEqual([
      "Arrival flight: LA2120 ETA 14MAR27 10.05 to LPB",
      "Departure flight: H2253 ETA 18MAR27 08.44 from CJC",
    ]);
  });

  it("un mail sin vuelos no da nada", () => {
    expect(lineasDeVuelosDelMail(["Please book OD031 for 2 pax.\nThanks"])).toEqual([]);
  });
});

describe("M3-07 fila 7 — los vuelos en el historial (sin datos de pasajeros)", () => {
  it("lado, número, aeropuerto, fecha y hora", () => {
    const r = validarVuelos([fila(), fila({ lado: "llegada", numero: "LA2120", aeropuerto: "LPB", fecha: "2027-03-14", hora: "10:05" })]);
    if (!r.ok) throw new Error("se esperaba ok");
    expect(vuelosEnHistorial(r.vuelos)).toEqual([
      { lado: "salida", numero: "H2253", aeropuerto: "CJC", fecha: "2027-03-18", hora: "08:44" },
      { lado: "llegada", numero: "LA2120", aeropuerto: "LPB", fecha: "2027-03-14", hora: "10:05" },
    ]);
  });
});

describe("M3-07 fila 6 — qué pedidos enviados hay que avisar", () => {
  const cuerpoTraslado = (dato: string) => `Traslado de salida: Transfer Hotel - Aeropuerto Calama\nFecha: 18/03\n${dato}`;
  const antes: VueloIA[] = [{ numero: "H2253", aerolinea: null, origen: null, destino: "CJC", fecha_salida: null, hora_salida: null, fecha_llegada: "2027-03-18", hora_llegada: "08:44", confianza: 0.6 }];
  const despues: VueloIA[] = [{ numero: "H2253", aerolinea: null, origen: "CJC", destino: null, fecha_salida: "2027-03-18", hora_salida: "08:44", fecha_llegada: null, hora_llegada: null, confianza: 1 }];

  it("un pedido enviado con 'Vuelo pendiente' y vuelos nuevos → avisar", () => {
    const pedidos = [{ id: "p1", estado: "enviado", proveedores: ["Ayllu"], cuerpo: cuerpoTraslado("Vuelo pendiente") }];
    expect(pedidosAAvisar(pedidos, antes, despues)).toEqual([{ pedidoId: "p1", proveedores: ["Ayllu"] }]);
  });

  it("un pedido enviado con un vuelo que ya no está igual → avisar", () => {
    const pedidos = [{ id: "p1", estado: "enviado", proveedores: ["Ayllu"], cuerpo: cuerpoTraslado("Vuelo: H2253 (CJC) salida 08:44 hs") }];
    const otroHorario = [{ ...despues[0], hora_salida: "09:30" }];
    expect(pedidosAAvisar(pedidos, despues, otroHorario)).toEqual([{ pedidoId: "p1", proveedores: ["Ayllu"] }]);
  });

  it("si el vuelo del pedido sigue igual, no hay aviso", () => {
    const pedidos = [{ id: "p1", estado: "enviado", proveedores: ["Ayllu"], cuerpo: cuerpoTraslado("Vuelo: H2253 (CJC) salida 08:44 hs") }];
    const conOtroMas = [...despues, { ...despues[0], numero: "LA2120", origen: null, destino: "LPB", fecha_salida: null, hora_salida: null, fecha_llegada: "2027-03-14", hora_llegada: "10:05" }];
    expect(pedidosAAvisar(pedidos, despues, conOtroMas)).toEqual([]);
  });

  it("los borradores no se avisan (se rearman al entrar) y un pedido sin traslado tampoco", () => {
    const pedidos = [
      { id: "p1", estado: "borrador", proveedores: ["Ayllu"], cuerpo: cuerpoTraslado("Vuelo pendiente") },
      { id: "p2", estado: "enviado", proveedores: ["Hostal"], cuerpo: "Alojamiento: Hostal\nDesde: 14/03 · Hasta: 18/03" },
    ];
    expect(pedidosAAvisar(pedidos, antes, despues)).toEqual([]);
  });

  it("sin cambio en los vuelos, nada que avisar", () => {
    const pedidos = [{ id: "p1", estado: "enviado", proveedores: ["Ayllu"], cuerpo: cuerpoTraslado("Vuelo pendiente") }];
    expect(pedidosAAvisar(pedidos, despues, despues.map((v) => ({ ...v })))).toEqual([]);
  });
});
