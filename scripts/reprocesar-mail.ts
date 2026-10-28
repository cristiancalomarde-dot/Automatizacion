/**
 * Volver a leer UN mail de sales@ que ya entró (spec M3-30 fila 8; el de
 * Petzold, Inbox uid 16682), ahora con las imágenes del cuerpo. Un solo uso:
 * lo corre el owner (#4).
 *
 *   npm run reprocesar:mail -- --uid 16682            # en seco: qué haría (sin IA, sin escribir)
 *   npm run reprocesar:mail -- --uid 16682 --aplicar  # lo hace
 *   npm run reprocesar:mail -- --uid 16682 --carpeta spam
 *
 * Con --aplicar:
 * 1. Suma a la base los nombres de Journaway que faltan (`data/journaway-nombres.csv`,
 *    los de Petzold en alemán).
 * 2. Baja el mail de la casilla (solo lectura: EXAMINE y BODY.PEEK, nunca lo marca ni lo mueve).
 * 3. Sube sus imágenes al bucket, pasa sus reservas a "descartada" (si siguen
 *    "recibida" o "para revisión"; si no, no toca nada) y lo lee de nuevo con la IA
 *    (una llamada, bajo el techo de gasto, #3) por el circuito de siempre.
 *
 * Antes: la migración 0024 (el bucket acepta imágenes) aplicada a la base real.
 *
 * Variables (regla #2), de `.env.local`: SALES_IMAP_HOST, SALES_IMAP_USER,
 * SALES_IMAP_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y
 * ANTHROPIC_API_KEY (solo con --aplicar). No imprime datos de pasajeros (#1):
 * solo ids, estados, códigos y motivos.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { mesActual } from "@/lib/ia/techo-gasto";
import { sumarNombresJournaway } from "@/lib/importador-journaway/sumar-nombres";
import { abrirCasillaImap } from "@/lib/lectura-sales/casilla";
import { carpetaInbox, carpetaSpam } from "@/lib/lectura-sales/carpetas";
import { configCasilla } from "@/lib/lectura-sales/config";
import { huellaDeSobre } from "@/lib/lectura-sales/corrida";
import { camposDeEml } from "@/lib/modo-prueba/leer-archivo";
import { agenciaDelRemitente } from "@/lib/reservas/agencias";
import { crearProponedorIA } from "@/lib/reservas/emparejar/propuesta-ia";
import { cargarDependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { reprocesarMailGuardado } from "@/lib/reservas/reprocesar";
import type { MailEntrada } from "@/lib/reservas/tipos";

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta configurar ${nombre}.`);
  return valor;
}

function argumentos() {
  const a = process.argv.slice(2);
  const valor = (n: string) => {
    const i = a.indexOf(n);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const uid = Number(valor("--uid"));
  if (!Number.isInteger(uid) || uid < 1) throw new Error("Falta --uid <número> (el UID del mail en la casilla; Petzold: 16682).");
  const carpeta = (valor("--carpeta") ?? "inbox").toLowerCase();
  if (carpeta !== "inbox" && carpeta !== "spam") throw new Error("--carpeta es inbox o spam.");
  return { uid, carpeta: carpeta as "inbox" | "spam", aplicar: a.includes("--aplicar") };
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  const { uid, carpeta, aplicar } = argumentos();
  const admin = createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Los nombres de Journaway que faltan en la base.
  const nombres = await sumarNombresJournaway(admin, { aplicar });
  console.log(`Nombres de Journaway que faltan en la base: ${nombres.sumados.length}${aplicar ? " (sumados)" : ""}`);
  for (const n of nombres.sumados) console.log(`  + ${n.codigo}: ${n.nombre}`);
  for (const n of nombres.enOtroProducto) console.log(`  ! ${n.nombre}: ya está en otro producto, no se tocó (${n.codigo} en el archivo)`);
  for (const n of nombres.sinProducto) console.log(`  ! ${n.codigo} no está en el catálogo: no se cargó "${n.nombre}"`);

  // 2. El mail, de la casilla (solo lectura).
  const config = configCasilla();
  if (!config) throw new Error("Faltan las variables SALES_IMAP_* para leer la casilla.");
  const casilla = await abrirCasillaImap(config);
  let entrada: MailEntrada;
  try {
    const carpetas = await casilla.carpetas();
    const ruta = carpeta === "inbox" ? carpetaInbox(carpetas) : carpetaSpam(carpetas);
    if (!ruta) throw new Error("La casilla no tiene carpeta de Spam.");
    const { uidValidity, sobres } = await casilla.sobres(ruta, new Date(Date.now() - 120 * 86_400_000));
    const sobre = sobres.find((s) => s.uid === uid);
    if (!sobre) throw new Error(`No está el mail ${uid} en ${carpeta} (últimos 120 días).`);
    const fuente = (await casilla.fuentes(ruta, [uid])).get(uid);
    if (!fuente) throw new Error(`La casilla no devolvió el mail ${uid}.`);
    const campos = await camposDeEml(new Uint8Array(fuente));
    entrada = {
      origen: "imap",
      carpeta,
      imapUidvalidity: uidValidity,
      imapUid: uid,
      messageId: sobre.messageId,
      huella: huellaDeSobre(sobre),
      ...campos,
      remitente: sobre.remitente || campos.remitente,
      fechaMail: sobre.fecha ?? campos.fechaMail ?? null,
      agencia: agenciaDelRemitente(sobre.remitente || campos.remitente),
      dePrueba: false,
    };
  } finally {
    await casilla.cerrar();
  }
  const imagenes = (entrada.adjuntos ?? []).filter((x) => x.tipo.startsWith("image/"));
  console.log(`\nMail ${uid} (${carpeta}) de ${entrada.agencia}: ${imagenes.length} imagen(es), ${imagenes.filter((x) => x.cid).length} pegada(s) en el cuerpo.`);

  // 3. Reprocesar.
  const mes = mesActual();
  const llamadas = crearRegistroLlamadasSupabase(admin);
  const registro = crearRegistroUsoIASupabase(admin);
  let cliente: Anthropic | null = null;
  const ia = () => (cliente ??= new Anthropic({ apiKey: variable("ANTHROPIC_API_KEY") }));
  const r = await reprocesarMailGuardado(entrada, {
    admin,
    aplicar,
    llamadas,
    leer: (mail, ctx) => leerMailConIA(mail, { cliente: ia(), registro, mes, llamadas, mailRecibidoId: ctx.mailRecibidoId }),
    deps: (ctx) => cargarDependenciasReservas(admin, crearProponedorIA({ cliente: ia(), registro, mes, mailRecibidoId: ctx.mailRecibidoId })),
  });

  if (r.estado === "no_esta") {
    console.log(`No se hizo nada: ${r.motivo}.`);
    return;
  }
  console.log(`Reservas de ese mail hoy: ${r.viejas.map((v) => `${v.id} (${v.estado}, ${v.producto ?? "sin producto"})`).join(", ") || "ninguna"}`);
  if (r.estado === "no_se_toca") {
    console.log(`No se hizo nada: ${r.motivo}.`);
    return;
  }
  if (r.estado === "en_seco") {
    console.log(`Subiría ${r.imagenes.length} imagen(es) (${r.imagenes.join(", ") || "ninguna"}), descartaría ${r.viejas.length} reserva(s) y leería el mail de nuevo con la IA.`);
    console.log("No se cambió nada. Para hacerlo: npm run reprocesar:mail -- --uid " + uid + (carpeta === "spam" ? " --carpeta spam" : "") + " --aplicar");
    return;
  }
  console.log(`Imágenes subidas: ${r.subidas}. Reservas viejas descartadas: ${r.viejas.length}. Costo de IA: US$ ${r.costo.toFixed(4)}.`);
  for (const p of r.nuevas) {
    const { data } = await admin.from("reserva").select("estado, motivos_revision, producto:producto_id(codigo)").eq("id", p.reservaId).single();
    const f = data as unknown as { estado: string; motivos_revision: string[] | null; producto: { codigo: string } | null } | null;
    console.log(`\nReserva nueva ${p.reservaId}: ${f?.producto?.codigo ?? "sin producto"} · ${f?.estado ?? "?"}`);
    for (const m of f?.motivos_revision ?? []) console.log(`  - ${m}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
