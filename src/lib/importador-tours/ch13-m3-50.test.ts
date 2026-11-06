import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { leerCodigosKilroy } from "@/lib/reservas/emparejar/codigos-kilroy";
import { armarTour, type PaqueteConocido, type TourArmado } from "./armado";
import { TOURS_PILOTO } from "./importar";
import { hayInsumosTours, leerInsumosTours } from "./insumos";
import { nochesBasePaquete } from "./noches-base";
import { leerTourRutas } from "./rutas";
import { leerItinerario } from "./word";

// Spec M3-50: CH13 (Santiago y Valparaíso) con OD029 y COMPCH01, que ya están cargados,
// y el Excel y el Word reales de Insumos/ (no están en Git).

const RAIZ = process.cwd();
const dato = (archivo: string) => readFileSync(resolve(RAIZ, "data", archivo), "utf-8");

describe("M3-50 punto 1 — CH13 entra de verdad", () => {
  it("CH13 está en TOURS_PILOTO", () => {
    expect(TOURS_PILOTO).toContain("CH13");
  });

  it("el código Kilroy de CH13 lleva a CH13", () => {
    const fila = leerCodigosKilroy(dato("codigos-kilroy.csv")).find((f) => f.codigoKilroy === "HI_TRAVEL_CH13-677")!;
    expect(fila.codigoHiTravel).toBe("CH13");
  });
});

describe.skipIf(!hayInsumosTours(RAIZ))("M3-50 punto 2 — CH13 se arma con los archivos reales", () => {
  it("armado, 4 noches: OD029 día 1 con la llegada y COMPCH01 día 3, sin traslado de salida (data/transfers-tour.csv)", () => {
    const insumos = leerInsumosTours(RAIZ);
    const paquetes = new Map<string, PaqueteConocido>(
      insumos.paquetesPiloto.map((p) => [
        p.codigo,
        { ...p, nochesBase: nochesBasePaquete(insumos.filasPaquetes, p.codigo), cubrePuntas: true, rutasPropias: [] },
      ]),
    );
    const excel = leerTourRutas(insumos.filasRutas, "CH13");
    const doc = insumos.words.map((w) => leerItinerario(w.parrafos, "CH13")).find(Boolean) ?? null;
    const t: TourArmado = armarTour({
      codigo: "CH13",
      excel,
      word: doc,
      paquetes,
      codigosTour: new Set(TOURS_PILOTO),
      tours: new Map(),
      tramosConProveedor: insumos.tramosConProveedor,
      incluidosTour: insumos.incluidosTour,
      excepcionesTransfer: insumos.excepcionesTransfer,
    });
    if (t.estado !== "armado") throw new Error(`para revisar: ${t.motivos.join(" | ")}`);
    expect(t.noches).toBe(4);
    expect(t.componentes.map((c) => `${c.codigo} d${c.diaDesde} ${c.noches}n${c.transferIn ? " IN" : ""}${c.transferOut ? " OUT" : ""}`)).toEqual([
      "OD029 d1 2n IN",
      "COMPCH01 d3 2n",
    ]);
  });
});
