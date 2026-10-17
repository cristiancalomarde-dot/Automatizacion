/**
 * Lectura de sales@ a mano (spec M2-07 #6): la misma corrida que el cron.
 *
 *   npm run leer:sales -- --solo-listar        # qué mails procesaría y de qué agencia: sin IA, sin reservas, sin registro
 *   npm run leer:sales -- --solo-listar --dias 3
 *   npm run leer:sales                          # la corrida de verdad (solo con LECTURA_SALES_ACTIVA=si)
 *
 * Solo lee la casilla (EXAMINE, BODY.PEEK): nunca marca, mueve ni borra mails,
 * y no manda nada (#15, #16). No imprime remitentes, asuntos ni contenido:
 * solo fecha, carpeta, agencia y qué haría.
 *
 * Variables (regla #2), de `.env.local` (la base real: es la casilla real):
 * SALES_IMAP_HOST, SALES_IMAP_USER, SALES_IMAP_PASSWORD,
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y, para la corrida de
 * verdad, ANTHROPIC_API_KEY y LECTURA_SALES_ACTIVA=si.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { lecturaActiva } from "@/lib/lectura-sales/config";
import { opcionesDeProduccion } from "@/lib/lectura-sales/produccion";
import { leerSales, type ItemListado, type ResumenCorrida } from "@/lib/lectura-sales/corrida";
import { DIAS_VENTANA } from "@/lib/lectura-sales/ventana";

function argumentos() {
  const a = process.argv.slice(2);
  const i = a.indexOf("--dias");
  const dias = i >= 0 ? Number(a[i + 1]) : DIAS_VENTANA;
  if (!Number.isInteger(dias) || dias < 1 || dias > 60) throw new Error("--dias tiene que ser un número entero entre 1 y 60.");
  return { soloListar: a.includes("--solo-listar"), dias };
}

const ACCION: Record<ItemListado["accion"], string> = {
  leer: "se leería con IA",
  reintentar: "se reintentaría con IA",
  registrar: "se registraría sin IA",
  ya_procesado: "ya procesado",
  saltear: "no se lee",
};

function imprimirListado(r: ResumenCorrida) {
  console.log(`Carpetas leídas: ${r.carpetas.join(", ") || "ninguna"}`);
  console.log(`Mails en la ventana: ${r.miro} · de agencias: ${r.de_agencias}\n`);
  for (const x of r.listado) {
    console.log(`- ${x.fecha?.slice(0, 16).replace("T", " ") ?? "sin fecha"} UTC · ${x.carpeta} · ${x.agencia} · ${ACCION[x.accion]}: ${x.motivo}`);
  }
  const cuenta = new Map<string, number>();
  for (const x of r.listado) {
    const k = `${x.agencia} · ${ACCION[x.accion]} · ${x.motivo}`;
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  console.log("\nResumen por agencia y motivo:");
  for (const [k, n] of [...cuenta.entries()].sort()) console.log(`  ${n} × ${k}`);
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  const { soloListar, dias } = argumentos();
  if (!soloListar && !lecturaActiva()) {
    console.log("La lectura automática está apagada (LECTURA_SALES_ACTIVA no es \"si\"). Para probar la conexión: npm run leer:sales -- --solo-listar");
    return;
  }
  const r = await leerSales(opcionesDeProduccion("manual", { soloListar, dias }));
  if (soloListar) {
    console.log(`Solo listar (sin IA, sin reservas, sin registro) · últimos ${dias} días\n`);
    if (r.estado === "fallo") console.log(`No se pudo leer: ${r.errores.join("; ")}`);
    else imprimirListado(r);
  } else {
    console.log(
      `Corrida: ${r.estado} · miró ${r.miro} · de agencias ${r.de_agencias} · procesó ${r.procesados} · ` +
        `${r.reservas_nuevas} nuevas, ${r.reservas_actualizadas} actualizadas · pendientes ${r.pendientes} · no se pudo leer ${r.no_se_pudo_leer}`,
    );
  }
  for (const a of r.avisos) console.log(`Aviso: ${a}`);
  for (const e of r.errores) if (!soloListar || r.estado !== "fallo") console.log(`Error: ${e}`);
  if (r.estado === "fallo") process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Error inesperado.");
  process.exit(1);
});
