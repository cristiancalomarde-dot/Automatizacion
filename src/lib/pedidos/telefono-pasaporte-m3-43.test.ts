/**
 * Spec M3-43 — teléfono y pasaporte del pasajero en el pedido (owner, 2026-11-01). El pasaporte va
 * en todo pedido que lleva los datos de los pasajeros ("pendiente" si falta); el teléfono, solo a
 * los proveedores de `data/proveedores-con-telefono.csv` (Cuenca del Plata y Horizonte Atacama), y
 * en Journaway el del contacto del pasajero principal va como teléfono del PAX 1 si no tiene otro.
 * Pasajeros inventados (#1).
 */
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { cargarProveedoresConTelefono, leerProveedoresConTelefono } from "./cargar";
import { llevaTelefono } from "./ficha";
import { renglonDelPasajero } from "./formato";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoCon, producto, proveedor, reserva, servicio } from "./fixtures.test-utils";
import type { CatalogoParaPedidos, ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}
const pax = (cuerpo: string) => cuerpo.split("\n").filter((l) => l.startsWith("PAX "));

const PASAJEROS = [
  { nombre: "Ana", apellido: "Gómez", nacionalidad: "Denmark", pasaporte: "XX1234567", telefono: "+45 1111 1111" },
  { nombre: "Luis", apellido: "Pérez", nacionalidad: "Denmark", pasaporte: null, telefono: null },
];

// Un hotel de Cuenca del Plata (como en el directorio) y uno de otro proveedor, cada uno a su casilla.
const pueblito = proveedor("prov-pueblito-real", "El Pueblito, proveedor Cuenca del Plata", ["reservas3@cuencadelplata.test"]);
const otro = P.donRaul;
const conTelefono = leerProveedoresConTelefono('proveedor,nota\n"El Pueblito, proveedor Cuenca del Plata",Cuenca\nHorizonte Atacama,San Pedro\n');

function prod(id: string) {
  return producto(id, "OD999", [
    servicio({ productoId: id, tipo: "alojamiento", orden: 1, serviceProviderNombre: "Hotel El Pueblito", bookingSupplier: pueblito }),
    servicio({ productoId: id, tipo: "alojamiento", orden: 2, serviceProviderNombre: "Hotel Don Raul", bookingSupplier: otro }),
  ]);
}
const catalogo = (extra: Partial<CatalogoParaPedidos> = {}): CatalogoParaPedidos => ({ ...catalogoCon([prod("prod-m343")]), conTelefono, ...extra });
const laReserva = (extra: Parameters<typeof reserva>[0] = {}) =>
  reserva({ productoId: "prod-m343", fechaInicio: "2027-03-05", fechaFin: "2027-03-08", habitacion: "Double Room", pasajeros: PASAJEROS, pax: 2, ...extra });
const pedidoA = (r: ReturnType<typeof ok>, mail: string) => r.pedidos.find((p) => p.destinatarios.some((d) => d.toLowerCase() === mail))!;

describe("data/proveedores-con-telefono.csv (fila 4)", () => {
  it("se lee por nombre del proveedor, sin mayúsculas ni acentos; la cabecera tiene que ser proveedor,nota", () => {
    expect(llevaTelefono(conTelefono, { nombre: "HORIZONTE  atacama" })).toBe(true);
    expect(llevaTelefono(conTelefono, { nombre: "El Pueblito, proveedor Cuenca del Plata" })).toBe(true);
    expect(llevaTelefono(conTelefono, { nombre: "Imperio Inca" })).toBe(false);
    expect(() => leerProveedoresConTelefono("nombre\nHorizonte\n")).toThrow(/proveedor,nota/);
    expect(() => leerProveedoresConTelefono("proveedor,nota\n,sin nombre\n")).toThrow(/fila 2/);
  });

  it("la lista del owner trae a Cuenca del Plata (sus filas del directorio) y a Horizonte Atacama, como están en el directorio", () => {
    const lista = cargarProveedoresConTelefono();
    for (const nombre of [
      "Horizonte atacama",
      "El Pueblito, proveedor Cuenca del Plata",
      "Paquete 105 Premium desde Foz: Transfer in+out en Foz/Igu, Lado Arg, Lado Bra IGRP01",
      "Excursion Lado Argentino Premium IGRE01",
      "Excursion Lado Brasilero Premium IGRE02",
      "Transfers IGU - Puerto Iguazu Hotels (regular 7 AM - 9 PM; privado de noche) IGRT01",
    ]) {
      expect(llevaTelefono(lista, { nombre }), nombre).toBe(true);
    }
    expect(llevaTelefono(lista, P.imperio)).toBe(false);
    expect(llevaTelefono(lista, { nombre: "Nacional Inn Foz" })).toBe(false);
  });
});

