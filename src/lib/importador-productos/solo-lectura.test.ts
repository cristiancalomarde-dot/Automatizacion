import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { clienteEnSeco, clienteSoloLectura, EscrituraProhibida, fetchSoloLectura, resumirEscrituras } from "./solo-lectura";

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

describe("clienteEnSeco (M3-46 punto 7): corre el importador sin escribir y anota qué haría", () => {
  function cliente(fetchReal: typeof fetch) {
    return createClient("https://prueba.supabase.co", "clave", {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fetchSoloLectura(fetchReal) },
    });
  }
  const leer = vi.fn(async () => respuestaVacia());

  it("insert/update/delete no salen a la red: responden sin error y quedan anotados", async () => {
    leer.mockClear();
    const { cliente: admin, escrituras } = clienteEnSeco(cliente(leer as unknown as typeof fetch));

    const sinFila = await admin.from("producto_servicio").insert({ producto_id: "p1", orden: 1 });
    expect(sinFila.error).toBeNull();
    const conFila = await admin.from("producto").insert({ codigo: "ZZ1", nombre: "Uno" }).select("id, nombre").single();
    expect(conFila.error).toBeNull();
    expect(conFila.data).toMatchObject({ nombre: "Uno" });
    expect((conFila.data as unknown as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await admin.from("producto").update({ nombre: "Dos" }).eq("id", "p1")).error).toBeNull();
    expect((await admin.from("producto_servicio").delete().in("id", ["a", "b"])).error).toBeNull();

    expect(leer).not.toHaveBeenCalled();
    expect(escrituras.map((e) => [e.tabla, e.operacion])).toEqual([
      ["producto_servicio", "insert"],
      ["producto", "insert"],
      ["producto", "update"],
      ["producto_servicio", "delete"],
    ]);
  });

  it("las lecturas siguen yendo a la base", async () => {
    leer.mockClear();
    const { cliente: admin } = clienteEnSeco(cliente(leer as unknown as typeof fetch));
    const { data, error } = await admin.from("producto").select("id").eq("codigo", "ZZ1");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(leer).toHaveBeenCalledTimes(1);
  });

  it("rpc está prohibido", () => {
    const { cliente: admin } = clienteEnSeco(cliente(leer as unknown as typeof fetch));
    expect(() => admin.rpc("borrar_todo")).toThrow(EscrituraProhibida);
  });

  it("el resumen cuenta por tabla y lista los productos que crearía", () => {
    expect(
      resumirEscrituras([
        { tabla: "producto", operacion: "insert", fila: { codigo: "ZZ1" } },
        { tabla: "producto", operacion: "update", fila: { nombre: "x" } },
        { tabla: "producto_servicio", operacion: "insert", fila: {} },
        { tabla: "producto_servicio", operacion: "insert", fila: {} },
        { tabla: "producto_servicio", operacion: "delete", fila: null },
      ]),
    ).toEqual({
      porTabla: {
        producto: { insert: 1, update: 1, delete: 0 },
        producto_servicio: { insert: 2, update: 0, delete: 1 },
      },
      productosNuevos: ["ZZ1"],
    });
  });
});
