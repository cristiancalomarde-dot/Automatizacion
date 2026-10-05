// @vitest-environment node
//
// Spec M1-04c — verificaciones 2 y 3 (regla #5), contra el proyecto Supabase
// real y el Excel vigente de `Insumos/` (no mocks).
//
// V2 (integración):
//   - El diagnóstico real de los 17 paquetes NO escribe nada: se cuentan las
//     filas de producto, producto_servicio, codigo_externo, proveedor,
//     proveedor_alias e importacion antes y después, y además se registra el
//     método de cada pedido HTTP (solo GET/HEAD).
//     Los conteos dejan afuera lo que crean y borran en paralelo otros tests
//     de integración (proveedores "TEST-…", productos "TEST…", e importacion
//     de otros archivos): en importacion se cuentan las filas del archivo que
//     lee el diagnóstico, que es lo único que podría registrar.
//   - Cada uno de los 17 códigos tiene su bloque, o queda reportado como no
//     encontrado.
//   - Iguazú no cambia (§3 #7): el diagnóstico de los 5 de Iguazú no trae nada
//     nuevo para confirmar, salvo lo ya conocido ("Extra glamping x pax"; Tetris
//     está en el directorio desde M1-04d).
// V3 (recorrido completo): el script real (`diagnosticar:paquetes`) deja el
//     .md con las 17 secciones y el .json válido con una entrada por paquete.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { diagnosticarPaquetes, type Diagnostico } from "@/lib/importador-productos/diagnostico";
import { leerFilasPaquetes } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { fetchSoloLectura } from "@/lib/importador-productos/solo-lectura";
import { credencialesSupabaseDisponibles } from "./helpers/entorno-supabase";

const RAIZ = resolve(__dirname, "..");
const RUTA_PAQUETES = resolve(RAIZ, "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls");
const LISTA = parsearPaquetesPiloto(readFileSync(resolve(RAIZ, "data/paquetes-piloto.csv"), "utf-8"));
const NIVELES = parsearNivelesConfirmados(readFileSync(resolve(RAIZ, "data/niveles-confirmados.csv"), "utf-8"));
const SALIDA = resolve(RAIZ, "docs/sdd/diagnosticos/M1-04c-paquetes-de-los-tours");
const IGUAZU = ["OD010A", "OD010B", "OD010C", "OD010D", "OD011"];
const LOS_17 = LISTA.map((p) => p.codigo).filter((c) => !IGUAZU.includes(c));
const CORRE = credencialesSupabaseDisponibles() && existsSync(RUTA_PAQUETES);
const TIMEOUT = 240_000;

