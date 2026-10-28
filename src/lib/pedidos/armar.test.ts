import { describe, expect, it } from "vitest";
import { armarPedidos } from "./armar";
import { cargarExcursionesConEntrada } from "./cargar";
import { cargarPlantilla, leerPlantilla } from "./plantilla";
import {
  P,
  catalogoChb31,
  catalogoCon,
  componente,
  od010b,
  parte,
  producto,
  reserva,
  reservaChb31,
  reservaOd010b,
  servicio,
} from "./fixtures.test-utils";
import { MARCA_NOMBRE, type ResultadoArmado } from "./tipos";

const plantilla = cargarPlantilla();

function ok(r: ResultadoArmado) {
  if (!r.ok) throw new Error(`Se esperaba un armado: ${r.error}`);
  return r;
}

const pedidoA = (r: ReturnType<typeof ok>, mail: string) => r.pedidos.find((p) => p.destinatarios.includes(mail));

describe("armarPedidos — un borrador por casilla (fila 1)", () => {
  it("OD010B: el hotel El Pueblito y el Paquete 105 van en UN borrador a reservas8@", () => {
    const r = ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla));
    expect(r.pedidos).toHaveLength(1);
    const [p] = r.pedidos;
    expect(p.destinatarios).toEqual(["reservas8@cuencadelplata.com"]);
    expect(p.proveedores.map((x) => x.id).sort()).toEqual([P.cuenca.id, P.pueblito.id].sort());
    expect(p.cuerpo).toContain("Alojamiento: El Pueblito Iguazu");
    expect(p.cuerpo).toContain("105 Premium x Foz");
    // En orden de fecha: el hotel (IN el 3) antes que el lado argentino (el 4).
    expect(p.cuerpo.indexOf("El Pueblito")).toBeLessThan(p.cuerpo.indexOf("Lado argentino"));
    expect(p.partes).toHaveLength(2);
  });

  it("IGRE01 + IGRE02 de Journaway: un borrador a reservas8@ con los dos lados", () => {
    const igre01 = producto("prod-igre01", "IGRE01", [
      servicio({ productoId: "prod-igre01", tipo: "excursion", descripcion: "Argentina Side of the Falls, full day, Premium small groups", bookingSupplier: P.cuencaArg }),
    ], { destino: "IGR" });
    const igre02 = producto("prod-igre02", "IGRE02", [
      servicio({ productoId: "prod-igre02", tipo: "excursion", descripcion: "Brazilian Side of the Falls, half day, Premium small groups (max 15)", bookingSupplier: P.cuencaBra }),
    ], { destino: "IGR" });
    const r = ok(
      armarPedidos(
        reserva({
          agencia: "Journaway",
          productoId: igre01.id,
          otrosProductos: [igre02.id],
          partes: [
            parte({ id: "a", orden: 1, tipo: "paquete", productoId: igre01.id, fechaInicio: "2027-06-14", fechaFin: "2027-06-14", pickUp: "Hotel Sol" }),
            parte({ id: "b", orden: 2, tipo: "paquete", productoId: igre02.id, fechaInicio: "2027-06-15", fechaFin: "2027-06-15" }),
          ],
        }),
        catalogoCon([igre01, igre02]),
        plantilla,
      ),
    );
    expect(r.pedidos).toHaveLength(1);
    expect(r.pedidos[0].destinatarios).toEqual(["reservas8@cuencadelplata.com"]);
    expect(r.pedidos[0].cuerpo).toContain("Argentina Side of the Falls");
    expect(r.pedidos[0].cuerpo).toContain("Brazilian Side of the Falls");
    expect(r.pedidos[0].cuerpo).toContain("Fecha: 14 jun 2027");
    expect(r.pedidos[0].cuerpo).toContain("Pick up: Hotel Sol");
  });
});

