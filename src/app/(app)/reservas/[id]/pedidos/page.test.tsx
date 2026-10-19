// @vitest-environment node
//
// Spec M3-02 fila 9: la pantalla de pedidos exige sesión (además del proxy y
// del layout); quien firma y el modo prueba salen del servidor (fila 8).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() =>
  vi.fn((destino: string) => {
    throw new Error(`redirect:${destino}`);
  }),
);
const sesion = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: sesion.user } }) } }),
}));
vi.mock("@/components/pedidos/pedidos-pantalla", () => ({ PedidosPantalla: () => null }));

import { decidirRedireccion } from "@/lib/auth/proteccion-rutas";
import PedidosPage from "./page";

const ID = "1b6e1f0a-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
const params = Promise.resolve({ id: ID });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PEDIDOS_ENVIO_REAL", "");
  vi.stubEnv("PEDIDOS_DESTINO_PRUEBA", "");
  vi.stubEnv("PEDIDOS_CC", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("/reservas/<id>/pedidos (spec M3-02)", () => {
  it("sin sesión redirige al login (proxy y página)", async () => {
    expect(decidirRedireccion({ pathname: `/reservas/${ID}/pedidos`, haySesion: false })).toEqual({
      tipo: "redirigir",
      destino: "/login?error=sesion_vencida",
    });
    sesion.user = null;
    await expect(PedidosPage({ params })).rejects.toThrow("redirect:/login?error=sesion_vencida");
  });

  it("con sesión: firma el nombre de la cuenta y el envío está en modo prueba", async () => {
    sesion.user = { id: "u", email: "leticia@hitravel.com.ar", user_metadata: { full_name: "Leticia Gómez" } };
    const el = (await PedidosPage({ params })) as { props: Record<string, unknown> };
    expect(el.props).toMatchObject({
      reservaId: ID,
      firmante: "Leticia Gómez",
      envio: { modoPrueba: true, destinoPrueba: "ccalomarde@", cc: ["ccalomarde@hitravel.com.ar"] },
    });
  });

  it("con PEDIDOS_ENVIO_REAL=si deja de estar en modo prueba", async () => {
    vi.stubEnv("PEDIDOS_ENVIO_REAL", "si");
    sesion.user = { id: "u", email: "leticia@hitravel.com.ar", user_metadata: {} };
    const el = (await PedidosPage({ params })) as { props: { firmante: string; envio: { modoPrueba: boolean } } };
    expect(el.props.firmante).toBe("leticia");
    expect(el.props.envio.modoPrueba).toBe(false);
  });
});
