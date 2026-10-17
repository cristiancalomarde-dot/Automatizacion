// @vitest-environment node
//
// Spec M1-08 — verificación 2 (regla #5), contra el proyecto Supabase real,
// después de la recarga completa (proveedores → equivalencias → productos →
// paquetes → tours). Consultas de las filas 1-8 de §3, RLS de la tabla nueva
// (0009), la excepción que no cierra (no escribe nada) y lo que leen las
// pantallas.
//
// Solo lee, salvo las corridas fallidas de la fila 3 (que por diseño no escriben).
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { partesPorNoche } from "@/lib/catalogo/reglas";
import { importarToursCompuestos } from "@/lib/importador-tours/importar";
import { hayInsumosTours, leerInsumosTours } from "@/lib/importador-tours/insumos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";

const RAIZ = resolve(__dirname, "..");
const CORRE = credencialesSupabaseDisponibles();
const TIMEOUT = 120_000;

interface FilaServicio {
  orden: number;
  prioridad: number;
  tipo_servicio: string;
  descripcion: string | null;
  service_provider_nombre: string | null;
  booking_supplier_nombre: string | null;
  booking_supplier_id: string | null;
  proveedor_sin_resolver: boolean;
  sentido: string | null;
  a_pedido: string | null;
  bs: { nombre: string; mails: string[] } | null;
}

