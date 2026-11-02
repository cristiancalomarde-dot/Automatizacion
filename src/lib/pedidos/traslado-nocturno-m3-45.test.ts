/**
 * M3-45 — el aviso de traslado nocturno (owner 2026-11-01, DK1592913): Cuenca del Plata hace los traslados de
 * 21:00 a 07:00 solo en privado. Si un traslado de llegada de un proveedor de `data/traslados-nocturnos.csv`
 * tiene un vuelo que llega en ese rango (o uno de salida, que sale en ese rango), avisa en "Revisar antes de
 * pedir" (detalle y pedidos). Rango inclusivo, cruza la medianoche; la hora, la del mail.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { armarPedidos, itinerarioDeLaReserva } from "./armar";
import { cargarReglasItinerario } from "./cargar";
import { ARCHIVO_TRASLADOS_NOCTURNOS, avisosDeTrasladoNocturno, leerTrasladosNocturnos, SIN_REGLAS, type ReglasItinerario } from "./itinerario";
import { cargarPlantilla } from "./plantilla";
import { catalogoCon, od010b, producto, proveedor, reserva, reservaOd010b, servicio } from "./fixtures.test-utils";
import type { CatalogoParaPedidos, ResultadoArmado, VueloDeReserva } from "./tipos";

const plantilla = cargarPlantilla();
const reglas = cargarReglasItinerario();
const IGRT01 = "Transfers IGU - Puerto Iguazu Hotels (regular 7 AM - 9 PM; privado de noche) IGRT01";
const IGRP01 = "Paquete 105 Premium desde Foz: Transfer in+out en Foz/Igu, Lado Arg, Lado Bra IGRP01";

const aviso = (vuelo: string) =>
  `Traslado nocturno (${vuelo}): Cuenca del Plata lo hace solo en privado, con tarifa privada. Confirmar con la agencia antes de pedir.`;

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

describe("M3-45 fila 1 — la regla en data/traslados-nocturnos.csv", () => {
  const filas = leerTrasladosNocturnos(readFileSync(ARCHIVO_TRASLADOS_NOCTURNOS, "utf-8"));

  it("Cuenca del Plata, de 21:00 a 07:00, con sus filas de traslados del directorio", () => {
    expect(filas.length).toBeGreaterThan(0);
    for (const f of filas) expect(f).toMatchObject({ empresa: "Cuenca del Plata", desde: "21:00", hasta: "07:00" });
    expect(filas.map((f) => f.proveedor)).toEqual(expect.arrayContaining([IGRT01, IGRP01, "Paquetes 105 Premium: Transfer in+out en IGR, Lado Arg, lado Bra", "Cuenca del Plata"]));
  });

  it("viaja en las reglas del itinerario (detalle y pedidos)", () => {
    expect(reglas.trasladosNocturnos).toEqual(filas);
  });

  it("rechaza una fila sin proveedor o con una hora mal escrita", () => {
    expect(() => leerTrasladosNocturnos("proveedor,empresa,desde,hasta,nota\n,X,21:00,07:00,\n")).toThrow(/fila 2/);
    expect(() => leerTrasladosNocturnos("proveedor,empresa,desde,hasta,nota\nX,X,21hs,07:00,\n")).toThrow(/fila 2/);
    expect(() => leerTrasladosNocturnos("proveedor,desde,hasta\nX,21:00,07:00\n")).toThrow(/primera fila/);
  });

  it("sin empresa, el aviso usa el nombre del proveedor", () => {
    expect(leerTrasladosNocturnos("proveedor,empresa,desde,hasta,nota\nOtro,,22:00,06:00,\n")).toEqual([{ proveedor: "Otro", empresa: "Otro", desde: "22:00", hasta: "06:00" }]);
  });
});

describe("M3-45 fila 2 — cuándo avisa (unitarios)", () => {
  const de = (lado: "in" | "out", hora: string | null, numero: string | null = "AR1234", prov: string | null = IGRT01) =>
    avisosDeTrasladoNocturno(reglas, { proveedor: prov, lado, numero, hora });

  it("llega 22:40 avisa, con el texto de la ficha", () => {
    expect(de("in", "22:40")).toEqual([aviso("vuelo AR1234, llega 22:40")]);
  });
  it("llega 07:00 avisa (inclusivo); 21:00 también", () => {
    expect(de("in", "07:00")).toEqual([aviso("vuelo AR1234, llega 07:00")]);
    expect(de("in", "21:00")).toEqual([aviso("vuelo AR1234, llega 21:00")]);
  });
  it("07:01 y 20:59 no avisan", () => {
    expect(de("in", "07:01")).toEqual([]);
    expect(de("in", "20:59")).toEqual([]);
  });
  it("sale 05:30 avisa (traslado de salida); 00:00 también", () => {
    expect(de("out", "05:30")).toEqual([aviso("vuelo AR1234, sale 05:30")]);
    expect(de("out", "00:00")).toEqual([aviso("vuelo AR1234, sale 00:00")]);
  });
  it("la hora con segundos o sin cero adelante, como la trae el mail", () => {
    expect(de("in", "22:40:00")).toEqual([aviso("vuelo AR1234, llega 22:40")]);
    expect(de("out", "5:30")).toEqual([aviso("vuelo AR1234, sale 05:30")]);
  });
  it("vuelo sin hora o pendiente no avisa", () => {
    expect(de("in", null)).toEqual([]);
    expect(de("in", "")).toEqual([]);
    expect(de("in", "Pendiente")).toEqual([]);
  });
  it("vuelo sin número: avisa con la hora", () => {
    expect(de("in", "23:15", null)).toEqual([aviso("llega 23:15")]);
  });
  it("otro proveedor no avisa; el nombre se compara sin mayúsculas ni acentos", () => {
    expect(de("in", "22:40", "AR1234", "Rumbo Sur")).toEqual([]);
    expect(de("in", "22:40", "AR1234", null)).toEqual([]);
    expect(de("in", "22:40", "AR1234", "  cuenca  DEL plata ")).toEqual([aviso("vuelo AR1234, llega 22:40")]);
  });
  it("sin la regla cargada, nada", () => {
    expect(avisosDeTrasladoNocturno(SIN_REGLAS, { proveedor: IGRT01, lado: "in", numero: "AR1234", hora: "22:40" })).toEqual([]);
  });
});

describe("M3-45 fila 2 — en el armado y en el detalle", () => {
  const cuencaTrf = proveedor("prov-igrt01", IGRT01, ["reservas8@cuencadelplata.com"]);
  const trf = producto(
    "prod-trf-igr",
    "TRFIGR",
    [servicio({ productoId: "prod-trf-igr", tipo: "traslado", orden: 1, sentido: "ida_y_vuelta", descripcion: "Transfer IGR airport - Accommodation - IGR airport", bookingSupplier: cuencaTrf })],
    { destino: "IGR" },
  );
  const vuelos = (llega: string | null, sale: string | null): VueloDeReserva[] => [
    { numero: "AR1234", origen: "AEP", destino: "IGR", fecha_salida: "2027-02-10", hora_salida: "20:30", fecha_llegada: "2027-02-10", hora_llegada: llega },
    { numero: "G31010", origen: "IGR", destino: "AEP", fecha_salida: "2027-02-13", hora_salida: sale, fecha_llegada: "2027-02-13", hora_llegada: "08:00" },
  ];
  const r = (llega: string | null, sale: string | null) => reserva({ productoId: trf.id, fechaInicio: "2027-02-10", fechaFin: "2027-02-13", vuelos: vuelos(llega, sale) });
  const cat = (conReglas: ReglasItinerario | null = reglas): CatalogoParaPedidos => ({ ...catalogoCon([trf]), ...(conReglas ? { itinerario: conReglas } : {}) });

  it("traslado de Cuenca (IGRT01): llega 22:40 y sale 05:30 → dos avisos, en orden de fecha, en el itinerario y en el borrador", () => {
    const a = ok(armarPedidos(r("22:40", "05:30"), cat(), plantilla));
    const esperados = [aviso("vuelo AR1234, llega 22:40"), aviso("vuelo G31010, sale 05:30")];
    expect(a.itinerario).toEqual(esperados);
    const p = a.pedidos.find((x) => x.destinatarios.includes("reservas8@cuencadelplata.com"))!;
    expect(p.avisos).toEqual(expect.arrayContaining(esperados));
    expect(p.cuerpo).not.toMatch(/nocturno|tarifa privada/);
    expect(itinerarioDeLaReserva(r("22:40", "05:30"), cat())).toEqual(esperados);
  });

  it("de día (llega 14:00, sale 12:00) no avisa", () => {
    expect(ok(armarPedidos(r("14:00", "12:00"), cat(), plantilla)).itinerario).toEqual([]);
  });

  it("el paquete 105 Premium (IGRP01) con sus traslados también avisa", () => {
    const paquete = proveedor("prov-igrp01", IGRP01, ["reservas8@cuencadelplata.com"]);
    const prod = producto("prod-od010b", "OD010B", od010b.servicios.map((s) => (s.tipo === "excursion" ? { ...s, bookingSupplier: paquete } : s)), { destino: "IGR" });
    const res = {
      ...reservaOd010b,
      vuelos: [
        { numero: "LA4410", origen: "GRU", destino: "IGU", fecha_llegada: "2026-10-03", hora_llegada: "23:50" },
        { numero: "LA4411", origen: "IGU", destino: "GRU", fecha_salida: "2026-10-06", hora_salida: "15:00" },
      ],
    };
    const a = ok(armarPedidos(res, { ...catalogoCon([prod]), itinerario: reglas }, plantilla));
    expect(a.itinerario).toEqual([aviso("vuelo LA4410, llega 23:50")]);
    expect(itinerarioDeLaReserva(res, { ...catalogoCon([prod]), itinerario: reglas })).toEqual([aviso("vuelo LA4410, llega 23:50")]);
  });

  it("otro proveedor con vuelo de noche, nada; sin las reglas, nada", () => {
    const otro = producto("prod-otro", "TRFOTRO", [servicio({ ...trf.servicios[0], productoId: "prod-otro", bookingSupplier: proveedor("prov-otro", "Rumbo Sur", ["rumbo@test"]) })], { destino: "IGR" });
    const res = reserva({ productoId: otro.id, fechaInicio: "2027-02-10", fechaFin: "2027-02-13", vuelos: vuelos("22:40", "05:30") });
    expect(ok(armarPedidos(res, { ...catalogoCon([otro]), itinerario: reglas }, plantilla)).itinerario).toEqual([]);
    expect(ok(armarPedidos(r("22:40", "05:30"), cat(null), plantilla)).itinerario).toEqual([]);
  });
});
