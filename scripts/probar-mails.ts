/**
 * Modo prueba con mails reales (spec M2-06).
 *
 *   npm run probar:mails                                   # Insumos/Mails
 *   npm run probar:mails -- "<archivo o carpeta>" ["<otra>"…]
 *   npm run probar:mails -- --modelo claude-opus-5-5       # otro modelo para la lectura
 *   npm run probar:mails -- --tope 1                       # tope de la corrida en US$ (por defecto 2)
 *   npm run probar:mails -- --resumen                      # solo reescribe M2-06-resumen.md
 *   npm run probar:mails -- --borrar                       # borra TODO lo de prueba (solo si se pide)
 *
 * Cada .docx, .pdf y .eml pasa por el circuito real (filtro de entrada →
 * M2-02 → M2-03 → M2-04) con todo marcado "de prueba". Deja un reporte por
 * archivo en `docs/sdd/diagnosticos/M2-06-mails/` y el resumen en
 * `docs/sdd/diagnosticos/M2-06-resumen.md`. Un archivo ya procesado (mismo
 * contenido) no se vuelve a leer ni gasta IA.
 *
 * Gasta dinero real: cada llamada pasa por el techo del mes (US$ 20, `uso_ia`)
 * y por el tope de la corrida (US$ 2), chequeados antes (#3). No se conecta a
 * la casilla sales@ ni manda mails (#4): todo sale de archivos locales. No
 * imprime datos de pasajeros.
 *
 * Variables de entorno (regla #2, en local desde `.env.local`):
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y, para leer,
 * ANTHROPIC_API_KEY.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MODELOS, preciosDelModelo } from "@/lib/ia/modelos";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { mesActual } from "@/lib/ia/techo-gasto";
import { borrarTodoLoDePrueba } from "@/lib/modo-prueba/borrar";
import { correrModoPrueba, type ResultadoArchivo } from "@/lib/modo-prueba/corrida";
import { listarArchivos } from "@/lib/modo-prueba/leer-archivo";
import { armarReporteMail, nombreDelReporte } from "@/lib/modo-prueba/reporte";
import { armarResumen, type ArchivoDelResumen, type EvalDeModelo, type ReservaDelResumen } from "@/lib/modo-prueba/resumen";
import { TOPE_CORRIDA_USD } from "@/lib/modo-prueba/tope-corrida";
import { crearProponedorIA } from "@/lib/reservas/emparejar/propuesta-ia";
import { cargarDependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import type { EstadoReserva } from "@/lib/reservas/tipos";

const RAIZ = process.cwd();
const DIR_REPORTES = join(RAIZ, "docs", "sdd", "diagnosticos", "M2-06-mails");
const RESUMEN = join(RAIZ, "docs", "sdd", "diagnosticos", "M2-06-resumen.md");
const INDICE = join(DIR_REPORTES, "indice.json");
const EVALS = join(RAIZ, "Insumos", "evals", "lectura", "resultados");

function argumentos() {
  const a = process.argv.slice(2);
  const valor = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const conValor = new Set(["--modelo", "--tope"]);
  const rutas = a.filter((x, i) => !x.startsWith("--") && !conValor.has(a[i - 1] ?? ""));
  return {
    rutas: rutas.length ? rutas : ["Insumos/Mails"],
    borrar: a.includes("--borrar"),
    resumen: a.includes("--resumen"),
    modelo: valor("--modelo") ?? MODELOS.lectura_mail.modelo,
    tope: Number(valor("--tope") ?? TOPE_CORRIDA_USD),
  };
}

function conectar(): SupabaseClient {
  for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[v]) throw new Error(`Falta la variable de entorno ${v}.`);
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// --- índice de la última corrida (sin datos personales) ---------------------------------

function leerIndice(): ArchivoDelResumen[] {
  return existsSync(INDICE) ? (JSON.parse(readFileSync(INDICE, "utf-8")) as ArchivoDelResumen[]) : [];
}

function guardarIndice(resultados: ResultadoArchivo[]) {
  const porArchivo = new Map(leerIndice().map((a) => [a.archivo, a]));
  for (const r of resultados) {
    const anterior = porArchivo.get(r.archivo);
    // Uno ya procesado conserva lo que dijo la corrida en que se leyó.
    if (r.estado === "ya_procesado" && anterior) continue;
    porArchivo.set(r.archivo, {
      archivo: r.archivo,
      estado: r.estado === "ya_procesado" ? "procesado" : r.estado,
      ...(r.motivo ? { motivo: r.motivo } : {}),
      reservas: r.reservas.filter((x) => x.accion !== "sumada").length,
      reporte: nombreDelReporte(r.archivo),
    });
  }
  const lista = [...porArchivo.values()].sort((a, b) => (a.archivo < b.archivo ? -1 : 1));
  writeFileSync(INDICE, `${JSON.stringify(lista, null, 2)}\n`);
}

// --- resumen -------------------------------------------------------------------------------

function evalsPorModelo(): EvalDeModelo[] {
  if (!existsSync(EVALS)) return [];
  const ultimo = new Map<string, EvalDeModelo>();
  for (const f of readdirSync(EVALS).filter((x) => x.endsWith(".json")).sort()) {
    const j = JSON.parse(readFileSync(join(EVALS, f), "utf-8")) as Omit<EvalDeModelo, "cuando">;
    const cuando = f.slice(0, 16).replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2}).*/, "$1 $2:$3 UTC");
    ultimo.set(j.modelo, { modelo: j.modelo, version: j.version, total: j.total, gasto: j.gasto, porCampo: j.porCampo, cuando });
  }
  return [...ultimo.values()];
}

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST */
async function escribirResumen(admin: SupabaseClient) {
  const { data: filas, error } = await admin
    .from("reserva")
    .select("id,agencia,booking_id,booking_id_original,estado,motivos_revision,producto:producto_id(codigo),mail:mail_recibido_id(archivo_origen)")
    .eq("de_prueba", true)
    .order("created_at");
  if (error) throw new Error(`No se pudieron leer las reservas de prueba: ${error.message}`);
  const revisiones = await admin.from("revision_prueba").select("reserva_id,resultado,que_mal,nota");
  const marcasDisponibles = !revisiones.error;
  const marcaDe = new Map((revisiones.data ?? []).map((v: any) => [v.reserva_id, v]));
  const reservas: ReservaDelResumen[] = (filas as any[]).map((r) => {
    const v = marcaDe.get(r.id);
    const archivo = r.mail?.archivo_origen ?? null;
    return {
      archivo,
      reporte: archivo ? nombreDelReporte(archivo) : null,
      bookingId: r.booking_id_original ?? r.booking_id,
      agencia: r.agencia,
      producto: r.producto?.codigo ?? null,
      estado: r.estado as EstadoReserva,
      motivos: r.motivos_revision ?? [],
      marca: v ? { resultado: v.resultado, queMal: v.que_mal ?? [], nota: v.nota } : null,
    };
  });
  const { data: llamadas, error: errorLlamadas } = await admin
    .from("ia_llamada")
    .select("tarea,modelo,version_instrucciones,costo_usd,resultado")
    .eq("de_prueba", true);
  if (errorLlamadas) throw new Error(`No se pudo leer el gasto de IA: ${errorLlamadas.message}`);
  const lista = (llamadas ?? []) as any[];
  const md = armarResumen({
    fecha: new Date().toISOString().slice(0, 10),
    reservas,
    archivos: leerIndice(),
    gasto: {
      total: lista.reduce((s, l) => s + Number(l.costo_usd), 0),
      lecturas: lista.filter((l) => l.tarea === "lectura_mail" && l.resultado !== "sin_presupuesto").length,
      propuestas: lista.filter((l) => l.tarea === "propuesta_producto" && l.resultado !== "sin_presupuesto").length,
    },
    modelos: [...new Set(lista.map((l) => l.modelo as string))],
    versiones: [...new Set(lista.filter((l) => l.tarea === "lectura_mail").map((l) => l.version_instrucciones as string))],
    evals: evalsPorModelo(),
    marcasDisponibles,
  });
  writeFileSync(RESUMEN, md);
  console.log(`Resumen: docs/sdd/diagnosticos/M2-06-resumen.md (${reservas.length} reservas de prueba).`);
}

