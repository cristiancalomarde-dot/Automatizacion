// Spec M2-07 — lo que se comprueba leyendo archivos: #1 (el servidor solo de la
// variable), #4 (un solo cron a las 15:00 UTC), #16 (ningún camino para mandar
// mails) y #22 (.env.example con los nombres, sin valores).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = resolve(__dirname, "..");
const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const r = join(dir, n);
    return statSync(r).isDirectory() ? archivos(r) : [r];
  });

describe("M2-07 en los archivos", () => {
  it("#4: vercel.json tiene exactamente un cron a /api/cron/leer-sales a las 15:00 UTC (12:00 de Argentina)", () => {
    const v = JSON.parse(readFileSync(join(RAIZ, "vercel.json"), "utf-8"));
    expect(v.crons).toEqual([{ path: "/api/cron/leer-sales", schedule: "0 15 * * *" }]);
  });

  it("#1: en src/ y scripts/ no aparece el servidor de Ferozo ni una clave", () => {
    for (const f of [...archivos(join(RAIZ, "src")), ...archivos(join(RAIZ, "scripts"))]) {
      const texto = readFileSync(f, "utf-8");
      expect(texto, f).not.toMatch(/ferozo\.com/i);
      expect(texto, f).not.toMatch(/SALES_IMAP_PASSWORD\s*=\s*["'][^"']+/);
    }
  });

  it("#16: el código de la lectura no importa ninguna librería de envío", () => {
    const propios = [
      ...archivos(join(RAIZ, "src", "lib", "lectura-sales")),
      ...archivos(join(RAIZ, "src", "app", "api", "cron")),
      join(RAIZ, "scripts", "leer-sales.ts"),
    ];
    for (const f of propios) {
      const texto = readFileSync(f, "utf-8");
      expect(texto, f).not.toMatch(/nodemailer|smtp|sendMail|gmail|\.append\(|messageMove|messageDelete|messageFlagsAdd/i);
    }
  });

  it("#22: .env.example nombra las cinco variables, sin valores y con de dónde sale cada una", () => {
    const texto = readFileSync(join(RAIZ, ".env.example"), "utf-8");
    for (const v of ["SALES_IMAP_HOST", "SALES_IMAP_USER", "SALES_IMAP_PASSWORD", "CRON_SECRET", "LECTURA_SALES_ACTIVA"]) {
      expect(texto).toMatch(new RegExp(`^${v}=<PENDIENTE>$`, "m"));
      expect(texto).toMatch(new RegExp(`^# - ${v}`, "m"));
    }
  });
});
