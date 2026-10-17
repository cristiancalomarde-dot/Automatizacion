import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistroLlamadasIA } from "@/lib/ia/registro-llamadas";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { camposDeEml } from "@/lib/modo-prueba/leer-archivo";
import { crearTopeDeCorrida } from "@/lib/modo-prueba/tope-corrida";
import { AGENCIA_DESCONOCIDA, agenciaDelRemitente } from "@/lib/reservas/agencias";
import type { DependenciasReservas } from "@/lib/reservas/emparejar/reservas-del-mail";
import type { ResultadoLectura } from "@/lib/reservas/extraer";
import { decidirEntrada, TEXTO_SALTEO, type DecisionEntrada } from "@/lib/reservas/filtro-entrada";
import { guardarMailRecibido } from "@/lib/reservas/guardar";
import { huellaDelMail, normalizarMessageId } from "@/lib/reservas/huella";
import { MOTIVOS, type MailParaLeer } from "@/lib/reservas/preparar-mail";
import { cargarReservasDelAsunto, procesarMail } from "@/lib/reservas/procesar-mail";
import type { MailEntrada } from "@/lib/reservas/tipos";
import { TEXTOS } from "@/lib/textos";
import { carpetaInbox, carpetaSpam } from "./carpetas";
import { ErrorCasilla, type Casilla, type CasillaAbierta, type SobreMail } from "./casilla";
import { filaVacia, registrarCorrida, terminarCorrida, tomarCandado, type FilaCorrida, type OrigenCorrida } from "./registro";
import { DIAS_VENTANA, desdeCuandoLeer } from "./ventana";

/**
 * Una corrida de la lectura de sales@ (spec M2-07). La ruta del cron y el
 * script solo llaman a `leerSales`; todo lo de afuera (la casilla, la IA, la
 * base) llega inyectado.
 *
 * 1. Candado (#8): si ya hay una corrida en curso, esta queda "salteada".
 * 2. Carpetas (#2, #3): Inbox y Spam (por `\Junk` o por el nombre). Sin Spam,
 *    se lee el Inbox y la corrida queda "con aviso".
 * 3. Sobres de los últimos 7 días (#9). Un remitente que no es de una agencia
 *    no se baja, no gasta IA y no deja rastro (#10). Lo ya procesado (por
 *    Message-ID / huella o carpeta + UID) no se vuelve a mirar (#12).
 * 4. El filtro de entrada de M2-06 (`filtro-entrada.ts`) decide con el sobre:
 *    leer con IA, registrar sin IA (Jysk, cotizaciones, TourRadar que no es
 *    statement) o saltear sin rastro (respuestas que no esperan un vuelo,
 *    Journaway hasta M2-09). Solo se baja el cuerpo de lo que se lee o se
 *    registra.
 * 5. El circuito de M2-06 (`procesarMail`), con las reservas SIN la marca de
 *    prueba (#11). Un mail que falla queda "pendiente" y se reintenta; a los 3
 *    intentos, "no se pudo leer" (#13). El techo de gasto corta la IA y deja lo
 *    que falta para mañana (#14).
 * 6. Registro (#18) con números y textos en llano.
 *
 * Nunca modifica la casilla ni manda mails (#15, #16): la casilla solo tiene
 * métodos de lectura.
 */

const T = TEXTOS.lecturaSales;

/** Tope de gasto de una corrida (además del techo del mes, #3). */
export const TOPE_CORRIDA_SALES_USD = 2;
/** Intentos fallidos antes de "no se pudo leer" (#13). */
export const MAX_INTENTOS = 3;
/** Margen de tiempo de una corrida: lo que no entra queda para mañana (la ventana lo cubre). */
export const LIMITE_CORRIDA_MS = 240_000;

/** Lecturas de la IA que se reintentan: la IA no respondió, contestó mal o el PDF vino roto. */
const LECTURAS_REINTENTABLES = new Set<string>([MOTIVOS.sinRespuesta, MOTIVOS.invalida, MOTIVOS.cortada, MOTIVOS.pdf]);

