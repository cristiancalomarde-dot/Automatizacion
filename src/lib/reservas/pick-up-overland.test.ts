import { describe, expect, it } from "vitest";
import { esHotelDelOverland, hotelEnSanPedro, hotelEnSanPedroAConfirmar, partesConElPickUpDelOverland } from "./pick-up-overland";

describe("M3-41: el pick up del Overland es el hotel de San Pedro", () => {
  it("los Tayka son hoteles del Overland, no un pick up", () => {
    expect(esHotelDelOverland("Tayka del Desierto Hotel")).toBe(true);
    expect(esHotelDelOverland("Tayka del Desierto Hotel / Tayka del Sal Hotel")).toBe(true);
    expect(esHotelDelOverland("Our Habitas Atacama")).toBe(false);
    expect(esHotelDelOverland(null)).toBe(false);
  });

  it("el pick up de lo de San Pedro (el último hasta el día del Overland)", () => {
    const pickUps = [
      { pickUp: "Hub Providencia", fecha: "2026-10-08" },
      { pickUp: "Our Habitas Atacama", fecha: "2026-10-14" },
      { pickUp: "Tayka del Desierto Hotel", fecha: "2026-10-15" },
      { pickUp: "Otro después", fecha: "2026-10-20" },
    ];
    expect(hotelEnSanPedro("2026-10-15", pickUps)).toBe("Our Habitas Atacama");
  });

  it("si no, el hotel de la agencia de la noche anterior", () => {
    const hoteles = [
      { nombre: "Hub Providencia", desde: "2026-10-07", hasta: "2026-10-09" },
      { nombre: "Don Raul", desde: "2026-10-11", hasta: "2026-10-15" },
    ];
    expect(hotelEnSanPedro("2026-10-15", [{ pickUp: "Tayka del Desierto Hotel", fecha: "2026-10-15" }], hoteles)).toBe("Don Raul");
  });

  it("no se adivina: sin hotel de San Pedro en la reserva, null", () => {
    expect(hotelEnSanPedro("2027-05-26", [{ pickUp: "Tayka del Desierto Hotel", fecha: "2027-05-26" }, { pickUp: null, fecha: "2027-05-25" }])).toBeNull();
  });

  it("el texto de a confirmar", () => {
    expect(hotelEnSanPedroAConfirmar("Journaway")).toBe("hotel en San Pedro de Atacama a confirmar (lo informa Journaway)");
  });
});

describe("M3-41 #3: las partes del detalle", () => {
  const parte = (codigo: string, nombre: string, fecha: string, pickUp: string | null) => ({ producto: { codigo, nombre }, descripcion: null, fechaInicio: fecha, pickUp });

  it("el Overland toma el hotel de San Pedro; lo demás queda igual (lo guardado no se toca)", () => {
    const partes = [
      parte("SPAE01", "Astrophotography Tour", "2026-10-11", "Our Habitas Atacama"),
      parte("UYUO01", "Overland privado", "2026-10-15", "Tayka del Desierto Hotel / Tayka del Sal Hotel"),
    ];
    const r = partesConElPickUpDelOverland(partes, [], "Journaway");
    expect(r.map((p) => p.pickUp)).toEqual(["Our Habitas Atacama", "Our Habitas Atacama"]);
    expect(partes[1].pickUp).toBe("Tayka del Desierto Hotel / Tayka del Sal Hotel");
  });

  it("sin hotel de San Pedro: a confirmar; un Overland sin Tayka (CHB31) no cambia", () => {
    const petzold = [parte("UYUO01", "Overland privado San Pedro – Uyuni en hoteles Tayka", "2027-05-26", null)];
    expect(partesConElPickUpDelOverland(petzold, [], "Journaway")[0].pickUp).toBe("hotel en San Pedro de Atacama a confirmar (lo informa Journaway)");
    const chb31 = [parte("COMPBO20", "Overland San Pedro de Atacama to Uyuni", "2027-01-21", null)];
    expect(partesConElPickUpDelOverland(chb31, [], "Kilroy")).toEqual(chb31);
  });
});
