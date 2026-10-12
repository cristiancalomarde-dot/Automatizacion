import { describe, expect, it } from "vitest";
import { huellaDelMail, normalizarMessageId } from "./huella";

// Spec M2-01 fila 2: cada mail tiene una huella — su Message-ID normalizado,
// o, si no tiene, un sha256 del remitente, la fecha, el asunto y el cuerpo.

describe("normalizarMessageId", () => {
  it("saca los <> y los espacios, y pasa a minúscula", () => {
    expect(normalizarMessageId(" <ABC.123@Mail.Kilroy.DK> ")).toBe("abc.123@mail.kilroy.dk");
    expect(normalizarMessageId("abc@x")).toBe("abc@x");
  });

  it("vacío o ausente → null", () => {
    expect(normalizarMessageId("")).toBeNull();
    expect(normalizarMessageId("  <>  ")).toBeNull();
    expect(normalizarMessageId(null)).toBeNull();
    expect(normalizarMessageId(undefined)).toBeNull();
  });
});

describe("huellaDelMail", () => {
  const base = {
    remitente: "aarhus@kilroy.dk",
    fecha: "2026-06-16T09:19:00.000Z",
    asunto: "DK1564627 - Iguazu Falls Combined",
    cuerpo: "Hola,\nreserva nueva.",
  };

  it("con Message-ID, la huella es el Message-ID normalizado (el mismo en Inbox y en Spam)", () => {
    expect(huellaDelMail({ ...base, messageId: "<ABC@kilroy.dk>" })).toBe("abc@kilroy.dk");
    expect(huellaDelMail({ ...base, asunto: "otro", messageId: "abc@KILROY.dk" })).toBe("abc@kilroy.dk");
  });

  it("sin Message-ID, un sha256 estable del remitente, la fecha, el asunto y el cuerpo", () => {
    const h = huellaDelMail(base);
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(huellaDelMail({ ...base })).toBe(h);
    expect(huellaDelMail({ ...base, fecha: new Date(base.fecha) })).toBe(h);
    // Mayúsculas del remitente y fin de línea Windows no cambian la huella.
    expect(huellaDelMail({ ...base, remitente: "Aarhus@Kilroy.DK", cuerpo: "Hola,\r\nreserva nueva." })).toBe(h);
  });

  it("dos mails distintos sin Message-ID tienen huellas distintas", () => {
    const h = huellaDelMail(base);
    expect(huellaDelMail({ ...base, cuerpo: "otro cuerpo" })).not.toBe(h);
    expect(huellaDelMail({ ...base, asunto: "otro asunto" })).not.toBe(h);
    expect(huellaDelMail({ ...base, remitente: "oslo@kilroy.no" })).not.toBe(h);
    expect(huellaDelMail({ ...base, fecha: "2026-06-17T09:19:00.000Z" })).not.toBe(h);
    // Los campos no se confunden al concatenarse.
    expect(huellaDelMail({ ...base, asunto: "a", cuerpo: "bc" })).not.toBe(
      huellaDelMail({ ...base, asunto: "ab", cuerpo: "c" }),
    );
  });

  it("acepta fecha, asunto o cuerpo ausentes", () => {
    expect(huellaDelMail({ remitente: "x@kilroy.dk" })).toMatch(/^sha256:/);
  });
});
