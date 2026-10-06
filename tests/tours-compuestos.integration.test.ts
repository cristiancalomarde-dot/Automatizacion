// @vitest-environment node
//
// Spec M1-05 — verificaciones 2 y 3 (regla #5), contra el proyecto Supabase
// real y los archivos reales de `Insumos/` (no mocks). En orden: carga de los
// 7 tours → segunda corrida idempotente → lectura de punta a punta de CHB31,
// ARCH31, 5C01, BOCHI04R y ARCH33 → el script real y su reporte.
//
// Lo cargado queda (es la carga real, idempotente); solo se borran las filas
// de `importacion` de las corridas de este test.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importarToursCompuestos, TIPO_CORRIDA_TOURS, TOURS_PILOTO, type ResumenImportacionTours } from "@/lib/importador-tours/importar";
import { hayInsumosTours, leerInsumosTours, type InsumosTours } from "@/lib/importador-tours/insumos";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const REPORTE = resolve(RAIZ, "docs/sdd/diagnosticos/M1-05-tours.md");
const CORRE = credencialesSupabaseDisponibles() && hayInsumosTours(RAIZ);
const TIMEOUT = 300_000;

interface Componente {
  orden: number;
  tipo: "paquete" | "tramo_bus";
  descripcion_ruta: string | null;
  transfer_in: boolean;
  transfer_out: boolean;
  noches: number | null;
  dia_desde: number | null;
  nocturno: boolean | null;
  componente: { codigo: string } | null;
}

