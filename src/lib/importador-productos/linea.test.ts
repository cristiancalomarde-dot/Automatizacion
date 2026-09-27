import { describe, expect, it } from "vitest";
import { clasificarLinea } from "./linea";

// Spec M1-04 §3 #5, #6, #9 y Anexo técnico (reglas de lectura de la hoja
// "Readme AI"): cómo se lee UNA celda de la columna de la sección 1 de un
// bloque de producto.

describe("clasificarLinea — prioridad por \"/\" (spec M1-04 §3 #5)", () => {
  it("alojamiento \"X / Y / Z\" → un servicio con las 3 opciones en orden 1-2-3", () => {
    const r = clasificarLinea(
      "Accommodation: Beer Hostel / Hostel Inn / Mango Hostel. Booking Supplier: Cuenca del Plata",
    );
    expect(r.clase).toBe("servicio");
    if (r.clase !== "servicio") return;
    expect(r.servicios).toHaveLength(1);
    expect(r.servicios[0].tipo).toBe("alojamiento");
    expect(r.servicios[0].opciones).toEqual([
      { prioridad: 1, serviceProvider: "Beer Hostel", bookingSupplier: "Cuenca del Plata" },
      { prioridad: 2, serviceProvider: "Hostel Inn", bookingSupplier: "Cuenca del Plata" },
      { prioridad: 3, serviceProvider: "Mango Hostel", bookingSupplier: "Cuenca del Plata" },
    ]);
  });

  it("Booking Supplier también con \"/\": cada opción se empareja con el suyo, por posición", () => {
    const r = clasificarLinea(
      "Accommodation: Nacional Inn Foz 3* / Taroba Express. Booking Supplier: Nacional Inn / Taroba",
    );
    if (r.clase !== "servicio") throw new Error(r.clase);
    expect(r.servicios[0].opciones).toEqual([
      { prioridad: 1, serviceProvider: "Nacional Inn Foz 3*", bookingSupplier: "Nacional Inn" },
      { prioridad: 2, serviceProvider: "Taroba Express", bookingSupplier: "Taroba" },
    ]);
  });

  it("una \"/\" pegada sin espacios (\"3* sup/4\") es parte del nombre, no una alternativa", () => {
    const r = clasificarLinea("Accommodation: Taroba Hotel 3* sup/4. Booking Supplier: Taroba");
    if (r.clase !== "servicio") throw new Error(r.clase);
    expect(r.servicios[0].opciones).toEqual([
      { prioridad: 1, serviceProvider: "Taroba Hotel 3* sup/4", bookingSupplier: "Taroba" },
    ]);
  });

  it("\"/\" con cantidades distintas de opciones y de Booking Suppliers (2 vs 3) → dudosa, no se adivina", () => {
    const r = clasificarLinea("Accommodation: A / B. Booking Supplier: X / Y / Z");
    expect(r.clase).toBe("dudosa");
  });
});

