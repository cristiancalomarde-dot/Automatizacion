/**
 * Recorrido de M2-03 (verificación 3): cada mail de ejemplo pasa por la
 * lectura con IA (M2-02) y el emparejado (M2-03) de verdad, y queda como
 * reserva "de prueba". Imprime, por reserva, el producto, cómo se reconoció,
 * el estado y los motivos, y el gasto total.
 *
 *   npm run probar:emparejado               # corre y después borra lo de prueba
 *   npm run probar:emparejado -- --conservar # deja las reservas de prueba en la base
 *
 * Gasta dinero real: cada llamada pasa por el techo del mes (`uso_ia`, regla
 * #3) y queda en `ia_llamada`; además la corrida se frena si pasa US$ 1. No
 * imprime datos de pasajeros. Una sola corrida: no reintenta.
 *
 * Variables de entorno (regla #2, en local desde `.env.local`):
 * ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { crearRegistroLlamadasSupabase } from "@/lib/ia/registro-llamadas-supabase";
import { crearRegistroUsoIASupabase } from "@/lib/ia/registro-uso-ia-supabase";
import { mesActual } from "@/lib/ia/techo-gasto";
import { agenciaDelRemitente } from "@/lib/reservas/agencias";
import { crearProponedorIA } from "@/lib/reservas/emparejar/propuesta-ia";
import { cargarDependenciasReservas, crearReservasDelMail } from "@/lib/reservas/emparejar/reservas-del-mail";
import { leerMailConIA } from "@/lib/reservas/extraer";
import { borrarDatosDePruebaDe, guardarMailRecibido } from "@/lib/reservas/guardar";
import { aNumeroDeTest, conNumerosDeTest } from "@/lib/reservas/numeros-de-test";
import { mailDeArchivo } from "./mail-de-archivo";

const TOPE_CORRIDA_USD = 1;
const TEXTO = "Insumos/Mails/texto";
const PDF = "Insumos/Mails";

interface Caso {
  nombre: string;
  archivo: string;
  remitente: string;
  asunto: string;
  /** El cuerpo arranca en el renglón que matchea (el mail original dentro de una respuesta). */
  desde?: RegExp;
  nombreAdjunto?: string;
}

const CASOS: Caso[] = [
  {
    nombre: "Kilroy CHB31 (DK1547743)",
    archivo: `${TEXTO}/Reserva de Cliente Kilroy Copenhague - Overland San Pedro de Atacama to Uyuni end in La Paz CHB31.txt`,
    remitente: "copenhagen@kilroy.dk",
    asunto: "DK1547743/pela - Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days - KILROY booking request",
  },
  {
    nombre: "Kilroy ARCH33 + CHB31 (DK1576932)",
    archivo: `${TEXTO}/Reserva de Cliente Kilroy Copenhaguen  - Patagonia Trekking Paradise ARCH33.txt`,
    remitente: "emhe@kilroy.dk",
    asunto: "2 NEW BOOKINGS - DK1576932/emhe - KILROY booking request",
  },
  {
    nombre: "Kilroy OD010D (DK1564627)",
    archivo: `${TEXTO}/Reserva de Cliente Kilroy Aarhus -Iguazu Falls Combined  OD010D.txt`,
    remitente: "aarhus@kilroy.dk",
    asunto: "DK1564627/cafj - Iguazu Falls Combined (2 nights in Brazil + 1 night in Argentina) - KILROY booking request",
  },
  {
    nombre: "Kilroy OD032 Aarhus (DK1576836)",
    archivo: `${TEXTO}/Reserva de Cliente Kilroy Aarhus - Rio Starter Package OD032.txt`,
    remitente: "aarhus@kilroy.dk",
    asunto: "DK1576836-26196085 - HI - Rio de Janeiro Starter Package (Cabanacopa Hostel) - KILROY booking request",
  },
  {
    nombre: "Kilroy Trekking Paradise EXPRESS (DK1586168)",
    archivo: `${TEXTO}/Reserva de Cliente Kilroy Copenahue - Patagonia Trekking Paradise.txt`,
    remitente: "copenhagen@kilroy.dk",
    asunto: "DK1586168/pela - Patagonia, Trekking Paradise with W-Trek EXPRESS (10 nights) - Self Guided - KILROY booking request",
    desde: /^Asunto: DK1586168/,
  },
  {
    nombre: "TourRadar Overland (1376833)",
    archivo: `${PDF}/1# Booking Statement 1376833 - 25351215 - vendorbill Ejemplo Reserva Tourradar Overland San Pedro de Atacama to Uyuni end in La Paz.pdf`,
    remitente: "system@sent-via.netsuite.com",
    asunto: "Booking Statement 1376833 - 25351215 - vendorbill",
    nombreAdjunto: "Booking Statement 1376833 - 25351215 - vendorbill.pdf",
  },
  {
    nombre: "TourRadar Patagonia Adventure (1377598)",
    archivo: `${PDF}/1# Booking Statement 1377598 - 25372219 - vendorbill Ejemplo Reserva de TR Patagonia Adventure Blanca Roman Original.pdf`,
    remitente: "system@sent-via.netsuite.com",
    asunto: "Booking Statement 1377598 - 25372219 - vendorbill",
    nombreAdjunto: "Booking Statement 1377598 - 25372219 - vendorbill.pdf",
  },
  {
    nombre: "TourRadar Buenos Aires to Rio (1377583)",
    archivo: `${PDF}/1# Booking Statement 1377583 - 25365166 - vendorbill Ejemplo Reserva TR Buenos Aires to Rio.pdf`,
    remitente: "system@sent-via.netsuite.com",
    asunto: "Booking Statement 1377583 - 25365166 - vendorbill",
    nombreAdjunto: "Booking Statement 1377583 - 25365166 - vendorbill.pdf",
  },
];

