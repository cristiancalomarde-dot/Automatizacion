import { describe, expect, it } from "vitest";
import { TEXTOS } from "@/lib/textos";
import { detalleDePrueba } from "../emparejar/__fixtures__/cargar";
import { MOTIVOS_EMPAREJADO as M } from "../emparejar/motivos";
import type { FichaLectura, VueloIA } from "../esquema-ficha";
import { MOTIVOS_INTERCAMBIO } from "../intercambio";
import {
  comoCambianLasFechas,
  datosDudosos,
  decidirCorreccion,
  porQueNoSeCorrige,
  quitarDudosos,
  validarFechas,
  validarPax,
  versionParaCorregir,
  type ReservaParaCorregir,
} from "./decidir";

/**
 * Spec M3-07 filas 4, 5 y 8 (la parte pura): qué motivos quedan después de
 * corregir los vuelos o revisar un dato dudoso, y cuándo no se corrige. Con
 * el catálogo real (foto): BOCHI04R pide el vuelo de salida de Calama.
 */

const R = TEXTOS.reserva.corregir.motivos;
const E = TEXTOS.reserva.corregir.errores;

const salidaCJC: VueloIA = {
  numero: "H2253",
  aerolinea: null,
  origen: "CJC",
  destino: null,
  fecha_salida: "2027-03-18",
  hora_salida: "08:44",
  fecha_llegada: null,
  hora_llegada: null,
  confianza: 1,
};

function reserva(extra: Partial<ReservaParaCorregir> = {}): ReservaParaCorregir {
  return {
    estado: "para_revision",
    cancelacion: false,
    motivos: [M.dudosos(["vuelos"])],
    productoTexto: "BOCHI04R",
    fechaInicio: "2027-03-10",
    fechaFin: "2027-03-18",
    vuelos: [],
    pedidosEspeciales: null,
    sinTrasladoDe: null,
    datosExtraidos: { tipo_mail: { valor: "reserva_nueva", confianza: 1 } } as unknown as FichaLectura,
    ...extra,
  };
}

const sinProducto = { principal: null, otros: [] };
const bochi = () => ({ principal: detalleDePrueba("BOCHI04R"), otros: [] });

describe("M3-07 fila 5 — los datos dudosos del motivo", () => {
  it("se leen del motivo 'La IA no está segura de: …'", () => {
    expect(datosDudosos([M.dudosos(["vuelos", "pax"]), M.sinFechaInicio])).toEqual(["pax", "vuelos"]);
    expect(datosDudosos([M.sinFechaInicio])).toEqual([]);
  });

  it("sacar uno deja los demás; sacar el último saca el motivo", () => {
    expect(quitarDudosos([M.dudosos(["vuelos", "pax"]), M.sinFechaInicio], ["vuelos"])).toEqual([M.dudosos(["pax"]), M.sinFechaInicio]);
    expect(quitarDudosos([M.dudosos(["pax"])], ["pax"])).toEqual([]);
  });
});

