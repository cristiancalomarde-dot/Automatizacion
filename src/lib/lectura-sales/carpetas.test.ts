import { describe, expect, it } from "vitest";
import { carpetaInbox, carpetaSpam } from "./carpetas";

const c = (path: string, atributos: string[] = []) => ({ path, atributos });

describe("carpetaSpam (criterios #2 y #3)", () => {
  it("primero la marcada \Junk, aunque tenga otro nombre", () => {
    expect(carpetaSpam([c("INBOX"), c("INBOX.Spam"), c("Correo no deseado", ["\\Junk"])])).toBe("Correo no deseado");
  });
  it("sin marca, la que tiene spam o junk en el nombre", () => {
    expect(carpetaSpam([c("INBOX"), c("INBOX.Spam")])).toBe("INBOX.Spam");
    expect(carpetaSpam([c("INBOX"), c("Junk")])).toBe("Junk");
    expect(carpetaSpam([c("INBOX"), c("INBOX.Junk")])).toBe("INBOX.Junk");
    expect(carpetaSpam([c("INBOX"), c("INBOX.spam"), c("INBOX.Promociones")])).toBe("INBOX.spam");
  });
  it("si no hay ninguna, null", () => {
    expect(carpetaSpam([c("INBOX"), c("INBOX.Promociones"), c("Trash")])).toBeNull();
  });
  it("una carpeta que no se puede abrir no cuenta", () => {
    expect(carpetaSpam([c("INBOX"), c("Spam", ["\\Noselect"])])).toBeNull();
  });
});

describe("carpetaInbox", () => {
  it("la INBOX, sin importar mayúsculas", () => {
    expect(carpetaInbox([c("Trash"), c("Inbox")])).toBe("Inbox");
    expect(carpetaInbox([c("Trash")])).toBe("INBOX");
  });
});