describe("armarPedidos — tour compuesto (fila 2)", () => {
  const r = ok(armarPedidos(reservaChb31, catalogoChb31, plantilla));

  it("un borrador por casilla, cada uno solo con sus servicios", () => {
    expect(r.pedidos.map((p) => p.destinatarios[0]).sort()).toEqual(["reservas@horizonte.test", "reservas@imperioinca.test"]);
    const horizonte = pedidoA(r, "reservas@horizonte.test")!;
    expect(horizonte.cuerpo).toContain("Geisers del Tatio");
    expect(horizonte.cuerpo).not.toContain("Overland");
    const imperio = pedidoA(r, "reservas@imperioinca.test")!;
    expect(imperio.cuerpo).toContain("Overland San Pedro de Atacama to Uyuni");
    expect(imperio.cuerpo).toContain("Bus Uyuni – La Paz");
    expect(imperio.cuerpo).not.toContain("Tatio");
  });

  it("el Overland es tour regular y lleva la habitación (dorm, DBL o SGL con baño compartido); la tarea de WhatsApp también", () => {
    const conDorm = ok(armarPedidos({ ...reservaChb31, habitacion: "Dormitory - Hostel" }, catalogoChb31, plantilla));
    const imperio = pedidoA(conDorm, "reservas@imperioinca.test")!.cuerpo;
    expect(imperio).toMatch(/Overland San Pedro de Atacama to Uyuni\nDesde: .*\nServicio: tour regular\nHabitación: dorm compartido/);
    const dbl = ok(armarPedidos({ ...reservaChb31, habitacion: "Double Room - Hostel" }, catalogoChb31, plantilla));
    expect(pedidoA(dbl, "reservas@imperioinca.test")!.cuerpo).toContain("Habitación: DBL con baño compartido");
    const sgl = ok(armarPedidos({ ...reservaChb31, habitacion: "Single Room - Hostel" }, catalogoChb31, plantilla));
    expect(pedidoA(sgl, "reservas@imperioinca.test")!.cuerpo).toContain("Habitación: SGL con baño compartido");
    const whatsapp = conDorm.tareas.filter((t) => t.tipo === "whatsapp");
    expect(whatsapp.length).toBeGreaterThan(0);
    for (const t of whatsapp) expect(t.texto).toContain("(dorm compartido)");
  });

  it("las fechas salen del inicio de la reserva: el Tatio el día 3, el Overland del 21 al 23, el bus el 23", () => {
    expect(pedidoA(r, "reservas@horizonte.test")!.cuerpo).toContain("Fecha: 20 ene 2027");
    const imperio = pedidoA(r, "reservas@imperioinca.test")!.cuerpo;
    expect(imperio).toContain("21 ene 2027");
    expect(imperio).toContain("23 ene 2027");
  });
});