export interface ContextoIA {
  mailRecibidoId: string;
  registro: RegistroUsoIA;
}

export type AccionListado = "leer" | "registrar" | "reintentar" | "ya_procesado" | "saltear";

/** Una línea del `--solo-listar`: sin remitente, asunto ni contenido. */
export interface ItemListado {
  carpeta: "inbox" | "spam";
  fecha: string | null;
  agencia: string;
  accion: AccionListado;
  motivo: string;
}

export interface OpcionesLectura {
  admin: SupabaseClient;
  /** Abre la casilla; null si faltan las variables SALES_IMAP_* (#1). */
  casilla: Casilla | null;
  origen: OrigenCorrida;
  /** Solo lista qué haría: sin IA, sin escribir en la base, sin registro (#6). */
  soloListar?: boolean;
  dias?: number;
  /** Nada anterior a esta fecha se lee (LECTURA_SALES_DESDE). */
  arranque?: Date | null;
  ahora?: () => Date;
  /** Reloj para el límite de tiempo (por defecto, Date.now). */
  reloj?: () => number;
  limiteMs?: number;
  registroUso: RegistroUsoIA;
  leer: (mail: MailParaLeer, ctx: ContextoIA) => Promise<ResultadoLectura>;
  deps: (ctx: ContextoIA) => Promise<DependenciasReservas> | DependenciasReservas;
  llamadas?: RegistroLlamadasIA;
  tope?: number;
  techo?: number;
  /** Solo tests: acota el "mismo intercambio" a las reservas de estos mails. */
  alcance?: () => readonly string[];
  /** Solo tests: avisa cada mail que se guarda en la base. */
  alGuardar?: (mailRecibidoId: string) => void;
}

export interface ResumenCorrida extends FilaCorrida {
  id: string | null;
  listado: ItemListado[];
}

interface Visto {
  id: string;
  huella: string;
  carpeta: string | null;
  uidValidity: number | null;
  uid: number | null;
  estado: "listo" | "pendiente";
  intentos: number;
}

interface Candidato {
  sobre: SobreMail;
  tipo: "inbox" | "spam";
  uidValidity: number;
  huella: string;
  agencia: string;
  /** Null: Kilroy sin asunto, se decide con el cuerpo. */
  decision: DecisionEntrada | null;
  visto: Visto | null;
  fuente?: Buffer;
}

class TopeAlcanzado extends Error {
  constructor() {
    super("tope");
  }
}

class FallaLectura extends Error {}

/** La huella del sobre: el Message-ID normalizado, o remitente + fecha + asunto si no tiene (#12). */
export function huellaDeSobre(s: Pick<SobreMail, "messageId" | "remitente" | "fecha" | "asunto">): string {
  return normalizarMessageId(s.messageId) ?? huellaDelMail({ remitente: s.remitente, fecha: s.fecha, asunto: s.asunto, cuerpo: null });
}

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST */
function aVisto(f: any): Visto {
  const listo =
    f.estado_lectura === "procesado" ||
    f.estado_lectura === "registrado" ||
    f.estado_lectura === "no_se_pudo_leer" ||
    (!f.estado_lectura && !!f.procesado_en);
  return {
    id: f.id,
    huella: f.huella,
    carpeta: f.carpeta,
    uidValidity: f.imap_uidvalidity === null ? null : Number(f.imap_uidvalidity),
    uid: f.imap_uid === null ? null : Number(f.imap_uid),
    estado: listo ? "listo" : "pendiente",
    intentos: Number(f.intentos ?? 0),
  };
}

