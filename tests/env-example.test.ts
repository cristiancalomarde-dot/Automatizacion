import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Spec M1-01 #9: ".env.example en el repo con los nombres de las variables
// ... sin valores reales." La consigna del owner (todavía no existen las
// cuentas reales) pide placeholders explícitos `<PENDIENTE>` en vez de string
// vacío — este test comprueba esa forma en vez de "" literal.
const RUTA = resolve(__dirname, "..", ".env.example");

const VARIABLES_ESPERADAS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
];

describe(".env.example", () => {
  const contenido = readFileSync(RUTA, "utf-8");

  it("define cada variable que necesita esta pieza", () => {
    for (const variable of VARIABLES_ESPERADAS) {
      expect(contenido).toMatch(new RegExp(`^${variable}=`, "m"));
    }
  });

  it("ninguna variable tiene un valor real cargado (todas son <PENDIENTE>)", () => {
    const lineasDeValor = contenido
      .split("\n")
      .filter((linea) => !linea.trim().startsWith("#"))
      .filter((linea) => linea.includes("="));

    expect(lineasDeValor.length).toBeGreaterThan(0);

    for (const linea of lineasDeValor) {
      const valor = linea.split("=")[1]?.trim();
      expect(valor).toBe("<PENDIENTE>");
    }
  });
});