describe("armarPedidos — qué lleva cada servicio (fila 3)", () => {
  it("alojamiento: IN/OUT, noches y tipo de habitación (Standard con desayuno, M3-18); sin régimen inventado", () => {
    const p = ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("IN: 3 oct 2026");
    expect(p.cuerpo).toContain("OUT: 6 oct 2026 (3 noches)");
    expect(p.cuerpo).toContain("Habitación: DBL Standard con desayuno");
    expect(p.cuerpo).not.toMatch(/régimen/i);
  });

  it("excursión: fecha, idioma inglés por defecto y regular", () => {
    const p = ok(armarPedidos(reservaChb31, catalogoChb31, plantilla)).pedidos.find((x) => x.cuerpo.includes("Tatio"))!;
    expect(p.cuerpo).toMatch(/Excursión: Geisers del Tatio\nFecha: 20 ene 2027\nServicio: regular · Idioma: inglés/);
  });

  it("excursión privada: dice privado", () => {
    const priv = producto("prod-priv", "PRIV1", [
      servicio({ productoId: "prod-priv", tipo: "excursion", descripcion: "Trekking Poike 3 hrs Private", bookingSupplier: P.horizonte }),
    ]);
    const p = ok(
      armarPedidos(reserva({ productoId: priv.id, fechaInicio: "2027-02-01", fechaFin: "2027-02-01" }), catalogoCon([priv]), plantilla),
    ).pedidos[0];
    expect(p.cuerpo).toContain("Servicio: privado · Idioma: inglés");
  });

  it("traslado sin vuelo: dice 'Vuelo pendiente' y el borrador igual se arma", () => {
    const trf = producto("prod-trf", "OD016", [
      servicio({ productoId: "prod-trf", tipo: "traslado", sentido: "llegada", descripcion: "Transfer FTE Airport - El Calafate Accommodation. Booking Supplier: Chalten Travel", bookingSupplier: P.chalten }),
    ], { destino: "FTE" });
    const r = ok(armarPedidos(reserva({ productoId: trf.id, fechaInicio: "2027-01-24", fechaFin: "2027-01-28" }), catalogoCon([trf]), plantilla));
    expect(r.pedidos).toHaveLength(1);
    expect(r.pedidos[0].cuerpo).toContain("Traslado de llegada: Transfer FTE Airport - El Calafate Accommodation");
    expect(r.pedidos[0].cuerpo).toContain("Fecha: 24 ene 2027");
    expect(r.pedidos[0].cuerpo).toContain("Vuelo pendiente");
  });

  it("traslado con vuelo: número, aeropuerto y hora", () => {
    const trf = producto("prod-trf", "OD016", [
      servicio({ productoId: "prod-trf", tipo: "traslado", sentido: "llegada", descripcion: "Transfer FTE Airport - El Calafate Accommodation", bookingSupplier: P.chalten }),
    ], { destino: "FTE" });
    const r = ok(
      armarPedidos(
        reserva({
          productoId: trf.id,
          fechaInicio: "2027-01-24",
          fechaFin: "2027-01-28",
          vuelos: [{ numero: "AR1850", origen: "AEP", destino: "FTE", fecha_llegada: "2027-01-24", hora_llegada: "20:05" }],
        }),
        catalogoCon([trf]),
        plantilla,
      ),
    );
    expect(r.pedidos[0].cuerpo).toContain("Vuelo: AR1850 (FTE) llegada 20:05 hs");
    expect(r.pedidos[0].cuerpo).not.toContain("pendiente");
  });

  it("en Iguazú el traslado sin dato dice 'Bus o vuelo pendiente' (M3-28: en el Premium, sin 'regular')", () => {
    const p = ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("TRF IN: 3 oct 2026 · Bus o vuelo pendiente");
    expect(p.cuerpo).toContain("Lado argentino, Premium, en inglés: 4 oct 2026");
    expect(p.cuerpo).toContain("Lado brasileño, Premium, en inglés: 5 oct 2026");
    expect(p.cuerpo).toContain("TRF OUT: 6 oct 2026 · Bus o vuelo pendiente");
    expect(p.cuerpo).not.toContain("Ese día cruzan");
  });

  it("Combined que empieza en Brasil (OD010D): lado brasileño el día 2 y argentino el día 3, el del cruce", () => {
    const od010d = { ...od010b, id: "prod-od010d", codigo: "OD010D", servicios: od010b.servicios.map((s) => ({ ...s, productoId: "prod-od010d" })) };
    const p = ok(armarPedidos({ ...reservaOd010b, productoId: od010d.id }, catalogoCon([od010d]), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("Lado brasileño, Premium, en inglés: 4 oct 2026");
    expect(p.cuerpo).toContain("Lado argentino, Premium, en inglés: 5 oct 2026");
    expect(p.cuerpo).toContain("Ese día cruzan: el drop off es en el hotel de Argentina. Los pasajeros hacen check out y llevan el equipaje");
    expect(p.cuerpo.indexOf("Ese día cruzan")).toBeGreaterThan(p.cuerpo.indexOf("Lado argentino"));
  });
});

describe("armarPedidos — los pasajeros (fila 4)", () => {
  it("con pasaportes en la reserva, el pedido del hotel los lleva", () => {
    const r = ok(
      armarPedidos(
        { ...reservaOd010b, pasajeros: [{ nombre: "Ana", apellido: "Gómez", nacionalidad: "Denmark", fecha_nacimiento: "1990-05-17", pasaporte: "XX1234567" }] , pax: 1 },
        catalogoCon([od010b]),
        plantilla,
      ),
    );
    expect(r.pedidos[0].cuerpo).toContain("PAX 1: Ana Gómez · Nacionalidad: Denmark · Fecha de nacimiento: 17/05/1990 · Pasaporte: XX1234567");
    expect(r.pedidos[0].cuerpo).toContain("Pasajeros: 1");
  });

  it("un pedido de solo traslados no lleva los datos de los pasajeros, solo el principal", () => {
    const trf = producto("prod-trf", "OD016", [
      servicio({ productoId: "prod-trf", tipo: "traslado", sentido: "llegada", descripcion: "Transfer FTE Airport - El Calafate Accommodation", bookingSupplier: P.chalten }),
    ], { destino: "FTE" });
    const p = ok(armarPedidos(reserva({ productoId: trf.id, fechaInicio: "2027-01-24", fechaFin: "2027-01-28" }), catalogoCon([trf]), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("Pasajeros: 2 (pasajero principal: Ana Gómez)");
    expect(p.cuerpo).not.toContain("PAX 1");
    expect(p.cuerpo).not.toContain("Nacionalidad");
  });

  it("sin datos de pasajeros no aparece ningún 'PAX 1:' vacío", () => {
    const r = ok(armarPedidos({ ...reservaOd010b, pasajeros: [] }, catalogoCon([od010b]), plantilla));
    expect(r.pedidos[0].cuerpo).not.toContain("PAX");
    expect(r.pedidos[0].cuerpo).toContain("Pasajeros: 2");
  });
});

describe("armarPedidos — asunto (fila 5; M3-16: sin códigos internos)", () => {
  it("'Solicitud de reserva – pasajero x pax – fechas' (M3-28): sin el código del producto ni el número de la agencia", () => {
    const p = ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla)).pedidos[0];
    // M3-28 (owner, 2026-10-28): el asunto lleva "x N" con los pax después del pasajero.
    expect(p.asunto).toBe("Solicitud de reserva – Ana Gómez x 2 – 3 al 6 oct 2026");
    expect(p.asunto).not.toContain("OD010B");
    expect(p.asunto).not.toContain("DK1234567");
  });
  it("sin número, igual", () => {
    const p = ok(armarPedidos({ ...reservaOd010b, numero: null }, catalogoCon([od010b]), plantilla)).pedidos[0];
    expect(p.asunto).toBe("Solicitud de reserva – Ana Gómez x 2 – 3 al 6 oct 2026");
  });
  it("las fechas son las de ese pedido, no las de toda la reserva", () => {
    const r = ok(armarPedidos(reservaChb31, catalogoChb31, plantilla));
    for (const p of r.pedidos) {
      expect(p.asunto).toMatch(/^Solicitud de reserva – Ana Gómez x 2 – \d/);
      expect(p.asunto).not.toMatch(/CHB31|OD030|COMPBO20/);
    }
    expect(r.pedidos.map((p) => p.asunto)).not.toContain("Solicitud de reserva – Ana Gómez x 2 – 18 al 24 ene 2027");
    expect(pedidoA(r, "reservas@horizonte.test")!.asunto).toBe("Solicitud de reserva – Ana Gómez x 2 – 20 ene 2027");
    expect(pedidoA(r, "reservas@imperioinca.test")!.asunto).toBe("Solicitud de reserva – Ana Gómez x 2 – 21 al 23 ene 2027");
  });
  it("un solo día → esa fecha", () => {
    const exc = producto("prod-exc", "EXC01", [servicio({ productoId: "prod-exc", tipo: "excursion", descripcion: "Argentina Side of the Falls", bookingSupplier: P.cuencaArg })], { destino: "IGR" });
    const r = reserva({ productoId: exc.id, partes: [parte({ id: "a", orden: 1, tipo: "paquete", productoId: exc.id, fechaInicio: "2027-03-13", fechaFin: "2027-03-13" })] });
    expect(ok(armarPedidos(r, catalogoCon([exc]), plantilla)).pedidos[0].asunto).toBe("Solicitud de reserva – Ana Gómez x 2 – 13 mar 2027");
  });
  it("sin ninguna fecha conocida: sin el guion colgando", () => {
    const p = ok(armarPedidos({ ...reservaOd010b, fechaInicio: null, fechaFin: null, partes: [] }, catalogoCon([od010b]), plantilla)).pedidos[0];
    expect(p.asunto).toBe("Solicitud de reserva – Ana Gómez x 2");
  });
});

describe("armarPedidos — la plantilla y la firma (fila 6)", () => {
  it("el tono sale de la plantilla: saludo, pedido, agradecimiento y cierre", () => {
    const p = ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla)).pedidos[0];
    expect(p.cuerpo.startsWith("¡Hola!")).toBe(true);
    expect(p.cuerpo).toMatch(/gracias/i);
    expect(p.firma).toContain(MARCA_NOMBRE);
    expect(p.firma).toContain("Hi Travel South America");
    expect(p.firma).toContain("On duty phone: +54 9 11 5588-9443");
    expect(p.firma).toContain("www.hitravel.com.ar");
    expect(p.firma).toContain("Instagram @hitravelargentina");
    // El nombre queda aparte: el cuerpo no tiene firma ni el marcador.
    expect(p.cuerpo).not.toContain(MARCA_NOMBRE);
  });

  it("cambiar la plantilla cambia el texto sin tocar código", () => {
    const otra = leerPlantilla(
      "## Asunto\nPedido {{pasajero}} ({{pax}}) {{producto}}{{referencia}}\n## Cuerpo\nBuenas tardes, equipo.\n\n{{servicios}}\n\n{{pasajeros}}\n## Firma\nSaludos, {{nombre_de_quien_envia}}",
    );
    const p = ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), otra)).pedidos[0];
    expect(p.asunto).toBe("Pedido Ana Gómez (2) OD010B · Ref. DK1234567/abcd");
    expect(p.cuerpo.startsWith("Buenas tardes, equipo.")).toBe(true);
    expect(p.firma).toBe("Saludos, {{nombre_de_quien_envia}}");
  });
});

