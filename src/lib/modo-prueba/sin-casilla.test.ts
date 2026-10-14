import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec M2-06 filas 1 y 9 (#4): el modo prueba no se conecta a la casilla
// sales@ ni manda mails. Todo sale de archivos locales.

const RAIZ = join(__dirname, "..", "..", "..");
const ARCHIVOS = [
  ...readdirSync(__dirname)
    .filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
    .map((f) => join(__dirname, f)),
  join(RAIZ, "scripts", "probar-mails.ts"),
];

describe("el modo prueba no toca la casilla", () => {
  it.each(ARCHIVOS)("%s no importa IMAP ni envío de mails, ni lee la clave de sales@", (archivo) => {
    const codigo = readFileSync(archivo, "utf-8");
    expect(codigo).not.toMatch(/from\s+["'](imapflow|node-imap|imap|nodemailer|node:net|node:tls|net|tls|@sendgrid\/[^"']+|resend)["']/);
    expect(codigo).not.toMatch(/SALES_IMAP/);
  });

  it("con una ruta que no existe termina con un mensaje claro (y sin la clave de sales@)", () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("SALES_IMAP")));
    const r = spawnSync("npx", ["tsx", "--conditions=react-server", "scripts/probar-mails.ts", "no-existe-esta-carpeta"], {
      cwd: RAIZ,
      env: { ...env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "x", ANTHROPIC_API_KEY: "x" } as unknown as NodeJS.ProcessEnv,
      encoding: "utf-8",
      shell: true,
      timeout: 120_000,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/No existe .*no-existe-esta-carpeta: no se procesó nada\./);
  }, 130_000);
});
