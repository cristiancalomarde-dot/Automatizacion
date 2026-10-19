// @vitest-environment node
//
// Spec M3-02 fila 9: sin una sesión del equipo, ninguna acción de la pantalla
// de pedidos lee ni escribe nada. Fila 8: confirmar el envío no manda nada
// todavía (M3-03). Con un cliente falso: la integración real está en
// tests/pedidos-pantalla-m3-02.integration.test.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTOS } from "@/lib/textos";
import { guardarEdicionDePedido, pedirEnvioDePedidos, prepararPedidos } from "./revision";

const ID = "8f7c6a2e-1b1a-4c3e-9a55-2a0f6d5b9c11";

function clienteFalso(usuario: { id: string; email: string } | null) {
  const from = vi.fn(() => {
    throw new Error("no debería tocar la base");
  });
  const rpc = vi.fn(() => {
    throw new Error("no debería tocar la base");
  });
  const cliente = { auth: { getUser: vi.fn(async () => ({ data: { user: usuario }, error: null })) }, from, rpc } as unknown as SupabaseClient;
  return { cliente, from, rpc };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN", "hitravel.com.ar");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("acciones de pedidos: solo el equipo (fila 9)", () => {
  it.each([
    ["sin sesión", null],
    ["con una cuenta de otro dominio", { id: ID, email: "alguien@gmail.com" }],
  ])("%s, nada lee ni escribe", async (_caso, usuario) => {
    const { cliente, from, rpc } = clienteFalso(usuario);
    const esperado = { ok: false, error: TEXTOS.pedidos.sinSesion, sinSesion: true };
    expect(await prepararPedidos(cliente, ID)).toEqual(esperado);
    expect(await guardarEdicionDePedido(cliente, { pedidoId: ID, asunto: "A", cuerpo: "B" })).toEqual(esperado);
    expect(await pedirEnvioDePedidos(cliente, { reservaId: ID, pedidoIds: [ID] })).toEqual(esperado);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("confirmar el envío (fila 8)", () => {
  it("con sesión del equipo responde que falta conectar el envío y no toca nada", async () => {
    const { cliente, from, rpc } = clienteFalso({ id: ID, email: "ccalomarde@hitravel.com.ar" });
    expect(await pedirEnvioDePedidos(cliente, { reservaId: ID, pedidoIds: [ID] })).toEqual({ ok: false, error: TEXTOS.pedidos.faltaConectar });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("un id de reserva inválido no se acepta", async () => {
    const { cliente, from } = clienteFalso({ id: ID, email: "ccalomarde@hitravel.com.ar" });
    expect(await prepararPedidos(cliente, "no-es-un-id")).toEqual({ ok: false, error: "No existe la reserva." });
    expect(from).not.toHaveBeenCalled();
  });
});
