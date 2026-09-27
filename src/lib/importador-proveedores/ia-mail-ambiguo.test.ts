import { describe, expect, it, vi } from "vitest";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { MODELO_IA, crearConsultorIAMailAmbiguo, type ClienteMensajesIA } from "./ia-mail-ambiguo";

function registroFake(gastoInicial: number): RegistroUsoIA & { sumar: ReturnType<typeof vi.fn> } {
  let gasto = gastoInicial;
  return {
    gastoDelMes: async () => gasto,
    sumar: vi.fn(async (_mes: string, uso: { costo: number }) => {
      gasto += uso.costo;
    }),
  };
}

function clienteFake(respuestaJson: unknown) {
  const create = vi.fn(async () => ({
    content: [
      { type: "thinking", thinking: "…" },
      { type: "text", text: JSON.stringify(respuestaJson) },
    ],
    usage: { input_tokens: 400, output_tokens: 120 },
  }));
  return { cliente: { messages: { create } } as unknown as ClienteMensajesIA, create };
}

const CONSULTA = { nombre: "Selina salta", textoMailWeb: "VER MAILLLL", aclaraciones: "" };

describe("crearConsultorIAMailAmbiguo — respaldo de IA celda por celda (spec M1-03 #9, regla #3)", () => {
  it("llama al modelo de integraciones-ia.md con salida estructurada y devuelve la respuesta", async () => {
    const { cliente, create } = clienteFake({ mails: [], canal: "ninguno", confianza: 0.9 });
    const registro = registroFake(0);
    const consultor = crearConsultorIAMailAmbiguo({ cliente, registro, mes: "2026-09" });

    const r = await consultor.consultar(CONSULTA);

    expect(r).toEqual({ mails: [], canal: "ninguno", confianza: 0.9 });
    expect(create).toHaveBeenCalledTimes(1);
    const params = (create.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(params.model).toBe(MODELO_IA);
    expect(MODELO_IA).toBe("claude-sonnet-5");
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config).toMatchObject({ format: { type: "json_schema" } });
    // en el prompt va solo la celda, sus aclaraciones y el nombre — no el archivo entero
    expect(JSON.stringify(params.messages)).toContain("VER MAILLLL");
    expect(registro.sumar).toHaveBeenCalledWith("2026-09", expect.objectContaining({ tokensIn: 400, tokensOut: 120 }));
    expect(consultor.estadisticas()).toEqual({ llamadas: 1, cortadasPorTecho: 0, errores: 0 });
  });

  it("con el techo agotado no llama a la API y devuelve null (el proveedor queda sin mail)", async () => {
    const { cliente, create } = clienteFake({ mails: [], canal: "ninguno", confianza: 0.9 });
    const consultor = crearConsultorIAMailAmbiguo({ cliente, registro: registroFake(20), mes: "2026-09" });

    expect(await consultor.consultar(CONSULTA)).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(consultor.estadisticas()).toEqual({ llamadas: 0, cortadasPorTecho: 1, errores: 0 });
  });

  it("si la API falla o devuelve algo que no es el JSON esperado → null, no rompe la importación", async () => {
    const { cliente } = clienteFake({ algo: "raro" });
    const consultor = crearConsultorIAMailAmbiguo({ cliente, registro: registroFake(0), mes: "2026-09" });
    expect(await consultor.consultar(CONSULTA)).toBeNull();

    const roto = { messages: { create: vi.fn(async () => Promise.reject(new Error("500"))) } };
    const consultor2 = crearConsultorIAMailAmbiguo({
      cliente: roto as unknown as ClienteMensajesIA,
      registro: registroFake(0),
      mes: "2026-09",
    });
    expect(await consultor2.consultar(CONSULTA)).toBeNull();
    expect(consultor2.estadisticas().errores).toBe(1);
  });
});
