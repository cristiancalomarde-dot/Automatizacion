import { describe, expect, it } from "vitest";
import { bookingIdDelAsunto, esCancelacionDeAgencia, normalizarBookingId } from "./booking-id";

// Spec M2-04 fila 2, con los textos reales de Insumos/Mails. Journaway sigue al
// owner (plan M2 §3, 2026-10-13): el booking_id es el "ID" de 11 dígitos del
// asunto; el Trip Number es secundario y no se usa para comparar.

describe("normalizarBookingId — Kilroy y Jysk: país + número", () => {
  it("lo que va después de la / (iniciales) o del - (número de orden) no cuenta", () => {
    expect(normalizarBookingId("DK1594100/maga", "Kilroy")).toBe("DK1594100");
    expect(normalizarBookingId("DK1594100/olha", "Kilroy")).toBe("DK1594100");
    expect(normalizarBookingId("DK1576836-26196085", "Kilroy")).toBe("DK1576836");
    expect(normalizarBookingId("NO1569851/saha", "Kilroy")).toBe("NO1569851");
    expect(normalizarBookingId("UK1586142/fagu", "Kilroy")).toBe("UK1586142");
    expect(normalizarBookingId("dk1234567/abcd", "Jysk")).toBe("DK1234567");
  });
  it("también dentro del texto de la referencia o del asunto", () => {
    expect(normalizarBookingId("KILROY Reference.:DK1594100/maga", "Kilroy")).toBe("DK1594100");
  });
});

describe("normalizarBookingId — TourRadar: el TOURRADAR REFERENCE ID", () => {
  it("es el primer número del Booking Statement; el segundo cambia en cada estado de cuenta", () => {
    expect(normalizarBookingId("Booking Statement 1377598 - 25388222", "TourRadar")).toBe("1377598");
    expect(normalizarBookingId("Booking Statement 1377598 - 25372219 - vendorbill", "TourRadar")).toBe("1377598");
    expect(normalizarBookingId(" 1376833 ", "TourRadar")).toBe("1376833");
    expect(normalizarBookingId("TOURRADAR REFERENCE ID: 1363612", "TourRadar")).toBe("1363612");
  });
  it("'Blanca Roman x1' (el campo HI TRAVEL BOOKING ID) no es un booking_id", () => {
    expect(normalizarBookingId("Blanca Roman x1", "TourRadar")).toBeNull();
  });
});

describe("normalizarBookingId — Journaway: el ID de 11 dígitos", () => {
  it("toma el ID; sin ID no hay booking_id (el Trip Number solo no alcanza)", () => {
    expect(normalizarBookingId("ID 65643802533 · Trip 62992", "Journaway")).toBe("65643802533");
    expect(normalizarBookingId("65676257628", "Journaway")).toBe("65676257628");
    expect(normalizarBookingId("Trip Number: 62992", "Journaway")).toBeNull();
    expect(normalizarBookingId(null, "Journaway")).toBeNull();
  });
});

describe("bookingIdDelAsunto — sin IA, cuando la lectura no lo trajo", () => {
  it("Kilroy: la referencia del asunto, también en '2 NEW BOOKINGS - …'", () => {
    expect(bookingIdDelAsunto("DK1594100/maga - Overland San Pedro … - KILROY booking request", "Kilroy")).toBe(
      "DK1594100",
    );
    expect(bookingIdDelAsunto("2 NEW BOOKINGS - DK1576932/emhe - KILROY booking request", "Kilroy")).toBe("DK1576932");
    expect(bookingIdDelAsunto("NEW FLIGHT: DK1562336 - flights", "Kilroy")).toBe("DK1562336");
  });
  it("TourRadar: el primer número del Booking Statement", () => {
    expect(bookingIdDelAsunto("Booking Statement 1377598 - 25388222 - vendorbill", "TourRadar")).toBe("1377598");
  });
  it("Journaway: el ID del asunto; los mails de Iguazú no lo traen", () => {
    expect(bookingIdDelAsunto("Program Booking / Client Probe / ID 65643802533", "Journaway")).toBe("65643802533");
    expect(bookingIdDelAsunto("de-DE Activity Booking / Client Probe / ID 65676257628", "Journaway")).toBe("65676257628");
    expect(bookingIdDelAsunto("Booking request", "Journaway")).toBeNull();
    expect(bookingIdDelAsunto(null, "Journaway")).toBeNull();
  });
});

describe("esCancelacionDeAgencia — fila 9, sin IA para TourRadar", () => {
  it("vendorcredit en el asunto o 'BOOKING CANCELLATION STATEMENT' en el texto", () => {
    expect(esCancelacionDeAgencia({ asunto: "Booking Statement 1363612 - 25160515 - vendorcredit" })).toBe(true);
    expect(esCancelacionDeAgencia({ asunto: "x", cuerpo: "BOOKING CANCELLATION STATEMENT\n…" })).toBe(true);
    expect(esCancelacionDeAgencia({ asunto: "Booking Statement 1377598 - 25372219 - vendorbill" })).toBe(false);
  });
  it("o la IA dijo que el mail es una cancelación", () => {
    expect(esCancelacionDeAgencia({ asunto: "x", tipoMail: "cancelacion" })).toBe(true);
    expect(esCancelacionDeAgencia({ asunto: "x", tipoMail: "reserva_nueva" })).toBe(false);
  });
});
