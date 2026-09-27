import { describe, expect, it, vi } from "vitest";
import {
  TECHO_MENSUAL_USD,
  costoUSD,
  llamarConTecho,
  mesActual,
  type RegistroUsoIA,
} from "./techo-gasto";

function registroFake(gastoInicial: number) {
  let gasto = gastoInicial;
  const sumar = vi.fn(async (_mes: string, uso: { costo: number }) => {
    gasto += uso.costo;
  });
  const registro: RegistroUsoIA = {
    gastoDelMes: vi.fn(async () => gasto),
    sumar,
  };
  return { registro, sumar, gasto: () => gasto };
}

// Regla #3 (docs/arquitectura/integraciones-ia.md): techo US$ 20/mes,
// chequeado ANTES de cada llamada; al 80% avisa; al 100% no llama.
describe("techo de gasto de IA (regla #3)", () => {
  it("el techo mensual es US$ 20", () => {
    expect(TECHO_MENSUAL_USD).toBe(20);
  });

  it("costo con precios de claude-sonnet-5 (US$ 2 / US$ 10 por millón in/out)", () => {
    expect(costoUSD({ tokensIn: 1_000_000, tokensOut: 0 })).toBeCloseTo(2);
    expect(costoUSD({ tokensIn: 0, tokensOut: 1_000_000 })).toBeCloseTo(10);
    expect(costoUSD({ tokensIn: 3000, tokensOut: 500 })).toBeCloseTo(0.011);
  });

  it("mes en formato AAAA-MM (UTC)", () => {
    expect(mesActual(new Date("2026-09-27T23:59:00Z"))).toBe("2026-09");
  });

  it("con margen: llama, y suma el gasto real de la llamada al registro del mes", async () => {
    const { registro, sumar } = registroFake(1);
    const llamar = vi.fn(async () => ({ resultado: "ok", uso: { tokensIn: 3000, tokensOut: 500 } }));

    const r = await llamarConTecho({ registro, mes: "2026-09", costoMaximoLlamada: 0.02, llamar });

    expect(llamar).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ llamada: true, resultado: "ok", costo: costoUSD({ tokensIn: 3000, tokensOut: 500 }) });
    expect(sumar).toHaveBeenCalledWith("2026-09", {
      tokensIn: 3000,
      tokensOut: 500,
      costo: costoUSD({ tokensIn: 3000, tokensOut: 500 }),
    });
  });

  it("si el gasto del mes + el máximo de esta llamada supera el techo, NO llama (se chequea antes de gastar)", async () => {
    const { registro, sumar } = registroFake(19.99);
    const llamar = vi.fn();

    const r = await llamarConTecho({ registro, mes: "2026-09", costoMaximoLlamada: 0.02, llamar });

    expect(r).toEqual({ llamada: false, motivo: "techo" });
    expect(llamar).not.toHaveBeenCalled();
    expect(sumar).not.toHaveBeenCalled();
  });

  it("al cruzar el 80% del techo, avisa", async () => {
    const { registro } = registroFake(16.5);
    const avisar = vi.fn();
    await llamarConTecho({
      registro,
      mes: "2026-09",
      costoMaximoLlamada: 0.02,
      llamar: async () => ({ resultado: 1, uso: { tokensIn: 10, tokensOut: 10 } }),
      avisar,
    });
    expect(avisar).toHaveBeenCalledTimes(1);
  });
});
