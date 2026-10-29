/**
 * M3-35: hay alojamientos que no ofrecen desayuno (owner, 2026-10-28). La lista vive en
 * `data/alojamientos-sin-desayuno.csv`; en esos el pedido no dice "con desayuno" en ninguna de las
 * variantes de M3-18/M3-21. El resto sigue igual. El nombre se reconoce aunque cambien las mayúsculas,
 * los acentos, "Foz" o "Hostel/Hostal", sin agarrar otro alojamiento.
 */
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { cargarAlojamientosSinDesayuno, leerAlojamientosSinDesayuno } from "./cargar";
import { habitacionDelPedido, sinDesayuno } from "./formato";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoCon, producto, reserva, servicio } from "./fixtures.test-utils";
import type { ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const lista = cargarAlojamientosSinDesayuno();

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

describe("data/alojamientos-sin-desayuno.csv (fila 1)", () => {
  it("tiene los 3 del owner, cada uno con su nota", () => {
    const nombres = lista.map((f) => f.alojamiento);
    expect(nombres).toEqual(expect.arrayContaining(["San Pedro Backpackers", "Puma House", "Bambu Hostel"]));
    for (const f of lista) expect(f.nota).toMatch(/owner/i);
  });

  it("la cabecera equivocada o una fila sin alojamiento fallan con un mensaje claro", () => {
    expect(() => leerAlojamientosSinDesayuno("hotel,nota\nX,y\n")).toThrow(/alojamiento,nota/);
    expect(() => leerAlojamientosSinDesayuno("alojamiento,nota\n,falta\n")).toThrow(/fila 2/);
  });
});

describe("sinDesayuno: el nombre con sus variantes (fila 3)", () => {
  it.each([
    "San Pedro Backpackers",
    "Backpacker San Pedro Hostel",
    "san pedro backpackers",
    "Puma House",
    "PUMA HOUSE",
    "Bambu Hostel",
    "Bambu",
    "Bambu Foz",
    "Bambu hostel",
    "Bambu Hostel Foz",
    "Bambú Hostal",
  ])("%s → sin desayuno", (nombre) => {
    expect(sinDesayuno(nombre, lista)).toBe(true);
  });

  it.each([
    "El Pueblito Iguazu",
    "Tayka Hostel San Pedro",
    "San Pedro Hotel",
    "Puma Lodge",
    "Bambu Lodge Mendoza",
    "Hostel",
    "Foz",
    "",
    null,
  ])("%s → con desayuno (como siempre)", (nombre) => {
    expect(sinDesayuno(nombre, lista)).toBe(false);
  });
});

describe("habitacionDelPedido sin desayuno (fila 2)", () => {
  const sin = (pax: number | null, hostel: boolean) => ({ pax, hostel, desayuno: false });
  it.each([
    ["Double Room - Hostel", sin(2, true), "DBL Standard"],
    [null, sin(2, false), "DBL Standard"],
    [null, sin(1, false), "SGL Standard"],
    ["Hotel 3*", sin(3, false), "Standard (tipo a confirmar)"],
    ["Hostel", sin(2, true), "a confirmar (dorm / DBL / SGL)"],
    [null, sin(null, true), "a confirmar (dorm / DBL / SGL)"],
    ["Dormitory - Hostel", sin(2, true), "dorm compartido"],
    ["Dorm traveling together - Hostel", sin(2, true), "dorm compartido (viajan juntos)"],
    ["2 SGLs", sin(2, false), "2 SGL Standard"],
    ["Suite Junior", sin(2, false), "Suite Junior"],
  ])("%s con %o → %s", (habitacion, ctx, esperado) => {
    expect(habitacionDelPedido(habitacion, ctx)).toBe(esperado);
  });

  it("sin decir nada del desayuno, sigue con desayuno (M3-18/M3-21 igual)", () => {
    expect(habitacionDelPedido("Double Room - Hostel", { pax: 2, hostel: true })).toBe("DBL Standard con desayuno");
    expect(habitacionDelPedido(null, { pax: 2, hostel: true })).toBe("a confirmar (dorm / DBL / SGL), con desayuno");
  });
});

describe("el pedido de alojamiento (fila 2, de punta a punta en el armado)", () => {
  const paquete = (nombre: string, nivel: string | null) =>
    producto(
      "prod-sd1",
      "SD1",
      [servicio({ productoId: "prod-sd1", tipo: "alojamiento", orden: 1, serviceProviderNombre: nombre, bookingSupplier: P.pueblito, nivel })],
      { destino: "IGR" },
    );

  function renglon(nombre: string, nivel: string | null, habitacion: string | null, pax: number, conLista = true) {
    const p = paquete(nombre, nivel);
    const pasajeros = Array.from({ length: pax }, (_, i) => ({ nombre: `Pax${i + 1}`, apellido: "Prueba" }));
    const catalogo = { ...catalogoCon([p]), ...(conLista ? { sinDesayuno: lista } : {}) };
    const r = ok(armarPedidos(reserva({ productoId: p.id, habitacion, pax, pasajeros, fechaInicio: "2027-02-10", fechaFin: "2027-02-12" }), catalogo, plantilla));
    const pedido = r.pedidos.find((x) => x.cuerpo.includes(`Alojamiento: ${nombre}`))!;
    return pedido.cuerpo.split("\n").find((l) => l.startsWith("Habitación:"));
  }

  it("Puma House 2 pax → DBL Standard", () => {
    expect(renglon("Puma House", null, null, 2)).toBe("Habitación: DBL Standard");
  });

  it("Bambu hostel sin tipo → a confirmar (dorm / DBL / SGL)", () => {
    expect(renglon("Bambu hostel", "Hostel", null, 2)).toBe("Habitación: a confirmar (dorm / DBL / SGL)");
  });

  it("Backpacker San Pedro Hostel con dorm → dorm compartido", () => {
    expect(renglon("Backpacker San Pedro Hostel", "Hostel", "Dormitory - Hostel", 1)).toBe("Habitación: dorm compartido");
  });

  it("un hotel cualquiera sigue DBL Standard con desayuno", () => {
    expect(renglon("El Pueblito Iguazu", null, null, 2)).toBe("Habitación: DBL Standard con desayuno");
  });

  it("sin la lista en el catálogo, todo con desayuno como antes", () => {
    expect(renglon("Puma House", null, null, 2, false)).toBe("Habitación: DBL Standard con desayuno");
  });
});
