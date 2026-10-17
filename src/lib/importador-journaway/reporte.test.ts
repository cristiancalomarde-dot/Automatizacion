import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { crearIndiceProveedores } from "@/lib/importador-productos/proveedores";
import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { ARCHIVOS_JOURNAWAY, hayPlanillaJournaway, leerInsumosJournaway } from "./insumos";
import { planificarJournaway } from "./plan";
import { reporteJournawayMarkdown } from "./reporte";

// Spec M2-08 §3 #12: el reporte para el owner, en llano.

const RAIZ = resolve(__dirname, "..", "..", "..");

(hayPlanillaJournaway(RAIZ) ? describe : describe.skip)("reporteJournawayMarkdown", () => {
  const insumos = leerInsumosJournaway(RAIZ);
  const nombres = [...new Set(insumos.proveedores.filter((p) => p.modo === "alias").map((p) => p.proveedor))].filter(
    (n) => n !== "Cuenca del Plata, mail general",
  );
  const directorio = nombres.map((n) => ({ id: `id:${n}`, nombre: n, nombre_normalizado: normalizarNombre(n), mails: [`${n.split(" ")[0].toLowerCase()}@mail.com`], canal: "mail" }));
  const plan = planificarJournaway({ ...insumos, indice: crearIndiceProveedores(directorio) });
  const md = reporteJournawayMarkdown({
    fecha: "2026-10-17",
    plan,
    proveedores: new Map(directorio.map((d) => [d.id, d])),
    filasProveedores: insumos.proveedores,
  });
  const seccion = (titulo: string) => md.split("\n## ").find((s) => s.startsWith(titulo)) ?? "";

  it("cuenta los productos por destino", () => {
    expect(md).toMatch(/53 productos/);
    expect(seccion("Cuántos productos por destino")).toContain("| San Pedro de Atacama | 15 |");
    expect(seccion("Cuántos productos por destino")).toContain("| Isla de Pascua | 12 |");
  });

  it("lista los que no se venden sueltos a Journaway (los 8 sin color y el Overland interno)", () => {
    const s = seccion("Lo que no se vende suelto");
    for (const c of ["SPAT01", "SPAE01", "SPAE02", "SPAE03", "SPAE04", "SPAE06", "SPAE07", "SPAT02", "UYUO01"]) expect(s).toContain(c);
    expect(s).not.toContain("SPAE05");
  });

  it("dice a quién se le pide cada uno, con el mail", () => {
    const s = seccion("A quién se le pide cada uno");
    expect(s).toMatch(/FTEE03.*Nativo Experience, proveedor: Patagonia Profunda.*nativo@mail\.com/);
    expect(s).toMatch(/BUS02.*a mano en Plataforma10.*si no hay lugar.*Patagonia planet/i);
  });

  it("IGRP02, IGRT01 e IGRE03 sin proveedor, con el pedido concreto de qué fila agregar", () => {
    const s = seccion("Falta el proveedor");
    for (const c of ["IGRP02", "IGRT01", "IGRE03"]) expect(s).toContain(c);
    expect(s).toMatch(/Agregar .*fila .*«Cuenca del Plata, mail general»/);
    expect(s).toContain("reservas8@cuencadelplata.com");
  });

  it("lista los manuales (Plataforma10 y Transvip) y los nombres por producto, con los que no tienen nombre de mail", () => {
    expect(seccion("Lo que se hace a mano")).toMatch(/Plataforma10.*BUS02.*BUS03/);
    expect(seccion("Lo que se hace a mano")).toMatch(/Transvip.*SPAT01/);
    const nombres = seccion("Los nombres de Journaway");
    expect(nombres).toContain("San Pedro de Atacama: Tour through the Moon Valley");
    expect(nombres).toMatch(/Sin ningún nombre de mail todavía[\s\S]*FTEE01/);
    expect(nombres.split("Sin ningún nombre de mail todavía")[1]).not.toContain("SPAE03");
  });

  it("los armados, parte por parte con su día", () => {
    expect(seccion("Los paquetes armados")).toMatch(/SPAP05[\s\S]*Día 5: Transfer San Pedro - Hito Cajon regular/);
    expect(seccion("Los paquetes armados")).toMatch(/solo la llegada/);
  });

  it("sin jerga ni rutas de archivos", () => {
    for (const x of ["data/", ".csv", ".xlsx", "codigo_externo", "producto_servicio", "Insumos", "sin_resolver", "null"]) {
      expect(md, x).not.toContain(x);
    }
    expect(existsSync(resolve(RAIZ, ARCHIVOS_JOURNAWAY.nombres))).toBe(true);
    expect(readFileSync(resolve(RAIZ, ARCHIVOS_JOURNAWAY.nombres), "utf-8")).toContain("SPAE03");
  });
});
