import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec M3-02: la pantalla de pedidos no escribe en la base por su cuenta (lo
// hacen las server actions con la sesión, RLS #1) y en esta pieza nada manda
// un mail (#4: el envío lo conecta M3-03).

const RAIZ = join(__dirname, "..", "..");
const PANTALLA = readdirSync(__dirname)
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => join(__dirname, f));
const SERVIDOR = [
  join(RAIZ, "app", "(app)", "reservas", "[id]", "pedidos", "acciones.ts"),
  join(RAIZ, "app", "(app)", "reservas", "[id]", "pedidos", "page.tsx"),
  join(RAIZ, "lib", "pedidos", "revision.ts"),
  join(RAIZ, "lib", "pedidos", "pantalla.ts"),
];

describe("pantalla de pedidos: sin escrituras sueltas ni envío (M3-02)", () => {
  it.each(PANTALLA)("%s solo llama a las acciones", (archivo) => {
    const codigo = readFileSync(archivo, "utf-8");
    for (const prohibido of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(", "createSupabaseBrowserClient"]) {
      expect(codigo, `${archivo} usa ${prohibido}`).not.toContain(prohibido);
    }
    expect(codigo).not.toMatch(/supabase\/admin|SERVICE_ROLE|dangerouslySetInnerHTML/);
  });

  it.each([...PANTALLA, ...SERVIDOR])("%s no manda mails", (archivo) => {
    const codigo = readFileSync(archivo, "utf-8");
    expect(codigo).not.toMatch(/nodemailer|smtp|imapflow|sendMail/i);
    expect(codigo).not.toMatch(/supabase\/admin|SERVICE_ROLE_KEY/);
  });
});
