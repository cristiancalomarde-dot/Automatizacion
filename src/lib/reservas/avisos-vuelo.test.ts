import { describe, expect, it, vi } from "vitest";
import { detalleDePrueba } from "./emparejar/__fixtures__/cargar";
import type { VueloIA } from "./esquema-ficha";
import { avisosDeLlegada, avisosDeVuelo, cargarAvisosDeVuelo, esAvisoDeVuelo, separarAvisosDeVuelo } from "./avisos-vuelo";

/**
 * Owner 2026-10-16 (plan M2 §3): "falta el vuelo" deja de mandar a revisión.
 * La reserva queda "recibida" con un aviso concreto, calculado con lo que
 * tiene (producto, vuelos, pedidos y fechas), que se va solo cuando llega el
 * vuelo. Catálogo real (foto), datos de pasajeros inventados.
 */

const vuelo = (v: Partial<VueloIA>): VueloIA => ({
  numero: "LA1234",
  aerolinea: null,
  origen: null,
  destino: null,
  fecha_salida: null,
  hora_salida: null,
  fecha_llegada: null,
  hora_llegada: null,
  confianza: 0.95,
  ...v,
});

const OD030 = { productoTexto: "San Pedro de Atacama Explorer - 4 Days", fechaInicio: "2027-03-07", fechaFin: "2027-03-10", pedidos: null };

describe("avisosDeVuelo", () => {
  it("OD030 sin vuelos: 'Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030'", () => {
    const avisos = avisosDeVuelo(detalleDePrueba("OD030"), { ...OD030, vuelos: [] });
    expect(avisos).toContain("Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030");
    expect(avisos.every(esAvisoDeVuelo)).toBe(true);
  });

  it("con el vuelo de llegada a CJC ese aviso se va", () => {
    const llega = vuelo({ origen: "SCL", destino: "CJC", fecha_llegada: "2027-03-07", hora_llegada: "10:00" });
    expect(avisosDeVuelo(detalleDePrueba("OD030"), { ...OD030, vuelos: [llega] })).not.toContain(
      "Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030",
    );
  });

  it("ARCH33 con 'flights after tour are from Puerto Natales' también pide el de salida de PNT", () => {
    const avisos = avisosDeVuelo(detalleDePrueba("ARCH33"), {
      productoTexto: "Patagonia, Trekking Paradise with W-Trek (12 Days)",
      fechaInicio: "2027-02-23",
      fechaFin: "2027-03-06",
      vuelos: [],
      pedidos: "Flights after tour are from Puerto Natales",
    });
    expect(avisos).toEqual([
      "Falta el vuelo de llegada a El Calafate (FTE) para el traslado de OD033",
      "Falta el vuelo de salida de Puerto Natales (PNT) para el traslado al aeropuerto de Puerto Natales",
    ]);
  });

  it("'elegir la variante' no es un aviso (pide una decisión: sigue siendo motivo de revisión)", () => {
    const avisos = avisosDeVuelo(detalleDePrueba("OD019"), { productoTexto: "Inventado", fechaInicio: "2027-01-01", fechaFin: null, vuelos: [], pedidos: null });
    expect(avisos.some((a) => /variante/i.test(a))).toBe(false);
  });

  it("sin producto no hay aviso", () => {
    expect(avisosDeVuelo(null, { ...OD030, vuelos: [] })).toEqual([]);
  });
});

describe("avisosDeLlegada (owner 2026-10-16: una sola marca 'falta dato de llegada')", () => {
  const IGUAZU = "Falta el vuelo o bus de llegada a Iguazú: pasárselo a Cuenca del Plata cuando llegue.";
  const CJC = "Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030";

  it("junta los vuelos que faltan y el Iguazú sin dato, cada uno con su texto concreto", () => {
    expect(avisosDeLlegada({ avisosVuelo: [CJC], sinDatoLlegada: true })).toEqual([CJC, IGUAZU]);
    expect(avisosDeLlegada({ avisosVuelo: [], sinDatoLlegada: true })).toEqual([IGUAZU]);
    expect(avisosDeLlegada({ avisosVuelo: [CJC], sinDatoLlegada: false })).toEqual([CJC]);
  });

  it("sin nada pendiente, ninguno", () => {
    expect(avisosDeLlegada({ avisosVuelo: [], sinDatoLlegada: false })).toEqual([]);
  });
});

describe("separarAvisosDeVuelo", () => {
  it("los 'Falta el vuelo…' van a avisos; lo demás sigue como motivo", () => {
    expect(
      separarAvisosDeVuelo([
        "Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030",
        "Elegir la variante de OD019 (con o sin traslados)",
      ]),
    ).toEqual({
      avisos: ["Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030"],
      motivos: ["Elegir la variante de OD019 (con o sin traslados)"],
    });
  });
});

describe("cargarAvisosDeVuelo", () => {
  it("carga el detalle una sola vez por producto y devuelve los avisos de cada reserva", async () => {
    const od030 = detalleDePrueba("OD030");
    const detalle = vi.fn(async () => od030);
    const filas = [
      { id: "a", productoId: od030.id, estado: "recibida" as const, ...OD030, vuelos: [] },
      { id: "b", productoId: od030.id, estado: "para_revision" as const, ...OD030, vuelos: [] },
      { id: "c", productoId: null, estado: "recibida" as const, ...OD030, vuelos: [] },
    ];
    const avisos = await cargarAvisosDeVuelo(detalle, filas);
    expect(detalle).toHaveBeenCalledTimes(1);
    expect(avisos.get("a")).toContain("Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030");
    expect(avisos.get("b")).toEqual(avisos.get("a"));
    expect(avisos.get("c")).toEqual([]);
  });

  it("solo en las reservas que todavía se trabajan (recibida o para revisión)", async () => {
    const od030 = detalleDePrueba("OD030");
    const detalle = vi.fn(async () => od030);
    const avisos = await cargarAvisosDeVuelo(detalle, [{ id: "x", productoId: od030.id, estado: "confirmada", ...OD030, vuelos: [] }]);
    expect(avisos.get("x")).toEqual([]);
    expect(detalle).not.toHaveBeenCalled();
  });

  it("si un detalle no se puede cargar, falla (la pantalla muestra el error, nunca datos a medias)", async () => {
    const detalle = vi.fn(async () => {
      throw new Error("Producto no encontrado.");
    });
    await expect(cargarAvisosDeVuelo(detalle, [{ id: "y", productoId: "p-x", estado: "recibida", ...OD030, vuelos: [] }])).rejects.toThrow(
      "Producto no encontrado.",
    );
  });
});