/** Lo que la base ya sabe de estos sobres: por huella o por carpeta + UID. Solo lee. */
async function buscarVistos(admin: SupabaseClient, huellas: string[], tipo: "inbox" | "spam", uids: number[]): Promise<Visto[]> {
  if (huellas.length === 0) return [];
  // "*": la base real todavía no tiene las columnas de 0015 y el solo-listar igual tiene que andar.
  const porHuella = await admin.from("mail_recibido").select("*").in("huella", huellas);
  if (porHuella.error) throw new Error(`No se pudo revisar qué mails ya se procesaron: ${porHuella.error.message}`);
  const porUid = await admin.from("mail_recibido").select("*").eq("origen", "imap").eq("carpeta", tipo).in("imap_uid", uids);
  if (porUid.error) throw new Error(`No se pudo revisar qué mails ya se procesaron: ${porUid.error.message}`);
  return [...(porHuella.data ?? []), ...(porUid.data ?? [])].map(aVisto);
}

async function marcarMail(admin: SupabaseClient, id: string, cambios: Record<string, unknown>): Promise<void> {
  const { error } = await admin
    .from("mail_recibido")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`No se pudo marcar el mail: ${error.message}`);
}

const textoError = (e: unknown) => (e instanceof FallaLectura ? e.message : T.motivos.inesperado);

function estadoFinal(fila: FilaCorrida): FilaCorrida["estado"] {
  return fila.avisos.length || fila.errores.length ? "con_aviso" : "anduvo_bien";
}

export async function leerSales(o: OpcionesLectura): Promise<ResumenCorrida> {
  const ahora = o.ahora?.() ?? new Date();
  const reloj = o.reloj ?? Date.now;
  const comienzo = reloj();
  const limite = o.limiteMs ?? LIMITE_CORRIDA_MS;
  const fila = filaVacia(o.origen, "en_curso", ahora);
  const listado: ItemListado[] = [];
  const cerrarFila = () => ({ ...fila, fin: new Date().toISOString() });

  // #1: sin las variables no se intenta conectar.
  if (!o.casilla) {
    const final = { ...cerrarFila(), estado: "fallo" as const, errores: [T.motivos.faltaClave] };
    const id = o.soloListar ? null : await registrarCorrida(o.admin, final);
    return { ...final, id, listado };
  }

  let id: string | null = null;
  if (!o.soloListar) {
    id = await tomarCandado(o.admin, o.origen, ahora);
    if (!id) {
      const final = { ...cerrarFila(), estado: "salteada" as const, avisos: ["ya había una lectura en curso"] };
      return { ...final, id: await registrarCorrida(o.admin, final), listado };
    }
  }

  try {
    const candidatos = await juntarCandidatos(o, o.casilla, ahora, fila, listado);
    if (!o.soloListar) await procesarCandidatos(o, candidatos, fila, () => reloj() - comienzo > limite);
    fila.estado = estadoFinal(fila);
  } catch (e) {
    fila.estado = "fallo";
    fila.errores.push(e instanceof ErrorCasilla ? e.message : T.motivos.inesperado);
    if (!(e instanceof ErrorCasilla)) console.error("Lectura de sales@: error inesperado", e instanceof Error ? e.message.slice(0, 300) : "");
  }
  const final = cerrarFila();
  if (id) await terminarCorrida(o.admin, id, final);
  return { ...final, id, listado };
}