function cuerpoDesde(ruta: string, desde: RegExp): string {
  const renglones = readFileSync(ruta, "utf-8").split(/\r?\n/);
  const i = renglones.findIndex((r) => desde.test(r));
  if (i < 0) throw new Error(`No se encontró el mail original en ${ruta}.`);
  return renglones.slice(i + 1).join("\n");
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
  const codigoDe = new Map<string, string>();
  for (const p of (await admin.from("producto").select("id,codigo")).data ?? []) codigoDe.set(p.id, p.codigo);

  let gasto = 0;
  /** Los mails de esta corrida: lo único que se borra al final (no las reservas del modo prueba). */
  const mailsCreados: string[] = [];
  try {
    for (const caso of CASOS) {
      if (gasto > TOPE_CORRIDA_USD) {
        console.log(`\nSe frenó la corrida: el gasto pasó US$ ${TOPE_CORRIDA_USD}.`);
        break;
      }
      const ruta = resolve(process.cwd(), caso.archivo);
      const datos = { remitente: caso.remitente, asunto: caso.asunto, nombre_adjunto: caso.nombreAdjunto, cuerpo: caso.desde ? cuerpoDesde(ruta, caso.desde) : undefined };
      const mail = caso.desde
        ? { remitente: caso.remitente, asunto: caso.asunto, cuerpoTexto: datos.cuerpo!, adjuntos: [] }
        : mailDeArchivo(ruta, ruta.endsWith(".pdf") ? { ...datos, cuerpo: "" } : datos);
      const agencia = agenciaDelRemitente(mail.remitente);
      const { mail: guardado, nuevo } = await guardarMailRecibido(
        {
          origen: "archivo",
          archivoOrigen: caso.archivo.split("/").pop(),
          messageId: `<probar-emparejado-${randomUUID()}@hitravel.local>`,
          remitente: mail.remitente,
          asunto: aNumeroDeTest(mail.asunto),
          cuerpoTexto: mail.cuerpoTexto ?? null,
          adjuntos: mail.adjuntos,
          agencia,
          dePrueba: true,
        },
        admin,
      );
      if (nuevo) mailsCreados.push(guardado.id);
      // Con números de reserva de test (DK1576932 → DK9576932): no choca con las reservas del modo prueba (M2-06).
      const lectura = conNumerosDeTest(
        await leerMailConIA(mail, { cliente, registro, mes, llamadas, mailRecibidoId: guardado.id, dePrueba: true }),
      );
      const deps = await cargarDependenciasReservas(
        admin,
        crearProponedorIA({ cliente, registro, mes, dePrueba: true, mailRecibidoId: guardado.id }),
      );
      const creadas = await crearReservasDelMail(lectura, { admin, mailRecibidoId: guardado.id, agencia, deps, llamadas, dePrueba: true });
      const costoMail = lectura.costo + creadas.reduce((s, c) => s + c.costo, 0);
      gasto += costoMail;

      console.log(`\n=== ${caso.nombre} — lectura: ${lectura.estado}, US$ ${costoMail.toFixed(4)}`);
      for (const { reserva, componentes } of creadas) {
        const producto = reserva.producto_id ? codigoDe.get(reserva.producto_id) : "(sin producto)";
        const sugerencia = reserva.sugerencia_producto_id ? ` · sugerencia IA: ${codigoDe.get(reserva.sugerencia_producto_id)}` : "";
        const origen = reserva.origen_emparejado ? `${reserva.origen_emparejado} (${Number(reserva.confianza_emparejado).toFixed(2)})` : "—";
        console.log(`- ${reserva.booking_id ?? "(sin número)"} | ${reserva.producto_texto_agencia ?? ""}`);
        console.log(`  producto: ${producto} · origen: ${origen}${sugerencia} · estado: ${reserva.estado}`);
        for (const m of reserva.motivos_revision) console.log(`  motivo: ${m}`);
        if (componentes.length) {
          const partes = componentes.map((c) =>
            c.producto_id ? `${codigoDe.get(c.producto_id)} ${c.fecha_inicio}` : `${c.descripcion_ruta}${c.es_tarea ? " [tarea]" : ""} ${c.fecha_inicio}`,
          );
          console.log(`  partes: ${partes.join(" → ")}`);
        }
      }
    }
    console.log(`\nGasto total de la corrida: US$ ${gasto.toFixed(4)}`);
  } finally {
    if (!process.argv.includes("--conservar")) {
      await borrarDatosDePruebaDe({ mails: mailsCreados }, admin);
      console.log("Datos de prueba de esta corrida borrados.");
    }
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Error inesperado.");
  process.exit(1);
});
