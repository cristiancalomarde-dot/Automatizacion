/**
 * M3-21: la habitación según los pax (owner, 2026-10-23). En un hotel sin tipo de habitación
 * ("Budget Hotel", "Hotel 3*" o vacía) va DBL con 2 pax y SGL con 1, con un aviso para revisarlo con
 * el vendedor; 3 o más pax (o sin saber), a confirmar como hoy. Lo explícito ("2 SGLs", "twin")
 * manda. En un hostel sin tipo, a confirmar (dorm / DBL / SGL). En el W Trek, la carpa sin cantidad
 * es Tent DBL con 2 pax; con 1 pax no se asume Tent SGL (es mucho más caro que el Refugio Dorm).
 */
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { alojamientoDelTrek, habitacionDelPedido, habitacionSinTipo, tipoDeHabitacion } from "./formato";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoCon, componente, parte, producto, reserva, servicio } from "./fixtures.test-utils";
import type { PasajeroDeReserva, ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();
const TREK_A_CONFIRMAR = "a confirmar (Refugio Dorm a compartir / Tent DBL / Tent SGL)";

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const hotel = { pax: 2, hostel: false };

describe("habitacionDelPedido con los pax (tabla de hoteles)", () => {
  it.each([
    // hotel sin tipo, 2 pax → DBL
    [null, { pax: 2, hostel: false }, "DBL Standard con desayuno"],
    ["Budget Hotel", { pax: 2, hostel: false }, "DBL Standard con desayuno"],
    ["Hotel 3*", { pax: 2, hostel: false }, "DBL Standard con desayuno"],
    ["Hotel 4 stars", { pax: 2, hostel: false }, "DBL Standard con desayuno"],
    // hotel sin tipo, 1 pax → SGL
    ["Budget Hotel", { pax: 1, hostel: false }, "SGL Standard con desayuno"],
    [null, { pax: 1, hostel: false }, "SGL Standard con desayuno"],
    // 3 o más pax, o sin saber → a confirmar
    ["Budget Hotel", { pax: 3, hostel: false }, "Standard con desayuno (tipo a confirmar)"],
    ["Hotel 3*", { pax: null, hostel: false }, "Standard con desayuno (tipo a confirmar)"],
    // lo explícito manda
    ["2 SGLs", hotel, "2 SGL Standard con desayuno"],
    ["2 single rooms - Hotel 3*", hotel, "2 SGL Standard con desayuno"],
    ["twin", hotel, "TWIN Standard con desayuno"],
    // hostel sin tipo → a confirmar
    ["Hostel", { pax: 2, hostel: true }, "a confirmar (dorm / DBL / SGL), con desayuno"],
    [null, { pax: 1, hostel: true }, "a confirmar (dorm / DBL / SGL), con desayuno"],
    // con tipo: como hoy (M3-18), en hotel o en hostel
    ["Double Room - Hostel", { pax: 1, hostel: true }, "DBL Standard con desayuno"],
    ["Single Room - Hotel 3*", hotel, "SGL Standard con desayuno"],
    ["Dormitory - Hostel", { pax: 2, hostel: true }, "dorm compartido, con desayuno"],
    ["Triple Room - Hotel 3*", hotel, "TPL Standard con desayuno"],
  ])("%s con %o → %s", (habitacion, ctx, esperado) => {
    expect(habitacionDelPedido(habitacion, ctx)).toBe(esperado);
  });

  it("«sin tipo» es la vacía y la que solo dice el nivel", () => {
    for (const h of [null, "  ", "Budget Hotel", "Hotel 3*", "Hostel", "hotel 4*"]) expect(habitacionSinTipo(h)).toBe(true);
    for (const h of ["Double Room - Budget Hotel", "2 SGLs", "twin", "Dormitory - Hostel", "Suite Junior"]) expect(habitacionSinTipo(h)).toBe(false);
  });

  it("tipoDeHabitacion no cambia", () => {
    expect(tipoDeHabitacion("Budget Hotel")).toBe("Budget Hotel");
    expect(tipoDeHabitacion("2 SGLs")).toBe("2 SGLs");
    expect(tipoDeHabitacion(null)).toBeNull();
  });
});

describe("alojamientoDelTrek con los pax (tabla del W Trek)", () => {
  it.each([
    ["Double Room - Hostel and W-Trek Tent", 1, "Tent DBL"],
    ["Single Room - Hostel and W-Trek Tent", 2, "Tent SGL"],
    ["Dormitory - Hostel and W-Trek Tent", 2, "Tent DBL"],
    ["Dormitory - Hostel and W-Trek Tent", 1, TREK_A_CONFIRMAR],
    ["Dormitory - Hostel and W-Trek Tent", 3, TREK_A_CONFIRMAR],
    ["Dormitory - Hostel", 1, "Refugio Dorm a compartir"],
    ["Single Room - Hotel 3*", 1, TREK_A_CONFIRMAR],
    ["Single Room - Hostel", null, TREK_A_CONFIRMAR],
    ["Double Room - Hotel 3*", 2, "Tent DBL"],
    [null, 2, TREK_A_CONFIRMAR],
    ["Budget Hotel", 1, TREK_A_CONFIRMAR],
  ])("%s con %s pax → %s", (habitacion, pax, esperado) => {
    expect(alojamientoDelTrek(habitacion, pax)).toBe(esperado);
  });
});

// --- En el armado -------------------------------------------------------------------------

const unHotel = (nivel: string | null) =>
  producto("prod-hot21", "HOT21", [
    servicio({ productoId: "prod-hot21", tipo: "alojamiento", orden: 1, nivel, serviceProviderNombre: "El Pueblito Iguazu", bookingSupplier: P.pueblito }),
  ], { destino: "IGR" });

const dos: PasajeroDeReserva[] = [
  { nombre: "Ana", apellido: "Gómez", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17" },
  { nombre: "Luis", apellido: "Pérez", nacionalidad: "Denmark", fecha_nacimiento: "1991-02-03" },
];

function pedidoDelHotel(habitacion: string | null, pax: number | null, nivel: string | null = "Budget Hotel", pasajeros: PasajeroDeReserva[] = dos.slice(0, pax ?? 2)) {
  const prod = unHotel(nivel);
  const r = ok(armarPedidos(reserva({ productoId: prod.id, habitacion, pax, pasajeros, fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogoCon([prod]), plantilla));
  return r.pedidos.find((p) => p.cuerpo.includes("Alojamiento: El Pueblito Iguazu"))!;
}

const renglonHabitacion = (cuerpo: string) => cuerpo.split("\n").filter((l) => l.startsWith("Habitación:"));
const AVISO_DBL = "La reserva no dice el tipo de habitación: va DBL por 2 pax. Revisalo con el vendedor.";
const AVISO_SGL = "La reserva no dice el tipo de habitación: va SGL por 1 pax. Revisalo con el vendedor.";

describe("armarPedidos — hoteles (filas 1, 2 y 4)", () => {
  it("Budget Hotel con 2 pax → DBL y el aviso", () => {
    const p = pedidoDelHotel("Budget Hotel", 2);
    expect(renglonHabitacion(p.cuerpo)).toEqual(["Habitación: DBL Standard con desayuno"]);
    expect(p.avisos).toContain(AVISO_DBL);
  });

  it("Hotel 3* con 1 pax → SGL y el aviso", () => {
    const p = pedidoDelHotel("Hotel 3*", 1, "Hotel 3*");
    expect(renglonHabitacion(p.cuerpo)).toEqual(["Habitación: SGL Standard con desayuno"]);
    expect(p.avisos).toContain(AVISO_SGL);
  });

  it("sin pax, cuenta los pasajeros (fila 2)", () => {
    const p = pedidoDelHotel(null, null, "Budget Hotel", dos.slice(0, 1));
    expect(renglonHabitacion(p.cuerpo)).toEqual(["Habitación: SGL Standard con desayuno"]);
    expect(p.avisos).toContain(AVISO_SGL);
  });

  it("3 pax → a confirmar con el aviso de hoy", () => {
    const tres = [...dos, { nombre: "Eva", apellido: "Ruiz", nacionalidad: "Denmark", fecha_nacimiento: "1992-01-01" }];
    const p = pedidoDelHotel("Budget Hotel", 3, "Budget Hotel", tres);
    expect(renglonHabitacion(p.cuerpo)).toEqual(["Habitación: Standard con desayuno (tipo a confirmar)"]);
    expect(p.avisos).toContain("Falta el tipo de habitación de El Pueblito Iguazu: completalo antes de enviar.");
  });

  it("«2 SGLs» → lo que dice, sin aviso de habitación", () => {
    const p = pedidoDelHotel("2 SGLs", 2);
    expect(renglonHabitacion(p.cuerpo)).toEqual(["Habitación: 2 SGL Standard con desayuno"]);
    expect(p.avisos.filter((a) => /habitación/i.test(a))).toEqual([]);
  });

  it("los avisos son internos: el texto al proveedor no habla del vendedor (fila 4)", () => {
    const p = pedidoDelHotel("Budget Hotel", 2);
    expect(p.cuerpo).not.toMatch(/vendedor|no dice/i);
  });
});

describe("armarPedidos — hostel sin tipo", () => {
  it("nivel Hostel del catálogo y la habitación «Hostel» → a confirmar (dorm / DBL / SGL) y aviso", () => {
    const p = pedidoDelHotel("Hostel", 2, "Hostel");
    expect(renglonHabitacion(p.cuerpo)).toEqual(["Habitación: a confirmar (dorm / DBL / SGL), con desayuno"]);
    expect(p.avisos).toContain("La reserva no dice si en El Pueblito Iguazu es dorm, DBL o SGL: completalo antes de enviar y revisalo con el vendedor.");
  });

  it("sin nivel en el catálogo, decide la habitación («Hostel»)", () => {
    const p = pedidoDelHotel("Hostel", 1, null);
    expect(renglonHabitacion(p.cuerpo)).toEqual(["Habitación: a confirmar (dorm / DBL / SGL), con desayuno"]);
  });

  it("hostel con tipo: como hoy", () => {
    expect(renglonHabitacion(pedidoDelHotel("Double Room - Hostel", 2, "Hostel").cuerpo)).toEqual(["Habitación: DBL Standard con desayuno"]);
  });
});

describe("armarPedidos — dentro de un tour (fila 3)", () => {
  it("el hotel de un componente sin tipo va por pax", () => {
    const prod = unHotel("Hotel 3*");
    const tour = producto("prod-tour21", "TOUR21", [], { esTour: true, componentes: [componente("c-hot21", 1, 1, 3, prod)] });
    const r = ok(
      armarPedidos(
        reserva({
          productoId: tour.id,
          habitacion: "Hotel 3*",
          pax: 2,
          fechaInicio: "2027-02-10",
          fechaFin: "2027-02-13",
          partes: [parte({ id: "p1", orden: 1, tipo: "paquete", productoId: prod.id, productoComponenteId: "c-hot21", fechaInicio: "2027-02-10", fechaFin: "2027-02-13" })],
        }),
        catalogoCon([tour, prod]),
        plantilla,
      ),
    );
    const p = r.pedidos.find((x) => x.cuerpo.includes("Alojamiento: El Pueblito Iguazu"))!;
    expect(renglonHabitacion(p.cuerpo)).toEqual(["Habitación: DBL Standard con desayuno"]);
    expect(p.avisos).toContain(AVISO_DBL);
  });
});

describe("armarPedidos — el W Trek con los pax", () => {
  const trek = producto("prod-wtrek21", "CH11", [
    servicio({ productoId: "prod-wtrek21", tipo: "otro", orden: 1, descripcion: "W Trek Express. Booking Supplier: Las Torres", serviceProviderNombre: "W Trek Express", bookingSupplier: P.cuenca, tramosNoches: [{ nocheDesde: 1, noches: 3, lugar: "refugios" }] }),
  ], { destino: "PNT" });

  function pedidoDelTrek(habitacion: string | null, pax: number) {
    const r = ok(armarPedidos(reserva({ productoId: trek.id, habitacion, pax, pasajeros: dos.slice(0, pax), fechaInicio: "2027-03-01", fechaFin: "2027-03-04" }), catalogoCon([trek]), plantilla));
    return r.pedidos.find((p) => p.cuerpo.includes("W Trek Express"))!;
  }
  const renglonTrek = (cuerpo: string) => cuerpo.split("\n").filter((l) => l.startsWith("Alojamiento en el trek:"));
  const AVISO_1_PAX = "Falta el tipo de alojamiento del W Trek Express (1 pax): Tent SGL es mucho más caro que el Refugio Dorm; revisalo con el vendedor.";

  it("carpa sin cantidad con 2 pax → Tent DBL, sin aviso", () => {
    const p = pedidoDelTrek("Dormitory - Hostel and W-Trek Tent", 2);
    expect(renglonTrek(p.cuerpo)).toEqual(["Alojamiento en el trek: Tent DBL"]);
    expect(p.avisos.filter((a) => /trek/i.test(a))).toEqual([]);
  });

  it("carpa sin cantidad con 1 pax → a confirmar y el aviso de 1 pax", () => {
    const p = pedidoDelTrek("Dormitory - Hostel and W-Trek Tent", 1);
    expect(renglonTrek(p.cuerpo)).toEqual([`Alojamiento en el trek: ${TREK_A_CONFIRMAR}`]);
    expect(p.avisos).toContain(AVISO_1_PAX);
    expect(p.cuerpo).not.toMatch(/vendedor/);
  });

  it("single que no menciona el trek («Single Room - Hotel 3*») → a confirmar y el aviso de 1 pax", () => {
    const p = pedidoDelTrek("Single Room - Hotel 3*", 1);
    expect(renglonTrek(p.cuerpo)).toEqual([`Alojamiento en el trek: ${TREK_A_CONFIRMAR}`]);
    expect(p.avisos).toContain(AVISO_1_PAX);
  });

  it("sin habitación con 2 pax → a confirmar con el aviso de hoy", () => {
    const p = pedidoDelTrek(null, 2);
    expect(p.avisos).toContain("Falta el tipo de alojamiento del W Trek Express: completalo antes de enviar.");
  });
});