async function juntarCandidatos(
  o: OpcionesLectura,
  casilla: Casilla,
  ahora: Date,
  fila: FilaCorrida,
  listado: ItemListado[],
): Promise<Candidato[]> {
  const abierta: CasillaAbierta = await casilla();
  const candidatos: Candidato[] = [];
  const huellasVistas = new Set<string>();
  try {
    const lista = await abierta.carpetas();
    const inbox = carpetaInbox(lista);
    const spam = carpetaSpam(lista);
    const carpetas: Array<[string, "inbox" | "spam"]> = [[inbox, "inbox"]];
    if (spam) carpetas.push([spam, "spam"]);
    else fila.avisos.push(T.avisos.sinSpam);
    const desde = desdeCuandoLeer(ahora, o.dias ?? DIAS_VENTANA, o.arranque ?? null);

    for (const [carpeta, tipo] of carpetas) {
      const { uidValidity, sobres } = await abierta.sobres(carpeta, desde);
      fila.carpetas.push(carpeta);
      fila.miro += sobres.length;
      const deAgencia = sobres
        .map((sobre) => ({ sobre, agencia: agenciaDelRemitente(sobre.remitente) }))
        .filter((x) => x.agencia !== AGENCIA_DESCONOCIDA);
      fila.de_agencias += deAgencia.length;
      const vistos = await buscarVistos(
        o.admin,
        deAgencia.map((x) => huellaDeSobre(x.sobre)),
        tipo,
        deAgencia.map((x) => x.sobre.uid),
      );

      const elegidos: Candidato[] = [];
      for (const { sobre, agencia } of deAgencia) {
        const huella = huellaDeSobre(sobre);
        const item = (accion: AccionListado, motivo: string) =>
          listado.push({ carpeta: tipo, fecha: sobre.fecha?.toISOString() ?? null, agencia, accion, motivo });
        const visto =
          vistos.find((v) => v.huella === huella) ??
          vistos.find((v) => v.carpeta === tipo && v.uidValidity === uidValidity && v.uid === sobre.uid) ??
          null;
        if (visto?.estado === "listo" || huellasVistas.has(huella)) {
          item("ya_procesado", "Ya se procesó en una corrida anterior");
          continue;
        }
        huellasVistas.add(huella);
        let decision: DecisionEntrada | null = null;
        if (!(agencia === "Kilroy" && !sobre.asunto)) {
          decision = await decidirEntrada(
            { remitente: sobre.remitente, asunto: sobre.asunto, cuerpoTexto: null },
            { dePrueba: false, buscarReservas: (asunto, ag) => cargarReservasDelAsunto(o.admin, asunto, ag, false, o.alcance?.() ?? null) },
          );
          if (!decision.leer && !decision.registrar) {
            item("saltear", TEXTO_SALTEO[decision.motivo]);
            continue;
          }
        }
        if (visto) item("reintentar", `Quedó pendiente (${visto.intentos} intentos fallidos)`);
        else if (!decision) item("leer", "Kilroy sin asunto: se decide con el cuerpo");
        else if (decision.leer) item("leer", decision.motivo === "espera_vuelo" ? "Respuesta con el vuelo que espera una reserva" : "Mail original de reserva");
        else item("registrar", TEXTO_SALTEO[decision.motivo]);
        elegidos.push({ sobre, tipo, uidValidity, huella, agencia, decision, visto });
      }

      // #10: el cuerpo, solo de lo elegido (y nunca en el --solo-listar).
      if (!o.soloListar && elegidos.length) {
        const fuentes = await abierta.fuentes(carpeta, elegidos.map((c) => c.sobre.uid));
        for (const c of elegidos) c.fuente = fuentes.get(c.sobre.uid);
      }
      candidatos.push(...elegidos);
    }
  } finally {
    await abierta.cerrar();
  }
  return candidatos;
}

async function entradaDe(c: Candidato): Promise<MailEntrada> {
  if (!c.fuente) throw new FallaLectura("la casilla no devolvió el mail");
  let campos: Awaited<ReturnType<typeof camposDeEml>>;
  try {
    campos = await camposDeEml(new Uint8Array(c.fuente));
  } catch {
    throw new FallaLectura("el mail no se pudo abrir");
  }
  return {
    origen: "imap",
    carpeta: c.tipo,
    imapUidvalidity: c.uidValidity,
    imapUid: c.sobre.uid,
    messageId: c.sobre.messageId,
    huella: c.huella,
    ...campos,
    // El remitente y la fecha del sobre: los mismos con los que se armó la huella.
    remitente: c.sobre.remitente || campos.remitente,
    fechaMail: c.sobre.fecha ?? campos.fechaMail ?? null,
    agencia: c.agencia,
    dePrueba: false,
  };
}