describe("clasificarLinea — Service Provider y Booking Supplier (spec M1-04 §3 #6)", () => {
  it("distintos: cada uno en su campo, sin fusionar", () => {
    const r = clasificarLinea("Accommodation: Dann Inn Foz. Booking Supplier: Nacional Inn");
    if (r.clase !== "servicio") throw new Error(r.clase);
    expect(r.servicios[0].opciones).toEqual([
      { prioridad: 1, serviceProvider: "Dann Inn Foz", bookingSupplier: "Nacional Inn" },
    ]);
  });

  it("prefijo sin \":\" y \"Booking Supplier\" sin \":\" también se leen", () => {
    const r = clasificarLinea("Accommodation: Beer Hostel. Booking Supplier Beer Hostel");
    if (r.clase !== "servicio") throw new Error(r.clase);
    expect(r.servicios[0].opciones).toEqual([
      { prioridad: 1, serviceProvider: "Beer Hostel", bookingSupplier: "Beer Hostel" },
    ]);
    const r2 = clasificarLinea(
      "Accommodation Hotel 4*: La Aldea de la Selva. Booking Supplier: Cuenca del Plata",
    );
    if (r2.clase !== "servicio") throw new Error(r2.clase);
    expect(r2.servicios[0].opciones[0].serviceProvider).toBe("Hotel 4*: La Aldea de la Selva");
  });

  it("sin Booking Supplier escrito → queda null (no se asume que es el mismo)", () => {
    const r = clasificarLinea("Excursion: Gran Aventura");
    if (r.clase !== "servicio") throw new Error(r.clase);
    expect(r.servicios[0]).toMatchObject({
      tipo: "excursion",
      opciones: [{ prioridad: 1, serviceProvider: "Gran Aventura", bookingSupplier: null }],
    });
  });

  it("\"+\" = tramos en secuencia: un servicio por tramo, con sus noches y su Booking Supplier", () => {
    const r = clasificarLinea(
      "Accommodation: 2 Nights El Pueblito + 1 night Nacional inn Foz. Booking Supplier: Cuenca del Plana + Nacional Inn",
    );
    if (r.clase !== "servicio") throw new Error(r.clase);
    expect(r.servicios).toHaveLength(2);
    expect(r.servicios[0]).toMatchObject({
      tipo: "alojamiento",
      noches: 2,
      opciones: [{ prioridad: 1, serviceProvider: "El Pueblito", bookingSupplier: "Cuenca del Plana" }],
    });
    expect(r.servicios[1]).toMatchObject({
      noches: 1,
      opciones: [{ prioridad: 1, serviceProvider: "Nacional inn Foz", bookingSupplier: "Nacional Inn" }],
    });
  });

  it("tipos de servicio: excursión, traslado, bus, crucero, otro", () => {
    const tipo = (t: string) => {
      const r = clasificarLinea(t);
      return r.clase === "servicio" ? r.servicios[0].tipo : r.clase;
    };
    expect(tipo("Excursion: Paquete Receptvo 105 Premium. Booking Supplier: Cuenca del Plata")).toBe("excursion");
    expect(tipo("Transfer: IGR - Hotel. Booking Supplier: Remis")).toBe("traslado");
    expect(tipo("Bus: Uyuni - La Paz. Booking Supplier: Todo Turismo")).toBe("bus");
    expect(tipo("Cruise: Navimag. Booking Supplier: Navimag")).toBe("crucero");
    expect(tipo("Car Rental: Hertz. Booking Supplier: Hertz")).toBe("otro");
  });
});

describe("clasificarLinea — lo que no es un servicio (spec M1-04 §3 #2, #9)", () => {
  it("celda en blanco → vacía (filas en blanco intencionales, no son error)", () => {
    expect(clasificarLinea("").clase).toBe("vacia");
    expect(clasificarLinea("   ").clase).toBe("vacia");
  });

  it("rótulos y encabezados de sección", () => {
    for (const t of ["Tarifas", "Tarifas ", "Net Rates", "Excursions", "Accommodation"]) {
      expect(clasificarLinea(t).clase, t).toBe("etiqueta");
    }
  });

  it("filas de tarifa (tipo de habitación) — costos, se ignoran", () => {
    for (const t of ["Dorm", "DBL ", "SGL", "DBL / SGL Alta temporada", "SGL / DBL Baja", "Dorm Alta"]) {
      expect(clasificarLinea(t).clase, t).toBe("tarifa");
    }
  });

  it("\"Includes: …\" → detalle del servicio anterior", () => {
    const r = clasificarLinea("Includes: Transfer in + Out, Excursion Cataratas Argentinas");
    expect(r).toEqual({ clase: "incluye", texto: "Includes: Transfer in + Out, Excursion Cataratas Argentinas" });
  });

  it("\"Paquete(s) …\" marca el fin de la sección 1 (empieza el cálculo de costos)", () => {
    expect(clasificarLinea("Paquetes Iguazu Falls on a Shoestring Argentina p/person").clase).toBe("fin_seccion");
    expect(clasificarLinea("Paquete Iguazu Combined 2 Nights Argentina 1 night Brazil").clase).toBe("fin_seccion");
  });

  it("texto libre que no calza con ningún patrón → dudosa (para IA o para revisar)", () => {
    for (const t of ["Budget Hotel", "Green + Dann Inn", "Extra glamping x pax", "Hostel"]) {
      expect(clasificarLinea(t).clase, t).toBe("dudosa");
    }
  });
});
