import { describe, expect, it } from "vitest";
import { formatearFecha, formatearFechaHora, formatearHora, formatearRango } from "./formato";

describe("formatearFechaHora (marca.md §5)", () => {
  it("DD/MM/AAAA HH:mm en hora local", () => {
    const local = new Date(2026, 2, 5, 9, 7).toISOString();
    expect(formatearFechaHora(local)).toBe("05/03/2026 09:07");
  });
  it("vacío si la fecha no es válida", () => {
    expect(formatearFechaHora("no")).toBe("");
  });
});

describe("fechas del viaje y horas de vuelo (spec M2-05 #2, #10)", () => {
  it("una fecha sin hora sale DD/MM/AAAA, sin correrse de día por la zona horaria", () => {
    expect(formatearFecha("2026-03-12")).toBe("12/03/2026");
    expect(formatearFecha("2026-01-01")).toBe("01/01/2026");
  });

  it("un dato que falta o no es fecha se muestra como —", () => {
    expect(formatearFecha(null)).toBe("—");
    expect(formatearFecha("")).toBe("—");
    expect(formatearFecha("mañana")).toBe("—");
  });

  it("el rango lleva la flecha", () => {
    expect(formatearRango("2026-03-12", "2026-03-15")).toBe("12/03/2026 → 15/03/2026");
    expect(formatearRango("2026-03-12", null)).toBe("12/03/2026 → —");
    expect(formatearRango(null, null)).toBe("—");
  });

  it("la hora de vuelo es la del mail (hora del aeropuerto): no se convierte", () => {
    expect(formatearHora("14:35")).toBe("14:35");
    expect(formatearHora("14:35:00")).toBe("14:35");
    expect(formatearHora("9:05")).toBe("09:05");
    expect(formatearHora(null)).toBe("—");
    expect(formatearHora("a la tarde")).toBe("a la tarde");
  });
});
