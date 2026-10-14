/**
 * Recorrido de M2-04 (verificación 3): la secuencia "Overland 9-oct → varias →
 * 2 NEW BOOKINGS → los dos de TourRadar 1377598 → la cancelación de 1363612 →
 * los dos de Iguazú de Journaway" por el circuito real de M2-02 → M2-03 →
 * M2-04, dos veces. La segunda pasada no tiene que cambiar nada ni gastar IA
 * (fila 1). Todo queda "de prueba" y se borra al final.
 *
 *   npm run probar:intercambio               # corre y después borra lo de prueba
 *   npm run probar:intercambio -- --conservar # deja las reservas de prueba
 *
 * Gasta dinero real (Sonnet): cada llamada pasa por el techo del mes (#3) y
 * queda en `ia_llamada`; la corrida se frena si pasa US$ 1. No reintenta. No
 * imprime datos de pasajeros.
 *
 * "varias" es en realidad una respuesta de HI Travel que copia las 3 reservas:
 * se le da un asunto de mail original para que entre (el filtro de respuestas
 * es de M2-07). Los mails de Journaway de Iguazú no traen el ID en el asunto.
 *
 * Variables de entorno (regla #2, en local desde `.env.local`):
 * ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { mesActual } from "@/lib/ia/techo-gasto";
import { crearProponedorIA } from "@/lib/reservas/emparejar/propuesta-ia";
import { cargarDependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { borrarDatosDePrueba } from "@/lib/reservas/guardar";
import { procesarMail, type ResultadoProceso } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";

const TOPE_CORRIDA_USD = 1;
const TEXTO = "Insumos/Mails/texto";
const PDF = "Insumos/Mails";
const VARIAS = `${TEXTO}/Reserva de Cliente Kilroy Copenagiue varias.txt`;

interface Caso {
  nombre: string;
  remitente: string;
  asunto: string;
  fecha: string;
  texto?: string;
  pdf?: string;
}

function desde(ruta: string, patron: RegExp): string {
  const renglones = readFileSync(ruta, "utf-8").split(/\r?\n/);
  const i = renglones.findIndex((r) => patron.test(r));
  if (i < 0) throw new Error(`No se encontró el mail original en ${ruta}.`);
  return renglones.slice(i + 1).join("\n");
}

const CASOS: Caso[] = [
  {
    nombre: "Kilroy Overland DK1594100 (9-oct)",
    remitente: "copenhagen@kilroy.dk",
    asunto: "DK1594100/maga - Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days - KILROY booking request",
    fecha: "2026-10-09T06:38:00Z",
    texto: desde(resolve(VARIAS), /^Asunto: DK1594100/),
  },
  {
    nombre: "Kilroy 'varias' DK1594100 (3 reservas)",
    remitente: "copenhagen@kilroy.dk",
    asunto: "DK1594100/maga - 3 NEW BOOKINGS - KILROY booking request",
    fecha: "2026-10-09T12:00:00Z",
    texto: readFileSync(resolve(VARIAS), "utf-8"),
  },
  {
    nombre: "Kilroy 2 NEW BOOKINGS DK1576932",
    remitente: "emhe@kilroy.dk",
    asunto: "2 NEW BOOKINGS - DK1576932/emhe - KILROY booking request",
    fecha: "2026-10-10T10:00:00Z",
    texto: readFileSync(resolve(`${TEXTO}/Reserva de Cliente Kilroy Copenhaguen  - Patagonia Trekking Paradise ARCH33.txt`), "utf-8"),
  },
  {
    nombre: "TourRadar 1377598 (estado de cuenta 1)",
    remitente: "system@sent-via.netsuite.com",
    asunto: "Booking Statement 1377598 - 25372219 - vendorbill",
    fecha: "2026-10-10T11:00:00Z",
    pdf: `${PDF}/1# Booking Statement 1377598 - 25372219 - vendorbill Ejemplo Reserva de TR Patagonia Adventure Blanca Roman Original.pdf`,
  },
  {
    nombre: "TourRadar 1377598 (estado de cuenta 2)",
    remitente: "system@sent-via.netsuite.com",
    asunto: "Booking Statement 1377598 - 25388222 - vendorbill",
    fecha: "2026-10-10T12:00:00Z",
    pdf: `${PDF}/1# Booking Statement 1377598 - 25388222 - vendorbill Ejemplo Reserva TR Patagonia Adventure Tour.pdf`,
  },
  {
    nombre: "TourRadar cancelación 1363612",
    remitente: "system@sent-via.netsuite.com",
    asunto: "Booking Statement 1363612 - 25160515 - vendorcredit",
    fecha: "2026-10-10T13:00:00Z",
    pdf: `${PDF}/1# Booking Statement 1363612 - 25160515 - vendorcredit Ejemplo Reserva TR Iguazu Falls on a Shoestring hotel 4..pdf`,
  },
  {
    nombre: "Journaway Iguazú lado brasileño",
    remitente: "de@journaway.com",
    asunto: "Booking request",
    fecha: "2026-10-11T09:00:00Z",
    texto: readFileSync(resolve(`${TEXTO}/Reserva de Cliente Journaway - Iguazu Falls Brazilian Side.txt`), "utf-8"),
  },
  {
    nombre: "Journaway Iguazú lado argentino",
    remitente: "de@journaway.com",
    asunto: "Booking request",
    fecha: "2026-10-11T09:05:00Z",
    texto: readFileSync(resolve(`${TEXTO}/Reserva de Cliente Journaway  - Iguazu Fall Argentina Side.txt`), "utf-8"),
  },
];

function entradaDe(caso: Caso, messageId: string): MailEntrada {
  const base = { origen: "archivo" as const, messageId, remitente: caso.remitente, asunto: caso.asunto, fechaMail: caso.fecha, dePrueba: true };
  if (caso.pdf) {
    const contenido = new Uint8Array(readFileSync(resolve(caso.pdf)));
    return { ...base, cuerpoTexto: "", adjuntos: [{ nombre: `${caso.asunto}.pdf`, tipo: "application/pdf", contenido }] };
  }
  return { ...base, cuerpoTexto: caso.texto!, adjuntos: [] };
}

async function contar(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("reserva")
    .select("id,agencia,booking_id,estado,posible_duplicada,mail_recibido_id")
    .eq("de_prueba", true);
  if (error) throw new Error(error.message);
  const { count: eventos } = await admin.from("evento_reserva").select("id", { count: "exact", head: true }).in("reserva_id", data!.map((r) => r.id));
  return { reservas: data!, eventos: eventos ?? 0 };
}

async function main() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
  for (const v of ["ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[v]) throw new Error(`Falta la variable de entorno ${v}.`);
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const cliente = new Anthropic();
  const registro = crearRegistroUsoIASupabase(admin);
  const llamadas = crearRegistroLlamadasSupabase(admin);
  const mes = mesActual();
  const corrida = randomUUID();
  const codigoDe = new Map<string, string>();
  for (const p of (await admin.from("producto").select("id,codigo")).data ?? []) codigoDe.set(p.id, p.codigo);

  let gasto = 0;
  let llamadasIA = 0;
  const opciones = {
    admin,
    dePrueba: true,
    llamadas,
    leer: async (mail: Parameters<typeof leerMailConIA>[0], ctx: { mailRecibidoId: string }) => {
      llamadasIA += 1;
      return leerMailConIA(mail, { cliente, registro, mes, llamadas, mailRecibidoId: ctx.mailRecibidoId, dePrueba: true });
    },
    deps: ({ mailRecibidoId }: { mailRecibidoId: string }) =>
      cargarDependenciasReservas(admin, crearProponedorIA({ cliente, registro, mes, dePrueba: true, mailRecibidoId })),
  };

  try {
    for (const pasada of [1, 2]) {
      console.log(`\n##### Pasada ${pasada}`);
      const antes = await contar(admin);
      const llamadasAntes = llamadasIA;
      for (const [i, caso] of CASOS.entries()) {
        if (gasto > TOPE_CORRIDA_USD) throw new Error(`Se frenó la corrida: el gasto pasó US$ ${TOPE_CORRIDA_USD}.`);
        const r: ResultadoProceso = await procesarMail(entradaDe(caso, `<probar-intercambio-${corrida}-${i}@hitravel.local>`), opciones);
        gasto += r.costo;
        const detalle =
          r.estado === "ya_procesado"
            ? "ya procesado (sin IA)"
            : r.pedidos.map((p) => `${p.accion}${p.enlazadas.length ? ` (enlazada a ${p.enlazadas.length})` : ""}`).join(", ");
        console.log(`- ${caso.nombre}: ${detalle} · US$ ${r.costo.toFixed(4)}`);
      }
      const despues = await contar(admin);
      if (pasada === 2) {
        const igual = despues.reservas.length === antes.reservas.length && despues.eventos === antes.eventos && llamadasIA === llamadasAntes;
        console.log(`Segunda pasada sin cambios: ${igual ? "sí" : "NO"} (reservas ${despues.reservas.length}, eventos ${despues.eventos}, lecturas IA ${llamadasIA - llamadasAntes})`);
      }
    }

    const { reservas } = await contar(admin);
    const de = (b: string) => reservas.filter((r) => r.booking_id === b);
    const mailsDe = async (id: string, origen: string) => {
      const { data } = await admin.from("evento_reserva").select("mail_recibido_id").eq("reserva_id", id).eq("tipo", "mail_agregado");
      return new Set([origen, ...(data ?? []).map((e) => e.mail_recibido_id)]).size;
    };
    const tr = de("1377598");
    const journaway = reservas.filter((r) => r.agencia === "Journaway");
    const chequeos: Array<[string, boolean]> = [
      ["3 reservas con DK1594100", de("DK1594100").length === 3],
      ["2 reservas con DK1576932", de("DK1576932").length === 2],
      ["1 reserva con 1377598 y 2 mails en su historial", tr.length === 1 && (await mailsDe(tr[0].id, tr[0].mail_recibido_id)) === 2],
      ["1 reserva con 1363612 en para revisión", de("1363612").length === 1 && de("1363612")[0].estado === "para_revision"],
      ["2 de Journaway sin marca", journaway.length === 2 && journaway.every((r) => !r.posible_duplicada)],
    ];
    console.log("\n##### Resultado");
    for (const [que, ok] of chequeos) console.log(`${ok ? "OK " : "MAL"} ${que}`);
    const { data: detalle } = await admin
      .from("reserva")
      .select("agencia,booking_id,producto_id,producto_texto_agencia,estado,motivos_revision,posible_duplicada")
      .eq("de_prueba", true)
      .order("created_at");
    for (const r of detalle ?? []) {
      const producto = r.producto_id ? codigoDe.get(r.producto_id) : "(sin producto)";
      console.log(`- ${r.agencia} ${r.booking_id ?? "(sin número)"} · ${producto} · ${r.estado}${r.posible_duplicada ? " · posible duplicada" : ""}`);
      for (const m of r.motivos_revision as string[]) console.log(`    motivo: ${m}`);
    }
    console.log(`\nGasto total de la corrida: US$ ${gasto.toFixed(4)} (lecturas con IA: ${llamadasIA})`);
    if (chequeos.some(([, ok]) => !ok)) process.exitCode = 1;
  } finally {
    if (!process.argv.includes("--conservar")) {
      await borrarDatosDePrueba(admin);
      console.log("Datos de prueba borrados.");
    }
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Error inesperado.");
  process.exit(1);
});