describe("armarPedidos — lo que no se pide (fila 7)", () => {
  it("SPAP05: nada a Our Habitas, Tayka ni los hoteles de la agencia; los Tayka van en el pedido de Imperio Inca", () => {
    const uyuo01 = producto("prod-uyuo01", "UYUO01", [
      servicio({ productoId: "prod-uyuo01", tipo: "excursion", orden: 1, descripcion: "Overland privado San Pedro – Uyuni, 3 días en jeep 4x4 desde Hito Cajón", bookingSupplier: P.imperio }),
      servicio({ productoId: "prod-uyuo01", tipo: "alojamiento", orden: 2, serviceProviderNombre: "Tayka del Desierto", descripcion: "Tayka del Desierto, habitación doble, noche 1 del Overland", bookingSupplier: P.imperio, tramosNoches: [{ nocheDesde: 1, noches: 1, lugar: null }] }),
      servicio({ productoId: "prod-uyuo01", tipo: "alojamiento", orden: 3, serviceProviderNombre: "Tayka de Sal", descripcion: "Tayka de Sal, habitación doble, noche 2 del Overland", bookingSupplier: P.imperio, tramosNoches: [{ nocheDesde: 2, noches: 1, lugar: null }] }),
      servicio({ productoId: "prod-uyuo01", tipo: "bus", orden: 4, descripcion: "Bus nocturno Uyuni – La Paz, sale la noche del día 3 del Overland desde la terminal de Uyuni", bookingSupplier: P.imperio }),
    ], { destino: "UYU" });
    // Un producto con un hotel que la agencia ya reservó (Our Habitas): no se pide.
    const conHabitas = producto("prod-hab", "SPAH01", [
      servicio({ productoId: "prod-hab", tipo: "alojamiento", serviceProviderNombre: "Our Habitas Atacama", bookingSupplier: P.habitas }),
    ], { destino: "SPA" });
    const spap05 = producto("prod-spap05", "SPAP05", [], {
      esTour: true,
      codigosExternos: [{ agencia: "Journaway", codigo: "san pedro + uyuni", nombreExterno: null }],
      componentes: [componente("c-hab", 1, 1, 4, conHabitas), componente("c-uyu", 2, 5, 2, uyuo01)],
    });
    const r = ok(
      armarPedidos(
        reserva({
          agencia: "Journaway",
          habitacion: null,
          productoId: spap05.id,
          hotelesAgencia: [{ nombre: "Our Habitas Atacama", desde: "2026-10-11", hasta: "2026-10-15" }],
          partes: [
            parte({ id: "h", orden: 1, tipo: "paquete", productoId: conHabitas.id, productoComponenteId: "c-hab", fechaInicio: "2026-10-11", fechaFin: "2026-10-15" }),
            parte({ id: "u", orden: 2, tipo: "paquete", productoId: uyuo01.id, productoComponenteId: "c-uyu", fechaInicio: "2026-10-15", fechaFin: "2026-10-17", pickUp: "Tayka del Desierto Hotel" }),
          ],
        }),
        catalogoCon([spap05, uyuo01, conHabitas]),
        plantilla,
      ),
    );
    const nombres = r.pedidos.flatMap((p) => p.proveedores.map((x) => x.nombre));
    expect(nombres).toEqual(["Imperio Inca"]);
    expect(r.pedidos.flatMap((p) => p.destinatarios)).not.toContain("reservas@habitas.test");
    const imperio = r.pedidos[0].cuerpo;
    expect(imperio).toContain("Alojamiento: Tayka del Desierto");
    expect(imperio).toContain("IN: 15 oct 2026");
    expect(imperio).toContain("Alojamiento: Tayka de Sal");
    expect(imperio).toContain("IN: 16 oct 2026");
    expect(imperio).toContain("Bus: Bus nocturno Uyuni – La Paz");
    expect(imperio).toContain("17 oct 2026");
    expect(r.avisos.join("\n")).toMatch(/Our Habitas Atacama.*agencia/);
  });

  it("el lado del traslado marcado en sin_traslado_de no se pide", () => {
    const trf = producto("prod-trf", "OD016", [
      servicio({ productoId: "prod-trf", tipo: "traslado", sentido: "ida_y_vuelta", descripcion: "Transfer Round Trip", bookingSupplier: P.chalten }),
    ], { destino: "FTE" });
    const r = ok(
      armarPedidos(reserva({ productoId: trf.id, fechaInicio: "2027-01-24", fechaFin: "2027-01-28", sinTrasladoDe: "salida" }), catalogoCon([trf]), plantilla),
    );
    expect(r.pedidos[0].cuerpo).toContain("Traslado de llegada");
    expect(r.pedidos[0].cuerpo).not.toContain("Traslado de salida");
  });
});

