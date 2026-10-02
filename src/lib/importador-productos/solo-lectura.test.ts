import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { clienteSoloLectura, EscrituraProhibida, fetchSoloLectura } from "./solo-lectura";

// Spec M1-04c §3 #3: el modo diagnóstico ("solo leer") no puede escribir en
// ninguna tabla. Dos guardas: el cliente (insert/update/upsert/delete/rpc
// tiran error antes de salir) y el fetch (cualquier pedido que no sea GET o
// HEAD se corta antes de llegar a la base).

function respuestaVacia() {
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
}

function clienteFalso(fetchBase: typeof fetch) {
  return createClient("http://localhost:54321", "clave-falsa-de-test", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchBase },
  });
}

describe("clienteSoloLectura", () => {
  it("deja leer (select) y el pedido sale como GET", async () => {
    const base = vi.fn(async () => respuestaVacia());
    const cliente = clienteSoloLectura(clienteFalso(base as unknown as typeof fetch));
    const { data, error } = await cliente.from("producto").select("id").range(0, 10);
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it.each(["insert", "update", "upsert", "delete"] as const)("%s tira EscrituraProhibida sin hacer ningún pedido", (metodo) => {
    const base = vi.fn(async () => respuestaVacia());
    const cliente = clienteSoloLectura(clienteFalso(base as unknown as typeof fetch));
    const builder = cliente.from("importacion") as unknown as Record<string, (...a: unknown[]) => unknown>;
    expect(() => builder[metodo]({ archivo: "x" })).toThrow(EscrituraProhibida);
    expect(() => builder[metodo]({ archivo: "x" })).toThrow(/solo leer.*importacion/);
    expect(base).not.toHaveBeenCalled();
  });

  it("rpc también está prohibido", () => {
    const base = vi.fn(async () => respuestaVacia());
    const cliente = clienteSoloLectura(clienteFalso(base as unknown as typeof fetch));
    expect(() => cliente.rpc("cualquier_funcion")).toThrow(EscrituraProhibida);
    expect(base).not.toHaveBeenCalled();
  });
});

describe("fetchSoloLectura", () => {
  it("deja pasar GET y HEAD", async () => {
    const base = vi.fn(async () => respuestaVacia());
    const f = fetchSoloLectura(base as unknown as typeof fetch);
    await f("http://x/rest/v1/producto");
    await f("http://x/rest/v1/producto", { method: "HEAD" });
    expect(base).toHaveBeenCalledTimes(2);
  });

  it.each(["POST", "PATCH", "PUT", "DELETE"])("corta %s antes de llegar a la base", async (method) => {
    const base = vi.fn(async () => respuestaVacia());
    const f = fetchSoloLectura(base as unknown as typeof fetch);
    await expect(f("http://x/rest/v1/importacion", { method })).rejects.toThrow(EscrituraProhibida);
    expect(base).not.toHaveBeenCalled();
  });

  it("aunque alguien saltee el cliente, un insert por el fetch guardado no llega a la base", async () => {
    const base = vi.fn(async () => respuestaVacia());
    const crudo = clienteFalso(fetchSoloLectura(base as unknown as typeof fetch));
    const { error } = await crudo.from("importacion").insert({ archivo: "x" });
    expect(error).not.toBeNull();
    expect(base).not.toHaveBeenCalled();
  });
});
