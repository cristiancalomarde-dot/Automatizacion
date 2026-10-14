import { describe, expect, it } from "vitest";
import { aNumeroDeTest, conNumerosDeTest } from "./numeros-de-test";

describe("números de reserva de test (no chocan con el modo prueba, M2-06)", () => {
  it("Kilroy y TourRadar: el 1 inicial pasa a 9, mismo formato", () => {
    expect(aNumeroDeTest("DK1594100/maga - 3 NEW BOOKINGS")).toBe("DK9594100/maga - 3 NEW BOOKINGS");
    expect(aNumeroDeTest("Booking Statement 1377598 - 25372219 - vendorbill")).toBe("Booking Statement 9377598 - 25372219 - vendorbill");
    expect(aNumeroDeTest("KILROY Reference.:UK1586142/fagu")).toBe("KILROY Reference.:UK9586142/fagu");
    expect(aNumeroDeTest("DK1576836-26196085")).toBe("DK9576836-26196085");
  });

  it("no toca otros números (tour de TourRadar de 6 dígitos, statement de 8, fechas, códigos)", () => {
    const texto = "150146 · 25372219 · 2027-01-18 · HI_ARGENTINA_OD010D-677 · 06 Jan 2027";
    expect(aNumeroDeTest(texto)).toBe(texto);
  });

  it("es idempotente y respeta null", () => {
    expect(aNumeroDeTest(aNumeroDeTest("DK1594100"))).toBe("DK9594100");
    expect(aNumeroDeTest(null)).toBeNull();
  });

  it("copia profunda: cambia los textos y deja los bytes del PDF como estaban", () => {
    const pdf = new Uint8Array([1, 2, 3]);
    const original = { asunto: "DK1594100", ficha: { numero_reserva: { valor: "1363612" } }, lista: ["NO1569851"], pdf };
    const copia = conNumerosDeTest(original);
    expect(copia).toEqual({ asunto: "DK9594100", ficha: { numero_reserva: { valor: "9363612" } }, lista: ["NO9569851"], pdf });
    expect(copia.pdf).toBe(pdf);
    expect(original.asunto).toBe("DK1594100");
  });
});