describe("armarPedidos — teléfono y pasaporte del pax (filas 2, 3 y 4)", () => {
  const r = ok(armarPedidos(laReserva(), catalogo(), plantilla));

  it("a Cuenca del Plata: el pasaporte y el teléfono de cada pasajero que lo tiene", () => {
    expect(pax(pedidoA(r, "reservas3@cuencadelplata.test").cuerpo)).toEqual([
      "PAX 1: Ana Gómez · Nacionalidad: Denmark · Pasaporte: XX1234567 · Teléfono: +45 1111 1111",
      "PAX 2: Luis Pérez · Nacionalidad: Denmark · Pasaporte: pendiente",
    ]);
  });

  it("a otro proveedor: el pasaporte sí, el teléfono no", () => {
    expect(pax(pedidoA(r, "reservas@donraul.test").cuerpo)).toEqual([
      "PAX 1: Ana Gómez · Nacionalidad: Denmark · Pasaporte: XX1234567",
      "PAX 2: Luis Pérez · Nacionalidad: Denmark · Pasaporte: pendiente",
    ]);
  });

  it("sin la lista, nadie recibe el teléfono", () => {
    const sin = ok(armarPedidos(laReserva(), catalogo({ conTelefono: undefined }), plantilla));
    expect(sin.pedidos.map((p) => p.cuerpo).join("\n")).not.toContain("Teléfono");
  });

  it("Journaway: el teléfono del contacto va como el del PAX 1 si no tiene otro (solo a los de la lista)", () => {
    const contacto = { nombre: "Luis Pérez", email: "luis@example.test", telefono: "+49 170 0000001" };
    const j = ok(armarPedidos(laReserva({ agencia: "Journaway", pasajeros: [PASAJEROS[1], PASAJEROS[0]], contactoCliente: contacto }), catalogo(), plantilla));
    expect(pax(pedidoA(j, "reservas3@cuencadelplata.test").cuerpo)).toEqual([
      "PAX 1: Luis Pérez · Nacionalidad: Denmark · Pasaporte: pendiente · Teléfono: +49 170 0000001",
      "PAX 2: Ana Gómez · Nacionalidad: Denmark · Pasaporte: XX1234567 · Teléfono: +45 1111 1111",
    ]);
    expect(pax(pedidoA(j, "reservas@donraul.test").cuerpo).join("\n")).not.toContain("Teléfono");
    // Si el PAX 1 ya tiene teléfono, queda el suyo.
    const propio = ok(armarPedidos(laReserva({ agencia: "Journaway", contactoCliente: contacto }), catalogo(), plantilla));
    expect(pax(pedidoA(propio, "reservas3@cuencadelplata.test").cuerpo)[0]).toContain("Teléfono: +45 1111 1111");
    expect(pedidoA(propio, "reservas3@cuencadelplata.test").cuerpo).not.toContain("+49 170 0000001");
  });

  it("M3-32: en portugués, Passaporte y Telefone", () => {
    expect(renglonDelPasajero(PASAJEROS[0], 0, "pt", true)).toBe("PAX 1: Ana Gómez · Nacionalidade: Denmark · Passaporte: XX1234567 · Telefone: +45 1111 1111");
    expect(renglonDelPasajero(PASAJEROS[0], 0, "pt")).toBe("PAX 1: Ana Gómez · Nacionalidade: Denmark · Passaporte: XX1234567");
  });
});
