/**
 * M3-51 (owner, 2026-11-07): los mails de pedido de una reserva, en orden cronológico. Caso real:
 * DK1598967 (BR20) guardó sus 9 pedidos con el mismo `created_at` y la pantalla mostraba primero los de marzo.
 */
import { describe, expect, it } from "vitest";
import { ordenarPorFecha } from "./orden";

const MISMO = "2026-11-07T03:53:04.281947+00:00";
const pedido = (id: string, fechas: Array<string | null>, created_at = MISMO) => ({
  id,
  created_at,
  partes: fechas.map((fecha) => ({ parteId: null, productoServicioId: null, producto: null, fecha })),
});

describe("ordenarPorFecha", () => {
  it("BR20: los 9 pedidos guardados juntos salen por su primera fecha, no como los devuelve la base", () => {
    const comoVinieron = [
      pedido("paraty", ["2027-03-03", "2027-03-04", "2027-03-07"]),
      pedido("holandes", ["2027-03-04"]),
      pedido("local55", ["2027-03-07", "2027-03-08"]),
      pedido("buzios", ["2027-03-10"]),
      pedido("bambu", ["2027-02-19"]),
      pedido("cuenca", ["2027-02-19"]),
      pedido("bonito", ["2027-02-23"]),
      pedido("ygarape", ["2027-02-24"]),
      pedido("pantanal", ["2027-02-25"]),
    ];
    expect(ordenarPorFecha(comoVinieron).map((p) => p.id)).toEqual(["bambu", "cuenca", "bonito", "ygarape", "pantanal", "paraty", "holandes", "local55", "buzios"]);
  });

  it("la primera fecha manda aunque las partes vengan desordenadas", () => {
    expect(ordenarPorFecha([pedido("b", ["2027-03-09", "2027-03-01"]), pedido("a", ["2027-03-05"])]).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("sin fecha (un pedido a mano, partes vacías o sin partes), al final; a igual fecha, por created_at y después como vinieron", () => {
    const r = ordenarPorFecha([
      { id: "sin-partes", created_at: MISMO },
      pedido("a-mano", [null], "2026-11-07T05:00:00+00:00"),
      pedido("hostel", ["2027-01-28"]),
      pedido("tarde", ["2027-01-28"], "2026-11-08T00:00:00+00:00"),
      pedido("transfer", ["2027-01-28"]),
    ]);
    expect(r.map((p) => p.id)).toEqual(["hostel", "transfer", "tarde", "sin-partes", "a-mano"]);
  });

  it("no cambia la lista que recibe", () => {
    const lista = [pedido("b", ["2027-03-01"]), pedido("a", ["2027-02-01"])];
    ordenarPorFecha(lista);
    expect(lista.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
