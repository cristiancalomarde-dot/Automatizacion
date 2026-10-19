import { describe, expect, it } from "vitest";
import { cargarAvisosDeVuelo } from "../avisos-vuelo";
import type { VueloIA } from "../esquema-ficha";
import { catalogoJournawayDePrueba, productoDePrueba } from "../../../../tests/fixtures/journaway/catalogo";

/**
 * Owner 2026-10-17: SPAP01 + SPAP03 es una sola reserva. Los avisos de vuelo
 * que muestran la lista y el detalle miran todos sus productos, una vez cada
 * lado: la llegada con SPAP01 y la salida con SPAP03.
 */

const vuelo = (numero: string, origen: string, destino: string, fecha: string): VueloIA => ({
  numero,
  aerolinea: "LATAM",
  origen,
  destino,
  fecha_salida: fecha,
  hora_salida: "15:33",
  fecha_llegada: fecha,
  hora_llegada: "17:41",
  confianza: 1,
});

const fila = (vuelos: VueloIA[]) => ({
  id: "r1",
  productoId: productoDePrueba("SPAP01").id,
  otrosProductos: [productoDePrueba("SPAP03").id],
  sinTrasladoDe: "salida" as const,
  estado: "recibida" as const,
  productoTexto: null,
  fechaInicio: "2027-03-16",
  fechaFin: "2027-03-23",
  vuelos,
  pedidos: null,
});

describe("avisos de una reserva con varios productos", () => {
  it("con la llegada y la salida a Calama, ningún aviso", async () => {
    const avisos = await cargarAvisosDeVuelo(catalogoJournawayDePrueba().detalle, [
      fila([vuelo("LA156", "SCL", "CJC", "2027-03-16"), vuelo("LA377", "CJC", "SCL", "2027-03-23")]),
    ]);
    expect(avisos.get("r1")).toEqual([]);
  });

  it("sin el vuelo de salida, un solo aviso (el de SPAP03)", async () => {
    const avisos = await cargarAvisosDeVuelo(catalogoJournawayDePrueba().detalle, [fila([vuelo("LA156", "SCL", "CJC", "2027-03-16")])]);
    expect(avisos.get("r1")).toEqual([expect.stringMatching(/^Falta el vuelo de salida de Calama \(CJC\) para el traslado de SPAT01/)]);
  });
});
