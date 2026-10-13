/**
 * Set de evaluación de la lectura de mails (spec M2-02 fila 28;
 * `docs/arquitectura/integraciones-ia.md`, "Medir la calidad").
 *
 *   npm run eval:lectura
 *   npm run eval:lectura -- --modelo=<id del modelo>     # para comparar (M2-06)
 *   npm run eval:lectura -- --solo=<nombre del json>     # un mail solo
 *
 * Lee `Insumos/evals/lectura/*.json` (fuera de Git: tienen datos reales; las
 * fichas esperadas las valida el owner), corre la IA de verdad sobre cada
 * mail y da el % de aciertos por campo y el total, con el modelo y la versión
 * de las instrucciones. Gasta dinero real: cada llamada pasa por el techo del
 * mes (`uso_ia`, regla #3) y queda en `ia_llamada`; además la corrida se
 * frena si pasa `--tope` (US$, por defecto 1).
 *
 * La consola no muestra datos de pasajeros: solo campos, números, fechas y
 * nombres de productos. Las fichas completas quedan en
 * `Insumos/evals/lectura/resultados/` (fuera de Git) para revisarlas.
 *
 * Variables de entorno (regla #2, en local desde `.env.local`):
 * ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { MODELOS, preciosDelModelo } from "@/lib/ia/modelos";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { mesActual } from "@/lib/ia/techo-gasto";
import { CAMPOS_EVAL, compararFicha, resumirEval, type FichaEsperada, type ResultadoEval } from "@/lib/reservas/eval-lectura";
import { VERSION_INSTRUCCIONES, leerMailConIA } from "@/lib/reservas/extraer";
import { mailDeArchivo } from "./mail-de-archivo";

const DIR = resolve(process.cwd(), "Insumos", "evals", "lectura");

interface CasoEval {
  descripcion?: string;
  validado_por_owner?: boolean;
  mail: { archivo: string; remitente?: string; asunto?: string; cuerpo?: string; nombre_adjunto?: string };
  esperado: FichaEsperada;
}

function argumento(nombre: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${nombre}=`));
  return a ? a.slice(nombre.length + 3) : undefined;
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  for (const v of ["ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[v]) throw new Error(`Falta la variable de entorno ${v}.`);
  }
  if (!existsSync(DIR)) throw new Error(`No existe ${DIR}: ahí va el set de evaluación.`);

  const modelo = argumento("modelo") ?? MODELOS.lectura_mail.modelo;
  preciosDelModelo(modelo); // un modelo sin precio no se corre (el techo lo necesita)
  const tope = Number(argumento("tope") ?? "1");
  const solo = argumento("solo");

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const registro = crearRegistroUsoIASupabase(admin);
  const llamadas = crearRegistroLlamadasSupabase(admin);
  const cliente = new Anthropic();
  const mes = mesActual();

  const archivos = readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !solo || f === solo || f === `${solo}.json`)
    .sort();
  if (archivos.length === 0) throw new Error("No hay fichas esperadas en el set de evaluación.");

  console.log(`Evaluación de la lectura — modelo ${modelo}, instrucciones ${VERSION_INSTRUCCIONES}, ${archivos.length} mails\n`);
  const resultados: ResultadoEval[] = [];
  const fichas: Record<string, unknown> = {};
  let gasto = 0;
  let validados = 0;

  for (const archivo of archivos) {
    if (gasto >= tope) {
      console.log(`Corte: la corrida ya gastó US$ ${gasto.toFixed(4)} (tope ${tope}).`);
      break;
    }
    const caso = JSON.parse(readFileSync(join(DIR, archivo), "utf-8")) as CasoEval;
    if (caso.validado_por_owner) validados++;
    const mail = mailDeArchivo(resolve(process.cwd(), caso.mail.archivo), caso.mail);
    const lectura = await leerMailConIA(mail, { cliente, registro, mes, llamadas, modelo });
    gasto += lectura.costo;
    const ficha = lectura.estado === "leido" ? lectura.ficha : null;
    fichas[archivo] = lectura;
    const r = compararFicha(caso.esperado, ficha);
    resultados.push(r);

    const marcas = CAMPOS_EVAL.map((c) => `${c} ${r.campos[c] ? "ok" : "MAL"}`).join(" · ");
    console.log(`■ ${archivo} — US$ ${lectura.costo.toFixed(4)}`);
    console.log(lectura.estado === "leido" ? `  ${marcas}` : `  PARA REVISIÓN: ${lectura.motivo}`);
    if (ficha?.datos_dudosos.length) console.log(`  dudosos: ${ficha.datos_dudosos.join(", ")}`);
    for (const d of r.diferencias) console.log(`  - ${d}`);
  }

  const { porCampo, total } = resumirEval(resultados);
  console.log(`\nAciertos por campo (${resultados.length} mails, ${validados} validados por el owner):`);
  for (const c of CAMPOS_EVAL) console.log(`  ${c.padEnd(9)} ${porCampo[c].toFixed(1)}%`);
  console.log(`  TOTAL     ${total.toFixed(1)}%`);
  console.log(`Modelo ${modelo} · instrucciones ${VERSION_INSTRUCCIONES} · gasto de la corrida US$ ${gasto.toFixed(4)}`);

  const salida = join(DIR, "resultados");
  mkdirSync(salida, { recursive: true });
  const nombre = `${new Date().toISOString().replace(/[:.]/g, "-")}-${modelo}.json`;
  writeFileSync(
    join(salida, nombre),
    JSON.stringify({ modelo, version: VERSION_INSTRUCCIONES, porCampo, total, gasto, fichas }, null, 2),
  );
  console.log(`Fichas completas: Insumos/evals/lectura/resultados/${nombre}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Error inesperado.");
  process.exit(1);
});