(CORRE ? describe : describe.skip)("diagnóstico de paquetes contra Supabase real (spec M1-04c)", () => {
  let admin: SupabaseClient;
  const metodos: string[] = [];

  beforeAll(() => {
    const registrar: typeof fetch = (entrada, opciones) => {
      metodos.push((opciones?.method ?? (entrada instanceof Request ? entrada.method : "GET")).toUpperCase());
      return fetch(entrada, opciones);
    };
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fetchSoloLectura(registrar) },
    });
  });

  async function contar(): Promise<Record<string, number>> {
    const lector = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const c = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
      const { count, error } = await q;
      expect(error).toBeNull();
      return count ?? 0;
    };
    return {
      producto: await c(lector.from("producto").select("id", { count: "exact", head: true }).not("codigo", "like", "TEST%")),
      producto_servicio: await c(
        lector
          .from("producto_servicio")
          .select("id, producto!inner(codigo)", { count: "exact", head: true })
          .not("producto.codigo", "like", "TEST%"),
      ),
      codigo_externo: await c(
        lector
          .from("codigo_externo")
          .select("id, producto!inner(codigo)", { count: "exact", head: true })
          .not("producto.codigo", "like", "TEST%"),
      ),
      proveedor: await c(lector.from("proveedor").select("id", { count: "exact", head: true }).not("nombre", "like", "TEST-%")),
      proveedor_alias: await c(lector.from("proveedor_alias").select("id", { count: "exact", head: true })),
      importacion: await c(
        lector.from("importacion").select("id", { count: "exact", head: true }).eq("archivo", basename(RUTA_PAQUETES)),
      ),
    };
  }

  describe("V2 — el diagnóstico real de los 17 no escribe nada (§3 #2, #3)", () => {
    let antes: Record<string, number>;
    let d: Diagnostico;

    beforeAll(async () => {
      antes = await contar();
      metodos.length = 0;
      d = await diagnosticarPaquetes({
        admin,
        filas: leerFilasPaquetes(RUTA_PAQUETES),
        archivo: basename(RUTA_PAQUETES),
        paquetes: LISTA.filter((p) => LOS_17.includes(p.codigo)),
        nivelesConfirmados: NIVELES,
      });
    }, TIMEOUT);

    it("las 6 tablas tienen las mismas filas antes y después", async () => {
      expect(await contar()).toEqual(antes);
    }, TIMEOUT);

    it("todos los pedidos a la base fueron lecturas (GET/HEAD)", () => {
      expect(metodos.length).toBeGreaterThan(0);
      expect(metodos.filter((m) => m !== "GET" && m !== "HEAD")).toEqual([]);
    });

    it("los 17 códigos: cada uno con su bloque o reportado como no encontrado", () => {
      expect(LOS_17).toHaveLength(17);
      expect(d.paquetes.map((p) => p.codigo)).toEqual(LOS_17);
      const noEncontrados = d.aConfirmar.bloquesNoEncontrados.map((b) => b.codigo);
      for (const p of d.paquetes) {
        expect(p.encontrado || noEncontrados.includes(p.codigo), p.codigo).toBe(true);
      }
    });

    it("ninguna sugerencia de proveedor quedó guardada (la lista de equivalencias no cambió)", async () => {
      const { count } = await admin.from("proveedor_alias").select("id", { count: "exact", head: true });
      expect(count).toBe(antes.proveedor_alias);
    });
  });

  describe("V2 — Iguazú no cambia (§3 #7)", () => {
    it("el diagnóstico de los 5 de Iguazú solo trae lo ya conocido: 'Extra glamping x pax' (Tetris ya está en el directorio, M1-04d)", async () => {
      const d = await diagnosticarPaquetes({
        admin,
        filas: leerFilasPaquetes(RUTA_PAQUETES),
        archivo: basename(RUTA_PAQUETES),
        paquetes: LISTA.filter((p) => IGUAZU.includes(p.codigo)),
        nivelesConfirmados: NIVELES,
      });
      expect(d.paquetes.every((p) => p.encontrado && !p.bloqueNoCalza)).toBe(true);
      const c = d.aConfirmar;
      expect(c.proveedoresSinEmparejar.map((p) => p.nombre)).toEqual([]);
      expect(c.lineasNoEntendidas.map((l) => l.texto)).toEqual(["Extra glamping x pax"]);
      expect({
        equivalenciasParaRevisar: c.equivalenciasParaRevisar,
        equivalenciasUsadas: c.equivalenciasUsadas,
        serviciosSinBookingSupplier: c.serviciosSinBookingSupplier,
        alojamientosSinNivel: c.alojamientosSinNivel,
        nivelesSoloEnPrecios: c.nivelesSoloEnPrecios,
        bloquesNoEncontrados: c.bloquesNoEncontrados,
        bloquesDuplicados: c.bloquesDuplicados,
        bloquesQueNoCalzan: c.bloquesQueNoCalzan,
        destinosAConfirmar: c.destinosAConfirmar,
        nivelesConfirmadosSinLinea: c.nivelesConfirmadosSinLinea,
      }).toEqual({
        equivalenciasParaRevisar: [],
        equivalenciasUsadas: [],
        serviciosSinBookingSupplier: [],
        alojamientosSinNivel: [],
        nivelesSoloEnPrecios: [],
        bloquesNoEncontrados: [],
        bloquesDuplicados: [],
        bloquesQueNoCalzan: [],
        destinosAConfirmar: [],
        nivelesConfirmadosSinLinea: [],
      });
    }, TIMEOUT);
  });

  describe("V3 — el script real deja el reporte (§3 #4, #6, #8)", () => {
    // Desde M1-04d los 17 ya están cargados (por defecto el script los saltea):
    // se corre con --todos, y el reporte de M1-04c (documento histórico, el que
    // contestó el owner) se restaura al terminar.
    it("npm run diagnosticar:paquetes -- --todos → .md con una sección por paquete y .json con una entrada por paquete", () => {
      const antes = { ...process.env };
      delete antes.ANTHROPIC_API_KEY; // sin clave: nunca hay llamadas a la IA
      const historico = { md: readFileSync(`${SALIDA}.md`, "utf-8"), json: readFileSync(`${SALIDA}.json`, "utf-8") };
      try {
        execFileSync(
          process.execPath,
          [resolve(RAIZ, "node_modules/tsx/dist/cli.mjs"), "scripts/diagnosticar-paquetes.ts", RUTA_PAQUETES, "--todos"],
          { cwd: RAIZ, env: antes, stdio: "pipe", timeout: TIMEOUT },
        );
        const md = readFileSync(`${SALIDA}.md`, "utf-8");
        const json = JSON.parse(readFileSync(`${SALIDA}.json`, "utf-8")) as Diagnostico;
        const todos = LISTA.map((p) => p.codigo);
        const detalle = md.slice(md.indexOf("## Detalle por paquete"));
        const secciones = detalle.split("\n").filter((l) => l.startsWith("### "));
        expect(secciones).toHaveLength(todos.length);
        for (const codigo of LOS_17) expect(secciones.some((s) => s.startsWith(`### ${codigo} `)), codigo).toBe(true);
        expect(md.indexOf("## Lo que necesito que confirmes")).toBeLessThan(md.indexOf("## Detalle por paquete"));
        expect(json.paquetes.map((p) => p.codigo)).toEqual(todos);
        // Cada servicio muestra su Booking Supplier y su estado.
        for (const p of json.paquetes) {
          for (const s of p.servicios) for (const o of s.opciones) expect(o.emparejado, `${p.codigo} fila ${s.fila}`).toBeTruthy();
        }
      } finally {
        writeFileSync(`${SALIDA}.md`, historico.md);
        writeFileSync(`${SALIDA}.json`, historico.json);
      }
    }, TIMEOUT);
  });
});
