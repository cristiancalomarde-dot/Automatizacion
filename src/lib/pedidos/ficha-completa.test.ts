/**
 * La ficha completa por pasajero (owner, 2026-10-19): Horizonte Atacama necesita de cada
 * pasajero nombre, pasaporte, teléfono, hotel, edad, nacionalidad, restricción alimentaria e
 * idioma, y las excursiones como "FECHAS Y TOURS". Los proveedores salen de
 * `data/proveedores-ficha-completa.csv`. Pasajeros inventados (#1).
 */
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { cargarExcursionesConEntrada, cargarProveedoresFichaCompleta, leerProveedoresFichaCompleta } from "./cargar";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoChb31, catalogoCon, parte, producto, reserva, reservaChb31, servicio } from "./fixtures.test-utils";
import { llevaFichaCompleta } from "./ficha";
import type { CatalogoParaPedidos, ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const fichaCompleta = cargarProveedoresFichaCompleta();
const entradas = cargarExcursionesConEntrada();
const conListas = (c: CatalogoParaPedidos): CatalogoParaPedidos => ({ ...c, entradas, fichaCompleta });

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}
const pedidoA = (r: ReturnType<typeof ok>, mail: string) => r.pedidos.find((p) => p.destinatarios.includes(mail))!;

const PASAJEROS_CHB31 = [
  { nombre: "Ana", apellido: "Gómez", tratamiento: "Ms", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17", pasaporte: "XX1234567", telefono: "+45 1111 1111" },
  // Sin pasaporte ni teléfono; cumple después del tour (35 y no 36).
  { nombre: "Luis", apellido: "Pérez", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
  // Sin fecha de nacimiento ni nacionalidad.
  { nombre: "Eva", apellido: "Ruiz" },
];

describe("data/proveedores-ficha-completa.csv", () => {
  it("se lee por nombre del proveedor; la cabecera tiene que ser proveedor,nota", () => {
    const lista = leerProveedoresFichaCompleta('proveedor,nota\nHorizonte Atacama,"pide la ficha, completa"\n');
    expect(llevaFichaCompleta(lista, { nombre: "HORIZONTE  atacama" })).toBe(true);
    expect(llevaFichaCompleta(lista, { nombre: "Imperio Inca" })).toBe(false);
    expect(() => leerProveedoresFichaCompleta("nombre\nHorizonte\n")).toThrow(/proveedor,nota/);
    expect(() => leerProveedoresFichaCompleta("proveedor,nota\n,sin nombre\n")).toThrow(/fila 2/);
  });

  it("la lista del owner trae a Horizonte Atacama, como está en el directorio ('Horizonte atacama')", () => {
    expect(llevaFichaCompleta(fichaCompleta, { nombre: "Horizonte atacama" })).toBe(true);
    expect(llevaFichaCompleta(fichaCompleta, P.imperio)).toBe(false);
  });
});

describe("armarPedidos — ficha completa por pasajero (Horizonte Atacama)", () => {
  const chb31 = {
    ...reservaChb31,
    pax: 3,
    pasajeros: PASAJEROS_CHB31,
    contactoCliente: { nombre: "Ana Gómez", email: "ana@example.test", telefono: "+45 2222 2222" },
  };
  const r = ok(armarPedidos(chb31, conListas(catalogoChb31), plantilla));
  const horizonte = pedidoA(r, "reservas@horizonte.test");

  it("CHB31: un bloque por pasajero, con PENDIENTE donde falta y la edad a la fecha del tour", () => {
    expect(horizonte.cuerpo).toContain(
      [
        "NOMBRE COMPLETO: Ana Gómez",
        "PASAPORTE: XX1234567",
        "TELÉFONO: +45 1111 1111",
        "HOTEL: San Pedro Backpackers (a confirmar)",
        "EDAD: 36",
        "NACIONALIDAD: Denmark",
        "RESTRICCIÓN ALIMENTARIA: NO INFORMADAS",
        "IDIOMA: INGLÉS",
        "",
        "NOMBRE COMPLETO: Luis Pérez",
        "PASAPORTE: PENDIENTE",
        // Sin teléfono propio: el de contacto de la reserva.
        "TELÉFONO: +45 2222 2222",
        "HOTEL: San Pedro Backpackers (a confirmar)",
        "EDAD: 35",
        "NACIONALIDAD: Denmark",
        "RESTRICCIÓN ALIMENTARIA: NO INFORMADAS",
        "IDIOMA: INGLÉS",
        "",
        "NOMBRE COMPLETO: Eva Ruiz",
        "PASAPORTE: PENDIENTE",
        "TELÉFONO: +45 2222 2222",
        "HOTEL: San Pedro Backpackers (a confirmar)",
        "EDAD: PENDIENTE",
        "NACIONALIDAD: PENDIENTE",
      ].join("\n"),
    );
  });

  it("las excursiones van como FECHAS Y TOURS, con la fecha con puntos; sin entradas en Kilroy", () => {
    expect(horizonte.cuerpo).toContain("FECHAS Y TOURS:\nGeisers del Tatio - 20.01.2027");
    expect(horizonte.cuerpo).not.toContain("ENTRADAS");
    // El formato de antes no sale: ni "PAX 1", ni "Pasajeros:", ni el pick up repetido (va en HOTEL).
    expect(horizonte.cuerpo).not.toContain("PAX 1");
    expect(horizonte.cuerpo).not.toContain("Pasajeros:");
    expect(horizonte.cuerpo).not.toContain("Pick up:");
    expect(horizonte.cuerpo).not.toContain("Excursión:");
  });

  it("mantiene el saludo, el cierre y la firma de la plantilla; los pasajeros antes que los tours", () => {
    expect(horizonte.cuerpo.startsWith("¡Hola!")).toBe(true);
    expect(horizonte.cuerpo).toContain("¿Nos confirman cuando puedan?");
    expect(horizonte.firma).toBe(plantilla.firma);
    expect(horizonte.cuerpo.indexOf("NOMBRE COMPLETO")).toBeLessThan(horizonte.cuerpo.indexOf("FECHAS Y TOURS"));
  });

  it("un proveedor que no está en la lista (Imperio Inca) sigue con el formato de hoy", () => {
    const imperio = pedidoA(r, "reservas@imperioinca.test");
    expect(imperio.cuerpo).toContain("Pasajeros: 3");
    expect(imperio.cuerpo).toContain("PAX 1: Ms Ana Gómez · Nacionalidad: Denmark");
    expect(imperio.cuerpo).not.toContain("NOMBRE COMPLETO");
    expect(imperio.cuerpo).not.toContain("FECHAS Y TOURS");
  });

  it("sin la lista, Horizonte sigue con el formato de hoy", () => {
    const sinLista = pedidoA(ok(armarPedidos(chb31, { ...catalogoChb31, entradas }, plantilla)), "reservas@horizonte.test");
    expect(sinLista.cuerpo).toContain("PAX 1:");
    expect(sinLista.cuerpo).not.toContain("NOMBRE COMPLETO");
  });

  it("pax 2 con un solo pasajero con nombre: el segundo bloque va PENDIENTE", () => {
    const p = pedidoA(
      ok(armarPedidos({ ...reservaChb31, pax: 2, pasajeros: [PASAJEROS_CHB31[0]] }, conListas(catalogoChb31), plantilla)),
      "reservas@horizonte.test",
    );
    expect(p.cuerpo.match(/NOMBRE COMPLETO:/g)).toHaveLength(2);
    expect(p.cuerpo).toContain("IDIOMA: INGLÉS\n\nNOMBRE COMPLETO: PENDIENTE\nPASAPORTE: PENDIENTE\nTELÉFONO: PENDIENTE\nHOTEL: San Pedro Backpackers (a confirmar)\nEDAD: PENDIENTE");
  });

  it("la restricción alimentaria sale de los pedidos especiales y las notas de la reserva", () => {
    const p = pedidoA(
      ok(
        armarPedidos(
          { ...reservaChb31, pedidosEspeciales: "Arriving late at night. Ana is vegetarian, Luis has a nut allergy.\nCelebrating a birthday", notas: ["Trae adjuntos: pasaportes (no se leen)"] },
          conListas(catalogoChb31),
          plantilla,
        ),
      ),
      "reservas@horizonte.test",
    );
    expect(p.cuerpo).toContain("RESTRICCIÓN ALIMENTARIA: Ana is vegetarian, Luis has a nut allergy\n");
    expect(p.cuerpo).not.toContain("Arriving late");
    expect(p.cuerpo).not.toContain("birthday");
  });
});

describe("armarPedidos — ficha completa en Journaway (entradas y pick up)", () => {
  const excursion = (codigo: string, descripcion: string) =>
    producto(`prod-${codigo}`, codigo, [servicio({ productoId: `prod-${codigo}`, tipo: "excursion", descripcion, bookingSupplier: P.horizonte })], { destino: "SPA" });
  const spae02 = excursion("SPAE02", "Rainbow Valley day Tour (entrance fee)");
  const spae04 = excursion("SPAE04", "El Tatio Geisers Tour (entrance fee)");
  const spae01 = excursion("SPAE01", "Astrophotography Tour");
  const journaway = (partes: ReturnType<typeof parte>[], extra = {}) =>
    reserva({ agencia: "Journaway", habitacion: null, pax: 1, pasajeros: [PASAJEROS_CHB31[0]], productoId: partes[0].productoId, otrosProductos: partes.slice(1).map((x) => x.productoId!), partes, ...extra });

  it("las entradas se marcan por tour (- CON ENTRADAS), no en el título; en orden de fecha", () => {
    const r = ok(
      armarPedidos(
        journaway([
          parte({ id: "b", orden: 1, tipo: "paquete", productoId: spae04.id, fechaInicio: "2027-03-19", fechaFin: "2027-03-19", pickUp: "Hotel Cumbres" }),
          parte({ id: "a", orden: 2, tipo: "paquete", productoId: spae02.id, fechaInicio: "2027-03-17", fechaFin: "2027-03-17", pickUp: "Hotel Cumbres" }),
          parte({ id: "c", orden: 3, tipo: "paquete", productoId: spae01.id, fechaInicio: "2027-03-18", fechaFin: "2027-03-18", pickUp: "Hotel Cumbres" }),
        ]),
        conListas(catalogoCon([spae02, spae04, spae01])),
        plantilla,
      ),
    );
    const p = r.pedidos[0];
    expect(p.cuerpo).toContain(
      "FECHAS Y TOURS:\nRainbow Valley day Tour (entrance fee) - 17.03.2027 - CON ENTRADAS\nAstrophotography Tour - 18.03.2027\nEl Tatio Geisers Tour (entrance fee) - 19.03.2027 - CON ENTRADAS",
    );
    expect(p.cuerpo).not.toContain("INCLUIR ENTRADAS");
    expect(p.cuerpo).toContain("HOTEL: Hotel Cumbres\n");
    // La edad, a la fecha del primer tour (17/3/2027).
    expect(p.cuerpo).toContain("EDAD: 36\n");
  });

  it("Journaway sin excursiones con entrada: ninguna línea marcada", () => {
    const p = ok(
      armarPedidos(
        journaway([parte({ id: "a", orden: 1, tipo: "paquete", productoId: spae01.id, fechaInicio: "2027-03-17", fechaFin: "2027-03-17", pickUp: "Hotel Cumbres" })]),
        conListas(catalogoCon([spae01])),
        plantilla,
      ),
    ).pedidos[0];
    expect(p.cuerpo).toContain("FECHAS Y TOURS:\nAstrophotography Tour - 17.03.2027");
    expect(p.cuerpo).not.toContain("ENTRADAS");
  });

  it("si cambian de hotel entre tours, HOTEL lleva los dos y cada tour dice su pick up", () => {
    const p = ok(
      armarPedidos(
        journaway([
          parte({ id: "a", orden: 1, tipo: "paquete", productoId: spae02.id, fechaInicio: "2027-03-17", fechaFin: "2027-03-17", pickUp: "Hotel Cumbres" }),
          parte({ id: "b", orden: 2, tipo: "paquete", productoId: spae04.id, fechaInicio: "2027-03-19", fechaFin: "2027-03-19", pickUp: "Hotel Kimal" }),
        ]),
        conListas(catalogoCon([spae02, spae04])),
        plantilla,
      ),
    ).pedidos[0];
    expect(p.cuerpo).toContain("HOTEL: Hotel Cumbres / Hotel Kimal\n");
    expect(p.cuerpo).toContain("Rainbow Valley day Tour (entrance fee) - 17.03.2027 - CON ENTRADAS (pick up: Hotel Cumbres)");
    expect(p.cuerpo).toContain("El Tatio Geisers Tour (entrance fee) - 19.03.2027 - CON ENTRADAS (pick up: Hotel Kimal)");
  });

  it("sin alojamiento conocido: HOTEL: A CONFIRMAR y el pendiente para el proveedor", () => {
    const p = ok(
      armarPedidos(
        journaway([parte({ id: "a", orden: 1, tipo: "paquete", productoId: spae01.id, fechaInicio: "2027-03-17", fechaFin: "2027-03-17" })]),
        conListas(catalogoCon([spae01])),
        plantilla,
      ),
    ).pedidos[0];
    expect(p.cuerpo).toContain("HOTEL: A CONFIRMAR\n");
    expect(p.cuerpo).toContain("Les pasamos el alojamiento para el pick up apenas lo tengamos.");
  });

  it("el hotel que reserva la agencia esa noche va sin '(a confirmar)'", () => {
    const p = ok(
      armarPedidos(
        journaway([parte({ id: "a", orden: 1, tipo: "paquete", productoId: spae01.id, fechaInicio: "2027-03-17", fechaFin: "2027-03-17" })], {
          hotelesAgencia: [{ nombre: "Hotel Altiplánico", desde: "2027-03-16", hasta: "2027-03-19" }],
        }),
        conListas(catalogoCon([spae01])),
        plantilla,
      ),
    ).pedidos[0];
    expect(p.cuerpo).toContain("HOTEL: Hotel Altiplánico\n");
  });
});