(CORRE ? describe : describe.skip)("traslados según el tour contra Supabase real (spec M1-08)", () => {
  let admin: SupabaseClient;
  const ids = new Map<string, string>();

  async function idDe(codigo: string): Promise<string> {
    if (!ids.has(codigo)) {
      const { data, error } = await admin.from("producto").select("id").eq("codigo", codigo).single();
      expect(error, codigo).toBeNull();
      ids.set(codigo, data!.id);
    }
    return ids.get(codigo)!;
  }

  async function servicios(codigo: string): Promise<FilaServicio[]> {
    const { data, error } = await admin
      .from("producto_servicio")
      .select(
        "orden, prioridad, tipo_servicio, descripcion, service_provider_nombre, booking_supplier_nombre, booking_supplier_id, proveedor_sin_resolver, sentido, a_pedido, bs:booking_supplier_id(nombre, mails)",
      )
      .eq("producto_id", await idDe(codigo))
      .order("orden")
      .order("prioridad");
    expect(error).toBeNull();
    return data as unknown as FilaServicio[];
  }

  /** Los ajustes de un tour, legibles: "OD020 6 anular regla". */
  async function ajustes(tour: string): Promise<string[]> {
    const { data, error } = await admin
      .from("tour_servicio_ajuste")
      .select("orden, accion, origen, texto, paquete:paquete_id(codigo)")
      .eq("tour_id", await idDe(tour));
    expect(error).toBeNull();
    return (data as unknown as Array<{ orden: number; accion: string; origen: string; paquete: { codigo: string } }>)
      .map((a) => `${a.paquete.codigo} ${a.orden} ${a.accion} ${a.origen}`)
      .sort();
  }

  async function ajuste(tour: string, paquete: string) {
    const { data, error } = await admin
      .from("tour_servicio_ajuste")
      .select("orden, accion, origen, texto, motivo")
      .eq("tour_id", await idDe(tour))
      .eq("paquete_id", await idDe(paquete));
    expect(error).toBeNull();
    return data!;
  }

  beforeAll(() => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("#1 cada traslado de paquete guarda su sentido; lo que no es traslado, ninguno", async () => {
    const sentido = async (codigo: string) =>
      (await servicios(codigo)).filter((s) => s.tipo_servicio === "traslado").map((s) => s.sentido);
    expect(await sentido("OD029")).toEqual(["llegada"]);
    expect(await sentido("OD016")).toEqual(["llegada"]); // Excel corregido el 2026-10-10 (M1-09)
    expect(await sentido("OD022")).toEqual(["ida_y_vuelta"]);
    expect(await sentido("OD018")).toEqual(["ida_y_vuelta"]);
    expect(await sentido("OD030")).toEqual(["llegada"]);
    expect(await sentido("OD033")).toEqual(["llegada", "llegada"]);
    expect(await sentido("OD019")).toEqual(["sin_sentido"]);
    expect((await servicios("OD019")).filter((s) => s.tipo_servicio !== "traslado").every((s) => s.sentido === null)).toBe(true);
  }, TIMEOUT);

  it("#2 la regla general: sin Greeters, Remis ni traslados en el medio; de un solo lado en las puntas de AR09", async () => {
    const c01 = await ajustes("5C01");
    expect(c01).toEqual(expect.arrayContaining(["OD020 6 anular regla", "OD019 4 anular regla"]));
    expect(await ajustes("BRARCH26")).toEqual(expect.arrayContaining(["OD019 4 anular regla", "OD018 6 anular regla"]));
    expect(await ajustes("AR09")).toEqual(["OD013 5 anular regla", "OD018 6 solo_llegada regla", "OD022 4 solo_salida regla", "OD025 4 anular regla"]);
    expect(await ajustes("ARCH33")).toEqual(["OD016 5 anular regla"]);
    expect(await ajustes("ARCH31")).toEqual(expect.arrayContaining(["OD016 5 anular regla"]));
    // el primer paquete conserva la llegada
    expect(c01.some((a) => a.startsWith("OD032"))).toBe(false);
    expect(await ajustes("CHB31")).toEqual([]);
  }, TIMEOUT);

  it("#3 una excepción que nombra un tour, un paquete o un servicio que no existe corta la carga sin escribir nada", async () => {
    if (!hayInsumosTours(RAIZ)) return;
    const insumos = leerInsumosTours(RAIZ);
    const antes = await ajustes("5C01");
    const fila = (tour: string, paquete: string, servicio: string) => ({ tour, paquete, servicio, accion: "anular" as const, motivo: "Motivo." });
    await expect(
      importarToursCompuestos({ admin, ...insumos, excepcionesTraslado: [fila("5C01", "OD018", "EZE o AEP - Hotel - EZE o AEP")] }),
    ).rejects.toThrow(/traslados-tour\.csv.*5C01.*OD018/);
    await expect(
      importarToursCompuestos({ admin, ...insumos, excepcionesTraslado: [fila("5C01", "OD029", "Transfer de Marte")] }),
    ).rejects.toThrow(/traslados-tour\.csv.*OD029.*Transfer de Marte/);
    await expect(
      importarToursCompuestos({ admin, ...insumos, excepcionesTraslado: [fila("ZZ99", "OD029", "SCL - accommodation")] }),
    ).rejects.toThrow(/traslados-tour\.csv.*ZZ99/);
    expect(await ajustes("5C01")).toEqual(antes);
  }, 3 * TIMEOUT);

  it("#4 (a) OD029 sin el traslado SCL de CL Mundo en 5C01 y BRARCH26", async () => {
    for (const tour of ["5C01", "BRARCH26"]) {
      expect(await ajuste(tour, "OD029"), tour).toEqual([expect.objectContaining({ orden: 5, accion: "anular", origen: "excepcion" })]);
    }
  }, TIMEOUT);

  it("#4 (b) el 105 Premium con transfer desde la Rodoviaria de Foz y a la terminal de Puerto Iguazú (OD010D en 5C01, OD010A en BRARCH26)", async () => {
    for (const [tour, paquete] of [["5C01", "OD010D"], ["BRARCH26", "OD010A"]]) {
      const [a] = await ajuste(tour, paquete);
      expect(a, tour).toMatchObject({ accion: "reemplazar", origen: "excepcion" });
      expect(a.texto).toMatch(/Rodoviaria de Foz.*terminal de buses de Puerto Iguazú/);
      const premium = (await servicios(paquete)).find((s) => s.orden === a.orden)!;
      expect(premium.descripcion).toMatch(/105 Premium/);
    }
  }, TIMEOUT);

  it("#4 (c) OD031 en 5C01: traslado desde la terminal de buses", async () => {
    const [a] = await ajuste("5C01", "OD031");
    expect(a).toMatchObject({ orden: 3, accion: "reemplazar", origen: "excepcion" });
    expect(a.texto).toMatch(/terminal de buses/);
  }, TIMEOUT);

  it("#4 (d) OD030 en BOCHI04R: el Transvip pasa a ser de salida, San Pedro → CJC", async () => {
    const [a] = await ajuste("BOCHI04R", "OD030");
    expect(a).toMatchObject({ orden: 3, accion: "invertir", origen: "excepcion" });
    expect(a.texto).toMatch(/San Pedro.*CJC/);
  }, TIMEOUT);

  it("#4 (e) COMPCH01 en 5C01: el bus Kupos solo de ida", async () => {
    expect(await ajuste("5C01", "COMPCH01")).toEqual([expect.objectContaining({ orden: 3, accion: "solo_llegada", origen: "excepcion" })]);
  }, TIMEOUT);

  it("#4 (f) ARCH31: OD017 sin el bus Punta Arenas → Puerto Natales y el último paso es la salida de Puerto Natales con las dos alternativas", async () => {
    expect(await ajuste("ARCH31", "OD017")).toEqual(
      expect.arrayContaining([expect.objectContaining({ orden: 3, accion: "anular", origen: "excepcion" })]),
    );
    const propios = await servicios("ARCH31");
    expect(propios).toHaveLength(1);
    expect(propios[0]).toMatchObject({ booking_supplier_nombre: "Kupos.cl", booking_supplier_id: null });
    expect(propios[0].descripcion).toMatch(/Puerto Natales – Punta Arenas.*sale el día 9 del tour.*a pedido, traslado al aeropuerto de Puerto Natales con Patagonia Planet/);
  }, TIMEOUT);

  it("#5 OD010D: cada nivel con noches 1-2 en Foz (lado brasileño) y 3 en Puerto Iguazú (lado argentino)", async () => {
    const lista = await servicios("OD010D");
    const { data, error } = await admin
      .from("producto_servicio_noches")
      .select("orden, noche_desde, noches, lugar")
      .eq("producto_id", await idDe("OD010D"))
      .order("orden");
    expect(error).toBeNull();
    const hotel = (orden: number) => lista.find((s) => s.orden === orden && s.prioridad === 1)!.service_provider_nombre;
    expect(data!.map((n) => `${hotel(n.orden)} ${n.noche_desde}+${n.noches}`)).toEqual([
      "Bambu Foz 1+2",
      "Beer Hostel 3+1",
      "Nacional inn Foz 1+2",
      "El Pueblito 3+1",
      "Taroba 1+2",
      "La Aldea 3+1",
    ]);
    expect(new Set(data!.map((n) => n.lugar))).toEqual(new Set(["Foz do Iguaçu (lado brasileño)", "Puerto Iguazú (lado argentino)"]));
  }, TIMEOUT);

  it("#6 OD017: la llegada PNT, opcional y sin marca a pedido (owner 2026-10-11; OD016 tampoco tiene marca); OD019: el Remis según la reserva (no se borran)", async () => {
    const od017 = (await servicios("OD017")).find((s) => s.tipo_servicio === "traslado")!;
    expect(od017).toMatchObject({ sentido: "llegada", a_pedido: null });
    const remis = (await servicios("OD019")).find((s) => /Remis/.test(s.descripcion ?? ""))!;
    expect(remis.a_pedido).toBe("segun_reserva");
  }, TIMEOUT);

  it("#7 Patagonian Group y Cuenca del Plata: cada hotel va a su fila", async () => {
    const pedidoA = async (codigo: string, filtro: RegExp) =>
      (await servicios(codigo))
        .filter((s) => filtro.test(s.booking_supplier_nombre ?? ""))
        .map((s) => `${s.service_provider_nombre} → ${s.bs?.nombre ?? "SIN RESOLVER"}`);
    expect(await pedidoA("OD033", /Patagonian Group/)).toEqual([
      "Fitz Roy → Hosteria Fitz roy, proveedor Patagonian Group",
      "Vertical Lodge → Vertical Lodge, proveedor Patagonian Group",
      "El Paraiso → Hosteria El Paraiso, proveedor Patagonian Group",
    ]);
    for (const codigo of ["OD013", "OD016"]) {
      expect(await pedidoA(codigo, /Patagonian Group/), codigo).toEqual([
        "Puerto San Julian → Hosteria Puerto San Julian, proveedor Patagonian Group",
      ]);
    }
    expect(await pedidoA("OD010C", /Cuenca del Pla/)).toEqual([
      "El Pueblito → El Pueblito, proveedor Cuenca del Plata",
      "La Aldea → La Aldea de la Selva, proveedor Cuenca del Plata",
      "Paquete Receptvo 105 Premium → Paquetes 105 Premium: Transfer in+out en IGR, Lado Arg, lado Bra",
    ]);
    expect(await pedidoA("OD010D", /Cuenca del Pla/)).toEqual([
      "El Pueblito → El Pueblito, proveedor Cuenca del Plata",
      "La Aldea → La Aldea de la Selva, proveedor Cuenca del Plata",
      "Paquete Receptvo 105 Premium x Foz → Paquete 105 Premium desde Foz: Transfer in+out en Foz/Igu, Lado Arg, Lado Bra IGRP01",
    ]);
    // ningún servicio apunta a la fila suelta "Hosteria Fitz roy" (la duplicada que el owner pidió borrar)
    const { data: sueltas } = await admin.from("proveedor").select("id").eq("nombre", "Hosteria Fitz roy");
    const ids = (sueltas ?? []).map((p) => p.id);
    if (ids.length) {
      const { data: usan } = await admin.from("producto_servicio").select("id").or(`booking_supplier_id.in.(${ids.join(",")}),service_provider_id.in.(${ids.join(",")})`);
      expect(usan).toEqual([]);
    }
  }, TIMEOUT);

  it("#8 directorio del 2026-10-10: NH Cordillera con mail (OD019 ya no lo tiene pendiente) y el mail nuevo del Copacabana Mar", async () => {
    const { data: nh } = await admin.from("proveedor").select("mails").eq("nombre", "NH Cordillera").single();
    expect(nh!.mails.length).toBeGreaterThan(0);
    const cordillera = (await servicios("OD019")).find((s) => s.booking_supplier_nombre === "NH Cordillera")!;
    expect(cordillera).toMatchObject({ proveedor_sin_resolver: false, bs: { nombre: "NH Cordillera" } });
    const { data: copa } = await admin.from("proveedor").select("mails").eq("nombre", "Copacabana Mar hotel").single();
    expect(copa!.mails).toContain("romulo.santos@hotelbb.com");
  }, TIMEOUT);

  it("RLS de tour_servicio_ajuste (#1): sin sesión no se lee ni se escribe", async () => {
    const anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anonimo.from("tour_servicio_ajuste").select("*").limit(5);
    expect(error !== null || (data?.length ?? 0) === 0).toBe(true);
    const { error: errorInsert } = await anonimo
      .from("tour_servicio_ajuste")
      .insert({ tour_id: await idDe("5C01"), paquete_id: await idDe("OD020"), orden: 99, accion: "anular", motivo: "x", origen: "regla" });
    expect(errorInsert).not.toBeNull();
  }, TIMEOUT);

  describe("lo que leen las pantallas, con una sesión del equipo (#5, #6, #9)", () => {
    let cliente: SupabaseClient;
    let borrar: () => Promise<void>;

    beforeAll(async () => {
      ({ cliente, borrar } = await crearSesionDePrueba());
    }, 30_000);

    afterAll(async () => {
      await borrar?.();
    });

    it("dentro de 5C01 cada paquete trae su ajuste (también los de CHB31); el paquete solo no", async () => {
      const t = await cargarProducto(cliente, await idDe("5C01"));
      const del = (codigo: string) => t.componentes.find((c) => c.producto?.codigo === codigo)!.producto!.servicios;
      expect(del("OD020").find((s) => s.tipo === "traslado")!.ajusteTour).toMatchObject({ accion: "anular", origen: "regla" });
      expect(del("OD031").find((s) => s.tipo === "traslado")!.ajusteTour).toMatchObject({ accion: "reemplazar" });
      const chb31 = t.componentes.find((c) => c.producto?.codigo === "CHB31")!;
      const od030 = chb31.producto!.componentes!.find((c) => c.producto?.codigo === "OD030")!.producto!.servicios;
      expect(od030.find((s) => s.tipo === "traslado")!.ajusteTour).toMatchObject({ accion: "anular", motivo: expect.stringMatching(/^Llega en bus/) });
      const solo = await cargarProducto(cliente, await idDe("OD020"));
      expect(solo.servicios.some((s) => s.ajusteTour)).toBe(false);
      // CHB31 solo: OD030 conserva su llegada
      const chb31Solo = await cargarProducto(cliente, await idDe("CHB31"));
      const od030Solo = chb31Solo.componentes.find((c) => c.producto?.codigo === "OD030")!.producto!.servicios;
      expect(od030Solo.some((s) => s.ajusteTour)).toBe(false);
    }, TIMEOUT);

    it("OD010D día por día (sola y dentro de 5C01, días 7 y 9); OD017 sola con la llegada, sin marca a pedido", async () => {
      const od010d = await cargarProducto(cliente, await idDe("OD010D"));
      expect(partesPorNoche(od010d.servicios)!.partes.map((p) => [p.nocheDesde, p.etiqueta])).toEqual([
        [1, "2 noches en Foz do Iguaçu (lado brasileño)"],
        [3, "1 noche en Puerto Iguazú (lado argentino)"],
      ]);
      const t = await cargarProducto(cliente, await idDe("5C01"));
      const enTour = t.componentes.find((c) => c.producto?.codigo === "OD010D")!;
      expect(partesPorNoche(enTour.producto!.servicios)!.partes.map((p) => enTour.diaDesde! + p.nocheDesde - 1)).toEqual([7, 9]);
      const od017 = await cargarProducto(cliente, await idDe("OD017"));
      expect(od017.servicios.find((s) => s.tipo === "traslado")).toMatchObject({ aPedido: null, sentido: "llegada" });
    }, TIMEOUT);
  });
});
