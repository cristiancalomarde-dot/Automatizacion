import { describe, expect, it } from "vitest";
import { llamarConTecho, type RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { crearTopeDeCorrida, TOPE_CORRIDA_USD } from "./tope-corrida";

// Spec M2-06 fila 10 (#3): el tope por corrida (US$ 2) se chequea antes de cada
// llamada, además del techo mensual (US$ 20). IA falsa: nunca la API.

function registroMes(gastoInicial = 0) {
  let gasto = gastoInicial;
  const registro: RegistroUsoIA = {
    gastoDelMes: async () => gasto,
    sumar: async (_mes, uso) => {
      gasto += uso.costo;
    },
  };
  return { registro, gasto: () => gasto };
}

/** Una llamada falsa que cuesta `costo` (con precios de 1 US$ por millón de tokens de entrada). */
const llamada = (tope: ReturnType<typeof crearTopeDeCorrida>, costo: number, peorCaso = costo) =>
  llamarConTecho({
    registro: tope.registro,
    mes: "2026-10",
    costoMaximoLlamada: peorCaso,
    precios: { entradaPorMillon: 1, salidaPorMillon: 0 },
    llamar: async () => ({ resultado: "ok", uso: { tokensIn: costo * 1_000_000, tokensOut: 0 } }),
  });

describe("tope por corrida", () => {
  it("es US$ 2 por defecto", () => {
    expect(TOPE_CORRIDA_USD).toBe(2);
  });

  it("corta antes de pasarse: la llamada que pasaría el tope no se hace", async () => {
    const mes = registroMes();
    const tope = crearTopeDeCorrida(mes.registro, { tope: 0.25 });
    expect((await llamada(tope, 0.1)).llamada).toBe(true);
    expect((await llamada(tope, 0.1)).llamada).toBe(true);
    const tercera = await llamada(tope, 0.1);
    expect(tercera).toEqual({ llamada: false, motivo: "techo" });
    expect(tope.bloqueo()).toBe("tope_corrida");
    expect(tope.gasto()).toBeCloseTo(0.2);
    // El gasto igual se sumó al mes (uso_ia).
    expect(mes.gasto()).toBeCloseTo(0.2);
  });

  it("con el techo mensual agotado corta igual, con su motivo", async () => {
    const mes = registroMes(19.95);
    const tope = crearTopeDeCorrida(mes.registro, { tope: 2 });
    expect(await llamada(tope, 0.1)).toEqual({ llamada: false, motivo: "techo" });
    expect(tope.bloqueo()).toBe("techo_mensual");
    expect(tope.gasto()).toBe(0);
  });

  it("sin bloqueo, no informa motivo", async () => {
    const tope = crearTopeDeCorrida(registroMes().registro);
    await llamada(tope, 0.01);
    expect(tope.bloqueo()).toBeNull();
  });
});
