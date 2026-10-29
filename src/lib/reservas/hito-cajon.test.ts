import { describe, expect, it } from "vitest";
import { esTrasladoAHitoCajon, incluyeTrasladoAHitoCajon, partesConElTrasladoEnElOverland } from "./hito-cajon";
import type { ParteDeReserva } from "./tipos";

const parte = (orden: number, codigo: string, nombre: string, desde: string, hasta = desde): ParteDeReserva => ({
  orden,
  tipo: "paquete",
  producto: { id: `id-${codigo}`, codigo, nombre },
  descripcion: null,
  fechaInicio: desde,
  fechaFin: hasta,
  esTarea: false,
});

describe("M3-38: el traslado San Pedro → Hito Cajón dentro del Overland", () => {
  it("reconoce el traslado, no el Overland que sale 'desde Hito Cajón'", () => {
    expect(esTrasladoAHitoCajon("Traslado: Transfer San Pedro - Hito Cajon regular")).toBe(true);
    expect(esTrasladoAHitoCajon("Excursión: Overland privado San Pedro – Uyuni, 3 días en jeep 4x4 desde Hito Cajón")).toBe(false);
    expect(esTrasladoAHitoCajon("Transfer in CJC - Accommodation in San Pedro de Atacama")).toBe(false);
  });

  it("el texto: siempre regular, con la fecha de los pedidos", () => {
    expect(incluyeTrasladoAHitoCajon("2027-05-26")).toBe("incluye traslado regular San Pedro → Hito Cajón el 26 may 2027");
    expect(incluyeTrasladoAHitoCajon(null)).toBe("incluye traslado regular San Pedro → Hito Cajón");
  });

  it("las partes de SPAP05: sin SPAT02 suelto; el Overland lo incluye", () => {
    const partes = [
      parte(5, "SPAE04", "El Tatio Geisers Tour (entrance fee)", "2027-05-25"),
      parte(6, "SPAT02", "Transfer San Pedro - Hito Cajon regular", "2027-05-26"),
      parte(7, "UYUO01", "Overland privado San Pedro – Uyuni en hoteles Tayka", "2027-05-26", "2027-05-28"),
    ];
    const r = partesConElTrasladoEnElOverland(partes);
    expect(r.map((p) => p.producto?.codigo)).toEqual(["SPAE04", "UYUO01"]);
    expect(r[1].incluye).toBe("incluye traslado regular San Pedro → Hito Cajón el 26 may 2027");
    expect(r[0].incluye).toBeUndefined();
  });

  it("sin Overland en la reserva, el traslado queda como estaba", () => {
    const partes = [parte(6, "SPAT02", "Transfer San Pedro - Hito Cajon regular", "2027-05-26")];
    expect(partesConElTrasladoEnElOverland(partes)).toEqual(partes);
  });
});
