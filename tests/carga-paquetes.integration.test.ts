// @vitest-environment node
//
// Spec M1-04d — verificaciones 2 y 3 (regla #5), contra el proyecto Supabase
// real y los Excel reales de `Insumos/` (no mocks). Un solo archivo y en
// orden: re-importar proveedores → cargar equivalencias → cargar los 17
// paquetes → segunda corrida idempotente → recorrido + reporte de cierre.
//
// Lo cargado queda (es la carga real, idempotente); solo se borran las filas
// de `importacion` de estas corridas de prueba.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importarProveedores } from "@/lib/importador-proveedores/importar";
import { TIPO_CORRIDA_PAQUETES } from "@/lib/importador-productos/carga-paquetes";
import { cargarEquivalencias } from "@/lib/importador-productos/equivalencias";
import { CODIGOS_PILOTO, importarProductosSimples, type ResumenImportacionProductos } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { leerServiciosCargados, resumirCarga } from "@/lib/importador-productos/reporte-carga";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const RUTA_PROVEEDORES = resolve(RAIZ, "Insumos/Proveedores Hi Travel 2026 para IA.xlsx");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");
const RUTA_EQUIVALENCIAS = resolve(RAIZ, "data/equivalencias-proveedores.csv");
const REPORTE = resolve(RAIZ, "docs/sdd/diagnosticos/M1-04d-carga.md");
const LOS_17 = parsearPaquetesPiloto(readFileSync(resolve(RAIZ, "data/paquetes-piloto.csv"), "utf-8")).filter(
  (p) => !CODIGOS_PILOTO.includes(p.codigo),
);
const NIVELES = parsearNivelesConfirmados(readFileSync(resolve(RAIZ, "data/niveles-confirmados.csv"), "utf-8"));
const CORRE = credencialesSupabaseDisponibles() && existsSync(RUTA_PAQUETES) && existsSync(RUTA_PROVEEDORES);
const TIMEOUT = 300_000;

interface Fila {
  orden: number;
  prioridad: number;
  tipo_servicio: string;
  nivel: string | null;
  fila_excel: number | null;
  descripcion: string;
  service_provider_nombre: string;
  booking_supplier_nombre: string | null;
  opcional: boolean;
  reserva_manual: boolean;
  proveedor_sin_resolver: boolean;
  proveedor_para_revisar: boolean;
  bs: { nombre: string; ciudad: string | null; mails: string[]; canal: string | null } | null;
}

