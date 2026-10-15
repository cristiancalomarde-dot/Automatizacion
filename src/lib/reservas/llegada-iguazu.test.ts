import { describe, expect, it } from "vitest";
import { esIguazu, sinDatoDeLlegada } from "./llegada-iguazu";

// Owner 2026-10-14 (plan M2 §3): Kilroy suele reservar Iguazú (OD010A–D) sin el
// vuelo de llegada; a veces llegan en bus. La reserva sigue "recibida" con un
// aviso "sin dato de llegada", que se va cuando llega el vuelo o el bus.

const vuelo = (destino: string | null, numero: string | null = "LA4420") => ({ destino, numero });

describe("esIguazu", () => {
  it("OD010A a OD010D, nada más", () => {
    for (const c of ["OD010A", "OD010B", "OD010C", "OD010D"]) expect(esIguazu(c)).toBe(true);
    for (const c of ["OD010", "OD010E", "OD019", "CHB31", "5C01", null]) expect(esIguazu(c)).toBe(false);
  });
});

describe("sinDatoDeLlegada", () => {
  it("Iguazú sin vuelos ni bus: falta el dato", () => {
    expect(sinDatoDeLlegada({ productoCodigo: "OD010D", vuelos: [], pedidos: null })).toBe(true);
    expect(sinDatoDeLlegada({ productoCodigo: "OD010B", vuelos: [], pedidos: "Vegetarian" })).toBe(true);
  });

  it("con un vuelo de llegada a Iguazú (IGR o IGU), o sin aeropuerto escrito, ya está", () => {
    expect(sinDatoDeLlegada({ productoCodigo: "OD010D", vuelos: [vuelo("IGR")], pedidos: null })).toBe(false);
    expect(sinDatoDeLlegada({ productoCodigo: "OD010B", vuelos: [vuelo("igu")], pedidos: null })).toBe(false);
    expect(sinDatoDeLlegada({ productoCodigo: "OD010A", vuelos: [vuelo(null)], pedidos: null })).toBe(false);
  });

  it("un vuelo a otro lado, o sin número, no cuenta", () => {
    expect(sinDatoDeLlegada({ productoCodigo: "OD010D", vuelos: [vuelo("EZE")], pedidos: null })).toBe(true);
    expect(sinDatoDeLlegada({ productoCodigo: "OD010D", vuelos: [vuelo("IGR", null)], pedidos: null })).toBe(true);
  });

  it("si el mail dice que llegan en bus, ya está", () => {
    expect(sinDatoDeLlegada({ productoCodigo: "OD010C", vuelos: [], pedidos: "They arrive by bus from Buenos Aires" })).toBe(false);
    expect(sinDatoDeLlegada({ productoCodigo: "OD010C", vuelos: [], pedidos: "Llegan en ómnibus a la terminal" })).toBe(false);
  });

  it("otro producto nunca lleva el aviso", () => {
    expect(sinDatoDeLlegada({ productoCodigo: "CHB31", vuelos: [], pedidos: null })).toBe(false);
    expect(sinDatoDeLlegada({ productoCodigo: null, vuelos: [], pedidos: null })).toBe(false);
  });
});
