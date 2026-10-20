// @vitest-environment node
//
// Spec M3-06 filas 1 y 9: "Mi nombre para la firma" exige sesión (además del
// proxy y del layout) y arranca con lo guardado o, si no hay, con el nombre de
// la cuenta de Google.
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() =>
  vi.fn((destino: string) => {
    throw new Error(`redirect:${destino}`);
  }),
);
const sesion = vi.hoisted(() => ({ user: null as unknown, nombreFirma: null as string | null }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: sesion.user } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nombre_firma: sesion.nombreFirma }, error: null }) }) }) }),
  }),
}));
vi.mock("@/components/usuarios/mi-firma-pantalla", () => ({ MiFirmaPantalla: () => null }));

import { decidirRedireccion } from "@/lib/auth/proteccion-rutas";
import MiFirmaPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("/mi-firma (spec M3-06)", () => {
  it("sin sesión redirige al login (proxy y página)", async () => {
    expect(decidirRedireccion({ pathname: "/mi-firma", haySesion: false })).toEqual({ tipo: "redirigir", destino: "/login?error=sesion_vencida" });
    sesion.user = null;
    await expect(MiFirmaPage()).rejects.toThrow("redirect:/login?error=sesion_vencida");
  });

  it("con sesión: el nombre de Google y lo guardado", async () => {
    sesion.user = { id: "u", email: "dperez@hitravel.com.ar", user_metadata: { full_name: "Damián Pérez" } };
    sesion.nombreFirma = "Damián · Operaciones";
    const el = (await MiFirmaPage()) as { props: Record<string, unknown> };
    expect(el.props).toEqual({ nombreGoogle: "Damián Pérez", guardado: "Damián · Operaciones" });
    sesion.nombreFirma = null;
    expect(((await MiFirmaPage()) as { props: Record<string, unknown> }).props).toEqual({ nombreGoogle: "Damián Pérez", guardado: null });
  });
});