describe("armarPedidos — tareas en vez de mails (fila 8)", () => {
  it("ARCH31: el bus El Calafate – El Chaltén queda como tarea 'emitir boleto' y sin borrador", () => {
    const od033 = producto("prod-od033", "OD033", [
      servicio({ productoId: "prod-od033", tipo: "alojamiento", nivel: "Hostel", serviceProviderNombre: "Rancho Grande", bookingSupplier: P.chalten }),
    ], { destino: "CHA" });
    const arch31 = producto("prod-arch31", "ARCH31", [], { esTour: true, componentes: [componente("c-033", 1, 1, 3, od033)] });
    const r = ok(
      armarPedidos(
        reserva({
          productoId: arch31.id,
          fechaInicio: "2027-03-01",
          fechaFin: "2027-03-09",
          partes: [
            parte({ id: "b", orden: 1, tipo: "tramo_bus", esTarea: true, descripcionRuta: "El Calafate – El Chaltén", fechaInicio: "2027-03-01", fechaFin: "2027-03-01" }),
            parte({ id: "o", orden: 2, tipo: "paquete", productoId: od033.id, productoComponenteId: "c-033", fechaInicio: "2027-03-01", fechaFin: "2027-03-04" }),
          ],
        }),
        catalogoCon([arch31, od033]),
        plantilla,
      ),
    );
    expect(r.tareas).toContainEqual(expect.objectContaining({ tipo: "emitir_boleto", texto: "Emitir boleto: El Calafate – El Chaltén, 1 mar 2027" }));
    expect(r.pedidos.some((p) => p.cuerpo.includes("El Calafate – El Chaltén"))).toBe(false);
    expect(r.pedidos).toHaveLength(1);
  });

  it("un proveedor de WhatsApp da una tarea y ningún borrador", () => {
    const r = ok(armarPedidos(reservaChb31, catalogoChb31, plantilla));
    const wa = r.tareas.filter((t) => t.tipo === "whatsapp");
    expect(wa).toHaveLength(1);
    expect(wa[0].texto).toContain("Contactar por WhatsApp a Backpacker San Pedro Hostel (+56 9 1111 2222)");
    expect(wa[0].texto).toContain("San Pedro Backpackers");
    expect(wa[0].texto).toContain("18 ene 2027");
    expect(r.pedidos.flatMap((p) => p.proveedores.map((x) => x.id))).not.toContain(P.backpackers.id);
  });

  it("un servicio de reserva manual (Transvip) da una tarea y nunca un mail (M3-28: con una p, aunque el Excel diga Transvipp)", () => {
    const r = ok(armarPedidos(reservaChb31, catalogoChb31, plantilla));
    const manual = r.tareas.filter((t) => t.tipo === "reservar_a_mano");
    expect(manual).toHaveLength(1);
    expect(manual[0].texto).toMatch(/^Reservar a mano en Transvip: traslado de llegada .*CJC.*18 ene 2027 · Vuelo pendiente$/);
    expect(r.pedidos.some((p) => p.cuerpo.includes("CJC"))).toBe(false);
  });
});

