import { describe, expect, it } from "vitest";
import { decidirRedireccion, esRutaPublica } from "./proteccion-rutas";

describe("esRutaPublica", () => {
  it("/login y /auth/callback son públicas", () => {
    expect(esRutaPublica("/login")).toBe(true);
    expect(esRutaPublica("/auth/callback")).toBe(true);
  });

  it("cualquier otra ruta no es pública", () => {
    expect(esRutaPublica("/")).toBe(false);
    expect(esRutaPublica("/catalogo")).toBe(false);
  });
});

describe("decidirRedireccion", () => {
  it("sin sesión y ruta protegida: redirige a Login con sesión vencida (spec #6, #7)", () => {
    expect(decidirRedireccion({ pathname: "/", haySesion: false })).toEqual({
      tipo: "redirigir",
      destino: "/login?error=sesion_vencida",
    });
  });

  it("sin sesión y /login: sigue de largo (deja ver el login)", () => {
    expect(decidirRedireccion({ pathname: "/login", haySesion: false })).toEqual({
      tipo: "seguir",
    });
  });

  it("sin sesión y /auth/callback: sigue de largo (el callback todavía no tiene sesión)", () => {
    expect(decidirRedireccion({ pathname: "/auth/callback", haySesion: false })).toEqual({
      tipo: "seguir",
    });
  });

  it("con sesión y ruta protegida: sigue de largo", () => {
    expect(decidirRedireccion({ pathname: "/", haySesion: true })).toEqual({ tipo: "seguir" });
  });

  it("con sesión y /login: redirige al shell", () => {
    expect(decidirRedireccion({ pathname: "/login", haySesion: true })).toEqual({
      tipo: "redirigir",
      destino: "/",
    });
  });
});
