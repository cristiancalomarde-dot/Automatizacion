import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buscarServicio, parsearServiciosAPedido, planAPedido, type ServicioBuscable } from "./a-pedido";

const OD016: ServicioBuscable[] = [
  { orden: 1, prioridad: 1, tipo: "alojamiento", serviceProviderNombre: "Hostel del Glaciar Pioneros", descripcion: "Accommodation: Hostel del Glaciar Pioneros / Calafate Hostel. Booking Supplier: Del Glaciar / Always Glaciers" },
  { orden: 1, prioridad: 2, tipo: "alojamiento", serviceProviderNombre: "Calafate Hostel", descripcion: "Accommodation: Hostel del Glaciar Pioneros / Calafate Hostel. Booking Supplier: Del Glaciar / Always Glaciers" },
  { orden: 5, prioridad: 1, tipo: "traslado", serviceProviderNombre: "El Calafate Accommodation - FTE Airport", descripcion: "Transfer El Calafate Accommodation - FTE Airport. Booking Supplier: Chalten Travel" },
  { orden: 6, prioridad: 1, tipo: "excursion", serviceProviderNombre: "Perito Moreno Glaciar Excursion", descripcion: "Excursion: Perito Moreno Glaciar Excursion. Booking Supplier: Chalten Travel" },
];

describe("servicios a pedido o según la reserva (spec M1-08 §3 #6)", () => {
  it("encuentra el servicio por su nombre o por un pedazo de la línea del Excel; si no está o hay más de uno, falla claro", () => {
    expect(buscarServicio(OD016, "El Calafate Accommodation - FTE Airport", "OD016")).toBe(5);
    expect(buscarServicio(OD016, "perito moreno", "OD016")).toBe(6);
    expect(() => buscarServicio(OD016, "Transfer FTE Airport - Accommodation", "OD016")).toThrow(/OD016.*no tiene.*Transfer FTE Airport - Accommodation/);
    expect(() => buscarServicio(OD016, "Chalten Travel", "OD016")).toThrow(/OD016.*más de un servicio/);
  });

  it("lee el archivo: paquete, servicio, marca (a_pedido | segun_reserva) y nota", () => {
    const filas = parsearServiciosAPedido("paquete,servicio,marca,nota\nod016,El Calafate Accommodation - FTE Airport,a_pedido,opcional\n");
    expect(filas).toEqual([{ paquete: "OD016", servicio: "El Calafate Accommodation - FTE Airport", marca: "a_pedido", nota: "opcional" }]);
    expect(() => parsearServiciosAPedido("paquete,servicio,marca,nota\nOD016,x,siempre,\n")).toThrow(/fila 2.*marca/);
  });

  it("marca todas las opciones del servicio (mismo orden) con su nota", () => {
    const filas = parsearServiciosAPedido("paquete,servicio,marca,nota\nOD016,El Calafate Accommodation - FTE Airport,a_pedido,opcional\n");
    expect(planAPedido("OD016", filas, OD016)).toEqual([{ orden: 5, marca: "a_pedido", nota: "opcional" }]);
  });

  it("el archivo real marca el Remis de OD019 y la llegada de OD017; OD016 ya no tiene marca (M1-09)", () => {
    const filas = parsearServiciosAPedido(readFileSync("data/servicios-a-pedido.csv", "utf-8"));
    expect(filas.map((f) => [f.paquete, f.servicio, f.marca])).toEqual([
      ["OD019", "Remis Mendoza", "segun_reserva"],
      ["OD017", "PNT Airport - PNT accommodation", "a_pedido"],
    ]);
  });
});
