// @vitest-environment node
//
// Spec M1-04 — verificaciones 2 y 3 (regla #5), contra el proyecto Supabase
// real y los Excel reales de `Insumos/` (no mocks). Un solo archivo a
// propósito: las corridas del importador tienen que ser secuenciales.
//
// V2 (integración):
//   A. El Excel real: productos, servicios, niveles, opciones "/", códigos
//      externos (HI Travel, Kilroy, TourRadar con su nombre), proveedores sin
//      resolver sin proveedores fantasma, y la fila de `importacion`.
//   B. Un libro de prueba con proveedores de prueba: SP ≠ BS resueltos contra
//      `proveedor`, un proveedor inexistente queda "sin resolver", y un bloque
//      con el cuerpo corrido una columna (IA falsa / sin IA).
//   C. Una copia del Excel real con una columna de más insertada: las reglas
//      leen lo mismo (0 filas nuevas).
// V3 (recorrido completo): el script real dos veces seguidas sobre el mismo
//     archivo — la segunda corrida no agrega nada y su `importacion` lo refleja.
//
// Las filas de `importacion` de estas corridas de prueba se borran al final;
// los productos reales NO: el importador es idempotente y el estado que deja
// es el de la carga real. Lo creado por el libro de prueba (B) sí se borra.
import { execFileSync } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CODIGOS_PILOTO,
  HOJA_PAQUETES,
  importarProductosSimples,
  type ResumenImportacionProductos,
} from "@/lib/importador-productos/importar";
import type { InterpretarBloque } from "@/lib/importador-productos/plan";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas para IA.xlsm");
const RUTA_TR = resolve(RAIZ, "Insumos/Codigos Productos Tourradar.xlsx");
const CORRE = credencialesSupabaseDisponibles() && existsSync(RUTA_PAQUETES) && existsSync(RUTA_TR);
const TIMEOUT = 240_000;

interface FilaServicioDB {
  id: string;
  producto_id: string;
  tipo_servicio: string;
  orden: number;
  prioridad: number;
  nivel: string | null;
  fila_excel: number | null;
  descripcion: string;
  service_provider_id: string | null;
  booking_supplier_id: string | null;
  service_provider_nombre: string;
  booking_supplier_nombre: string | null;
  proveedor_sin_resolver: boolean;
}