describe("armarPedidos — proveedor sin mail (fila 9)", () => {
  it("queda un borrador sin destinatario con el motivo, y los demás se arman", () => {
    const prod = producto("prod-x", "OD099", [
      servicio({ productoId: "prod-x", tipo: "alojamiento", nivel: "Hostel", serviceProviderNombre: "Hostel Sin Mail", bookingSupplier: P.sinMail }),
      servicio({ productoId: "prod-x", tipo: "excursion", descripcion: "Excursion: City Tour. Booking Supplier: Chalten Travel", bookingSupplier: P.chalten }),
    ]);
    const r = ok(armarPedidos(reserva({ productoId: prod.id, fechaInicio: "2027-02-01", fechaFin: "2027-02-03" }), catalogoCon([prod]), plantilla));
    expect(r.pedidos).toHaveLength(2);
    const sin = r.pedidos.find((p) => p.destinatarios.length === 0)!;
    expect(sin.sinDestinatario).toBe("Falta el mail de Hostel Sin Mail: completalo en el directorio de proveedores.");
    expect(sin.cuerpo).toContain("Hostel Sin Mail");
    expect(pedidoA(r, "agencias@chaltentravel.test")).toBeDefined();
  });
});

describe("armarPedidos — solo reservas recibidas (fila 10)", () => {
  it("una reserva para revisión no arma nada", () => {
    const r = armarPedidos({ ...reservaOd010b, estado: "para_revision" }, catalogoCon([od010b]), plantilla);
    expect(r).toEqual({ ok: false, error: "Resolvé primero lo que está para revisión." });
  });
  it("las de prueba también se arman (son recibidas)", () => {
    expect(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla).ok).toBe(true);
  });
});

