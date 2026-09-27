import { describe, expect, it } from "vitest";
import { aplicarNivelesConfirmados, parsearNivelesConfirmados } from "./niveles-confirmados";
import type { ServicioLeido } from "./linea";

// Spec M1-04b §3 #5: niveles confirmados por el owner para las líneas sin
// etiqueta, como datos (data/niveles-confirmados.csv), no como código.
// Incluye líneas de un nivel NO ofrecido (ej. "Green + Dann Inn": Budget
// Hotel dado de baja en los combinados, owner 2026-09-27).

const CSV =
  "producto,texto_linea,nivel,ofrecido,nota\n" +
  'OD010B,"Accommodation: Taroba Hotel 3* sup/4. Booking Supplier: Taroba",Hotel 4*,si,owner 2026-09-27\n' +
  'OD010C,"Accommodation 2 Nights Beer + 1 night Bambu. Booking Supplier Beer + Bambu",Hostel,si,\n' +
  "OD010C,Green + Dann Inn,Budget Hotel,no,Resto obsoleto\n";

function alojamiento(descripcion: string, nivel: string | null, fila: number, sp = "X"): ServicioLeido {
  return {
    tipo: "alojamiento",
    descripcion,
    noches: null,
    nivel,
    fila,
    opciones: [{ prioridad: 1, serviceProvider: sp, bookingSupplier: sp }],
  };
}

describe("parsearNivelesConfirmados", () => {
  it("lee producto, texto de la línea, nivel y si se ofrece", () => {
    expect(parsearNivelesConfirmados(CSV)).toEqual([
      {
        producto: "OD010B",
        texto_linea: "Accommodation: Taroba Hotel 3* sup/4. Booking Supplier: Taroba",
        nivel: "Hotel 4*",
        ofrecido: true,
      },
      {
        producto: "OD010C",
        texto_linea: "Accommodation 2 Nights Beer + 1 night Bambu. Booking Supplier Beer + Bambu",
        nivel: "Hostel",
        ofrecido: true,
      },
      { producto: "OD010C", texto_linea: "Green + Dann Inn", nivel: "Budget Hotel", ofrecido: false },
    ]);
  });

  it("nivel vacío → error (un nivel sin confirmar no va en esta lista)", () => {
    expect(() =>
      parsearNivelesConfirmados("producto,texto_linea,nivel,ofrecido\nOD010B,Accommodation: Dann Inn Foz,,si\n"),
    ).toThrow(/fila 2/);
  });

  it("ofrecido distinto de si/no → error", () => {
    expect(() => parsearNivelesConfirmados("producto,texto_linea,nivel,ofrecido\nOD010B,X,Hostel,quizas\n")).toThrow(
      /fila 2.*ofrecido/,
    );
  });
});

describe("aplicarNivelesConfirmados", () => {
  const confirmados = parsearNivelesConfirmados(CSV);

  it("pone el nivel a la línea sin etiqueta de ese producto (los 2 tramos '+' de la línea)", () => {
    const linea = "Accommodation 2 Nights Beer + 1 night Bambu. Booking Supplier Beer + Bambu";
    const r = aplicarNivelesConfirmados(
      "OD010C",
      { servicios: [alojamiento(linea, null, 5, "Beer"), alojamiento(linea, null, 5, "Bambu")], dudosas: [] },
      confirmados,
    );
    expect(r.servicios.map((s) => s.nivel)).toEqual(["Hostel", "Hostel"]);
    expect(r.usados.map((c) => c.nivel)).toEqual(["Hostel"]);
  });

  it("compara el texto normalizado (espacios y mayúsculas)", () => {
    const r = aplicarNivelesConfirmados(
      "OD010B",
      { servicios: [alojamiento("accommodation:  Taroba Hotel 3* sup/4.  Booking Supplier: Taroba", null, 16)], dudosas: [] },
      confirmados,
    );
    expect(r.servicios[0].nivel).toBe("Hotel 4*");
  });

  it("no toca líneas de otro producto, ni líneas que ya escriben su nivel, ni lo que no es alojamiento", () => {
    const linea = "Accommodation: Taroba Hotel 3* sup/4. Booking Supplier: Taroba";
    const r = aplicarNivelesConfirmados(
      "OD010B",
      {
        servicios: [
          alojamiento("Accommodation: Dann Inn Foz. Booking Supplier: Nacional Inn", null, 10),
          alojamiento(linea, "Hotel 3*", 16),
          { ...alojamiento(linea, null, 17), tipo: "excursion" },
        ],
        dudosas: [],
      },
      confirmados,
    );
    expect(r.servicios.map((s) => s.nivel)).toEqual([null, "Hotel 3*", null]);
    const otro = aplicarNivelesConfirmados("OD010A", { servicios: [alojamiento(linea, null, 16)], dudosas: [] }, confirmados);
    expect(otro.servicios[0].nivel).toBeNull();
  });

  it("nivel no ofrecido: su línea (dudosa o servicio) se descarta y el nivel se informa como no ofrecido", () => {
    const r = aplicarNivelesConfirmados(
      "OD010C",
      {
        servicios: [alojamiento("Green + Dann Inn", null, 9)],
        dudosas: [
          { fila: 9, texto: "Green  + Dann Inn", motivo: "no calza" },
          { fila: 21, texto: "Extra glamping x pax", motivo: "no calza" },
        ],
      },
      confirmados,
    );
    expect(r.servicios).toEqual([]);
    expect(r.dudosas.map((d) => d.texto)).toEqual(["Extra glamping x pax"]);
    expect(r.nivelesNoOfrecidos).toEqual(["Budget Hotel"]);
  });

  it("los confirmados del producto que no encontraron su línea se pueden reportar", () => {
    const r = aplicarNivelesConfirmados("OD010B", { servicios: [], dudosas: [] }, confirmados);
    expect(r.usados).toEqual([]);
    expect(confirmados.filter((c) => c.producto === "OD010B" && !r.usados.includes(c))).toHaveLength(1);
  });
});
