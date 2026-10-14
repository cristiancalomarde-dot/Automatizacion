import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec M2-05 #14, #13 y #2: las pantallas de reservas solo leen. Ninguna
// escritura a la base, ningún HTML del mail interpretado como página y nada
// de la clave de servicio en el navegador.
//
// `src/lib/reservas/` también tiene el guardado de M2-01 a M2-04 (que corre
// en el servidor, no en estas pantallas): se revisa lo que usan las
// pantallas, `consultas.ts` y `reglas.ts`, más la carpeta de componentes.
//
// M2-06 fila 13: la única escritura es la marca del owner sobre una reserva
// de prueba, por la server action `app/(app)/reservas/[id]/acciones.ts` (con
// la sesión y RLS); los componentes solo la llaman.

const RAIZ = join(__dirname, "..", "..");
const COMPONENTES = join(RAIZ, "components", "reservas");
const ARCHIVOS = [
  ...readdirSync(COMPONENTES)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => join(COMPONENTES, f)),
  join(RAIZ, "lib", "reservas", "consultas.ts"),
  join(RAIZ, "lib", "reservas", "reglas.ts"),
  join(RAIZ, "app", "(app)", "reservas", "page.tsx"),
  join(RAIZ, "app", "(app)", "reservas", "[id]", "page.tsx"),
];

describe("pantallas de reservas: solo lectura (#14)", () => {
  it("hay pantallas para revisar", () => {
    expect(ARCHIVOS.filter((f) => f.endsWith(".tsx")).length).toBeGreaterThanOrEqual(4);
  });

  it.each(ARCHIVOS)("%s no escribe en la base ni interpreta HTML", (archivo) => {
    const codigo = readFileSync(archivo, "utf-8");
    for (const prohibido of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(", ".upload(", ".remove("]) {
      expect(codigo, `${archivo} usa ${prohibido}`).not.toContain(prohibido);
    }
    expect(codigo).not.toContain("dangerouslySetInnerHTML");
    expect(codigo).not.toMatch(/supabase\/admin|SERVICE_ROLE/);
    expect(codigo).not.toMatch(/reservas\/guardar|procesar-mail/);
  });
});