describe("M3-07 fila 4 — después de corregir los vuelos", () => {
  it("(a) solo dudoso de vuelos y el vuelo que pide el producto → recibida, sin avisos", () => {
    const d = decidirCorreccion(reserva(), { vuelos: [salidaCJC] }, bochi());
    expect(d).toEqual({ estado: "recibida", motivos: [], avisos: [] });
  });

  it("(b) dudoso de vuelos y de pax, corrijo vuelos → sigue para revisión solo con pax", () => {
    const d = decidirCorreccion(reserva({ motivos: [M.dudosos(["vuelos", "pax"])] }), { vuelos: [salidaCJC] }, bochi());
    expect(d).toEqual({ estado: "para_revision", motivos: [M.dudosos(["pax"])], avisos: [] });
  });

  it("(c) todavía falta el vuelo que el producto necesita → aviso (no motivo), queda recibida", () => {
    const llegadaLPB = { ...salidaCJC, numero: "LA2120", origen: null, destino: "LPB", fecha_salida: null, hora_salida: null, fecha_llegada: "2027-03-10", hora_llegada: "10:05" };
    const d = decidirCorreccion(reserva(), { vuelos: [llegadaLPB] }, bochi());
    expect(d.estado).toBe("recibida");
    expect(d.motivos).toEqual([]);
    expect(d.avisos).toEqual(["Falta el vuelo de salida de Calama (CJC) para el traslado de OD030"]);
  });

  it("el caso real: la IA lo tomó como llegada; corregido a salida, el aviso se va", () => {
    const comoLlegada = { ...salidaCJC, origen: null, destino: "CJC", fecha_salida: null, hora_salida: null, fecha_llegada: "2027-03-18", hora_llegada: "08:44" };
    expect(decidirCorreccion(reserva(), { vuelos: [comoLlegada] }, bochi()).avisos).toHaveLength(1);
    expect(decidirCorreccion(reserva(), { vuelos: [salidaCJC] }, bochi()).avisos).toEqual([]);
  });

  it("un 'Falta el vuelo' guardado como motivo (antes de la regla del 2026-10-16) y 'Llegaron vuelos' se van al corregir", () => {
    const motivos = [M.faltaVuelo("out", { ciudad: "Calama", codigos: ["CJC"] }, "el traslado de OD030"), MOTIVOS_INTERCAMBIO.llegaronVuelos];
    expect(decidirCorreccion(reserva({ motivos }), { vuelos: [salidaCJC] }, bochi())).toEqual({ estado: "recibida", motivos: [], avisos: [] });
  });

  it("los motivos que no son de vuelos ni dudosos se quedan", () => {
    const d = decidirCorreccion(reserva({ motivos: [M.dudosos(["vuelos"]), M.elegirVariante("OD019")] }), { vuelos: [] }, sinProducto);
    expect(d).toEqual({ estado: "para_revision", motivos: [M.elegirVariante("OD019")], avisos: [] });
  });

  it("sin producto del catálogo no se miran los vuelos que hacen falta", () => {
    expect(decidirCorreccion(reserva(), { vuelos: [] }, sinProducto)).toEqual({ estado: "recibida", motivos: [], avisos: [] });
  });

  it("fuera de 'para revisión' el estado y los motivos no cambian (solo los vuelos)", () => {
    const d = decidirCorreccion(reserva({ estado: "pedido_a_proveedor", motivos: [] }), { vuelos: [] }, bochi());
    expect(d.estado).toBe("pedido_a_proveedor");
    expect(d.motivos).toEqual([]);
    expect(d.avisos).toEqual(["Falta el vuelo de salida de Calama (CJC) para el traslado de OD030"]);
  });
});

describe("M3-07 fila 5 — 'Está bien así' y corregir fechas o pax", () => {
  it("'Está bien así' en pax lo saca de los dudosos; los vuelos no se recalculan como motivo", () => {
    const d = decidirCorreccion(reserva({ motivos: [M.dudosos(["vuelos", "pax"])] }), { revisado: "pax" }, bochi());
    expect(d.motivos).toEqual([M.dudosos(["vuelos"])]);
    expect(d.estado).toBe("para_revision");
  });

  it("corregir las fechas saca 'fechas' de los dudosos y 'no trae la fecha de inicio'", () => {
    const d = decidirCorreccion(
      reserva({ motivos: [M.dudosos(["fechas"]), M.sinFechaInicio], fechaInicio: null }),
      { fechas: { fechaInicio: "2027-03-10", fechaFin: "2027-03-18" } },
      sinProducto,
    );
    expect(d).toEqual({ estado: "recibida", motivos: [], avisos: [] });
  });

  it("validar fechas y pax en llano", () => {
    expect(validarFechas("2027-03-10", "2027-03-18")).toBeNull();
    expect(validarFechas("2027-03-18", "2027-03-10")).toBe(E.fechasOrden);
    expect(validarFechas("2027-02-30", "2027-03-10")).toBe(E.fecha);
    expect(validarFechas("", "2027-03-10")).toBe(E.faltaFecha);
    expect(validarPax(2)).toBeNull();
    expect(validarPax(0)).toBe(E.pax);
    expect(validarPax(2.5)).toBe(E.pax);
  });
});

