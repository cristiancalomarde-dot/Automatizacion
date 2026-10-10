// @vitest-environment node
//
// Spec M1-07 — verificación 2 (regla #5), contra el proyecto Supabase real,
// después de la recarga completa (proveedores → equivalencias → productos →
// paquetes → tours). Consultas de las filas 1-8 de §3, RLS de la tabla nueva
// (0008), la excepción de transfer que no cierra (no escribe nada) y lo que
// leen las pantallas (CH10 en tres partes, CHB31 desplegado dentro de 5C01).
//
// Solo lee, salvo la corrida fallida de la fila 4 (que por diseño no escribe).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { partesPorNoche } from "@/lib/catalogo/reglas";
import { importarToursCompuestos } from "@/lib/importador-tours/importar";
import { hayInsumosTours, leerInsumosTours } from "@/lib/importador-tours/insumos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";
import { crearSesionDePrueba } from "./helpers/usuario-de-prueba";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");
const CORRE = credencialesSupabaseDisponibles();
const TIMEOUT = 120_000;

interface Componente {
  orden: number;
  tipo: "paquete" | "tramo_bus";
  descripcion_ruta: string | null;
  transfer_in: boolean;
  transfer_out: boolean;
  dia_desde: number | null;
  componente: { codigo: string } | null;
}

interface FilaServicio {
  orden: number;
  prioridad: number;
  tipo_servicio: string;
  descripcion: string | null;
  service_provider_nombre: string | null;
  booking_supplier_nombre: string | null;
  booking_supplier_id: string | null;
  service_provider_id: string | null;
  reserva_manual: boolean;
  proveedor_sin_resolver: boolean;
  proveedor_para_revisar: boolean;
}

