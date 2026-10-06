import { describe, expect, it } from "vitest";
import { formatearFechaHora } from "./formato";

describe("formatearFechaHora (marca.md §5)", () => {
  it("DD/MM/AAAA HH:mm en hora local", () => {
    const local = new Date(2026, 2, 5, 9, 7).toISOString();
    expect(formatearFechaHora(local)).toBe("05/03/2026 09:07");
  });
  it("vacío si la fecha no es válida", () => {
    expect(formatearFechaHora("no")).toBe("");
  });
});
