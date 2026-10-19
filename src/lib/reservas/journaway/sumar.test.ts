import { describe, expect, it } from "vitest";
import { ordenarPorFecha, partesNuevas } from "./sumar";

/** Owner 2026-10-17: un mail con un ID ya cargado suma sus tours, sin duplicar los que ya estaban. */

describe("partesNuevas", () => {
  const existentes = [{ producto_id: "p-igre01", fecha_inicio: "2027-06-14", texto_agencia: "Argentinean side" }];

  it("un tour nuevo se suma; el mismo producto en la misma fecha no se duplica", () => {
    const nuevas = partesNuevas(existentes, [
      { tipo: "paquete", productoId: "p-igre01", fechaInicio: "2027-06-14" },
      { tipo: "paquete", productoId: "p-igre02", fechaInicio: "2027-06-13" },
    ]);
    expect(nuevas.map((p) => p.productoId)).toEqual(["p-igre02"]);
  });

  it("el mismo producto otro día sí se suma; sin producto se compara por el texto de la agencia", () => {
    const nuevas = partesNuevas(existentes, [
      { tipo: "paquete", productoId: "p-igre01", fechaInicio: "2027-06-20" },
      { tipo: "paquete", productoId: null, textoAgencia: "Argentinean side", fechaInicio: "2027-06-14" },
      { tipo: "paquete", productoId: null, textoAgencia: "Moon Crater", fechaInicio: "2027-06-14" },
    ]);
    expect(nuevas.map((p) => p.textoAgencia ?? p.fechaInicio)).toEqual(["2027-06-20", "Moon Crater"]);
  });
});

describe("ordenarPorFecha", () => {
  it("por fecha, sin fecha al final, y los empates conservan su orden", () => {
    const xs = [
      { n: "b", f: "2027-03-19" },
      { n: "llegada", f: "2027-03-16" },
      { n: "sin", f: null },
      { n: "a", f: "2027-03-16" },
    ];
    expect(ordenarPorFecha(xs, (x) => x.f).map((x) => x.n)).toEqual(["llegada", "a", "b", "sin"]);
  });
});
