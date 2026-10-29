import { describe, expect, it } from "vitest";
import { MOTIVOS_EMPAREJADO as M } from "../emparejar/motivos";
import type { FichaLectura } from "../esquema-ficha";
import { MOTIVOS_INTERCAMBIO as MI } from "../intercambio";
import { MOTIVOS_JOURNAWAY as J } from "../journaway/motivos";
import { lineasDeMotivos, motivoResueltoEnHistorial } from "../reglas";
import { decidirCorreccion, type ReservaParaCorregir } from "./decidir";

/**
 * Spec M3-39 (la parte pura): "Marcar como resuelto" un motivo de revisión.
 * El caso real: Petzold (Journaway) quedó para revisión porque pide el
 * "Night Bus Peru", que no es parte de SPAP05.
 */

const NIGHT_BUS = J.noEsParte("Night Bus Peru", "2027-05-31", "2027-06-01", "SPAP05");

function reserva(extra: Partial<ReservaParaCorregir> = {}): ReservaParaCorregir {
  return {
    estado: "para_revision",
    cancelacion: false,
    motivos: [NIGHT_BUS],
    productoTexto: "SPAP05",
    fechaInicio: "2027-05-20",
    fechaFin: "2027-06-01",
    vuelos: [],
    pedidosEspeciales: null,
    sinTrasladoDe: null,
    datosExtraidos: { tipo_mail: { valor: "reserva_nueva", confianza: 1 } } as unknown as FichaLectura,
    ...extra,
  };
}
const sinProducto = { principal: null, otros: [] };

describe("M3-39 fila 3 — qué queda después de marcar un motivo como resuelto", () => {
  it("con un solo motivo, resolverlo deja la reserva recibida", () => {
    expect(decidirCorreccion(reserva(), { resueltos: [NIGHT_BUS] }, sinProducto)).toEqual({ estado: "recibida", motivos: [], avisos: [] });
  });

  it("con dos, resolver uno la deja para revisión con el otro", () => {
    const r = reserva({ motivos: [NIGHT_BUS, MI.posibleDuplicada] });
    expect(decidirCorreccion(r, { resueltos: [NIGHT_BUS] }, sinProducto)).toEqual({
      estado: "para_revision",
      motivos: [MI.posibleDuplicada],
      avisos: [],
    });
  });

  it("saca todas las copias del mismo motivo (un renglón en pantalla)", () => {
    const r = reserva({ motivos: [NIGHT_BUS, M.dudosos(["pax"]), NIGHT_BUS] });
    expect(decidirCorreccion(r, { resueltos: [NIGHT_BUS] }, sinProducto).motivos).toEqual([M.dudosos(["pax"])]);
  });

  it("en otro estado no cambia ni el estado ni los motivos (como las otras correcciones)", () => {
    const r = reserva({ estado: "recibida" });
    expect(decidirCorreccion(r, { resueltos: [NIGHT_BUS] }, sinProducto)).toEqual({ estado: "recibida", motivos: [NIGHT_BUS], avisos: [] });
  });
});

describe("M3-39 fila 1 — cada renglón de motivos sabe qué motivos guardados lleva", () => {
  it("un renglón por frase + detalle, con sus motivos guardados y su categoría", () => {
    const vuelo = M.faltaVuelo("in", null, "el traslado de A");
    const lineas = lineasDeMotivos([NIGHT_BUS, vuelo, MI.posibleDuplicada, vuelo, MI.posibleDuplicada]);
    expect(lineas.map((l) => [l.categoria, l.motivos])).toEqual([
      ["journaway", [NIGHT_BUS]],
      ["falta_vuelo", [vuelo]],
      ["posible_duplicada", [MI.posibleDuplicada]],
    ]);
    // M3-40: el de Journaway se lee tal cual se guardó.
    expect(lineas[0]).toMatchObject({ frase: NIGHT_BUS, detalle: null });
    expect(lineas[1]).toMatchObject({ frase: "Faltan los datos de vuelo, y el producto incluye traslados.", detalle: "Vuelo de llegada, para el traslado de A." });
  });
});

describe("M3-39 fila 2 — cómo se dice el motivo resuelto en el historial", () => {
  it("un motivo con frase propia va con su frase; uno sin frase (Journaway) va tal como se guardó", () => {
    expect(motivoResueltoEnHistorial([NIGHT_BUS])).toBe(
      "Journaway pide 'Night Bus Peru' (31.05–01.06), que no es parte de SPAP05: consultarlo con Journaway",
    );
    expect(motivoResueltoEnHistorial([MI.posibleDuplicada])).toBe(
      "Esta reserva se parece a otra (misma agencia, producto y fechas). Revisala antes de seguir.",
    );
  });
});
