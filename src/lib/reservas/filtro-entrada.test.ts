import { describe, expect, it, vi } from "vitest";
import { AGENCIAS_QUE_SE_LEEN, decidirEntrada, TEXTO_SALTEO } from "./filtro-entrada";
import type { ReservaParaRespuesta } from "./respuestas";

/**
 * Qué mails pasan a la IA (spec M2-06 fila 3 y plan M2 §3, owner 2026-10-13
 * y 2026-10-14). Lo usan el modo prueba y la lectura de sales@ (M2-07). Datos
 * inventados.
 */

const ESPERA = "Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030";
const reserva = (c: Partial<ReservaParaRespuesta> = {}): ReservaParaRespuesta => ({
  id: "r1",
  agencia: "Kilroy",
  booking_id: "DK0000077",
  estado: "para_revision",
  motivos_revision: [ESPERA],
  de_prueba: true,
  ...c,
});

const sinReservas = () => vi.fn(async () => [] as ReservaParaRespuesta[]);

describe("decidirEntrada", () => {
  it("las agencias que se leen hoy: Kilroy y TourRadar", () => {
    expect([...AGENCIAS_QUE_SE_LEEN].sort()).toEqual(["Kilroy", "TourRadar"]);
  });

  it("un mail original de Kilroy o TourRadar se lee, sin consultar la base", async () => {
    const buscar = sinReservas();
    for (const [remitente, asunto] of [
      ["testtown@kilroy.dk", "DK0000042/abcd - Overland - KILROY booking request"],
      ["system@sent-via.netsuite.com", "Booking Statement 0000042 - 00000042 - vendorbill"],
      ["KILROY UK <travels@kilroy.co.uk>", "NEW FLIGHT: UK0000042"],
    ]) {
      expect(await decidirEntrada({ remitente, asunto }, { buscarReservas: buscar, dePrueba: true })).toMatchObject({
        leer: true,
        motivo: "original",
      });
    }
    expect(buscar).not.toHaveBeenCalled();
  });

  it("los pedidos a proveedores (HI Travel o un proveedor) no son de agencia", async () => {
    for (const remitente of ["operations@hitravel.com.ar", "reservas@proveedor-inventado.com.ar", ""]) {
      const d = await decidirEntrada({ remitente, asunto: "Reserva x4" }, { buscarReservas: sinReservas(), dePrueba: true });
      expect(d).toEqual({ leer: false, agencia: null, motivo: "no_es_agencia", registrar: false });
    }
    expect(TEXTO_SALTEO.no_es_agencia).toBe("No es un mail de agencia");
  });

  it("Journaway entra con M2-09", async () => {
    const d = await decidirEntrada({ remitente: "de@journaway.com", asunto: null }, { buscarReservas: sinReservas(), dePrueba: true });
    expect(d).toMatchObject({ leer: false, agencia: "Journaway", motivo: "journaway_m2_09" });
    expect(TEXTO_SALTEO.journaway_m2_09).toBe("Journaway entra con M2-09");
  });

  it("Jysk no se lee, ni siquiera un original; el mail se registra (sin IA)", async () => {
    const d = await decidirEntrada(
      { remitente: "someone@jr.dk", asunto: "JY0000001 - Buenos Aires - 2 pax" },
      { buscarReservas: sinReservas(), dePrueba: true },
    );
    expect(d).toEqual({ leer: false, agencia: "Jysk", motivo: "jysk_no_se_lee", registrar: true });
  });

  it("una respuesta sin número de una reserva cargada no se lee", async () => {
    const buscar = sinReservas();
    const d = await decidirEntrada({ remitente: "testtown@kilroy.dk", asunto: "Re: Pax Inventado UK0000099" }, { buscarReservas: buscar, dePrueba: true });
    expect(d).toMatchObject({ leer: false, agencia: "Kilroy", motivo: "respuesta_sin_reserva" });
    expect(buscar).toHaveBeenCalledWith("Re: Pax Inventado UK0000099", "Kilroy");
  });

  it("una respuesta con la reserva cargada pero sin esperar vuelo no se lee", async () => {
    const buscar = vi.fn(async () => [reserva({ estado: "recibida", motivos_revision: [] })]);
    const d = await decidirEntrada({ remitente: "testtown@kilroy.dk", asunto: "Sv: Sv: RV: DK0000077 - Inventado" }, { buscarReservas: buscar, dePrueba: true });
    expect(d).toMatchObject({ leer: false, motivo: "respuesta_no_espera_vuelo" });
  });

  it("la excepción: 'Re: NEW FLIGHT' de una reserva que espera el vuelo se lee", async () => {
    const buscar = vi.fn(async () => [reserva()]);
    const d = await decidirEntrada({ remitente: "testtown@kilroy.dk", asunto: "Re: NEW FLIGHT: DK0000077 /emri - Overland" }, { buscarReservas: buscar, dePrueba: true });
    expect(d).toEqual({ leer: true, agencia: "Kilroy", motivo: "espera_vuelo", reservaIds: ["r1"] });
  });

  it("prueba y real no se mezclan: una reserva real no habilita leer la respuesta de una corrida de prueba", async () => {
    const buscar = vi.fn(async () => [reserva({ de_prueba: false })]);
    const d = await decidirEntrada({ remitente: "testtown@kilroy.dk", asunto: "Re: NEW FLIGHT: DK0000077" }, { buscarReservas: buscar, dePrueba: true });
    expect(d).toMatchObject({ leer: false, motivo: "respuesta_sin_reserva" });
  });
});
