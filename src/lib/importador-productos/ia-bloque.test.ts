import { describe, expect, it, vi } from "vitest";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { crearConsultorIABloque, MODELO_IA, type ClienteMensajesIA } from "./ia-bloque";
import type { ConsultaBloqueIA } from "./plan";

// Spec M1-04 §3 #10 + regla #3: la IA interpreta un bloque puntual, siempre
// bajo el techo de gasto chequeado ANTES de la llamada.

function registroFake(gastoInicial: number): RegistroUsoIA & { sumar: ReturnType<typeof vi.fn> } {
  let gasto = gastoInicial;
  return {
    gastoDelMes: async () => gasto,
    sumar: vi.fn(async (_mes: string, uso: { costo: number }) => {
      gasto += uso.costo;
    }),
  };
}

function clienteFake(respuesta: unknown, textoCrudo?: string) {
  const create = vi.fn(async () => ({
    content: [
      { type: "thinking", thinking: "…" },
      { type: "text", text: textoCrudo ?? JSON.stringify(respuesta) },
    ],
    usage: { input_tokens: 1200, output_tokens: 300 },
  }));
  return { cliente: { messages: { create } } as unknown as ClienteMensajesIA, create };
}

const CONSULTA: ConsultaBloqueIA = {
  codigo: "OD010C",
  nombre: "Iguazu Falls Combined (2 Nts ARG + 1 Nt BRA)",
  textoBloque: "S3: Iguazu Falls Combined OD010C\nS9: Green + Dann Inn",
  lineasDudosas: ["Green + Dann Inn"],
};

const RESPUESTA = {
  servicios: [
    { linea: "Green + Dann Inn", tipo: "alojamiento", opciones: [{ service_provider: "Green", booking_supplier: null }] },
  ],
  lineas_sin_servicio: [],
  confianza: 0.7,
};

describe("crearConsultorIABloque (spec M1-04 §3 #10, regla #3)", () => {
  it("llama al modelo de integraciones-ia.md con salida estructurada y el bloque puntual", async () => {
    const { cliente, create } = clienteFake(RESPUESTA);
    const registro = registroFake(0);
    const consultor = crearConsultorIABloque({ cliente, registro, mes: "2026-09" });

    expect(await consultor.interpretar(CONSULTA)).toEqual(RESPUESTA);

    const params = (create.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(params.model).toBe(MODELO_IA);
    expect(MODELO_IA).toBe("claude-sonnet-5");
    expect(params.output_config).toMatchObject({ format: { type: "json_schema" } });
    expect(JSON.stringify(params.messages)).toContain("Green + Dann Inn");
    expect(JSON.stringify(params.messages)).toContain("OD010C");
    expect(registro.sumar).toHaveBeenCalledTimes(1);
    expect(consultor.estadisticas()).toEqual({ llamadas: 1, cortadasPorTecho: 0, errores: 0 });
  });

  it("techo de gasto agotado → NO llama al modelo y devuelve null (el bloque queda para revisar)", async () => {
    const { cliente, create } = clienteFake(RESPUESTA);
    const consultor = crearConsultorIABloque({ cliente, registro: registroFake(19.999), mes: "2026-09" });

    expect(await consultor.interpretar(CONSULTA)).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(consultor.estadisticas()).toEqual({ llamadas: 0, cortadasPorTecho: 1, errores: 0 });
  });

  it("respuesta que no respeta el esquema o error de red → null, sin romper la corrida", async () => {
    const malFormada = crearConsultorIABloque({
      cliente: clienteFake(null, "esto no es JSON").cliente,
      registro: registroFake(0),
      mes: "2026-09",
    });
    expect(await malFormada.interpretar(CONSULTA)).toBeNull();

    const tipoInvalido = crearConsultorIABloque({
      cliente: clienteFake({ ...RESPUESTA, servicios: [{ ...RESPUESTA.servicios[0], tipo: "hotel" }] }).cliente,
      registro: registroFake(0),
      mes: "2026-09",
    });
    expect(await tipoInvalido.interpretar(CONSULTA)).toBeNull();

    const create = vi.fn(async () => {
      throw new Error("red caída");
    });
    const conError = crearConsultorIABloque({
      cliente: { messages: { create } } as unknown as ClienteMensajesIA,
      registro: registroFake(0),
      mes: "2026-09",
    });
    expect(await conError.interpretar(CONSULTA)).toBeNull();
    expect(conError.estadisticas().errores).toBe(1);
  });
});