// --- corrida -------------------------------------------------------------------------------

function lineaDe(r: ResultadoArchivo): string {
  const reservas = r.reservas
    .map((x) => `${x.accion === "sumada" ? "+ se sumó a " : ""}${x.bookingId ?? "sin número"} ${x.producto?.codigo ?? "(sin producto)"} ${x.estado}`)
    .join("; ");
  const detalle = r.estado === "procesado" || r.estado === "ya_procesado" ? reservas : (r.motivo ?? "");
  return `- ${r.archivo} · ${r.estado} · ${detalle} · US$ ${r.costo.toFixed(4)}`;
}

async function correr(admin: SupabaseClient, opciones: ReturnType<typeof argumentos>) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta la variable de entorno ANTHROPIC_API_KEY.");
  preciosDelModelo(opciones.modelo); // un modelo sin precio no se corre (el techo lo necesita)
  const archivos = listarArchivos(opciones.rutas.map((r) => resolve(RAIZ, r)));
  const cliente = new Anthropic();
  const registroUso = crearRegistroUsoIASupabase(admin);
  const llamadas = crearRegistroLlamadasSupabase(admin);
  const mes = mesActual();
  console.log(`Modo prueba: ${archivos.length} archivos · modelo ${opciones.modelo} · tope de la corrida US$ ${opciones.tope}\n`);

  mkdirSync(DIR_REPORTES, { recursive: true });
  const resultado = await correrModoPrueba(archivos, {
    admin,
    registroUso,
    llamadas,
    tope: opciones.tope,
    leer: (mail, ctx) =>
      leerMailConIA(mail, {
        cliente,
        registro: ctx.registro,
        mes,
        llamadas,
        mailRecibidoId: ctx.mailRecibidoId,
        dePrueba: true,
        modelo: opciones.modelo,
      }),
    deps: (ctx) =>
      cargarDependenciasReservas(admin, crearProponedorIA({ cliente, registro: ctx.registro, mes, dePrueba: true, mailRecibidoId: ctx.mailRecibidoId })),
    alTerminar: (r) => {
      console.log(lineaDe(r));
      const destino = join(DIR_REPORTES, nombreDelReporte(r.archivo));
      // Uno ya procesado no se vuelve a leer: su reporte (con lo que entendió la IA) se conserva.
      if (r.estado !== "ya_procesado" || !existsSync(destino)) writeFileSync(destino, armarReporteMail(r));
    },
  });
  guardarIndice(resultado.archivos);
  const cuenta = (e: string) => resultado.archivos.filter((a) => a.estado === e).length;
  console.log(
    `\nLeídos con IA: ${cuenta("procesado")} · ya procesados: ${cuenta("ya_procesado")} · salteados: ${cuenta("salteado")} · ` +
      `no procesados: ${cuenta("no_procesado")} · con error: ${cuenta("error")}`,
  );
  console.log(`Gasto de la corrida: US$ ${resultado.gasto.toFixed(4)} (${resultado.lecturasIA} lecturas con IA)`);
  // El aviso del 80% de llamarConTecho no se usa acá: con el tope de la corrida, el gasto que ve es
  // el del margen de la corrida, no el del mes. El del mes, real, sale de uso_ia.
  const delMes = await registroUso.gastoDelMes(mes);
  console.log(`Gasto de IA del mes ${mes}: US$ ${delMes.toFixed(2)} de US$ 20${delMes >= 16 ? " (80% o más del techo)" : ""}`);
  if (resultado.corte) console.log(`Se cortó: ${resultado.corte}`);
  console.log("Reportes: docs/sdd/diagnosticos/M2-06-mails/");
  if (cuenta("error")) process.exitCode = 1;
}

async function main() {
  const envLocal = resolve(RAIZ, ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  const opciones = argumentos();
  const admin = conectar();

  if (opciones.borrar) {
    const { archivosBorrados } = await borrarTodoLoDePrueba(admin);
    console.log(`Se borró todo lo de prueba (reservas, partes, historial, mails, llamadas a la IA y marcas) y ${archivosBorrados} PDF. Las reales y el gasto en uso_ia no se tocaron.`);
    return;
  }
  if (!opciones.resumen) await correr(admin, opciones);
  await escribirResumen(admin);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Error inesperado.");
  process.exit(1);
});