(CORRE ? describe : describe.skip)("importador de productos simples contra Supabase real (spec M1-04)", () => {
  let admin: SupabaseClient;
  const importacionesDePrueba: string[] = [];

  /** Proveedores reales (sin los "TEST-…" que crean y borran otros tests de integración en paralelo). */
  async function contarProveedores(): Promise<number> {
    const { count, error } = await admin
      .from("proveedor")
      .select("id", { count: "exact", head: true })
      .not("nombre", "like", "TEST-%");
    expect(error).toBeNull();
    return count ?? 0;
  }

  async function productoPorCodigo(codigo: string) {
    const { data, error } = await admin.from("producto").select("*").eq("codigo", codigo);
    expect(error).toBeNull();
    expect(data, `producto ${codigo}`).toHaveLength(1);
    return data![0] as { id: string; codigo: string; nombre: string; destino: string };
  }

  async function serviciosDe(productoId: string): Promise<FilaServicioDB[]> {
    const { data, error } = await admin
      .from("producto_servicio")
      .select("*")
      .eq("producto_id", productoId)
      .order("orden")
      .order("prioridad");
    expect(error).toBeNull();
    return data as FilaServicioDB[];
  }

  beforeAll(() => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  afterAll(async () => {
    if (importacionesDePrueba.length) {
      await admin.from("importacion").delete().in("id", importacionesDePrueba);
    }
  });

  describe("V2-A — el Excel real (puntos 1-9 y 11)", () => {
    let resumen: ResumenImportacionProductos;
    let proveedoresAntes: number;
    let productosAjenosAntes: number;
    const consultasIA: Array<{ codigo: string; lineas: string[] | null }> = [];

    // IA de prueba: registra qué le llega y "alucina" un proveedor con confianza
    // alta — el importador no debe guardarlo nunca.
    const iaQueInventa: InterpretarBloque = async (consulta) => {
      consultasIA.push({ codigo: consulta.codigo, lineas: consulta.lineasDudosas });
      return {
        servicios: (consulta.lineasDudosas ?? []).map((linea) => ({
          linea,
          tipo: "alojamiento" as const,
          opciones: [{ service_provider: "Hotel Inventado Por La IA", booking_supplier: null }],
        })),
        lineas_sin_servicio: [],
        confianza: 0.99,
      };
    };

    async function productosAjenos(): Promise<number> {
      const { data } = await admin.from("producto").select("codigo").range(0, 9999);
      return (data ?? []).filter((p) => !CODIGOS_PILOTO.includes(p.codigo) && !p.codigo.startsWith("TEST")).length;
    }

    beforeAll(async () => {
      proveedoresAntes = await contarProveedores();
      productosAjenosAntes = await productosAjenos();
      resumen = await importarProductosSimples({
        admin,
        rutaPaquetes: RUTA_PAQUETES,
        rutaCodigosTourRadar: RUTA_TR,
        interpretarIA: iaQueInventa,
      });
      importacionesDePrueba.push(resumen.importacionId);
    }, TIMEOUT);

    it("#1/#3 exactamente los 5 productos piloto de Iguazú, con su nombre; ningún otro producto", async () => {
      expect(resumen.productos.map((p) => p.codigo).sort()).toEqual([...CODIGOS_PILOTO].sort());
      const nombres = await Promise.all(CODIGOS_PILOTO.map(async (c) => (await productoPorCodigo(c)).nombre));
      expect(nombres).toEqual([
        "Iguazu Falls on a Shoestring Argentina",
        "Iguazu Falls on a Shoestring Brasil",
        "Iguazu Falls Combined (2 Nts ARG + 1 Nt BRA)",
        "Iguazu Falls Combined (2 Nts BRA + 1 Nt ARG)",
        "Iguazu Glamping",
      ]);
      expect((await productoPorCodigo("OD010A")).destino).toBe("IGR");
      expect(await productosAjenos()).toBe(productosAjenosAntes);
    });

    it("#2 ningún campo de costo/markup en producto_servicio", async () => {
      const od010a = await productoPorCodigo("OD010A");
      const [fila] = await serviciosDe(od010a.id);
      expect(Object.keys(fila).filter((k) => /cost|precio|price|markup|neto|net|rate|tarifa|margen/i.test(k))).toEqual([]);
    });

    it("#4/#9 OD010A: 4 servicios reales (3 niveles de alojamiento + excursión), sin filas vacías pese a las filas en blanco", async () => {
      const filas = await serviciosDe((await productoPorCodigo("OD010A")).id);
      const servicios = new Set(filas.map((f) => f.orden));
      expect(servicios.size).toBe(4);
      expect(filas.every((f) => f.service_provider_nombre.trim().length > 0)).toBe(true);
      expect(filas.find((f) => f.tipo_servicio === "excursion")!.descripcion).toContain("Includes: Transfer in + Out");
    });

    it("niveles: OD010A tiene Hostel / Hotel 3* / Hotel 4* con proveedores distintos (Beer Hostel vs Cuenca del Plata)", async () => {
      const filas = await serviciosDe((await productoPorCodigo("OD010A")).id);
      const alojamientos = filas.filter((f) => f.tipo_servicio === "alojamiento" && f.prioridad === 1);
      expect(alojamientos.map((f) => [f.nivel, f.service_provider_nombre, f.booking_supplier_nombre])).toEqual([
        ["Hostel", "Beer Hostel", "Beer Hostel"],
        ["Hotel 3*", "Hotel 3* El Pueblito", "Cuenca del Plata"],
        ["Hotel 4*", "Hotel 4*: La Aldea de la Selva", "Cuenca del Plata"],
      ]);
      // Budget Hotel figura solo en la tabla de precios: nivel no ofrecido, no se carga.
      expect(filas.some((f) => f.nivel === "Budget Hotel")).toBe(false);
      expect(resumen.productos.find((p) => p.codigo === "OD010A")!.nivelesNoOfrecidos).toEqual(["Budget Hotel"]);
    });

    it("#5 opciones \"/\": mismo servicio, prioridad 1-2 preservada (OD010A 3*: El Pueblito / Botanica; OD010B hostel)", async () => {
      const a = await serviciosDe((await productoPorCodigo("OD010A")).id);
      const nivel3 = a.filter((f) => f.nivel === "Hotel 3*");
      expect(new Set(nivel3.map((f) => f.orden)).size).toBe(1);
      expect(nivel3.map((f) => [f.prioridad, f.service_provider_nombre])).toEqual([
        [1, "Hotel 3* El Pueblito"],
        [2, "Botanica"],
      ]);

      const b = await serviciosDe((await productoPorCodigo("OD010B")).id);
      const hostel = b.filter((f) => f.nivel === "Hostel");
      expect(hostel.map((f) => [f.orden, f.prioridad, f.service_provider_nombre, f.booking_supplier_nombre])).toEqual([
        [1, 1, "Bambu Hostel Foz", "Bambu Hostel Foz"],
        [1, 2, "Tetris", "Tetris"],
      ]);
    });

    it("combinados: 2 hoteles por línea/nivel quedan como 2 alojamientos de la misma fila", async () => {
      const c = await serviciosDe((await productoPorCodigo("OD010C")).id);
      const fila12 = c.filter((f) => f.fila_excel === 12);
      expect(fila12.map((f) => [f.service_provider_nombre, f.booking_supplier_nombre])).toEqual([
        ["El Pueblito", "Cuenca del Plana"],
        ["Nacional inn Foz", "Nacional Inn"],
      ]);
      expect(new Set(fila12.map((f) => f.nivel)).size).toBe(1);
    });

    it("#6 SP ≠ BS quedan en su campo, sin fusionar (OD010B: Dann Inn Foz / Nacional Inn)", async () => {
      const b = await serviciosDe((await productoPorCodigo("OD010B")).id);
      const dann = b.find((f) => f.service_provider_nombre === "Dann Inn Foz")!;
      expect(dann.booking_supplier_nombre).toBe("Nacional Inn");
    });

    it("#7 sin resolver: flag + ids null + nombre del Excel; ningún proveedor nuevo", async () => {
      expect(await contarProveedores()).toBe(proveedoresAntes);
      for (const codigo of CODIGOS_PILOTO) {
        for (const f of await serviciosDe((await productoPorCodigo(codigo)).id)) {
          expect(f.proveedor_sin_resolver).toBe(f.service_provider_id === null || f.booking_supplier_id === null);
        }
      }
      expect(resumen.proveedoresSinResolver.length).toBeGreaterThan(0);
    }, TIMEOUT);

    it("#8 códigos externos: HI Travel + Kilroy (nuestro código) + TourRadar (con su nombre) por producto", async () => {
      const tr: Record<string, [string, string]> = {
        OD010A: ["160955", "Iguazu Falls on a Shoestring (3N)"],
        OD010B: ["318366", "Iguazu Falls on a Shoestring Brazil (4 days)"],
        OD010C: ["318443", "Iguazu Falls Combined 2 Nts ARG + 1 Nt BRA (4 Days)"],
        OD010D: ["318444", "Iguazu Falls Combined 2 Nts BRA + 1 Nt ARG (4 Days)"],
        OD011: ["285055", "Iguazu Glamping  (4 days)"],
      };
      for (const codigo of CODIGOS_PILOTO) {
        const producto = await productoPorCodigo(codigo);
        const { data } = await admin
          .from("codigo_externo")
          .select("agencia, codigo, nombre_externo, producto_id")
          .eq("producto_id", producto.id)
          .order("agencia");
        expect(data!.map((c) => [c.agencia, c.codigo, c.nombre_externo])).toEqual([
          ["HI Travel", codigo, null],
          ["Kilroy", codigo, null],
          ["TourRadar", tr[codigo][0], tr[codigo][1]],
        ]);
      }
      expect(resumen.codigosTourRadarSinProducto).toEqual([]);
    }, TIMEOUT);

    it("#10 (guarda) la IA solo recibe los bloques/líneas que no calzan, y su proveedor inventado nunca llega a la base", async () => {
      expect(consultasIA.map((c) => c.codigo)).toEqual(resumen.bloquesQueNecesitanIA);
      expect(resumen.bloquesQueNecesitanIA.length).toBeLessThan(CODIGOS_PILOTO.length);
      const { data } = await admin
        .from("producto_servicio")
        .select("id")
        .eq("service_provider_nombre", "Hotel Inventado Por La IA");
      expect(data).toEqual([]);
    });

    it("#11 `importacion` registra la corrida con sus conteos y lo que quedó para revisar", async () => {
      const { data, error } = await admin.from("importacion").select("*").eq("id", resumen.importacionId).single();
      expect(error).toBeNull();
      expect(data.archivo).toBe("Construccion de Paquetes 2019 con 3 y 4 estrellas para IA.xlsm");
      expect(data.tipo_corrida).toBe("productos-simples");
      expect(data.filas_para_revisar).toBe(resumen.filasParaRevisar);
      expect(data.detalle.productos.procesados).toBe(5);
      expect(data.detalle.proveedores_sin_resolver.length).toBe(resumen.proveedoresSinResolver.length);
      expect(data.detalle.bloques_que_necesitan_ia).toEqual(resumen.bloquesQueNecesitanIA);
    });
  });

  describe("V2-B — libro de prueba: emparejado real, sin resolver y columnas corridas (#6, #7, #10)", () => {
    const sufijo = randomUUID().slice(0, 8);
    const hotel = `TEST-M1-04-${sufijo} Hotel`;
    const supplier = `TEST-M1-04-${sufijo} Supplier`;
    const fantasma = `Hotel Fantasma ${sufijo}`;
    const codigoA = `ZZ${randomInt(100, 999)}A`;
    const codigoB = `ZZ${randomInt(100, 999)}B`;
    const proveedoresDePrueba: string[] = [];
    let ruta: string;

    beforeAll(async () => {
      const { data, error } = await admin
        .from("proveedor")
        .insert([
          { nombre: hotel, nombre_normalizado: hotel.toLowerCase(), ciudad: "TEST" },
          { nombre: supplier, nombre_normalizado: supplier.toLowerCase(), ciudad: "TEST" },
        ])
        .select("id");
      expect(error).toBeNull();
      proveedoresDePrueba.push(...data!.map((p) => p.id));

      const filas: string[][] = Array.from({ length: 30 }, () => Array(20).fill(""));
      filas[2][0] = "ZZT";
      filas[2][1] = `TEST ${codigoA}`;
      filas[2][5] = `Producto de prueba ${codigoA}`;
      filas[4][1] = `Accommodation: ${hotel}. Booking Supplier: ${supplier}`;
      filas[5][1] = "DBL";
      filas[5][2] = "100";
      filas[9][1] = `Accommodation Hotel 3*: ${fantasma}. Booking Supplier: ${supplier}`;
      filas[17][1] = "Paquetes de prueba";
      // Bloque B: encabezado en J, cuerpo corrido una columna (K).
      filas[2][9] = `Producto corrido ${codigoB}`;
      filas[4][10] = `Accommodation: ${hotel}. Booking Supplier: ${supplier}`;
      filas[17][10] = "Paquetes de prueba";
      filas[28][0] = "ZZU"; // otro destino después

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), HOJA_PAQUETES);
      ruta = join(mkdtempSync(join(tmpdir(), "m1-04-")), "libro-de-prueba.xlsx");
      writeFileSync(ruta, XLSX.write(libro, { type: "buffer", bookType: "xlsx" }));
    });

    afterAll(async () => {
      const { data: productos } = await admin.from("producto").select("id").in("codigo", [codigoA, codigoB]);
      const ids = (productos ?? []).map((p) => p.id);
      if (ids.length) {
        await admin.from("producto_servicio").delete().in("producto_id", ids);
        await admin.from("codigo_externo").delete().in("producto_id", ids);
        await admin.from("producto").delete().in("id", ids);
      }
      if (proveedoresDePrueba.length) await admin.from("proveedor").delete().in("id", proveedoresDePrueba);
    });

    it("SP y BS distintos se resuelven cada uno a su proveedor; el inexistente queda sin resolver sin crear nada", async () => {
      const antes = await contarProveedores();
      const r = await importarProductosSimples({
        admin,
        rutaPaquetes: ruta,
        rutaCodigosTourRadar: null,
        interpretarIA: null,
        destino: "ZZT",
        codigos: [codigoA, codigoB],
      });
      importacionesDePrueba.push(r.importacionId);
      expect(await contarProveedores()).toBe(antes);
      const { data: fantasmas } = await admin.from("proveedor").select("id").ilike("nombre", `%${fantasma}%`);
      expect(fantasmas).toEqual([]);

      const filas = await serviciosDe((await productoPorCodigo(codigoA)).id);
      expect(filas).toHaveLength(2);
      const [hostelDePrueba, conFantasma] = filas;
      expect(hostelDePrueba.service_provider_id).toBe(proveedoresDePrueba[0]);
      expect(hostelDePrueba.booking_supplier_id).toBe(proveedoresDePrueba[1]);
      expect(hostelDePrueba.proveedor_sin_resolver).toBe(false);
      expect(conFantasma).toMatchObject({
        service_provider_id: null,
        service_provider_nombre: `Hotel 3*: ${fantasma}`,
        booking_supplier_id: proveedoresDePrueba[1],
        proveedor_sin_resolver: true,
        nivel: "Hotel 3*",
      });

      // Bloque corrido sin IA: el producto existe, "para revisar", sin servicios inventados.
      const productoB = await productoPorCodigo(codigoB);
      expect(await serviciosDe(productoB.id)).toEqual([]);
      expect(r.productos.find((p) => p.codigo === codigoB)!.bloqueParaRevisar).toBe(true);
      expect(r.bloquesQueNecesitanIA).toEqual([codigoB]);
    }, TIMEOUT);

    it("bloque corrido con IA: lo interpreta la IA y se carga; con el proveedor resuelto", async () => {
      const ia: InterpretarBloque = async (consulta) => ({
        servicios: [
          {
            linea: `Accommodation: ${hotel}. Booking Supplier: ${supplier}`,
            tipo: "alojamiento",
            opciones: [{ service_provider: hotel, booking_supplier: supplier }],
          },
        ],
        lineas_sin_servicio: [],
        confianza: consulta.codigo === codigoB ? 0.95 : 0,
      });
      const r = await importarProductosSimples({
        admin,
        rutaPaquetes: ruta,
        rutaCodigosTourRadar: null,
        interpretarIA: ia,
        destino: "ZZT",
        codigos: [codigoA, codigoB],
      });
      importacionesDePrueba.push(r.importacionId);
      const filas = await serviciosDe((await productoPorCodigo(codigoB)).id);
      expect(filas.map((f) => [f.service_provider_id, f.booking_supplier_id])).toEqual([
        [proveedoresDePrueba[0], proveedoresDePrueba[1]],
      ]);
      expect(r.productos.find((p) => p.codigo === codigoB)).toMatchObject({ origen: "ia", bloqueParaRevisar: false });
    }, TIMEOUT);
  });

  describe("V2-C — copia del Excel real con una columna de más insertada (#10)", () => {
    it("las reglas leen lo mismo: 0 productos, servicios ni códigos nuevos", async () => {
      const libro = XLSX.read(readFileSync(RUTA_PAQUETES), { type: "buffer" });
      const filas = XLSX.utils.sheet_to_json<string[]>(libro.Sheets[HOJA_PAQUETES], {
        header: 1,
        defval: "",
        raw: false,
      });
      const corridas = filas.map((f) => [f[0] ?? "", "", ...f.slice(1)]); // columna nueva después de A
      const copia = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(copia, XLSX.utils.aoa_to_sheet(corridas), HOJA_PAQUETES);
      const ruta = join(mkdtempSync(join(tmpdir(), "m1-04-")), "copia-columna-insertada.xlsx");
      writeFileSync(ruta, XLSX.write(copia, { type: "buffer", bookType: "xlsx" }));

      const r = await importarProductosSimples({
        admin,
        rutaPaquetes: ruta,
        rutaCodigosTourRadar: RUTA_TR,
        interpretarIA: null,
      });
      importacionesDePrueba.push(r.importacionId);
      expect(r.productos.map((p) => p.bloqueParaRevisar)).toEqual([false, false, false, false, false]);
      expect(r.creados).toEqual({ productos: 0, servicios: 0, codigos: 0 });
      expect(r.servicios.eliminados).toBe(0);
    }, TIMEOUT);
  });

  describe("V3 — recorrido completo: el script real dos veces seguidas (#12)", () => {
    function correrScript(): ResumenImportacionProductos {
      const tsx = resolve(RAIZ, "node_modules", "tsx", "dist", "cli.mjs");
      const salida = execFileSync(
        process.execPath,
        [tsx, "scripts/importar-productos-simples.ts", RUTA_PAQUETES, RUTA_TR],
        { cwd: RAIZ, encoding: "utf-8", env: process.env, stdio: ["ignore", "pipe", "pipe"] },
      );
      return JSON.parse(salida.slice(salida.indexOf("{")));
    }

    async function conteos() {
      const ids = await Promise.all(CODIGOS_PILOTO.map(async (c) => (await productoPorCodigo(c)).id));
      const servicios = await admin.from("producto_servicio").select("id", { count: "exact", head: true }).in("producto_id", ids);
      const codigos = await admin.from("codigo_externo").select("id", { count: "exact", head: true }).in("producto_id", ids);
      return { productos: ids.length, servicios: servicios.count, codigos: codigos.count };
    }

    it("la segunda corrida deja las mismas filas (0 nuevas) y su `importacion` lo refleja", async () => {
      const primera = correrScript();
      importacionesDePrueba.push(primera.importacionId);
      const trasPrimera = await conteos();

      const segunda = correrScript();
      importacionesDePrueba.push(segunda.importacionId);
      const trasSegunda = await conteos();

      expect(trasSegunda).toEqual(trasPrimera);
      expect(trasPrimera.productos).toBe(5);
      expect(trasPrimera.codigos).toBe(15);
      expect(segunda.creados).toEqual({ productos: 0, servicios: 0, codigos: 0 });
      expect(segunda.servicios.eliminados).toBe(0);

      const { data } = await admin
        .from("importacion")
        .select("filas_cargadas, detalle")
        .eq("id", segunda.importacionId)
        .single();
      expect(data!.filas_cargadas).toBe(0);
      expect(data!.detalle.productos.creados).toBe(0);
      expect(data!.detalle.servicios.creados).toBe(0);
      expect(data!.detalle.codigos_externos.creados).toBe(0);
    }, TIMEOUT);
  });
});
