import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Spec M3-03 (#4 y fila 5): el correo sale de UN solo lugar
// (`src/lib/pedidos/envio/`) y, por IMAP, solo se agrega (APPEND): nada borra,
// mueve, marca ni crea carpetas. La lectura de sales@ (M2-07) sigue siendo la
// única otra que usa imapflow, y es de solo lectura.

const SRC = join(__dirname, "..", "..", "..");
const rel = (f: string) => relative(SRC, f).split(sep).join("/");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) return archivos(f);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [f] : [];
  });
}

const TODOS = archivos(SRC);

describe("el envío de mails vive solo en lib/pedidos/envio (M3-03)", () => {
  it("solo smtp.ts y mensaje.ts usan nodemailer", () => {
    const usan = TODOS.filter((f) => /from "nodemailer/.test(readFileSync(f, "utf-8"))).map(rel);
    expect(usan.sort()).toEqual(["lib/pedidos/envio/mensaje.ts", "lib/pedidos/envio/smtp.ts"]);
  });

  it("imapflow: solo la lectura de sales@ y la copia en Enviados", () => {
    const usan = TODOS.filter((f) => /from "imapflow"/.test(readFileSync(f, "utf-8"))).map(rel);
    expect(usan.sort()).toEqual(["lib/lectura-sales/casilla.ts", "lib/pedidos/envio/enviados.ts"]);
  });

  it("la copia en Enviados solo agrega: ni borra, ni mueve, ni marca, ni crea", () => {
    const codigo = readFileSync(join(__dirname, "enviados.ts"), "utf-8");
    expect(codigo).toContain(".append(");
    for (const prohibido of [
      "messageDelete",
      "messageMove",
      "messageCopy",
      "messageFlags",
      "mailboxCreate",
      "mailboxDelete",
      "mailboxRename",
      "mailboxOpen",
      "getMailboxLock",
      "expunge",
    ]) {
      expect(codigo, prohibido).not.toContain(prohibido);
    }
  });
});