describe("armarPedidos — detalles", () => {
  it("con varias opciones de hotel toma la primera y lo avisa", () => {
    const p = ok(armarPedidos(reservaOd010b, catalogoCon([od010b]), plantilla)).pedidos[0];
    expect(p.avisos.join("\n")).toMatch(/El Pueblito Iguazu.*primera opción.*Tetris/);
  });

  it("sin el nivel en la habitación y con varios niveles, deja una tarea para elegir el hotel", () => {
    const r = ok(armarPedidos({ ...reservaOd010b, habitacion: "SGL" }, catalogoCon([od010b]), plantilla));
    expect(r.tareas).toContainEqual(expect.objectContaining({ tipo: "revisar", texto: expect.stringMatching(/Elegir el hotel de OD010B/) }));
    expect(r.pedidos[0].cuerpo).not.toContain("Alojamiento:");
  });

  it("los nombres salen limpios: sin 'Booking Supplier', prefijos ni signos sueltos", () => {
    const prod = producto("prod-z", "OD097", [
      servicio({ productoId: "prod-z", tipo: "excursion", orden: 1, descripcion: "Excursion. Torres del Paine Full Day from Puerto Natales: Booking Supplier: Patagonia Planet", bookingSupplier: P.chalten }),
      servicio({ productoId: "prod-z", tipo: "excursion", orden: 2, descripcion: "Excursion: Tierra del Fuego National Park half Day. Bookind Supplier: Rumbo Sur", bookingSupplier: P.chalten }),
      servicio({ productoId: "prod-z", tipo: "excursion", orden: 3, descripcion: "Excursion: Beagle Channel Boat Trip, 3 hours, no transfer to port /\nBooking Supplier: Rumbo Sur", bookingSupplier: P.chalten }),
    ]);
    const p = ok(armarPedidos(reserva({ productoId: prod.id, fechaInicio: "2027-01-24", fechaFin: "2027-01-24" }), catalogoCon([prod]), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("Excursión: Torres del Paine Full Day from Puerto Natales\n");
    expect(p.cuerpo).toContain("Excursión: Tierra del Fuego National Park half Day\n");
    expect(p.cuerpo).toContain("Excursión: Beagle Channel Boat Trip, 3 hours, no transfer to port\n");
  });

  it("una excursión de varios días (el Overland) va con sus fechas y en español si el chofer es de habla hispana", () => {
    const uyu = producto("prod-uyu", "UYUO01", [
      servicio({ productoId: "prod-uyu", tipo: "excursion", descripcion: "Overland privado San Pedro – Uyuni, 3 días en jeep 4x4 desde Hito Cajón, con chofer de habla hispana (sin guía en inglés)", bookingSupplier: P.imperio }),
    ]);
    const r = ok(armarPedidos(reserva({ productoId: uyu.id, fechaInicio: "2026-10-15", fechaFin: "2026-10-17" }), catalogoCon([uyu]), plantilla));
    expect(r.pedidos[0].cuerpo).toContain("Desde: 15 oct 2026 · Hasta: 17 oct 2026");
    expect(r.pedidos[0].cuerpo).toContain("Servicio: privado · Idioma: español");
    expect(r.pedidos[0].avisos).toEqual([]);
  });

  it("final de ARCH31 con vuelo desde Puerto Natales: el transfer al aeropuerto PNT va como traslado de salida", () => {
    const planet = { id: "prov-planet", nombre: "Patagonia Planet", mails: ["excursiones@planet.test"], canal: "mail" as const, telefono: null };
    const arch = producto("prod-arch", "ARCH31", [], { esTour: true });
    const r = ok(
      armarPedidos(
        reserva({
          productoId: arch.id,
          vuelos: [{ numero: "JA1234", origen: "PNT", destino: "SCL", fecha_salida: "2027-03-09", hora_salida: "14:20" }],
          partes: [parte({ id: "t", orden: 1, tipo: "servicio", descripcionRuta: "Transfer al aeropuerto de Puerto Natales (PNT)", proveedorId: planet.id, fechaInicio: "2027-03-09", fechaFin: "2027-03-09" })],
        }),
        catalogoCon([arch], [planet]),
        plantilla,
      ),
    );
    expect(r.pedidos[0].cuerpo).toContain("Traslado de salida: Transfer al aeropuerto de Puerto Natales (PNT)\nFecha: 9 mar 2027\nVuelo: JA1234 (PNT) salida 14:20 hs");
  });

  it("una excursión sin día conocido queda 'a coordinar' con un aviso", () => {
    const prod = producto("prod-y", "OD098", [
      servicio({ productoId: "prod-y", tipo: "excursion", descripcion: "Excursion: Perito Moreno Glaciar Excursion. Booking Supplier: Chalten Travel", bookingSupplier: P.chalten }),
    ]);
    const p = ok(armarPedidos(reserva({ productoId: prod.id, fechaInicio: "2027-01-24", fechaFin: "2027-01-28" }), catalogoCon([prod]), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("Fecha: a coordinar (estadía del 24 al 28 ene 2027)");
    expect(p.avisos.join("\n")).toMatch(/Falta la fecha de Perito Moreno Glaciar Excursion/);
  });
});

describe("armarPedidos — pick up de las excursiones (owner, 2026-10-19)", () => {
  const tatio = (r: ReturnType<typeof ok>) => r.pedidos.find((p) => p.cuerpo.includes("Geisers del Tatio"))!;

  it("CHB31: el Tatio dice el hostel del OD030 de esas fechas, a confirmar porque se pide en esta reserva", () => {
    const p = tatio(ok(armarPedidos(reservaChb31, catalogoChb31, plantilla)));
    expect(p.cuerpo).toMatch(
      /Excursión: Geisers del Tatio\nFecha: 20 ene 2027\nServicio: regular · Idioma: inglés\nPick up y drop off: San Pedro Backpackers \(San Pedro de Atacama\) · hotel a confirmar/,
    );
    expect(p.cuerpo).not.toContain("Les pasamos el alojamiento");
  });

  it("con el pick up que manda la agencia (Journaway) se usa ese, como antes", () => {
    const r = ok(
      armarPedidos(
        {
          ...reservaChb31,
          agencia: "Journaway",
          hotelesAgencia: [{ nombre: "Hotel Cumbres", desde: "2027-01-18", hasta: "2027-01-21" }],
          partes: reservaChb31.partes.map((x) => (x.id === "p1" ? { ...x, pickUp: "Hotel Kimal" } : x)),
        },
        catalogoChb31,
        plantilla,
      ),
    );
    const p = tatio(r);
    expect(p.cuerpo).toContain("Pick up: Hotel Kimal\n");
    expect(p.cuerpo).not.toContain("Cumbres");
    expect(p.cuerpo).not.toContain("a confirmar");
  });

  it("el hotel que reserva la agencia esa noche, sin 'a confirmar'", () => {
    const spae04 = producto("prod-spae04", "SPAE04", [
      servicio({ productoId: "prod-spae04", tipo: "excursion", descripcion: "El Tatio Geisers Tour (entrance fee)", bookingSupplier: P.horizonte }),
    ], { destino: "SPA" });
    const r = ok(
      armarPedidos(
        reserva({
          agencia: "Journaway",
          habitacion: null,
          productoId: spae04.id,
          hotelesAgencia: [
            { nombre: "Hotel Altiplánico", desde: "2027-03-01", hasta: "2027-03-03" },
            { nombre: "Hotel Cumbres", desde: "2027-03-03", hasta: "2027-03-06" },
          ],
          partes: [parte({ id: "e", orden: 1, tipo: "paquete", productoId: spae04.id, fechaInicio: "2027-03-04", fechaFin: "2027-03-04" })],
        }),
        catalogoCon([spae04]),
        plantilla,
      ),
    );
    expect(r.pedidos[0].cuerpo).toContain("Pick up y drop off: Hotel Cumbres\n");
    expect(r.pedidos[0].cuerpo).not.toContain("a confirmar");
  });

  it("sin alojamiento en la reserva: 'alojamiento a confirmar' y el pendiente para el proveedor", () => {
    const city = producto("prod-city", "SCLE01", [
      servicio({ productoId: "prod-city", tipo: "excursion", descripcion: "Excursion: City Tour. Booking Supplier: Chalten Travel", bookingSupplier: P.chalten }),
    ]);
    const p = ok(armarPedidos(reserva({ productoId: city.id, fechaInicio: "2027-02-01", fechaFin: "2027-02-01" }), catalogoCon([city]), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("Pick up y drop off: alojamiento a confirmar");
    expect(p.cuerpo).toContain("Les pasamos el alojamiento para el pick up apenas lo tengamos.");
  });

  it("el Overland de Imperio Inca (CHB31) lleva el pick up en el hostel de OD030, el del OUT del día que arranca", () => {
    const imperio = ok(armarPedidos(reservaChb31, catalogoChb31, plantilla)).pedidos.find((p) => p.cuerpo.includes("Overland"))!;
    expect(imperio.cuerpo).toMatch(
      /Overland San Pedro de Atacama to Uyuni\nDesde: 21 ene 2027 · Hasta: 23 ene 2027\nServicio: tour regular\nHabitación: [^\n]+\nPick up: San Pedro Backpackers \(San Pedro de Atacama\) · hotel a confirmar/,
    );
  });

  it("el Overland sin alojamiento antes: 'alojamiento a confirmar' y el pendiente", () => {
    const solo = { ...reservaChb31, partes: reservaChb31.partes.filter((x) => x.id !== "p1") };
    const imperio = ok(armarPedidos(solo, catalogoChb31, plantilla)).pedidos.find((p) => p.cuerpo.includes("Overland"))!;
    expect(imperio.cuerpo).toContain("Servicio: tour regular");
    expect(imperio.cuerpo).toContain("Pick up: alojamiento a confirmar");
    expect(imperio.cuerpo).toContain("Les pasamos el alojamiento para el pick up apenas lo tengamos.");
  });
});

describe("armarPedidos — Journaway: excursiones con entrada (owner, 2026-10-19)", () => {
  const entradas = cargarExcursionesConEntrada();
  const conEntradas = (c: ReturnType<typeof catalogoCon>) => ({ ...c, entradas });
  const excursionSuelta = (codigo: string, descripcion: string, destino: string) =>
    producto(`prod-${codigo}`, codigo, [servicio({ productoId: `prod-${codigo}`, tipo: "excursion", descripcion, bookingSupplier: P.horizonte })], { destino });
  const journaway = (prod: ReturnType<typeof producto>) =>
    reserva({
      agencia: "Journaway",
      habitacion: null,
      productoId: prod.id,
      partes: [parte({ id: "e", orden: 1, tipo: "paquete", productoId: prod.id, fechaInicio: "2027-03-04", fechaFin: "2027-03-04", pickUp: "Hotel Cumbres" })],
    });

  it("un Journaway con el Tatio (SPAE04) se pide con entradas", () => {
    const spae04 = excursionSuelta("SPAE04", "El Tatio Geisers Tour (entrance fee)", "SPA");
    const p = ok(armarPedidos(journaway(spae04), conEntradas(catalogoCon([spae04])), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("Servicio: regular · Idioma: inglés · Con entradas\n");
  });

  it("el Tatio de OD030 dentro de un Journaway también (por el nombre del servicio)", () => {
    const r = ok(armarPedidos({ ...reservaChb31, agencia: "Journaway" }, conEntradas(catalogoChb31), plantilla));
    expect(r.pedidos.find((p) => p.cuerpo.includes("Tatio"))!.cuerpo).toContain("Idioma: inglés · Con entradas");
  });

  it("el mismo Tatio en una reserva de Kilroy NO", () => {
    const r = ok(armarPedidos(reservaChb31, conEntradas(catalogoChb31), plantilla));
    expect(r.pedidos.some((p) => /entradas/i.test(p.cuerpo))).toBe(false);
  });

  it("una excursión de Journaway que no está en la lista (Astrophotography) NO", () => {
    const spae01 = excursionSuelta("SPAE01", "Astrophotography Tour", "SPA");
    const p = ok(armarPedidos(journaway(spae01), conEntradas(catalogoCon([spae01])), plantilla)).pedidos[0];
    expect(p.cuerpo).toContain("Servicio: regular · Idioma: inglés\n");
    expect(p.cuerpo).not.toMatch(/entradas/i);
  });

  it("una excursión de Journaway en otro destino con parque (Cataratas, IGRE01) NO", () => {
    const igre01 = excursionSuelta("IGRE01", "Argentina Side of the Falls, full day, Premium small groups", "IGR");
    const p = ok(armarPedidos(journaway(igre01), conEntradas(catalogoCon([igre01])), plantilla)).pedidos[0];
    expect(p.cuerpo).not.toMatch(/entradas/i);
  });
});
