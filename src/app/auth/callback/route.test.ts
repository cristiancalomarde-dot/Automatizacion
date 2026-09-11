// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, signOut, deleteUser, adminFrom } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
  adminFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession, signOut },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: { admin: { deleteUser } },
    from: adminFrom,
  })),
}));

import { GET } from "./route";

function usuarioGoogle(id: string, email: string) {
  return { id, email, user_metadata: {} };
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN = "hitravel.com.ar";
    signOut.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
  });

  it("cuenta del dominio: da de alta el usuario y entra al shell (spec #3, #5)", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    adminFrom.mockReturnValue({ upsert });
    exchangeCodeForSession.mockResolvedValue({
      data: { session: {}, user: usuarioGoogle("u1", "ana@hitravel.com.ar") },
      error: null,
    });

    const res = await GET(new Request("http://localhost/auth/callback?code=abc"));

    expect(res.headers.get("location")).toBe("http://localhost/");
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      id: "u1",
      email: "ana@hitravel.com.ar",
      rol: "operador",
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("cuenta de otro dominio: no crea la fila `usuario`, cierra la sesión y borra la cuenta (spec #4)", async () => {
    const upsert = vi.fn();
    adminFrom.mockReturnValue({ upsert });
    exchangeCodeForSession.mockResolvedValue({
      data: { session: {}, user: usuarioGoogle("u2", "ana@otrodominio.com") },
      error: null,
    });

    const res = await GET(new Request("http://localhost/auth/callback?code=abc"));

    expect(res.headers.get("location")).toBe("http://localhost/login?error=dominio");
    expect(upsert).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith("u2");
  });

  it("sin `code` en la URL: vuelve a Login con error de autenticación", async () => {
    const res = await GET(new Request("http://localhost/auth/callback"));
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth");
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("Supabase no pudo crear la sesión: vuelve a Login con error de autenticación", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error("boom"),
    });

    const res = await GET(new Request("http://localhost/auth/callback?code=abc"));

    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth");
  });

  it("una segunda entrada de la misma cuenta no duplica la fila `usuario` (spec #5)", async () => {
    const filas = new Map<string, unknown>();
    adminFrom.mockReturnValue({
      upsert: vi.fn((valores: { id: string }) => {
        if (!filas.has(valores.id)) filas.set(valores.id, valores);
        return Promise.resolve({ error: null });
      }),
    });
    exchangeCodeForSession.mockResolvedValue({
      data: { session: {}, user: usuarioGoogle("u1", "ana@hitravel.com.ar") },
      error: null,
    });

    await GET(new Request("http://localhost/auth/callback?code=abc"));
    await GET(new Request("http://localhost/auth/callback?code=abc"));

    expect(filas.size).toBe(1);
  });
});
