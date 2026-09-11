import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { darDeAltaUsuarioOperador } from "./alta";

/**
 * Fake mínimo del cliente Supabase admin: simula la restricción de unicidad
 * por `id` que en la base real da el primary key + `ignoreDuplicates: true`.
 * Es lo que permite comprobar "una segunda entrada no duplica la fila"
 * (spec M1-01 #5) sin un Postgres real.
 */
function crearClienteAdminFake() {
  const filas = new Map<string, Record<string, unknown>>();

  const cliente = {
    from: () => ({
      upsert: vi.fn((valores: { id: string } & Record<string, unknown>) => {
        if (!filas.has(valores.id)) {
          filas.set(valores.id, valores);
        }
        return Promise.resolve({ error: null });
      }),
    }),
  } as unknown as SupabaseClient;

  return { cliente, filas };
}

describe("darDeAltaUsuarioOperador", () => {
  it("crea la fila con rol operador la primera vez", async () => {
    const { cliente, filas } = crearClienteAdminFake();

    await darDeAltaUsuarioOperador(cliente, {
      id: "u1",
      email: "ana@hitravel.com.ar",
      nombre: "Ana",
    });

    expect(filas.size).toBe(1);
    expect(filas.get("u1")).toMatchObject({
      id: "u1",
      email: "ana@hitravel.com.ar",
      rol: "operador",
    });
  });

  it("una segunda entrada de la misma cuenta no duplica la fila (spec #5)", async () => {
    const { cliente, filas } = crearClienteAdminFake();
    const datos = { id: "u1", email: "ana@hitravel.com.ar", nombre: "Ana" };

    await darDeAltaUsuarioOperador(cliente, datos);
    await darDeAltaUsuarioOperador(cliente, datos);

    expect(filas.size).toBe(1);
  });

  it("propaga un error si Supabase falla al insertar", async () => {
    const cliente = {
      from: () => ({
        upsert: vi.fn().mockResolvedValue({ error: { message: "boom" } }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      darDeAltaUsuarioOperador(cliente, { id: "u1", email: "ana@hitravel.com.ar", nombre: null }),
    ).rejects.toThrow("No se pudo dar de alta el usuario: boom");
  });
});
