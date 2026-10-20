import { describe, expect, it } from "vitest";
import { renglonDelPasajero } from "./formato";

describe("renglonDelPasajero", () => {
  it("deja siempre el lugar del pasaporte, aunque todavía no haya llegado (owner, 2026-10-20)", () => {
    expect(renglonDelPasajero({ nombre: "Ana", apellido: "Gómez", nacionalidad: "Argentina" }, 0)).toBe(
      "PAX 1: Ana Gómez · Nacionalidad: Argentina · Pasaporte: pendiente",
    );
  });

  it("con pasaporte, va el número", () => {
    expect(renglonDelPasajero({ nombre: "Ana", apellido: "Gómez", pasaporte: "AAA000111" }, 1)).toBe("PAX 2: Ana Gómez · Pasaporte: AAA000111");
  });
});
