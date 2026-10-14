import { describe, expect, it, vi } from "vitest";
import { guardarMarca, validarMarca } from "./revision-prueba";

// Spec M2-06 fila 13: la marca del owner se guarda con su autor (lo pone la
// base) y se rechaza en una reserva real. Cliente de Supabase falso.

const ID = "11111111-1111-4111-8111-111111111111";

function clienteFalso(opciones: { usuario?: string | null; dePrueba?: boolean | null; errorGuardar?: string } = {}) {
  const upsert = vi.fn(() => ({
    select: () => ({
      single: async () =>
        opciones.errorGuardar
          ? { data: null, error: { message: opciones.errorGuardar } }
          : {
              data: { reserva_id: ID, resultado: "mal", que_mal: ["producto"], nota: null, updated_at: "2026-10-15T13:00:00Z", autor: { nombre: "Owner", email: "o@hitravel.com.ar" } },
              error: null,
            },
    }),
  }));
  const reserva = opciones.dePrueba === null ? null : { id: ID, de_prueba: opciones.dePrueba ?? true };
  const cliente = {
    auth: { getUser: async () => ({ data: { user: opciones.usuario === null ? null : { id: "u1" } }, error: null }) },
    from: (tabla: string) =>
      tabla === "reserva"
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: reserva, error: null }) }) }) }
        : { upsert },
  };
  return { cliente: cliente as never, upsert };
}

describe("validarMarca", () => {
  it("acepta bien sin qué, y mal con al menos una cosa conocida", () => {
    expect(validarMarca({ reservaId: ID, resultado: "bien", queMal: [], nota: null })).toEqual({ ok: true, marca: { reservaId: ID, resultado: "bien", queMal: [], nota: null } });
    expect(validarMarca({ reservaId: ID, resultado: "mal", queMal: ["vuelos", "producto", "vuelos"], nota: "  x  " })).toEqual({
      ok: true,
      marca: { reservaId: ID, resultado: "mal", queMal: ["producto", "vuelos"], nota: "x" },
    });
  });

  it("rechaza lo que no tiene sentido", () => {
    for (const malo of [
      { reservaId: "no-es-un-id", resultado: "bien", queMal: [], nota: null },
      { reservaId: ID, resultado: "regular", queMal: [], nota: null },
      { reservaId: ID, resultado: "mal", queMal: [], nota: null },
      { reservaId: ID, resultado: "mal", queMal: ["color"], nota: null },
      { reservaId: ID, resultado: "mal", queMal: ["otro"], nota: "x".repeat(2001) },
    ]) {
      expect(validarMarca(malo as never).ok).toBe(false);
    }
  });
});

describe("guardarMarca", () => {
  it("guarda con la sesión y devuelve la marca con su autor", async () => {
    const { cliente, upsert } = clienteFalso();
    const r = await guardarMarca(cliente, { reservaId: ID, resultado: "mal", queMal: ["producto"], nota: null });
    expect(r).toEqual({ ok: true, revision: { reservaId: ID, resultado: "mal", queMal: ["producto"], nota: null, autor: "Owner", fecha: "2026-10-15T13:00:00Z" } });
    expect(upsert).toHaveBeenCalledWith({ reserva_id: ID, resultado: "mal", que_mal: ["producto"], nota: null }, { onConflict: "reserva_id" });
  });

  it("una reserva real no se marca (ni se intenta guardar)", async () => {
    const { cliente, upsert } = clienteFalso({ dePrueba: false });
    expect(await guardarMarca(cliente, { reservaId: ID, resultado: "bien", queMal: [], nota: null })).toEqual({
      ok: false,
      error: "Solo se marcan las reservas de prueba.",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("sin sesión, o una reserva que no existe: no", async () => {
    expect((await guardarMarca(clienteFalso({ usuario: null }).cliente, { reservaId: ID, resultado: "bien", queMal: [], nota: null })).ok).toBe(false);
    expect((await guardarMarca(clienteFalso({ dePrueba: null }).cliente, { reservaId: ID, resultado: "bien", queMal: [], nota: null })).ok).toBe(false);
  });

  it("si la base rechaza, el error (sin datos de la reserva)", async () => {
    const { cliente } = clienteFalso({ errorGuardar: "caída" });
    expect(await guardarMarca(cliente, { reservaId: ID, resultado: "bien", queMal: [], nota: null })).toEqual({ ok: false, error: "No se pudo guardar la marca: caída" });
  });
});
