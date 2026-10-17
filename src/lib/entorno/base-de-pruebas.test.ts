import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asegurarBaseDePruebas, cargarEntornoDePruebas, refDelProyecto, REF_BASE_REAL } from "./base-de-pruebas";

const REAL = `https://${REF_BASE_REAL}.supabase.co`;

describe("base de pruebas separada (DECISIONS 2026-10-14)", () => {
  it("saca el ref del proyecto de la URL", () => {
    expect(refDelProyecto("https://abcd1234.supabase.co")).toBe("abcd1234");
    expect(refDelProyecto("https://abcd1234.supabase.co/rest/v1")).toBe("abcd1234");
    expect(refDelProyecto(undefined)).toBeNull();
  });

  it("frena con un mensaje claro si la URL es la de la base real", () => {
    expect(() => asegurarBaseDePruebas({ NEXT_PUBLIC_SUPABASE_URL: REAL })).toThrow(/base REAL/);
    expect(() => asegurarBaseDePruebas({ NEXT_PUBLIC_SUPABASE_URL: "https://otra.supabase.co" })).not.toThrow();
    expect(() => asegurarBaseDePruebas({})).toThrow(/falta/i);
  });

  it(".env.pruebas.local manda sobre .env.local (Supabase), y lo demás sale de .env.local", () => {
    const dir = mkdtempSync(join(tmpdir(), "entorno-"));
    writeFileSync(join(dir, ".env.local"), `NEXT_PUBLIC_SUPABASE_URL=${REAL}\nSUPABASE_SERVICE_ROLE_KEY=real\nANTHROPIC_API_KEY=ia\n`);
    writeFileSync(join(dir, ".env.pruebas.local"), "NEXT_PUBLIC_SUPABASE_URL=https://prueba.supabase.co/rest/v1\r\nSUPABASE_SERVICE_ROLE_KEY=prueba\r\n");
    const env: Record<string, string | undefined> = {};
    expect(cargarEntornoDePruebas(dir, env)).toBe(true);
    expect(env).toMatchObject({ NEXT_PUBLIC_SUPABASE_URL: "https://prueba.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "prueba", ANTHROPIC_API_KEY: "ia" });
  });

  it("sin .env.pruebas.local queda lo de .env.local (y la guarda frena)", () => {
    const dir = mkdtempSync(join(tmpdir(), "entorno-"));
    writeFileSync(join(dir, ".env.local"), `NEXT_PUBLIC_SUPABASE_URL=${REAL}\n`);
    const env: Record<string, string | undefined> = {};
    expect(cargarEntornoDePruebas(dir, env)).toBe(false);
    expect(() => asegurarBaseDePruebas(env)).toThrow(/base REAL/);
  });
});