async function procesarCandidatos(o: OpcionesLectura, candidatos: Candidato[], fila: FilaCorrida, sinTiempo: () => boolean) {
  const tope = crearTopeDeCorrida(o.registroUso, { tope: o.tope ?? TOPE_CORRIDA_SALES_USD, techo: o.techo });
  const cuando = (c: Candidato) => c.sobre.fecha?.getTime() ?? Number.POSITIVE_INFINITY;
  const ordenados = [...candidatos].sort((a, b) => cuando(a) - cuando(b));
  let porTecho = 0;
  let porTiempo = 0;

  for (const c of ordenados) {
    if (sinTiempo()) {
      porTiempo++;
      continue;
    }
    let mailId: string | null = c.visto?.id ?? null;
    try {
      const entrada = await entradaDe(c);
      const decision =
        c.decision ??
        (await decidirEntrada(entrada, {
          dePrueba: false,
          buscarReservas: (asunto, ag) => cargarReservasDelAsunto(o.admin, asunto, ag, false, o.alcance?.() ?? null),
        }));
      if (!decision.leer) {
        if (!decision.registrar) continue;
        // Jysk, cotizaciones, TourRadar que no es statement: el mail queda registrado, sin IA.
        const { mail, nuevo } = await guardarMailRecibido({ ...entrada, agencia: c.agencia }, o.admin);
        if (nuevo) o.alGuardar?.(mail.id);
        await marcarMail(o.admin, mail.id, { procesado_en: new Date().toISOString(), estado_lectura: "registrado" });
        continue;
      }
      if (porTecho > 0) {
        porTecho++;
        continue;
      }
      const r = await procesarMail(entrada, {
        admin: o.admin,
        dePrueba: false,
        reintentar: true,
        llamadas: o.llamadas,
        alcance: o.alcance,
        leer: async (mail, ctx) => {
          mailId = ctx.mailRecibidoId;
          if (!c.visto) o.alGuardar?.(ctx.mailRecibidoId);
          const l = await o.leer(mail, { mailRecibidoId: ctx.mailRecibidoId, registro: tope.registro });
          if (l.estado === "para_revision" && l.motivo === MOTIVOS.techo) throw new TopeAlcanzado();
          if (l.estado === "para_revision" && LECTURAS_REINTENTABLES.has(l.motivo)) throw new FallaLectura(l.motivo);
          return l;
        },
        deps: (ctx) => o.deps({ mailRecibidoId: ctx.mailRecibidoId, registro: tope.registro }),
      });
      await marcarMail(o.admin, r.mailRecibidoId, { estado_lectura: "procesado", error_proceso: null });
      if (r.estado === "procesado") {
        fila.procesados++;
        for (const p of r.pedidos) {
          if (p.accion === "sumada") fila.reservas_actualizadas++;
          else fila.reservas_nuevas++;
        }
      }
    } catch (e) {
      if (e instanceof TopeAlcanzado) {
        porTecho++;
        if (mailId) await marcarMail(o.admin, mailId, { estado_lectura: "pendiente" });
        continue;
      }
      const motivo = textoError(e);
      if (!(e instanceof FallaLectura)) console.error("Lectura de sales@: un mail falló", e instanceof Error ? e.message.slice(0, 300) : "");
      const intentos = (c.visto?.intentos ?? 0) + 1;
      if (mailId) {
        const agotado = intentos >= MAX_INTENTOS;
        await marcarMail(o.admin, mailId, { intentos, estado_lectura: agotado ? "no_se_pudo_leer" : "pendiente" });
        if (agotado) {
          fila.no_se_pudo_leer++;
          fila.errores.push(T.avisos.noSePudoLeer(c.agencia, motivo));
          continue;
        }
      }
      fila.pendientes++;
      fila.errores.push(T.avisos.fallaMail(c.agencia, motivo));
    }
  }
  if (porTecho) {
    fila.pendientes += porTecho;
    fila.avisos.push(T.avisos.techo(porTecho));
  }
  if (porTiempo) {
    fila.pendientes += porTiempo;
    fila.avisos.push(T.avisos.tiempo(porTiempo));
  }
}