(CORRE ? describe : describe.skip)("correcciones del probalo vos de M1 contra Supabase real (spec M1-07)", () => {
  let admin: SupabaseClient;

  async function idDe(codigo: string): Promise<string> {
    const { data, error } = await admin.from("producto").select("id").eq("codigo", codigo).single();
    expect(error, codigo).toBeNull();
    return data!.id;
  }

  async function componentes(codigo: string): Promise<Componente[]> {
    const { data, error } = await admin
      .from("producto_componente")
      .select("orden, tipo, descripcion_ruta, transfer_in, transfer_out, dia_desde, componente:componente_producto_id(codigo)")
      .eq("producto_id", await idDe(codigo))
      .order("orden");
    expect(error).toBeNull();
    return data as unknown as Componente[];
  }

  async function servicios(codigo: string): Promise<FilaServicio[]> {
    const { data, error } = await admin
      .from("producto_servicio")
      .select(
        "orden, prioridad, tipo_servicio, descripcion, service_provider_nombre, booking_supplier_nombre, booking_supplier_id, service_provider_id, reserva_manual, proveedor_sin_resolver, proveedor_para_revisar",
      )
      .eq("producto_id", await idDe(codigo))
      .order("orden")
      .order("prioridad");
    expect(error).toBeNull();
    return data as FilaServicio[];
  }

  beforeAll(() => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("#1 directorio: un solo Tetris (Foz, WhatsApp), ninguna Natalia, Antarctica con contacto, Selina La Paz no volvió", async () => {
    const buscar = async (texto: string) => {
      const { data, error } = await admin.from("proveedor").select("id, nombre, ciudad, mails, canal").ilike("nombre", `%${texto}%`);
      expect(error).toBeNull();
      return data!;
    };
    const tetris = await buscar("Tetris");
    expect(tetris).toHaveLength(1);
    expect(tetris[0]).toMatchObject({ ciudad: "FOZ DO IGUAZU", canal: "whatsapp" });
    expect(await buscar("Natalia")).toEqual([]);
    // 2026-10-10: el owner separó Cuenca del Plata por hotel; el registro de antes ahora es El Pueblito
    const cuenca = await buscar("El Pueblito");
    expect(cuenca.map((c) => c.nombre)).toEqual(["El Pueblito, proveedor Cuenca del Plata"]);
    const antarctica = await buscar("Antarctica Hostel");
    expect(antarctica).toHaveLength(1);
    expect(antarctica[0].mails.length > 0 || antarctica[0].canal === "whatsapp").toBe(true);
    expect(await buscar("Selina La Paz")).toEqual([]);
  }, TIMEOUT);

  it("#2 los servicios de OD010C/OD010D que nombran Cuenca del Plata/Plana siguen yendo a Cuenca del Plata (desde M1-08, a la fila de cada hotel)", async () => {
    // M1-08 §3 #7: cada hotel va a su fila "…, proveedor Cuenca del Plata"; todas con el mail de Cuenca del Plata.
    const { data: filas } = await admin.from("proveedor").select("id").contains("mails", ["reservas3@cuencadelplata.com"]);
    const deCuencaIds = new Set((filas ?? []).map((f) => f.id));
    for (const codigo of ["OD010C", "OD010D"]) {
      const deCuenca = (await servicios(codigo)).filter((s) => /cuenca del pla(t|n)a/i.test(s.booking_supplier_nombre ?? ""));
      expect(deCuenca.length, codigo).toBeGreaterThan(0);
      for (const s of deCuenca) expect(deCuencaIds.has(s.booking_supplier_id!), `${codigo} orden ${s.orden}`).toBe(true);
    }
  }, TIMEOUT);

  it("#3 5C01: Calama – San Pedro por Kupos.cl, manual, sin proveedor ni revisión; ningún tramo con Transvip", async () => {
    const propios = await servicios("5C01");
    const calama = propios.find((s) => /Calama – San Pedro/.test(s.descripcion ?? ""))!;
    expect(calama).toMatchObject({
      booking_supplier_nombre: "Kupos.cl",
      booking_supplier_id: null,
      reserva_manual: true,
      proveedor_sin_resolver: false,
      proveedor_para_revisar: false,
    });
    expect(propios.some((s) => /transvip/i.test(`${s.descripcion} ${s.booking_supplier_nombre}`))).toBe(false);
    expect((await componentes("5C01")).some((c) => /transvip/i.test(c.descripcion_ruta ?? ""))).toBe(false);
  }, TIMEOUT);

  it("#4 una excepción de transfer con un componente que el tour no tiene corta la carga sin escribir nada", async () => {
    if (!hayInsumosTours(RAIZ)) return;
    const insumos = leerInsumosTours(RAIZ);
    const antes = await componentes("BRARCH26");
    // El armado corre antes de cualquier escritura: la corrida falla sin tocar la base
    // (no se cuentan filas de `importacion`: otros tests de integración corren en paralelo).
    await expect(
      importarToursCompuestos({
        admin,
        ...insumos,
        excepcionesTransfer: [{ tour: "BRARCH26", codigo: "OD031", transferIn: null, transferOut: false }],
      }),
    ).rejects.toThrow(/transfers-tour\.csv.*BRARCH26.*OD031/);
    expect(await componentes("BRARCH26")).toEqual(antes);
  }, TIMEOUT);

  it("#5 BRARCH26: OD029 sin transfer de salida ni de llegada; OD032 conserva el de llegada", async () => {
    const lista = await componentes("BRARCH26");
    const od029 = lista.find((c) => c.componente?.codigo === "OD029")!;
    expect(od029).toMatchObject({ transfer_in: false, transfer_out: false });
    expect(lista.find((c) => c.componente?.codigo === "OD032")!.transfer_in).toBe(true);
  }, TIMEOUT);

  it("#6/#7 ARCH33 termina con la salida de Puerto Natales (Kupos, manual, o Patagonia Planet); CH10 solo no tiene bus ni traslado", async () => {
    const propios = await servicios("ARCH33");
    expect(propios).toHaveLength(1);
    expect(propios[0]).toMatchObject({ booking_supplier_nombre: "Kupos.cl", reserva_manual: true, booking_supplier_id: null });
    expect(propios[0].descripcion).toMatch(/Puerto Natales – Punta Arenas.*sale el día 12.*Patagonia Planet/);
    const ultimo = (await componentes("ARCH33")).at(-1)!;
    expect(ultimo.componente?.codigo).toBe("CH10");
    expect(12).toBeGreaterThan(ultimo.dia_desde!);
    expect((await servicios("CH10")).filter((s) => ["bus", "traslado"].includes(s.tipo_servicio))).toEqual([]);
  }, TIMEOUT);

  it("#8 CH10 guarda las noches de cada servicio: alojamiento (1,1) y (6,1), W Trek (2,4); suman 6", async () => {
    const id = await idDe("CH10");
    const { data, error } = await admin
      .from("producto_servicio_noches")
      .select("orden, noche_desde, noches, lugar")
      .eq("producto_id", id)
      .order("orden")
      .order("noche_desde");
    expect(error).toBeNull();
    const lista = await servicios("CH10");
    const tipoDe = (orden: number) => lista.find((s) => s.orden === orden)!;
    const legibles = data!.map((n) => `${tipoDe(n.orden).tipo_servicio === "alojamiento" ? `alojamiento ${tipoDe(n.orden).orden}` : tipoDe(n.orden).service_provider_nombre} (${n.noche_desde},${n.noches})`);
    expect(legibles).toEqual([
      "alojamiento 1 (1,1)",
      "alojamiento 1 (6,1)",
      "alojamiento 2 (1,1)",
      "alojamiento 2 (6,1)",
      "W Trek Standard (2,4)",
    ]);
    const nivel1 = data!.filter((n) => n.orden !== 2).reduce((suma, n) => suma + n.noches, 0);
    expect(nivel1).toBe(6);
  }, TIMEOUT);

  it("RLS de producto_servicio_noches (#1): sin sesión no se lee ni se escribe", async () => {
    const anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anonimo.from("producto_servicio_noches").select("*").limit(5);
    expect(error !== null || (data?.length ?? 0) === 0).toBe(true);
    const { error: errorInsert } = await anonimo
      .from("producto_servicio_noches")
      .insert({ producto_id: await idDe("CH10"), orden: 99, noche_desde: 1, noches: 1 });
    expect(errorInsert).not.toBeNull();
  }, TIMEOUT);

  describe("lo que leen las pantallas, con una sesión del equipo (#9, #10)", () => {
    let cliente: SupabaseClient;
    let borrar: () => Promise<void>;

    beforeAll(async () => {
      ({ cliente, borrar } = await crearSesionDePrueba());
    }, 30_000);

    afterAll(async () => {
      await borrar?.();
    });

    it("CH10 en tres partes; dentro de ARCH33 empieza el día 6", async () => {
      const ch10 = await cargarProducto(cliente, await idDe("CH10"));
      expect(partesPorNoche(ch10.servicios)!.partes.map((p) => [p.nocheDesde, p.etiqueta])).toEqual([
        [1, "1 noche en Puerto Natales"],
        [2, "W Trek Standard, 4 noches en refugios (Las Torres)"],
        [6, "1 noche en Puerto Natales"],
      ]);
      const arch33 = await cargarProducto(cliente, await idDe("ARCH33"));
      const enTour = arch33.componentes.find((c) => c.producto?.codigo === "CH10")!;
      expect(enTour.diaDesde).toBe(6);
      expect(partesPorNoche(enTour.producto!.servicios)!.partes.map((p) => enTour.diaDesde! + p.nocheDesde - 1)).toEqual([6, 7, 11]);
    }, TIMEOUT);

    it("5C01 trae la secuencia de CHB31 (OD030, COMPBO20) y su bus Uyuni – La Paz", async () => {
      const t = await cargarProducto(cliente, await idDe("5C01"));
      const chb31 = t.componentes.find((c) => c.producto?.codigo === "CHB31")!;
      expect(chb31.diaDesde).toBe(22);
      expect(chb31.producto!.componentes!.map((c) => [c.producto?.codigo, c.diaDesde])).toEqual([
        ["OD030", 1],
        ["COMPBO20", 4],
      ]);
      expect(chb31.producto!.servicios.some((s) => /Uyuni – La Paz/.test(s.descripcion ?? ""))).toBe(true);
    }, TIMEOUT);
  });
});
