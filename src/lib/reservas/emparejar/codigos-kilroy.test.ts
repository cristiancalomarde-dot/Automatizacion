import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { leerCodigosKilroy, planCargaCodigosKilroy } from "./codigos-kilroy";

/** Spec M2-03 fila 2: `data/codigos-kilroy.csv` y su carga (la parte sin base). */

const CSV = readFileSync(join(process.cwd(), "data", "codigos-kilroy.csv"), "utf-8");
const ENCABEZADO = "codigo_kilroy,codigo_hi_travel,nombre_kilroy,nota";

describe("M2-03 fila 2 — data/codigos-kilroy.csv", () => {
  it("arranca con lo que sabemos por los mails: OVERLAND_7DAYS → CHB31 y W_TREK_ARCH_33 → ARCH33", () => {
    const filas = leerCodigosKilroy(CSV);
    expect(filas).toContainEqual(
      expect.objectContaining({ codigoKilroy: "HI_ARGENTINA_OVERLAND_7DAYS-677", codigoHiTravel: "CHB31" }),
    );
    expect(filas).toContainEqual(
      expect.objectContaining({ codigoKilroy: "HI_ARGENTINA_W_TREK_ARCH_33-677", codigoHiTravel: "ARCH33" }),
    );
    // Nunca el Express (no cargado) ni el OD014.
    expect(filas.map((f) => f.codigoHiTravel)).not.toContain("ARCH33EXP");
  });

  it("owner 2026-10-15 (mails reales del modo prueba): IGUAZU_BR_4DAYS → OD010B y SAN_PEDRO_ATACAMA_4DAYS → OD030", () => {
    const filas = leerCodigosKilroy(CSV);
    expect(filas).toContainEqual(
      expect.objectContaining({ codigoKilroy: "HI_ARGENTINA_IGUAZU_BR_4DAYS-677", codigoHiTravel: "OD010B" }),
    );
    expect(filas).toContainEqual(
      expect.objectContaining({ codigoKilroy: "HI_ARGENTINA_SAN_PEDRO_ATACAMA_4DAYS-677", codigoHiTravel: "OD030" }),
    );
  });

  it("una fila vacía o repetida es un error con su número de fila", () => {
    expect(() => leerCodigosKilroy(`${ENCABEZADO}\n,CHB31,,`)).toThrow(/fila 2/);
    expect(() => leerCodigosKilroy(`${ENCABEZADO}\nX-677,CHB31,,\nX-677,ARCH31,,`)).toThrow(/fila 3.*X-677/);
  });

  it("una fila con ARCH33EXP (no cargado) hace fallar la carga con un mensaje claro y no escribe nada", () => {
    const filas = leerCodigosKilroy(`${ENCABEZADO}\nHI_TRAVEL_ARCH_EXP-677,ARCH33EXP,Trekking Paradise EXPRESS,no cargado`);
    const guardar = vi.fn();
    expect(() => planCargaCodigosKilroy(filas, new Map([["ARCH33", "id-arch33"]]))).toThrow(
      "codigos-kilroy.csv fila 2: el código HI Travel ARCH33EXP no existe en el catálogo (HI_TRAVEL_ARCH_EXP-677). No se cargó nada.",
    );
    expect(guardar).not.toHaveBeenCalled();
  });

  it("el plan de carga es (producto, Kilroy, código, nombre) por fila", () => {
    const filas = leerCodigosKilroy(`${ENCABEZADO}\nHI_ARGENTINA_OVERLAND_7DAYS-677,CHB31,Overland 7 Days,nota`);
    expect(planCargaCodigosKilroy(filas, new Map([["CHB31", "id-chb31"]]))).toEqual([
      { productoId: "id-chb31", agencia: "Kilroy", codigo: "HI_ARGENTINA_OVERLAND_7DAYS-677", nombre: "Overland 7 Days" },
    ]);
  });
});
