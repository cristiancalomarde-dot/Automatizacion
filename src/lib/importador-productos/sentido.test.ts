import { describe, expect, it } from "vitest";
import { sentidoDelTraslado } from "./sentido";

// Los textos tal como están en el Excel de paquetes (spec M1-08 §3 #1).
describe("sentido de un traslado de paquete (spec M1-08 §3 #1)", () => {
  it.each([
    ["Transfer SCL - accommodation: Booking Supplier: CL Mundo", "llegada"],
    ["SCL - accommodation", "llegada"],
    ["Transfer El Calafate Accommodation - FTE Airport. Booking Supplier: Chalten Travel", "salida"],
    ["El Calafate Accommodation - FTE Airport", "salida"],
    ["Transfer Round Trip: Rumbo Sur.Booking Supplier: Rumbo Sur", "ida_y_vuelta"],
    ["Round Trip: Rumbo Sur", "ida_y_vuelta"],
    ["Transfer Round Trip. Booking Supplier: Chalten Travel", "ida_y_vuelta"],
    ["Round Trip", "ida_y_vuelta"],
    ["Transfer EZE o AEP - Hotel - EZE o AEP. Booking Supplier: Greeters", "ida_y_vuelta"],
    ["EZE o AEP - Hotel - EZE o AEP", "ida_y_vuelta"],
    ["Transfer in CJC - Accommodation in San Pedro de Atacama. Booking Supplier: Transvipp", "llegada"],
    ["in CJC - Accommodation in San Pedro de Atacama", "llegada"],
    ["Transfer GIG - Accommodation in Rio. Booking Supplier: Buzios Transfers / Alex", "llegada"],
    ["Transfer REL - accommodation. Bookinkg Supplier: All Peninsula", "llegada"],
    ["Transfer La Paz Airport - La Paz Accommodation: Booking Supplier: Imperio Inca", "llegada"],
    ["Transfer El Calafate Airport to El Chalten. Booking Supplier: Chalten Travel / Transporte Las Lengas", "llegada"],
    // M1-09: los textos que el owner corrigió en el Excel del 2026-10-10
    ["Transfer FTE Airport - El Calafate Accommodation. Booking Supplier: Chalten Travel", "llegada"],
    ["Optiona Transfer PNT Airport - PNT accommodation if requested.Booking Supplier: Patagonia Planet", "llegada"],
    ["Optional Transfer PNT Airport - PNT accommodation", "llegada"],
  ] as const)("%s → %s", (texto, sentido) => {
    expect(sentidoDelTraslado(texto)).toBe(sentido);
  });

  it("si el texto no dice de dónde a dónde va, queda sin sentido (no se inventa)", () => {
    expect(sentidoDelTraslado("Transfers: Remis Mendoza. Booking Booking Supplier: Remis Mendoza")).toBe("sin_sentido");
    expect(sentidoDelTraslado("Remis Mendoza")).toBe("sin_sentido");
    expect(sentidoDelTraslado("")).toBe("sin_sentido");
  });
});
