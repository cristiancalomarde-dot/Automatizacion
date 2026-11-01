/**
 * M3-42 (owner, 2026-11-01, tercera ronda de M3-04): los datos que cambian sin tocar el código.
 * #4: el Overland de Imperio Inca (UYUO01) va con pensión completa (data/journaway-internos.csv).
 * #5: los Tayka no ofrecen "con desayuno" en el pedido (data/alojamientos-sin-desayuno.csv).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsearInternos } from "@/lib/importador-journaway/composicion";
import { queEs } from "@/lib/catalogo/reglas";
import { cargarAlojamientosSinDesayuno } from "./cargar";
import { sinDesayuno } from "./formato";
import { nombreLimpio } from "./armar";
import type { Servicio } from "@/lib/catalogo/tipos";

describe("M3-42 #4 — el Overland con pensión completa", () => {
  it("el renglón del Overland (primera línea de su descripción en journaway-internos.csv) lo dice", () => {
    const uyuo01 = parsearInternos(readFileSync("data/journaway-internos.csv", "utf8")).find((p) => p.codigo === "UYUO01")!;
    const overland = uyuo01.servicios.find((s) => s.tipo === "excursion")!;
    const nombre = nombreLimpio(queEs({ tipo: "excursion", descripcion: overland.descripcion, serviceProviderNombre: overland.queEs } as Servicio));
    expect(nombre).toMatch(/^Overland privado San Pedro – Uyuni, .*con pensión completa \(incluye cena y desayuno en los Tayka\)$/);
  });
});

describe("M3-42 #5 — los Tayka sin desayuno", () => {
  const lista = cargarAlojamientosSinDesayuno();
  it.each(["Tayka del Desierto", "Tayka de Sal"])("%s está en la lista, con la nota del owner", (nombre) => {
    expect(sinDesayuno(nombre, lista)).toBe(true);
    expect(lista.find((f) => f.alojamiento === nombre)?.nota).toMatch(/owner 2026-11-01/i);
  });
  it("otro Tayka (un hostel de San Pedro) no", () => {
    expect(sinDesayuno("Tayka Hostel San Pedro", lista)).toBe(false);
  });
});
