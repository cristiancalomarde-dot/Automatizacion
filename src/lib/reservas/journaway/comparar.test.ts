import { describe, expect, it } from "vitest";
import { reservaKilroy } from "../fixtures.test-utils";
import type { DetalleReserva } from "../tipos";
import { ESPERADO_JOURNAWAY } from "../../../../tests/fixtures/journaway/esperado";
import { compararJournaway, reporteJournaway } from "./comparar";

/** Spec M2-09 fila 16: el resultado del modo prueba contra la tabla de §3, "esperado X, salió Y". */

const producto = (codigo: string) => ({ id: `id-${codigo}`, codigo, nombre: codigo });
const D = ESPERADO_JOURNAWAY.find((m) => m.letra === "D")!;

const vuelo = (numero: string, origen: string, destino: string, fecha: string, sale: string, llega: string) => ({
  numero,
  aerolinea: "LATAM",
  origen,
  destino,
  fechaSalida: fecha,
  horaSalida: sale,
  fechaLlegada: fecha,
  horaLlegada: llega,
});

function comoSalioD(cambios: Partial<DetalleReserva> = {}): DetalleReserva {
  return {
    ...reservaKilroy,
    agencia: "Journaway",
    estado: "recibida",
    motivos: [],
    producto: producto("SPAP05"),
    pax: 2,
    pasajeros: ["Kai Sacher", "Jeannette Tschorba"],
    tripNumber: null,
    hotelesAgencia: Array.from({ length: 8 }, (_, i) => ({ nombre: `Hotel ${i}`, desde: null, hasta: null })),
    partes: D.reservas[0].partes.map((p, i) => ({
      orden: i + 1,
      tipo: "paquete" as const,
      producto: producto(p.codigo),
      descripcion: null,
      fechaInicio: p.fecha,
      fechaFin: p.fecha,
      esTarea: false,
      pickUp: p.pickUp ?? null,
    })),
    vuelos: ["IB1314", "LA5404", "LA148", "LA2277", "LA2484", "IB1315"].map((n) =>
      n === "LA148" ? vuelo(n, "SCL", "CJC", "2026-10-11", "14:01", "16:11") : vuelo(n, "XXX", "YYY", "2026-10-06", "10:00", "12:00"),
    ),
    avisosVuelo: [],
    ...cambios,
  };
}

describe("compararJournaway", () => {
  it("si todo coincide, no hay diferencias", () => {
    expect(compararJournaway(D, [comoSalioD()])).toEqual({ ok: true, diferencias: [] });
  });

  it("cada diferencia en llano: esperado X, salió Y", () => {
    const r = compararJournaway(D, [
      comoSalioD({
        producto: producto("SPAP06"),
        estado: "para_revision",
        motivos: ["Falta el día 2 del Overland"],
        partes: comoSalioD().partes.map((p) => (p.producto?.codigo === "SPAE01" ? { ...p, pickUp: null } : p)),
        vuelos: comoSalioD().vuelos.filter((v) => v.numero !== "LA148"),
      }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.diferencias).toContain("SPAP05 · Producto: esperado SPAP05, salió SPAP06.");
    expect(r.diferencias).toContain("SPAP05 · Estado: esperado recibida, salió para revisión (Falta el día 2 del Overland).");
    expect(r.diferencias).toContain("SPAP05 · Pick up de SPAE01: esperado Our Habitas Atacama, salió vacío.");
    expect(r.diferencias.some((d) => d.startsWith("SPAP05 · Vuelos: esperado"))).toBe(true);
    expect(r.diferencias.some((d) => d.startsWith("SPAP05 · Traslado de llegada: esperado LA148"))).toBe(true);
  });

  it("una reserva de más o de menos se dice", () => {
    expect(compararJournaway(D, []).diferencias).toEqual(["Reservas: esperado 1 (SPAP05), salieron 0."]);
  });

  it("el reporte no lleva nombres de pasajeros si coinciden", () => {
    const md = reporteJournaway({ fecha: "2026-10-17", base: "pruebas", modelo: "m", gasto: 0.01, mails: [{ esperado: D, reservas: [comoSalioD()], costo: 0.01 }] });
    expect(md).toContain("# M2-09: los 4 mails de Journaway en el modo prueba");
    expect(md).toContain("Coincide con lo esperado");
    expect(md).not.toContain("Kai Sacher");
  });
});
