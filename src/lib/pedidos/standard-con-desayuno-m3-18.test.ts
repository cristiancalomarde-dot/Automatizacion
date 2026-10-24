/**
 * M3-18: el renglón de habitación de los pedidos de alojamiento (hotel u hostel) pide la habitación
 * Standard y aclara que es con desayuno (owner, 2026-10-23): así no hay upgrades que no pedimos.
 * El Overland (habitacionDelOverland), el W Trek, las excursiones y los traslados no cambian; la tarea
 * interna (queParaTarea) queda como antes.
 */
import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { habitacionDelPedido, tipoDeHabitacion } from "./formato";
import { cargarPlantilla } from "./plantilla";
import { P, catalogoChb31, catalogoCon, componente, parte, producto, reserva, reservaChb31, servicio } from "./fixtures.test-utils";
import type { ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

/** Un paquete con un solo hotel (sin niveles que elegir) y una excursión. */
const hotel = producto(
  "prod-hot1",
  "HOT1",
  [
    servicio({ productoId: "prod-hot1", tipo: "alojamiento", orden: 1, serviceProviderNombre: "El Pueblito Iguazu", bookingSupplier: P.pueblito }),
    servicio({ productoId: "prod-hot1", tipo: "excursion", orden: 2, descripcion: "Excursion: Cataratas Argentinas", serviceProviderNombre: "Cataratas Argentinas", bookingSupplier: P.cuenca }),
  ],
  { destino: "IGR" },
);

function armar(habitacion: string | null) {
  return ok(armarPedidos(reserva({ productoId: hotel.id, habitacion, fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogoCon([hotel]), plantilla));
}

const renglonHabitacion = (cuerpo: string) => cuerpo.split("\n").filter((l) => l.startsWith("Habitación:"));
const pedidoDelHotel = (r: ReturnType<typeof ok>) => r.pedidos.find((p) => p.cuerpo.includes("Alojamiento: El Pueblito Iguazu"))!;

describe("habitacionDelPedido (fila 1: un caso por fila de la tabla)", () => {
  it.each([
    ["Double Room - Hostel", "DBL Standard con desayuno"],
    ["Doble", "DBL Standard con desayuno"],
    ["Matrimonial - Hotel 3*", "DBL Standard con desayuno"],
    ["Twin Room - Budget Hotel", "TWIN Standard con desayuno"],
    ["Single Room - Hostel", "SGL Standard con desayuno"],
    ["SGL", "SGL Standard con desayuno"],
    ["Triple Room - Hotel 3*", "TPL Standard con desayuno"],
    ["Dormitory - Hostel", "dorm compartido, con desayuno"],
    ["Dorm traveling together - Hostel", "dorm compartido (viajan juntos), con desayuno"],
    ["Suite Junior", "Suite Junior, con desayuno"],
    [null, "Standard con desayuno (tipo a confirmar)"],
    ["   ", "Standard con desayuno (tipo a confirmar)"],
  ])("%s → %s", (habitacion, esperado) => {
    expect(habitacionDelPedido(habitacion)).toBe(esperado);
  });

  it("tipoDeHabitacion no cambia (lo usan el hostel según la habitación, las tareas y el Overland)", () => {
    expect(tipoDeHabitacion("Double Room - Hostel")).toBe("doble");
    expect(tipoDeHabitacion("Dormitory - Hostel")).toBe("dorm compartido");
    expect(tipoDeHabitacion(null)).toBeNull();
  });
});

describe("armarPedidos — el renglón de habitación del alojamiento (fila 1)", () => {
  it("DBL: Habitación: DBL Standard con desayuno", () => {
    expect(renglonHabitacion(pedidoDelHotel(armar("Double Room - Hostel")).cuerpo)).toEqual(["Habitación: DBL Standard con desayuno"]);
  });

  it("SGL: Habitación: SGL Standard con desayuno", () => {
    expect(renglonHabitacion(pedidoDelHotel(armar("Single Room - Hostel")).cuerpo)).toEqual(["Habitación: SGL Standard con desayuno"]);
  });

  it("dorm: Habitación: dorm compartido, con desayuno", () => {
    expect(renglonHabitacion(pedidoDelHotel(armar("Dormitory - Hostel")).cuerpo)).toEqual(["Habitación: dorm compartido, con desayuno"]);
  });

  it("sin habitación: Standard con desayuno (tipo a confirmar) y un aviso para completarla", () => {
    const p = pedidoDelHotel(armar(null));
    expect(renglonHabitacion(p.cuerpo)).toEqual(["Habitación: Standard con desayuno (tipo a confirmar)"]);
    expect(p.avisos).toContain("Falta el tipo de habitación de El Pueblito Iguazu: completalo antes de enviar.");
  });

  it("con habitación no hay aviso de habitación", () => {
    expect(pedidoDelHotel(armar("Double Room - Hostel")).avisos.filter((a) => /habitación/i.test(a))).toEqual([]);
  });

  it("la excursión del mismo proveedor no lleva desayuno", () => {
    const p = ok(armarPedidos(reserva({ productoId: hotel.id, habitacion: "Double Room - Hostel", fechaInicio: "2027-02-10", fechaFin: "2027-02-13" }), catalogoCon([hotel]), plantilla));
    const exc = p.pedidos.find((x) => x.cuerpo.includes("Cataratas Argentinas"))!.cuerpo;
    const bloque = exc.slice(exc.indexOf("Excursión: Cataratas Argentinas")).split("\n\n")[0];
    expect(bloque).not.toMatch(/desayuno|Habitación/);
  });
});

describe("armarPedidos — dentro de un tour (fila 2)", () => {
  it("el hotel de un componente del tour lleva el renglón nuevo", () => {
    const tour = producto("prod-tour1", "TOUR1", [], { esTour: true, componentes: [componente("c-hot1", 1, 1, 3, hotel)] });
    const r = ok(
      armarPedidos(
        reserva({
          productoId: tour.id,
          habitacion: "Twin Room - Hostel",
          fechaInicio: "2027-02-10",
          fechaFin: "2027-02-13",
          partes: [parte({ id: "p1", orden: 1, tipo: "paquete", productoId: hotel.id, productoComponenteId: "c-hot1", fechaInicio: "2027-02-10", fechaFin: "2027-02-13" })],
        }),
        catalogoCon([tour, hotel]),
        plantilla,
      ),
    );
    expect(renglonHabitacion(pedidoDelHotel(r).cuerpo)).toEqual(["Habitación: TWIN Standard con desayuno"]);
  });
});

describe("armarPedidos — lo que no es hotel/hostel no cambia (filas 3 y 4)", () => {
  it.each([
    ["Dormitory - Hostel", "Habitación: dorm compartido"],
    ["Double Room - Hostel", "Habitación: DBL con baño compartido"],
    ["Single Room - Hostel", "Habitación: SGL con baño compartido"],
  ])("el Overland con %s sigue con «%s», sin desayuno ni Standard", (habitacion, esperado) => {
    const r = ok(armarPedidos({ ...reservaChb31, habitacion }, catalogoChb31, plantilla));
    const imperio = r.pedidos.find((p) => p.destinatarios.includes("reservas@imperioinca.test"))!.cuerpo;
    const overland = imperio.slice(imperio.indexOf("Overland San Pedro de Atacama to Uyuni")).split("\n\n")[0];
    expect(renglonHabitacion(overland)).toEqual([esperado]);
    expect(overland).not.toMatch(/desayuno|Standard/);
  });

  it("el W Trek (servicio «otro») no lleva renglón de habitación", () => {
    const trek = producto("prod-wtrek", "PNTW99", [
      servicio({ productoId: "prod-wtrek", tipo: "otro", orden: 1, descripcion: "W Trek Standard. Booking Supplier: Las Torres", serviceProviderNombre: "W Trek Standard", bookingSupplier: P.cuenca, tramosNoches: [{ nocheDesde: 1, noches: 4, lugar: "refugios" }] }),
    ], { destino: "PNT" });
    const r = ok(armarPedidos(reserva({ productoId: trek.id, habitacion: "Double Room - Hostel", fechaInicio: "2027-02-10", fechaFin: "2027-02-14" }), catalogoCon([trek]), plantilla));
    const cuerpo = r.pedidos.map((p) => p.cuerpo).join("\n");
    expect(cuerpo).toContain("W Trek Standard");
    expect(cuerpo).not.toMatch(/Habitación:|desayuno/);
  });

  it("la tarea interna (WhatsApp) sigue con el tipo de hoy: «(dorm compartido)»", () => {
    const r = ok(armarPedidos({ ...reservaChb31, habitacion: "Dormitory - Hostel" }, catalogoChb31, plantilla));
    const whatsapp = r.tareas.filter((t) => t.tipo === "whatsapp");
    expect(whatsapp.length).toBeGreaterThan(0);
    for (const t of whatsapp) {
      expect(t.texto).toContain("(dorm compartido)");
      expect(t.texto).not.toMatch(/desayuno|Standard/);
    }
  });
});
