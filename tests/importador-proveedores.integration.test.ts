// @vitest-environment node
//
// Spec M1-03 — verificaciones 2 y 3 (regla #5), contra el proyecto Supabase
// real y el Excel real de `Insumos/` (no mocks). Un solo archivo a propósito:
// las corridas del importador tienen que ser secuenciales (dos corridas en
// paralelo podrían insertar el mismo proveedor dos veces).
//
// V2 (integración): puntos 1, 2, 8, 10 y 11 de la tabla de §3.
// V3 (recorrido completo): corre el script real (`scripts/importar-proveedores.ts`)
//     de punta a punta y confirma en la base los puntos 4, 5, 6 y 9.
//
// Las filas de `importacion` que crean estas corridas de prueba se borran al
// final (service role) para que el registro de corridas solo muestre las
// corridas reales. `proveedor` NO se limpia: el importador es idempotente y
// el estado que deja es justamente el de la carga real.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  importarProveedores,
  leerFilasDelExcel,
  type ResumenImportacion,
} from "@/lib/importador-proveedores/importar";
import type { ConsultarIA } from "@/lib/importador-proveedores/resolver";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const RUTA_EXCEL = resolve(
  RAIZ,
  process.env.PROVEEDORES_XLSX ?? "Insumos/Proveedores Hi Travel 2026 para IA.xlsx",
);
const CORRE = credencialesSupabaseDisponibles() && existsSync(RUTA_EXCEL);

const MAIL_INVENTADO = "inventado@no-esta-en-el-excel.com";
const TIMEOUT = 180_000;

interface FilaProveedorDB {
  id: string;
  nombre: string;
  nombre_normalizado: string;
  ciudad: string | null;
  mails: string[];
  canal: "mail" | "whatsapp" | null;
  aclaraciones: string | null;
}

