// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
  })),
}));

import { proxy } from "./proxy";

describe("proxy (spec M1-01 #6, #7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "clave-anon-de-test";
  });

  it("sin sesión y ruta protegida: redirige a Login con sesión vencida", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await proxy(new NextRequest("http://localhost/"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login?error=sesion_vencida");
  });

  it("sin sesión y /login: deja ver el login (no redirige)", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await proxy(new NextRequest("http://localhost/login"));

    expect(res.headers.get("location")).toBeNull();
  });

  it("con sesión y ruta protegida: sigue de largo", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await proxy(new NextRequest("http://localhost/"));

    expect(res.headers.get("location")).toBeNull();
  });

  it("con sesión y /login: redirige al shell", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await proxy(new NextRequest("http://localhost/login"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });
});