(CORRE ? describe : describe.skip)("carga de los 7 tours compuestos contra Supabase real (spec M1-05)", () => {
  let admin: SupabaseClient;
  let insumos: InsumosTours;
  const importaciones: string[] = [];
  let primera: ResumenImportacionTours;

  async function idDe(codigo: string): Promise<string> {
    const { data, error } = await admin.from("producto").select("id").eq("codigo", codigo).single();
    expect(error, codigo).toBeNull();
    return data!.id;
  }

  async function componentes(codigo: string): Promise<Componente[]> {
    const { data, error } = await admin
      .from("producto_componente")
      .select("orden, tipo, descripcion_ruta, transfer_in, transfer_out, noches, dia_desde, nocturno, componente:componente_producto_id(codigo)")
      .eq("producto_id", await idDe(codigo))
      .order("orden");
    expect(error).toBeNull();
    return data as unknown as Componente[];
  }

  function legible(c: Componente): string {
    return c.tipo === "paquete"
      ? `${c.componente!.codigo} d${c.dia_desde} ${c.noches}n${c.transfer_in ? " IN" : ""}${c.transfer_out ? " OUT" : ""}`
      : `bus ${c.descripcion_ruta} d${c.dia_desde}${c.nocturno ? " noct" : ""}${c.transfer_in || c.transfer_out ? " TRANSFER?" : ""}`;
  }

  async function serviciosPaquetes(): Promise<{ filas: number; ultimo: string | null }> {
    const codigos = insumos.paquetesPiloto.map((p) => p.codigo);
    const { data: ps } = await admin.from("producto").select("id").in("codigo", codigos);
    const { data, error } = await admin
      .from("producto_servicio")
      .select("updated_at")
      .in("producto_id", (ps ?? []).map((p) => p.id))
      .order("updated_at", { ascending: false })
      .range(0, 9999);
    expect(error).toBeNull();
    return { filas: data!.length, ultimo: data![0]?.updated_at ?? null };
  }

  function cargar() {
    return importarToursCompuestos({ admin, ...insumos }).then((r) => {
      importaciones.push(r.importacionId);
      return r;
    });
  }

  beforeAll(() => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    insumos = leerInsumosTours(RAIZ);
  });

  afterAll(async () => {
    if (importaciones.length) await admin.from("importacion").delete().in("id", importaciones);
  });

  it(
    "carga los 7 compuestos, sin tocar los productos simples, y registra la corrida",
    async () => {
      const antes = await serviciosPaquetes();
      primera = await cargar();
      expect(primera.tours.map((t) => `${t.codigo}:${t.estado}${t.motivos.length ? ` ${t.motivos.join("; ")}` : ""}`)).toEqual(
        TOURS_PILOTO.map((c) => `${c}:armado`),
      );
      const { data } = await admin.from("producto").select("codigo").in("codigo", TOURS_PILOTO);
      expect(data!.map((p) => p.codigo).sort()).toEqual([...TOURS_PILOTO].sort());
      const { data: ce } = await admin.from("codigo_externo").select("codigo").eq("agencia", "HI Travel").in("codigo", TOURS_PILOTO);
      expect(ce).toHaveLength(7);
      expect(await serviciosPaquetes()).toEqual(antes);
      const { data: imp } = await admin.from("importacion").select("tipo_corrida").eq("id", primera.importacionId).single();
      expect(imp!.tipo_corrida).toBe(TIPO_CORRIDA_TOURS);
    },
    TIMEOUT,
  );

  it(
    "una segunda corrida deja 0 filas nuevas (idempotente)",
    async () => {
      const segunda = await cargar();
      expect(segunda.creados).toEqual({ productos: 0, componentes: 0, servicios: 0, codigos: 0 });
      expect(segunda.actualizados).toEqual({ productos: 0, componentes: 0, servicios: 0 });
      expect(segunda.eliminados).toEqual({ componentes: 0, servicios: 0 });
    },
    TIMEOUT,
  );

  it("CHB31: 2 paquetes y el bus de Imperio Inca como servicio del tour, sin tramo_bus", async () => {
    expect((await componentes("CHB31")).map(legible)).toEqual(["OD030 d1 3n IN", "COMPBO20 d4 2n OUT"]);
    const { data, error } = await admin
      .from("producto_servicio")
      .select("tipo_servicio, service_provider_nombre, descripcion, proveedor_sin_resolver, bs:booking_supplier_id(nombre)")
      .eq("producto_id", await idDe("CHB31"));
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const s = data![0] as unknown as { tipo_servicio: string; service_provider_nombre: string; descripcion: string; proveedor_sin_resolver: boolean; bs: { nombre: string } | null };
    expect(s.tipo_servicio).toBe("bus");
    expect(s.service_provider_nombre).toBe("Bus Uyuni – La Paz");
    expect(s.descripcion).toMatch(/nocturno, sale el día 6/);
    expect(s.proveedor_sin_resolver).toBe(false);
    expect(s.bs!.nombre.toLowerCase()).toContain("imperio inca");
  });

  async function serviciosDelTour(codigo: string) {
    const { data, error } = await admin
      .from("producto_servicio")
      .select("descripcion, booking_supplier_nombre, booking_supplier_id, reserva_manual, proveedor_sin_resolver")
      .eq("producto_id", await idDe(codigo))
      .order("orden");
    expect(error).toBeNull();
    return data!;
  }

  it("ARCH31: paquete / paquete / bus / paquete, con transfers solo en las puntas; el bus a El Calafate lo reserva Chalten Travel", async () => {
    expect((await componentes("ARCH31")).map(legible)).toEqual([
      "OD033 d1 3n IN",
      "OD016 d4 3n",
      "bus El Calafate – Puerto Natales d7",
      "OD017 d7 2n OUT",
    ]);
    // Uno solo: el traslado de llegada (aeropuerto → El Chaltén) ya lo trae OD033.
    const s = await serviciosDelTour("ARCH31");
    expect(s.map((x) => [x.descripcion.split(" (")[0], x.booking_supplier_nombre, x.booking_supplier_id !== null])).toEqual([
      ["Bus El Chaltén – El Calafate", "Chalten Travel", true],
    ]);
  });

  it("5C01: apunta a CHB31 (anidado) con sus días; Iguazú conserva el transfer; cierra en 29 noches", async () => {
    const cs = await componentes("5C01");
    expect(cs.map(legible)).toEqual([
      "OD032 d1 3n IN",
      "bus Río de Janeiro – São Paulo d4",
      "COMPBR10 d4 2n",
      "bus São Paulo – Iguazú d6 noct",
      "OD010D d7 3n IN OUT",
      "bus Iguazú – Buenos Aires d10 noct",
      "OD020 d11 3n",
      "bus Buenos Aires – Mendoza d14 noct",
      "OD019 d15 2n",
      "bus Mendoza – Santiago de Chile d17",
      "OD029 d17 2n",
      "COMPCH01 d19 2n",
      "bus Valparaíso – Calama d21 noct",
      "CHB31 d22 6n",
      "OD031 d28 2n OUT",
    ]);
    const noches = cs.reduce((n, c) => n + (c.noches ?? 0) + (c.nocturno ? 1 : 0), 0);
    expect(noches).toBe(29);
    // Santiago – Valparaíso (Kupos.cl) y Calama – San Pedro (Transvipp) son manuales: sin proveedor ni revisión.
    const s = await serviciosDelTour("5C01");
    expect(s.map((x) => [x.descripcion.split(" (")[0], x.booking_supplier_nombre, x.reserva_manual, x.proveedor_sin_resolver])).toEqual([
      ["Bus Santiago de Chile – Valparaíso", "Kupos.cl", true, false],
      ["Bus Calama – San Pedro de Atacama", "Transvipp", true, false],
    ]);
    // CHB31 tiene sus propios componentes (no se copiaron a 5C01).
    expect((await componentes("CHB31")).length).toBe(2);
  });

  it("BOCHI04R arranca en La Paz y termina en San Pedro", async () => {
    expect((await componentes("BOCHI04R")).map(legible)).toEqual(["COMPBO20 d2 2n IN", "OD030 d4 3n OUT"]);
    const { data } = await admin.from("producto").select("ciudades").eq("codigo", "BOCHI04R").single();
    expect(data!.ciudades[0]).toBe("La Paz");
    expect(data!.ciudades[data!.ciudades.length - 1]).toBe("San Pedro de Atacama");
    const { data: s } = await admin.from("producto_servicio").select("descripcion").eq("producto_id", await idDe("BOCHI04R"));
    expect(s![0].descripcion).toMatch(/^Bus La Paz – Uyuni \(nocturno, sale el día 1/);
  });

  it("ARCH33: el W Trek va dentro de CH10 (sin componente propio)", async () => {
    expect((await componentes("ARCH33")).map(legible)).toEqual([
      "OD033 d1 3n IN",
      "OD016 d4 2n",
      "bus El Calafate – Puerto Natales d6",
      "CH10 d6 6n OUT",
    ]);
  });

  it(
    "recorrido completo: el script real carga (idempotente) y deja el reporte con los 7 tours",
    () => {
      const salida = execFileSync("npx", ["tsx", "scripts/importar-tours-compuestos.ts"], {
        cwd: RAIZ,
        encoding: "utf-8",
        shell: true,
        timeout: TIMEOUT,
      });
      const json = JSON.parse(salida.slice(salida.indexOf("{")));
      expect(json.creados).toEqual({ productos: 0, componentes: 0, servicios: 0, codigos: 0 });
      expect(existsSync(REPORTE)).toBe(true);
      const md = readFileSync(REPORTE, "utf-8");
      for (const codigo of TOURS_PILOTO) expect(md).toContain(`| ${codigo} |`);
      expect(md).toContain("## Lo que necesito que confirmes");
    },
    TIMEOUT,
  );
});
