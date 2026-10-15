import { describe, expect, it } from "vitest";
import { esRespuesta, numerosDelAsunto, respuestaMereceLectura, type ReservaParaRespuesta } from "./respuestas";

/**
 * Owner, 2026-10-14 (plan M2 §3, DECISIONS): los vuelos casi siempre llegan
 * como respuesta ("Re: NEW FLIGHT: DK1562336 /emri - …"). Una respuesta se lee
 * con IA solo si su asunto trae el número de una reserva que existe y esa
 * reserva está "para revisión" esperando un vuelo. Datos inventados.
 */

const FALTA = "Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030";

function reserva(c: Partial<ReservaParaRespuesta> = {}): ReservaParaRespuesta {
  return {
    id: "r1",
    agencia: "Kilroy",
    booking_id: "DK1562336",
    estado: "para_revision",
    motivos_revision: [FALTA],
    de_prueba: false,
    ...c,
  };
}

describe("esRespuesta", () => {
  it("Re:, RE:, SV:, Sv:, AW:, VS:, Fwd:, FW:, RV:, también repetidos", () => {
    for (const a of ["Re: x", "RE: x", "SV: x", "Sv: Sv: RV: x", "AW: x", "VS: x", "Fwd: x", "FW: x", "RV: x", "  re : x"]) {
      expect(esRespuesta(a)).toBe(true);
    }
  });
  it("un mail original no es respuesta, aunque hable de un número existente", () => {
    expect(esRespuesta("NEW FLIGHT: DK1562336 /emri - flights")).toBe(false);
    expect(esRespuesta("Reserva nueva DK1562336")).toBe(false);
    expect(esRespuesta(null)).toBe(false);
  });
});

describe("numerosDelAsunto", () => {
  it("Kilroy y Jysk: todos los país + número (DK, SE, UK, NO…)", () => {
    expect(numerosDelAsunto("Re: NEW FLIGHT: DK1562336 /emri - Overland", "Kilroy")).toEqual(["DK1562336"]);
    expect(numerosDelAsunto("SV: SE1500001/abcd y UK1586142-123", "Jysk")).toEqual(["SE1500001", "UK1586142"]);
  });
  it("TourRadar: el reference id; Journaway: el ID de 11 dígitos", () => {
    expect(numerosDelAsunto("RE: Booking Statement 1377598 - 25388222 - vendorbill", "TourRadar")).toEqual(["1377598"]);
    expect(numerosDelAsunto("RE: Re: booking 1377598 flights", "TourRadar")).toEqual(["1377598"]);
    expect(numerosDelAsunto("AW: Program Booking / Client Probe / ID 65643802533", "Journaway")).toEqual(["65643802533"]);
    expect(numerosDelAsunto("AW: Booking request", "Journaway")).toEqual([]);
  });
});

describe("respuestaMereceLectura", () => {
  const asunto = "Re: NEW FLIGHT: DK1562336 /emri - Overland San Pedro de Atacama";

  it("la reserva DK1562336 está para revisión esperando un vuelo → se lee", () => {
    expect(respuestaMereceLectura(asunto, "Kilroy", [reserva()], { dePrueba: false })).toEqual({
      leer: true,
      motivo: "espera_vuelo",
      reservaIds: ["r1"],
    });
  });
  it("la misma respuesta con la reserva ya recibida → no se lee", () => {
    const r = respuestaMereceLectura(asunto, "Kilroy", [reserva({ estado: "recibida", motivos_revision: [] })], { dePrueba: false });
    expect(r).toMatchObject({ leer: false, motivo: "no_espera_vuelo" });
  });
  it("Iguazú recibida sin dato de llegada (owner 2026-10-14) → se lee, para sumar el vuelo o el bus", () => {
    const iguazu = reserva({ estado: "recibida", motivos_revision: [], sin_dato_llegada: true });
    expect(respuestaMereceLectura(asunto, "Kilroy", [iguazu], { dePrueba: false })).toEqual({
      leer: true,
      motivo: "espera_vuelo",
      reservaIds: ["r1"],
    });
    const conDato = reserva({ estado: "recibida", motivos_revision: [], sin_dato_llegada: false });
    expect(respuestaMereceLectura(asunto, "Kilroy", [conDato], { dePrueba: false })).toMatchObject({ leer: false });
  });
  it("para revisión pero no por un vuelo → no se lee", () => {
    const r = respuestaMereceLectura(asunto, "Kilroy", [reserva({ motivos_revision: ["El producto X no está en el catálogo"] })], {
      dePrueba: false,
    });
    expect(r).toMatchObject({ leer: false, motivo: "no_espera_vuelo" });
  });
  it("un asunto sin un número conocido → no se lee", () => {
    expect(respuestaMereceLectura("Re: question about the tour", "Kilroy", [reserva()], { dePrueba: false })).toMatchObject({
      leer: false,
      motivo: "sin_numero_conocido",
    });
    expect(respuestaMereceLectura("Re: NEW FLIGHT: DK1999999 /emri", "Kilroy", [reserva()], { dePrueba: false })).toMatchObject({
      leer: false,
      motivo: "sin_numero_conocido",
    });
  });
  it("el número se compara dentro de la agencia y del mismo modo (prueba o real)", () => {
    expect(respuestaMereceLectura(asunto, "Jysk", [reserva()], { dePrueba: false }).leer).toBe(false);
    expect(respuestaMereceLectura(asunto, "Kilroy", [reserva()], { dePrueba: true }).leer).toBe(false);
  });
  it("TourRadar y Journaway también", () => {
    const tr = reserva({ agencia: "TourRadar", booking_id: "1377598" });
    expect(respuestaMereceLectura("RE: Booking Statement 1377598 - 25388222", "TourRadar", [tr], { dePrueba: false }).leer).toBe(true);
    const jw = reserva({ agencia: "Journaway", booking_id: "65643802533" });
    expect(respuestaMereceLectura("AW: Program Booking / Client X / ID 65643802533", "Journaway", [jw], { dePrueba: false }).leer).toBe(
      true,
    );
  });
  it("un mail original no pasa por este filtro: se lee siempre", () => {
    expect(respuestaMereceLectura("NEW FLIGHT: DK1562336 /emri", "Kilroy", [], { dePrueba: false })).toEqual({
      leer: true,
      motivo: "original",
      reservaIds: [],
    });
  });
});