(CORRE ? describe : describe.skip)("importador de proveedores contra Supabase real (spec M1-03)", () => {
  let admin: SupabaseClient;
  const importacionesDePrueba: string[] = [];

  async function proveedoresDeLaCorrida(resumen: ResumenImportacion): Promise<FilaProveedorDB[]> {
    const { data, error } = await admin
      .from("proveedor")
      .select("id, nombre, nombre_normalizado, ciudad, mails, canal, aclaraciones")
      .range(0, 9999);
    expect(error).toBeNull();
    const claves = new Set(resumen.claves.map((c) => `${c.ciudad ?? ""}|${c.nombre_normalizado}`));
    return (data as FilaProveedorDB[]).filter((p) =>
      claves.has(`${p.ciudad ?? ""}|${p.nombre_normalizado}`),
    );
  }

  function buscar(filas: FilaProveedorDB[], nombre: string, ciudad?: string) {
    const encontrados = filas.filter(
      (p) => p.nombre === nombre && (ciudad === undefined || p.ciudad === ciudad),
    );
    expect(encontrados, `proveedor "${nombre}"`).toHaveLength(1);
    return encontrados[0];
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

  describe("V2 — integración: puntos 1, 2, 8, 10, 11", () => {
    let primera: ResumenImportacion;
    let segunda: ResumenImportacion;
    let filasTrasPrimera: FilaProveedorDB[];
    let filasTrasSegunda: FilaProveedorDB[];
    const celdasEnviadasAIA: string[] = [];

    // IA de prueba: registra qué celdas le llegan y "alucina" un mail con
    // confianza alta — el importador no debe guardarlo nunca.
    const iaQueInventa: ConsultarIA = async (consulta) => {
      celdasEnviadasAIA.push(consulta.textoMailWeb);
      return { mails: [MAIL_INVENTADO], canal: "mail", confianza: 0.99 };
    };

    beforeAll(async () => {
      primera = await importarProveedores({ admin, rutaArchivo: RUTA_EXCEL, consultarIA: iaQueInventa });
      importacionesDePrueba.push(primera.importacionId);
      filasTrasPrimera = await proveedoresDeLaCorrida(primera);

      segunda = await importarProveedores({ admin, rutaArchivo: RUTA_EXCEL, consultarIA: iaQueInventa });
      importacionesDePrueba.push(segunda.importacionId);
      filasTrasSegunda = await proveedoresDeLaCorrida(segunda);
    }, TIMEOUT);

    it("#1 lee el archivo completo: entre 180 y 220 proveedores cargados en `proveedor`", () => {
      expect(primera.procesados).toBeGreaterThanOrEqual(180);
      expect(primera.procesados).toBeLessThanOrEqual(220);
      expect(filasTrasPrimera).toHaveLength(primera.procesados);
    });

    it("#2 destino y categoría del Excel quedan en el registro (IGUAZU / Hotel, FOZ DO IGUAZU / Hostel)", () => {
      const tangoinn = buscar(filasTrasPrimera, "Tangoinn Bed & Brewery IGR");
      expect(tangoinn.ciudad).toBe("IGUAZU");
      expect(tangoinn.aclaraciones?.split("\n")).toContain("Categoría: Hotel");

      const bambu = buscar(filasTrasPrimera, "Bambu hostel");
      expect(bambu.ciudad).toBe("FOZ DO IGUAZU");
      expect(bambu.aclaraciones?.split("\n")).toContain("Categoría: Hostel");
    });

    it("#3 variantes del mismo nombre en el mismo destino → un solo registro", () => {
      // "Altos Ushuaia" aparece en dos filas (133 y 137) del bloque USHUAIA.
      buscar(filasTrasPrimera, "Altos Ushuaia", "USHUAIA");
    });

    it("#8 celda vacía: el proveedor se carga igual, sin mail y sin whatsapp", () => {
      const muelle = buscar(filasTrasPrimera, "El Muelle by DOT Boutique");
      expect(muelle).toMatchObject({ ciudad: "VILLA LA ANGOSTURA", mails: [], canal: null });
      expect(muelle.aclaraciones?.split("\n")).toContain("Categoría: Hotel");
    });

    it("#9 (guarda) la IA solo recibe las celdas ambiguas y su mail inventado nunca llega a la base", () => {
      expect(celdasEnviadasAIA.length).toBe(primera.celdasAmbiguas + segunda.celdasAmbiguas);
      expect(primera.celdasAmbiguas).toBeLessThan(20); // muchísimo menor a las ~200 filas
      expect(filasTrasSegunda.some((p) => p.mails.includes(MAIL_INVENTADO))).toBe(false);
      expect(primera.mailsRechazadosIA).toContain(MAIL_INVENTADO);
    });

    it("#10 `importacion` registra archivo, fecha, procesados y sin mail, y coinciden con `proveedor`", async () => {
      const { data, error } = await admin
        .from("importacion")
        .select("archivo, fecha, tipo_corrida, filas_cargadas, filas_para_revisar")
        .eq("id", primera.importacionId)
        .single();
      expect(error).toBeNull();
      expect(data!.archivo).toBe("Proveedores Hi Travel 2026 para IA.xlsx");
      expect(data!.tipo_corrida).toBe("proveedores");
      expect(Date.now() - new Date(data!.fecha).getTime()).toBeLessThan(TIMEOUT * 2);

      const sinMailObservados = filasTrasPrimera.filter((p) => p.mails.length === 0 && p.canal === null);
      expect(data!.filas_cargadas).toBe(filasTrasPrimera.length);
      expect(data!.filas_para_revisar).toBe(sinMailObservados.length);
      expect(data!.filas_para_revisar).toBeGreaterThan(0);
    });

    it("#11 re-ejecutable: la segunda corrida no duplica y registra otra fila de corrida", async () => {
      expect(filasTrasSegunda).toHaveLength(filasTrasPrimera.length);
      expect(segunda.insertados).toBe(0);
      expect(segunda.actualizados).toBe(segunda.procesados);
      expect(segunda.importacionId).not.toBe(primera.importacionId);

      const { data } = await admin.from("importacion").select("id").in("id", [primera.importacionId, segunda.importacionId]);
      expect(data).toHaveLength(2);
    });
  });

  describe("V3 — recorrido completo con el script real: puntos 4, 5, 6 y 9", () => {
    let resumen: ResumenImportacion & { claves: number };
    let filas: FilaProveedorDB[];

    beforeAll(async () => {
      // node + CLI de tsx directo (sin shell): la ruta del Excel puede tener espacios.
      const tsx = resolve(RAIZ, "node_modules", "tsx", "dist", "cli.mjs");
      const salida = execFileSync(process.execPath, [tsx, "scripts/importar-proveedores.ts", RUTA_EXCEL], {
        cwd: RAIZ,
        encoding: "utf-8",
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      resumen = JSON.parse(salida.slice(salida.indexOf("{")));
      importacionesDePrueba.push(resumen.importacionId);

      const { data } = await admin
        .from("proveedor")
        .select("id, nombre, nombre_normalizado, ciudad, mails, canal, aclaraciones")
        .range(0, 9999);
      filas = data as FilaProveedorDB[];
    }, TIMEOUT);

    it("el script corre de punta a punta y deja la corrida registrada", async () => {
      expect(resumen.procesados).toBeGreaterThanOrEqual(180);
      expect(resumen.insertados).toBe(0); // ya cargados por V2: solo actualiza
      const { data } = await admin.from("importacion").select("id").eq("id", resumen.importacionId);
      expect(data).toHaveLength(1);
    });

    it("#4 Milhouse Avenue Hostel → melina@milhousehostel.com, canal mail", () => {
      expect(buscar(filas, "Milhouse Avenue Hostel")).toMatchObject({
        mails: ["melina@milhousehostel.com"],
        canal: "mail",
      });
    });

    it("#5 dos mails separados por // → ambos guardados", () => {
      expect(buscar(filas, "GRAN HOTEL ARGENTINO | BUENOS AIRES")).toMatchObject({
        mails: ["ventas@uphoteles.com", "reservas@hotel-argentino.com.ar"],
        canal: "mail",
      });
    });

    it("#6 Hostel Lagares Mendoza (celda 'WPP') → canal whatsapp, sin ningún mail", () => {
      expect(buscar(filas, "Hostel Lagares Mendoza")).toMatchObject({ mails: [], canal: "whatsapp" });
    });

    it("#7 link a web (Buquebus) → sin mail, el link queda en aclaraciones", () => {
      const buquebus = buscar(filas, "Buquebus");
      expect(buquebus).toMatchObject({ mails: [], canal: null });
      expect(buquebus.aclaraciones).toContain("Mail/web original: https://agencias.buquebus.com/");
    });

    it("#9 IA acotada a las celdas ambiguas y ningún mail de la base está fuera del Excel", async () => {
      const { data } = await admin
        .from("importacion")
        .select("detalle")
        .eq("id", resumen.importacionId)
        .single();
      const detalle = data!.detalle as {
        celdas_ambiguas: number;
        ia: { configurada: boolean; llamadas: number };
      };
      expect(detalle.celdas_ambiguas).toBe(resumen.celdasAmbiguas);
      expect(detalle.celdas_ambiguas).toBeLessThan(20);
      expect(detalle.ia.llamadas).toBeLessThanOrEqual(detalle.celdas_ambiguas);

      // Todo mail guardado aparece literal en las columnas Mail/web o Aclaraciones del Excel.
      const textoExcel = leerFilasDelExcel(RUTA_EXCEL)
        .map((fila) => `${fila[3] ?? ""}\n${fila[4] ?? ""}`)
        .join("\n")
        .toLowerCase();
      // (se excluyen los proveedores temporales que crean otros tests de integración)
      const mails = filas.filter((p) => !p.nombre.startsWith("TEST-")).flatMap((p) => p.mails);
      expect(mails.length).toBeGreaterThan(150);
      expect(mails.filter((m) => !textoExcel.includes(m))).toEqual([]);

      // Las celdas ambiguas reales quedan sin mail inventado.
      for (const nombre of ["Selina salta", "ONA Apart Hotel & Spa", "Rochester Calafate", "Cilene del Faro"]) {
        expect(buscar(filas, nombre)).toMatchObject({ mails: [], canal: null });
      }
    });
  });
});