describe("M3-07 filas 1 y 8 — cuándo no se corrige y la versión que vio la pantalla", () => {
  it.each([
    ["cerrada", { estado: "cerrada" as const }, R.cerrada],
    ["descartada", { estado: "descartada" as const }, R.descartada],
    ["cancelada por la agencia", { cancelacion: true }, R.cancelada],
  ])("%s → no", (_caso, extra, motivo) => {
    expect(porQueNoSeCorrige(reserva(extra))).toBe(motivo);
  });

  it.each(["recibida", "para_revision", "pedido_a_proveedor", "confirmada"] as const)("%s → sí", (estado) => {
    expect(porQueNoSeCorrige(reserva({ estado }))).toBeNull();
  });

  it("la versión cambia si cambian el estado, los motivos, los vuelos, las fechas, el pax o las notas", () => {
    const base = { estado: "para_revision" as const, motivos: ["x"], vuelos: [], fechaInicio: "2027-03-10", fechaFin: "2027-03-18", pax: 2, notas: [] };
    const v = versionParaCorregir(base);
    expect(versionParaCorregir({ ...base })).toBe(v);
    for (const cambio of [
      { estado: "recibida" as const },
      { motivos: [] },
      { vuelos: [{ numero: "H2253", aerolinea: null, origen: "CJC", destino: null, fechaSalida: null, horaSalida: null, fechaLlegada: null, horaLlegada: null }] },
      { fechaInicio: "2027-03-11" },
      { pax: 3 },
      { notas: ["Llegan por tierra"] },
    ]) {
      expect(versionParaCorregir({ ...base, ...cambio })).not.toBe(v);
    }
  });
});

describe("Owner 2026-10-20 — corregir las fechas de un tour con partes", () => {
  // ARCH31 (Kilroy): del 10 al 17 de enero, 7 noches.
  const antes = { fechaInicio: "2027-01-10", fechaFin: "2027-01-17" };

  it("inicio +2 y fin +2 → se corren las partes 2 días", () => {
    expect(comoCambianLasFechas(antes, { fechaInicio: "2027-01-12", fechaFin: "2027-01-19" })).toEqual({ tipo: "correr", dias: 2 });
  });

  it("inicio -3 y fin -3 → se corren 3 días para antes (y cruzando el mes)", () => {
    expect(comoCambianLasFechas(antes, { fechaInicio: "2027-01-07", fechaFin: "2027-01-14" })).toEqual({ tipo: "correr", dias: -3 });
    expect(comoCambianLasFechas({ fechaInicio: "2027-02-27", fechaFin: "2027-03-02" }, { fechaInicio: "2027-03-01", fechaFin: "2027-03-04" })).toEqual({
      tipo: "correr",
      dias: 2,
    });
  });

  it("inicio +2 y fin +3 → cambió la duración: las partes no se corren", () => {
    expect(comoCambianLasFechas(antes, { fechaInicio: "2027-01-12", fechaFin: "2027-01-20" })).toEqual({ tipo: "duracion", nochesAntes: 7, nochesDespues: 8 });
  });

  it("noches extra al final (el inicio igual) → cambió la duración", () => {
    expect(comoCambianLasFechas(antes, { fechaInicio: "2027-01-10", fechaFin: "2027-01-18" })).toEqual({ tipo: "duracion", nochesAntes: 7, nochesDespues: 8 });
  });

  it("las mismas fechas, o sin fechas antes → nada", () => {
    expect(comoCambianLasFechas(antes, antes)).toEqual({ tipo: "nada" });
    expect(comoCambianLasFechas({ fechaInicio: null, fechaFin: null }, antes)).toEqual({ tipo: "nada" });
    expect(comoCambianLasFechas({ fechaInicio: "2027-01-10", fechaFin: null }, antes)).toEqual({ tipo: "nada" });
  });

  it("el aviso dice de cuántas a cuántas noches; el historial, cuántos días se corrió", () => {
    expect(TEXTOS.reserva.corregir.avisoDuracion(7, 8)).toBe(
      "Cambió la duración del tour (de 7 a 8 noches): revisá las fechas de cada parte en los pedidos antes de enviar",
    );
    expect(TEXTOS.reserva.corregir.historialCorrio(2)).toBe("corrió las fechas del tour 2 días");
    expect(TEXTOS.reserva.corregir.historialCorrio(1)).toBe("corrió las fechas del tour 1 día");
    expect(TEXTOS.reserva.corregir.historialCorrio(-3)).toBe("corrió las fechas del tour 3 días para antes");
  });
});