(CORRE ? describe : describe.skip)("carga de los 17 paquetes de los tours contra Supabase real (spec M1-04d)", () => {
  let admin: SupabaseClient;
  const importaciones: string[] = [];

  async function servicios(codigo: string): Promise<Fila[]> {
    const { data: p, error } = await admin.from("producto").select("id").eq("codigo", codigo).single();
    expect(error, codigo).toBeNull();
    const { data, error: e } = await admin
      .from("producto_servicio")
      .select(
        "orden, prioridad, tipo_servicio, nivel, fila_excel, descripcion, service_provider_nombre, booking_supplier_nombre, opcional, reserva_manual, proveedor_sin_resolver, proveedor_para_revisar, bs:booking_supplier_id(nombre, ciudad, mails, canal)",
      )
      .eq("producto_id", p!.id)
      .order("orden")
      .order("prioridad");
    expect(e).toBeNull();
    return data as unknown as Fila[];
  }

  function cargar(): Promise<ResumenImportacionProductos> {
    return importarProductosSimples({
      admin,
      rutaPaquetes: RUTA_PAQUETES,
      rutaCodigosTourRadar: null,
      interpretarIA: null,
      nivelesConfirmados: NIVELES,
      paquetes: LOS_17,
      tipoCorrida: TIPO_CORRIDA_PAQUETES,
    });
  }

  async function conteos() {
    const { data } = await admin.from("producto").select("id").in("codigo", LOS_17.map((p) => p.codigo));
    const ids = (data ?? []).map((p) => p.id);
    const s = await admin.from("producto_servicio").select("id", { count: "exact", head: true }).in("producto_id", ids);
    const c = await admin.from("codigo_externo").select("id", { count: "exact", head: true }).in("producto_id", ids);
    return { productos: ids.length, servicios: s.count, codigos: c.count };
  }

  beforeAll(() => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  afterAll(async () => {
    if (importaciones.length) await admin.from("importacion").delete().in("id", importaciones);
  });

  describe("V2 — directorio, equivalencias y carga, en orden", () => {
    it("#1 re-importar el Excel de proveedores actualizado deja los nuevos con mail o canal", async () => {
      const r = await importarProveedores({ admin, rutaArchivo: RUTA_PROVEEDORES, consultarIA: null });
      importaciones.push(r.importacionId);
      for (const nombre of ["Anum Hostel", "Del Glaciar / Juan Pablo", "Rincon del calafate", "Dazzler San Martin", "Bamboo Hostel Rio", "Rodrigo Perez"]) {
        const { data } = await admin.from("proveedor").select("nombre, mails, canal").eq("nombre", nombre);
        expect(data, nombre).not.toHaveLength(0);
        expect(data!.some((p) => (p.mails ?? []).length > 0 || p.canal === "whatsapp"), nombre).toBe(true);
      }
    }, TIMEOUT);

    it("#2 cargar las equivalencias del formato nuevo (76) es idempotente", async () => {
      const texto = readFileSync(RUTA_EQUIVALENCIAS, "utf-8");
      await cargarEquivalencias({ admin, textoCsv: texto });
      const segunda = await cargarEquivalencias({ admin, textoCsv: texto });
      expect(segunda).toMatchObject({ total: 76, creados: 0, actualizados: 0 });
      const { data } = await admin
        .from("proveedor_alias")
        .select("destino, modo, proveedor:proveedor_id(nombre, ciudad)")
        .eq("alias_normalizado", "nacional inn");
      const porDestino = Object.fromEntries((data ?? []).map((a) => [a.destino, (a.proveedor as unknown as { nombre: string }).nombre]));
      expect(porDestino).toEqual({ IGR: "nacional inn foz", RIO: "Nacional inn Copacabana" });
      const { data: rumbo } = await admin
        .from("proveedor_alias")
        .select("proveedor:proveedor_id(ciudad)")
        .eq("destino", "USH")
        .eq("alias_normalizado", "rumbo sur")
        .single();
      expect((rumbo!.proveedor as unknown as { ciudad: string }).ciudad).toBe("USHUAIA");
    }, TIMEOUT);

    it("#9 los 17 productos existen con servicios; una segunda corrida deja 0 filas nuevas", async () => {
      const primera = await cargar();
      importaciones.push(primera.importacionId);
      expect(primera.codigosNoEncontrados).toEqual([]);
      expect(primera.productos).toHaveLength(17);
      expect(primera.productos.every((p) => !p.bloqueParaRevisar && p.opciones > 0)).toBe(true);
      const tras = await conteos();
      const segunda = await cargar();
      importaciones.push(segunda.importacionId);
      expect(segunda.creados).toEqual({ productos: 0, servicios: 0, codigos: 0 });
      expect(segunda.servicios).toMatchObject({ creados: 0, actualizados: 0, eliminados: 0 });
      expect(await conteos()).toEqual(tras);
      expect(tras.productos).toBe(17);
      const { data } = await admin.from("importacion").select("tipo_corrida, filas_cargadas").eq("id", segunda.importacionId).single();
      expect(data).toEqual({ tipo_corrida: TIPO_CORRIDA_PAQUETES, filas_cargadas: 0 });
    }, TIMEOUT);

    it("#2 Nacional Inn en OD032 (RIO) es el de Copacabana", async () => {
      const f = (await servicios("OD032")).find((s) => s.booking_supplier_nombre === "Nacional Inn")!;
      expect(f.bs?.nombre).toBe("Nacional inn Copacabana");
    });

    it("#2 Rumbo Sur en OD022 (USH) es el de Ushuaia", async () => {
      const rumbo = (await servicios("OD022")).filter((s) => s.booking_supplier_nombre === "Rumbo Sur");
      expect(rumbo.length).toBeGreaterThanOrEqual(3);
      expect(rumbo.every((s) => s.bs?.ciudad === "USHUAIA")).toBe(true);
    });

    it("#3 Tremun por hotel: en OD013/OD016 Rincón, Sent, Mirador del Lago y Calafate Parque con su propio proveedor y mail", async () => {
      for (const codigo of ["OD013", "OD016"]) {
        const tremun = (await servicios(codigo)).filter((s) => s.booking_supplier_nombre === "Tremun");
        expect(tremun.map((s) => s.bs?.nombre), codigo).toEqual(["Rincon del calafate", "Sent", "Mirador del Lago", "Calafate Parque"]);
        expect(tremun.every((s) => s.bs!.mails.length > 0), codigo).toBe(true);
      }
    });

    it("#3 Dazzler en OD018: \"Dazzler Maipu\" y \"San Martin\" con proveedores distintos", async () => {
      const dazzler = (await servicios("OD018")).filter((s) => s.booking_supplier_nombre === "Dazzler");
      expect(dazzler.map((s) => [s.service_provider_nombre, s.bs?.nombre])).toEqual([
        ["Dazzler Maipu", "Reservas Dazzler Maipu'"],
        ["San Martin", "Dazzler San Martin"],
      ]);
    });

    it("#3 Los Acebos (Tremun Ushuaia) resuelve por hotel; un proveedor que no está en el directorio (O Hostel GRU en COMPBR10) queda sin resolver, no se inventa", async () => {
      const acebos = (await servicios("OD022")).find((s) => s.service_provider_nombre.includes("Los Acebos"))!;
      expect(acebos.bs?.nombre).toBe("Las Hayas y los Acebos");
      const oHostel = (await servicios("COMPBR10")).find((s) => /O Hostel/i.test(s.service_provider_nombre))!;
      expect(oHostel).toMatchObject({ bs: null, proveedor_sin_resolver: true });
    });

    it("#4 Kupos (COMPCH01 y OD017) queda manual, sin proveedor y sin bandera de revisión", async () => {
      for (const codigo of ["COMPCH01", "OD017"]) {
        const kupos = (await servicios(codigo)).filter((s) => /kupos/i.test(s.booking_supplier_nombre ?? ""));
        expect(kupos, codigo).toHaveLength(1);
        expect(kupos[0], codigo).toMatchObject({ reserva_manual: true, bs: null, proveedor_sin_resolver: false, proveedor_para_revisar: false });
      }
    });

    it("#4 Buquebus (OD020) y Transvipp (OD030) quedan manuales aunque estén en el directorio (owner 2026-10-05)", async () => {
      for (const [codigo, nombre] of [["OD020", "Buquebus"], ["OD030", "Transvipp"]]) {
        const s = (await servicios(codigo)).filter((x) => x.booking_supplier_nombre === nombre);
        expect(s, codigo).toHaveLength(1);
        expect(s[0], codigo).toMatchObject({ reserva_manual: true, bs: null, proveedor_sin_resolver: false, proveedor_para_revisar: false });
      }
    });

    it("niveles confirmados (owner 2026-10-05): OD030 fila 801, COMPBR10 fila 2676 y OD032 fila 875 (forzado) = Hotel 3*", async () => {
      for (const [codigo, fila] of [["OD030", 801], ["COMPBR10", 2676], ["OD032", 875]] as const) {
        const s = (await servicios(codigo)).filter((x) => x.fila_excel === fila);
        expect(s.length, `${codigo} ${fila}`).toBe(2);
        expect(s.every((x) => x.nivel === "Hotel 3*"), `${codigo} ${fila}`).toBe(true);
      }
    });

    it("#5 las 8 líneas con typo de Booking Supplier quedan leídas como servicios con su proveedor", { timeout: TIMEOUT }, async () => {
      const casos: Array<[string, number]> = [
        ["OD019", 89],
        ["OD019", 90],
        ["OD022", 151],
        ["OD022", 153],
        ["OD025", 672],
        ["OD030", 801],
        ["OD033", 1038],
      ];
      let lineas = 0;
      for (const [codigo, fila] of casos) {
        const s = (await servicios(codigo)).filter((x) => x.fila_excel === fila);
        expect(s.length, `${codigo} fila ${fila}`).toBeGreaterThan(0);
        expect(s.every((x) => x.booking_supplier_nombre !== null), `${codigo} fila ${fila}`).toBe(true);
        lineas += s.length;
      }
      expect(lineas).toBe(8); // OD030 fila 801 son 2 opciones
      // todas con proveedor del directorio ("La Casa de Don Tomas" resuelve por equivalencia desde 2026-10-05)
      const conProveedor = (await Promise.all(casos.map(async ([c, f]) => (await servicios(c)).filter((x) => x.fila_excel === f)))).flat();
      expect(conProveedor.filter((x) => x.bs === null).map((x) => x.booking_supplier_nombre)).toEqual([]);
    });

    it("#6 opcionales: OD022, OD025, OD017 y OD033 tienen su servicio opcional con proveedor", async () => {
      const esperados: Record<string, number> = { OD022: 1, OD025: 2, OD017: 1, OD033: 1 };
      for (const [codigo, cantidad] of Object.entries(esperados)) {
        const opcionales = (await servicios(codigo)).filter((s) => s.opcional);
        expect(opcionales, codigo).toHaveLength(cantidad);
        expect(opcionales.every((s) => s.bs !== null), codigo).toBe(true);
      }
    });

    it("#7 títulos y notas no generan servicios", { timeout: TIMEOUT }, async () => {
      const todas = (await Promise.all(LOS_17.map((p) => servicios(p.codigo)))).flat();
      for (const texto of ["Excursions en", "Excursions in", "Excursions Aventura", "Hosteria HI: 80", "Rincon 93", "o Kau Yatun", "Tarifas W Trek", "Self Guided"]) {
        expect(todas.filter((s) => s.descripcion.startsWith(texto)), texto).toEqual([]);
      }
    });

    it("#8 COMPBO20 y COMPBR10 existen con su servicio; Sooz Hotel / Nacionalinn en COMPBR10, cada uno con su proveedor", async () => {
      const compbo = await servicios("COMPBO20");
      expect(compbo.map((s) => [s.fila_excel, s.booking_supplier_nombre, s.bs?.nombre])).toEqual([[849, "Imperio Inca", "Imperio Inca"]]);
      const soos = (await servicios("COMPBR10")).filter((s) => s.fila_excel === 2676);
      expect(soos.map((s) => [s.tipo_servicio, s.service_provider_nombre, s.booking_supplier_nombre])).toEqual([
        ["alojamiento", "Soos Hotel Collection", "Sooz Hotel"],
        ["alojamiento", "Nacionalinn Jaragua Sao Paulo", "Nacionalinn"],
      ]);
      expect(soos.map((s) => s.bs?.nombre)).toEqual(["sooz hotel", "Nacional Inn Jaragua Sao Paulo"]);
    });

    it("#9 re-correr no pisa un Booking Supplier resuelto a mano (O Hostel GRU en COMPBR10, mismo nombre en el Excel)", async () => {
      const { data: p } = await admin.from("producto").select("id").eq("codigo", "COMPBR10").single();
      const { data: filas } = await admin
        .from("producto_servicio")
        .select("id, service_provider_nombre")
        .eq("producto_id", p!.id);
      const acebos = filas!.find((f) => /O Hostel/i.test(f.service_provider_nombre))!;
      const { data: hayas } = await admin.from("proveedor").select("id").eq("nombre", "sooz hotel").single();
      try {
        await admin.from("producto_servicio").update({ booking_supplier_id: hayas!.id, proveedor_sin_resolver: false }).eq("id", acebos.id);
        const corrida = await cargar();
        importaciones.push(corrida.importacionId);
        const { data: despues } = await admin
          .from("producto_servicio")
          .select("booking_supplier_id, proveedor_sin_resolver")
          .eq("id", acebos.id)
          .single();
        expect(despues).toEqual({ booking_supplier_id: hayas!.id, proveedor_sin_resolver: false });
      } finally {
        await admin.from("producto_servicio").update({ booking_supplier_id: null, proveedor_sin_resolver: true }).eq("id", acebos.id);
      }
    }, TIMEOUT);

    it("#11 Iguazú no cambia: sus 29 servicios mantienen su proveedor (Tetris, ya en el directorio, por WhatsApp)", async () => {
      const iguazu = (await Promise.all(CODIGOS_PILOTO.map((c) => servicios(c)))).flat();
      expect(iguazu).toHaveLength(29);
      expect(iguazu.filter((s) => s.bs === null).map((s) => s.booking_supplier_nombre)).toEqual([]);
      expect(iguazu.find((s) => s.booking_supplier_nombre === "Tetris")!.bs!.canal).toBe("whatsapp");
      expect(iguazu.every((s) => !s.opcional && !s.reserva_manual)).toBe(true);
    });
  });

  describe("V3 — recorrido completo: el script real y el reporte de cierre (#10)", () => {
    it("npm run importar:paquetes: 0 filas nuevas, recorrido servicio → nivel → opción → Booking Supplier → contacto, y el reporte", async () => {
      const env = { ...process.env };
      delete env.ANTHROPIC_API_KEY; // sin clave: nunca hay llamadas a la IA (#3)
      const salida = execFileSync(process.execPath, [resolve(RAIZ, "node_modules/tsx/dist/cli.mjs"), "scripts/importar-paquetes-tours.ts"], {
        cwd: RAIZ,
        env,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: TIMEOUT,
      });
      const r = JSON.parse(salida.slice(salida.indexOf("{")));
      importaciones.push(r.importacionId);
      expect(r.creados).toEqual({ productos: 0, servicios: 0, codigos: 0 });

      const carga = resumirCarga(await leerServiciosCargados(admin, LOS_17.map((p) => p.codigo)));
      expect(carga.porPaquete.map((p) => p.codigo)).toEqual(LOS_17.map((p) => p.codigo));
      const recorrido = carga.servicios.map(
        (s) =>
          `${s.codigo} ${s.orden}.${s.prioridad} ${s.nivel ?? "-"} ${s.service_provider_nombre} → ${s.booking_supplier_nombre ?? "?"} → ${
            s.reserva_manual ? "MANUAL" : (s.proveedor?.mails?.[0] ?? (s.proveedor?.canal === "whatsapp" ? "WhatsApp" : "SIN CONTACTO"))
          }`,
      );
      console.log(recorrido.join("\n"));
      expect(carga.totales.servicios).toBe(recorrido.length);

      const md = readFileSync(REPORTE, "utf-8");
      expect(md).toContain("## Lo que sigue sin resolver");
      for (const p of LOS_17) expect(md, p.codigo).toContain(`### ${p.codigo} ·`);
      // De los pendientes conocidos solo queda NH Cordillera (el owner sumó Patagonia Hostel, Sooz, Nacional Inn Jaraguá y Tetris).
      const lista = md.slice(md.indexOf("## Lo que sigue sin resolver"), md.indexOf("## Detalle"));
      expect(lista).toContain("NH Cordillera");
      for (const resuelto of ["«Patagonia»", "«Nacionalinn»", "«Sooz Hotel»", "Tetris", "«Buquebus»", "«Transvipp»", "Don Tomas"]) {
        expect(lista, resuelto).not.toContain(resuelto);
      }
      expect(md).not.toContain("## Otros puntos para revisar"); // categorías confirmadas por el owner (2026-10-05)
    }, TIMEOUT);
  });
});
