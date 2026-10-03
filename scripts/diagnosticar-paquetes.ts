/**
 * Diagnóstico de los paquetes piloto, modo "solo leer" (spec M1-04c).
 *
 *   npm run diagnosticar:paquetes
 *   npm run diagnosticar:paquetes -- "<ruta al .xls de paquetes>" [--todos]
 *
 * Lee la lista de códigos de `data/paquetes-piloto.csv`, el Excel vigente de
 * paquetes (`Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls`,
 * hoja "Analisis a Mayo 2026"), los niveles confirmados
 * (`data/niveles-confirmados.csv`) y, si está, `Insumos/RutasenBus2020.xls`
 * (hoja "Tours 2027", solo para confirmar que cada código sale de ahí).
 * Por defecto saltea los códigos que ya son productos en la base (los 5 de
 * Iguazú); `--todos` los incluye.
 *
 * No escribe nada en la base: el cliente de Supabase usa `fetchSoloLectura`
 * (corta cualquier pedido que no sea GET/HEAD) y el diagnóstico lo envuelve
 * en `clienteSoloLectura`. No llama a la IA. Escribe el reporte en
 * `docs/sdd/diagnosticos/M1-04c-paquetes-de-los-tours.md` y `.json`.
 *
 * Variables de entorno (regla #2 — nunca en el código; en local se leen de
 * `.env.local`): NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { diagnosticarPaquetes } from "@/lib/importador-productos/diagnostico";
import { leerFilasPaquetes } from "@/lib/importador-productos/importar";
import { parsearNivelesConfirmados } from "@/lib/importador-productos/niveles-confirmados";
import { parsearPaquetesPiloto } from "@/lib/importador-productos/paquetes-piloto";
import { reporteJson, reporteMarkdown } from "@/lib/importador-productos/reporte-diagnostico";
import { fetchSoloLectura } from "@/lib/importador-productos/solo-lectura";

const PAQUETES_POR_DEFECTO = "Insumos/Construccion de Paquetes 2019 con 3 y 4 estrellas.xls";
const RUTAS = "Insumos/RutasenBus2020.xls";
const HOJA_RUTAS = "Tours 2027";
const LISTA = "data/paquetes-piloto.csv";
const NIVELES_CONFIRMADOS = "data/niveles-confirmados.csv";
const SALIDA = "docs/sdd/diagnosticos/M1-04c-paquetes-de-los-tours";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

function archivo(ruta: string): string {
  const absoluta = resolve(process.cwd(), ruta);
  if (!existsSync(absoluta)) throw new Error(`No existe el archivo: ${absoluta}`);
  return absoluta;
}

function filasRutas(): string[][] | null {
  const ruta = resolve(process.cwd(), RUTAS);
  if (!existsSync(ruta)) return null;
  const hoja = XLSX.read(readFileSync(ruta), { type: "buffer" }).Sheets[HOJA_RUTAS];
  if (!hoja) return null;
  return XLSX.utils
    .sheet_to_json<unknown[]>(hoja, { header: 1, defval: "", raw: false })
    .map((f) => f.map((c) => String(c ?? "")));
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);

  const argumentos = process.argv.slice(2);
  const todos = argumentos.includes("--todos");
  const rutaPaquetes = archivo(argumentos.find((a) => !a.startsWith("--")) ?? PAQUETES_POR_DEFECTO);

  const admin = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchSoloLectura() },
  });

  const diagnostico = await diagnosticarPaquetes({
    admin,
    filas: leerFilasPaquetes(rutaPaquetes),
    archivo: basename(rutaPaquetes),
    paquetes: parsearPaquetesPiloto(readFileSync(archivo(LISTA), "utf-8")),
    nivelesConfirmados: parsearNivelesConfirmados(readFileSync(archivo(NIVELES_CONFIRMADOS), "utf-8")),
    omitirCargados: !todos,
    filasRutas: filasRutas(),
  });

  const salida = resolve(process.cwd(), SALIDA);
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(`${salida}.md`, reporteMarkdown(diagnostico));
  writeFileSync(`${salida}.json`, reporteJson(diagnostico));

  const c = diagnostico.aConfirmar;
  console.log(
    JSON.stringify(
      {
        paquetes: diagnostico.paquetes.length,
        encontrados: diagnostico.paquetes.filter((p) => p.encontrado).length,
        omitidosPorYaCargados: diagnostico.omitidosPorYaCargados,
        proveedoresSinEmparejar: c.proveedoresSinEmparejar.length,
        reporte: `${SALIDA}.md`,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
