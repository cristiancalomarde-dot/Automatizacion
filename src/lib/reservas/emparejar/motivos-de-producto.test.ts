import { describe, expect, it } from "vitest";
import { MOTIVOS_EMPAREJADO as M } from "./motivos";
import { esMotivoDeProducto, sugerenciaDelMotivo } from "./motivos-de-producto";

/**
 * Spec M3-05 (anexo): qué motivos son "de producto", reconocidos con los mismos
 * generadores de `motivos.ts` (si cambia un texto, cambia el reconocedor).
 */

const NOMBRE = "HI - La Paz Starter Package (Adventure Brew Hostal)";

describe("M3-05 — esMotivoDeProducto", () => {
  it.each([
    ["noSeguro sin sugerencia", M.noSeguro(NOMBRE)],
    ["noSeguro con sugerencia", M.noSeguro(NOMBRE, { codigo: "OD031", confianza: 0.85 })],
    ["codigoFueraDeLista", M.codigoFueraDeLista(NOMBRE)],
    ["nochesNoCoinciden", M.nochesNoCoinciden(NOMBRE, "OD031", 3, 4)],
    ["iaInvalida", M.iaInvalida(NOMBRE)],
    ["iaNoDisponible", M.iaNoDisponible(NOMBRE)],
    ["noEstaEnCatalogo", M.noEstaEnCatalogo(NOMBRE)],
    ["codigoNoCargado con nombre", M.codigoNoCargado("HI_ARGENTINA_XYZ-677", NOMBRE)],
    ["codigoNoCargado sin nombre", M.codigoNoCargado("HI_ARGENTINA_XYZ-677", null)],
    ["sinProducto", M.sinProducto],
    ["techo", M.techo],
    ["iaNoRespondio", M.iaNoRespondio],
  ])("%s es de producto", (_, motivo) => {
    expect(esMotivoDeProducto(motivo)).toBe(true);
  });

  it.each([
    ["faltaVuelo", M.faltaVuelo("in", { ciudad: "La Paz", codigos: ["LPB"] }, "el traslado de OD031")],
    ["elegirVariante", M.elegirVariante("OD019")],
    ["dudosos", M.dudosos(["fechas", "pax"])],
    ["sinFechaInicio", M.sinFechaInicio],
    ["cancelación", M.tipoMail.cancelacion],
    ["cargo extra", M.cargoExtra({ importe: 10, moneda: "USD" })],
    ["producto conocido no cargado (no está en la lista de la spec)", M.productoNoCargado("OD099", "Algo")],
    ["lectura fallida", M.lecturaFallida("El PDF no se pudo leer")],
    ["un texto cualquiera", "Posible duplicada de otra reserva"],
  ])("%s NO es de producto", (_, motivo) => {
    expect(esMotivoDeProducto(motivo)).toBe(false);
  });

  it("no debe pasar: un nombre con paréntesis o signos de regex rompe el reconocimiento", () => {
    expect(esMotivoDeProducto(M.noSeguro("Tour (3N) + [extra] *.?", { codigo: "OD031", confianza: 0.5 }))).toBe(true);
    expect(esMotivoDeProducto(`  ${M.techo}  `)).toBe(true);
  });
});

describe("M3-05 — sugerenciaDelMotivo (el código y la seguridad de la IA)", () => {
  it("de un 'no seguro' con sugerencia sale el código y la confianza", () => {
    expect(sugerenciaDelMotivo(M.noSeguro(NOMBRE, { codigo: "OD031", confianza: 0.85 }))).toEqual({ codigo: "OD031", confianza: 0.85 });
  });

  it("de 'las noches no coinciden' sale el código, sin confianza", () => {
    expect(sugerenciaDelMotivo(M.nochesNoCoinciden(NOMBRE, "CHB31", 6, 7))).toEqual({ codigo: "CHB31", confianza: null });
  });

  it("los demás motivos no traen sugerencia", () => {
    expect(sugerenciaDelMotivo(M.noSeguro(NOMBRE))).toBeNull();
    expect(sugerenciaDelMotivo(M.techo)).toBeNull();
    expect(sugerenciaDelMotivo(M.elegirVariante("OD019"))).toBeNull();
  });
});
