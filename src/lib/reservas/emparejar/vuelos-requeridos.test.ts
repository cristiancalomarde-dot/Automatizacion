import { describe, expect, it } from "vitest";
import { detalleDePrueba, fichaDePrueba } from "./__fixtures__/cargar";
import { saleDePuertoNatales } from "./componentes";
import { motivosDeVuelos } from "./vuelos-requeridos";

/**
 * Spec M2-03 filas 10, 11 y 12: qué vuelos pide cada reserva, a partir de los
 * traslados que se van a pedir (catálogo real, con los ajustes de M1-08).
 */

function motivos(codigo: string, nombreFicha: string, cambios: Parameters<typeof fichaDePrueba>[1] = {}, indice = 0) {
  const ficha = fichaDePrueba(nombreFicha, cambios);
  return motivosDeVuelos(detalleDePrueba(codigo), {
    vuelos: ficha.vuelos,
    pedidos: ficha.pedidos_especiales.map((p) => p.texto),
    producto: ficha.productos[indice],
    finalPuertoNatales: saleDePuertoNatales(ficha),
  });
}

const llegadaCJC = { numero: "LA148", origen: "SCL", destino: "CJC", fecha_llegada: "2026-09-13", hora_llegada: "16:11" };

describe("M2-03 fila 11 — traslado sin vuelo → para revisión", () => {
  it("Kilroy CHB31 DK1547743: falta el vuelo de llegada a Calama para el traslado de OD030", () => {
    expect(motivos("CHB31", "kilroy-chb31-dk1547743")).toEqual([
      "Falta el vuelo de llegada a Calama (CJC) para el traslado de OD030",
    ]);
  });

  it("con el vuelo de llegada a CJC (número y horario) no falta nada", () => {
    expect(motivos("CHB31", "kilroy-chb31-dk1547743", { vuelos: [llegadaCJC] })).toEqual([]);
  });

  it("un vuelo a CJC sin horario no alcanza", () => {
    expect(motivos("CHB31", "kilroy-chb31-dk1547743", { vuelos: [{ ...llegadaCJC, hora_llegada: null }] })).toHaveLength(1);
  });

  it("un vuelo a otro aeropuerto no cuenta", () => {
    expect(motivos("CHB31", "kilroy-chb31-dk1547743", { vuelos: [{ ...llegadaCJC, destino: "SCL" }] })).toHaveLength(1);
  });

  it("DK1576932 TOUR 1 (ARCH33): faltan el de llegada a El Calafate y el de salida de Puerto Natales", () => {
    const m = motivos("ARCH33", "kilroy-dk1576932");
    expect(m).toEqual([
      "Falta el vuelo de llegada a El Calafate (FTE) para el traslado de OD033",
      "Falta el vuelo de salida de Puerto Natales (PNT) para el traslado al aeropuerto de Puerto Natales",
    ]);
  });

  it("no debe pasar: pedir vuelo para el traslado de llegada de OD016 dentro de ARCH31 (se llega en bus)", () => {
    const m = motivos("ARCH31", "kilroy-arch31-no1569851");
    expect(m).toEqual(["Falta el vuelo de llegada a El Calafate (FTE) para el traslado de OD033"]);
    expect(m.join(" ")).not.toContain("OD016");
    expect(m.join(" ")).not.toContain("OD017");
  });

  it("BOCHI04R: el traslado de OD030 es de salida (invertido): pide el vuelo de salida de CJC", () => {
    expect(motivos("BOCHI04R", "kilroy-bochi04r-dk1559523")).toEqual([
      "Falta el vuelo de salida de Calama (CJC) para el traslado de OD030",
    ]);
  });

  it("5C01: solo la llegada a Río; La Paz se llega en bus (traslado desde la terminal)", () => {
    expect(motivos("5C01", "kilroy-5c01-uk1586142")).toEqual([
      "Falta el vuelo de llegada a Río de Janeiro (GIG) para el traslado de OD032",
    ]);
  });

  it("Iguazú (OD010D) no tiene traslados propios: no pide vuelos", () => {
    expect(motivos("OD010D", "kilroy-od010d-dk1564627", { vuelos: [] })).toEqual([]);
  });

  it("un paquete solo con traslado de llegada pide el vuelo de llegada (OD016)", () => {
    expect(motivos("OD016", "kilroy-od010d-dk1564627", { vuelos: [] })).toEqual([
      "Falta el vuelo de llegada a El Calafate (FTE) para el traslado de OD016",
    ]);
  });
});

describe("M2-03 fila 10 — final de ARCH31 y ARCH33", () => {
  it("se sale de Puerto Natales si lo dice el mail (inglés o castellano) o si hay un vuelo desde PNT", () => {
    expect(saleDePuertoNatales(fichaDePrueba("kilroy-dk1576932"))).toBe(true);
    expect(
      saleDePuertoNatales(fichaDePrueba("kilroy-arch31-no1569851", { pedidos: ["Los vuelos de los clientes después del tour salen de Puerto Natales."] })),
    ).toBe(true);
    expect(
      saleDePuertoNatales(fichaDePrueba("kilroy-arch31-no1569851", { vuelos: [{ numero: "LA290", origen: "PNT", destino: "SCL" }] })),
    ).toBe(true);
    expect(saleDePuertoNatales(fichaDePrueba("kilroy-arch31-no1569851"))).toBe(false);
    expect(saleDePuertoNatales(fichaDePrueba("kilroy-arch31-no1569851", { pedidos: ["Vegetarian food in Puerto Natales"] }))).toBe(
      false,
    );
  });

  it("ARCH31 con vuelo de salida desde PNT: pide ese vuelo y queda satisfecho", () => {
    const m = motivos("ARCH31", "kilroy-arch31-no1569851", {
      vuelos: [
        { numero: "AR1234", origen: "AEP", destino: "FTE", fecha_llegada: "2027-03-01", hora_llegada: "10:00" },
        { numero: "LA290", origen: "PNT", destino: "SCL", fecha_salida: "2027-03-09", hora_salida: "12:00" },
      ],
    });
    expect(m).toEqual([]);
  });
});

describe("M2-03 fila 12 — OD019 vendido solo", () => {
  it("si el mail no dice la variante: Elegir la variante de OD019", () => {
    expect(motivos("OD019", "kilroy-od019-solo")).toEqual(["Elegir la variante de OD019 (con o sin traslados)"]);
  });

  it("si el mail dice SIN traslados, no pide nada", () => {
    expect(motivos("OD019", "kilroy-od019-solo", { pedidos: ["Without transfers, please"] })).toEqual([]);
  });

  it("si el mail dice CON traslados, pide los vuelos de Mendoza", () => {
    expect(motivos("OD019", "kilroy-od019-solo", { pedidos: ["With transfers"] })).toEqual([
      "Falta el vuelo de llegada a Mendoza (MDZ) para el traslado de OD019",
      "Falta el vuelo de salida de Mendoza (MDZ) para el traslado de OD019",
    ]);
  });

  it("dentro de un tour el traslado de OD019 está anulado: no pide la variante", () => {
    expect(motivos("BRARCH26", "kilroy-5c01-uk1586142").join(" ")).not.toContain("OD019");
  });
});
