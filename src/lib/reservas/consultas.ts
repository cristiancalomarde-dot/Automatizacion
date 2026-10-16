/**
 * Consultas de lectura de las pantallas de reservas (spec M2-05). Reciben el
 * cliente de Supabase de la sesión del usuario: la RLS de M2-01 deja leer
 * solo a `authenticated` (#1). Sin sesión, nada.
 *
 * Solo lectura (#14): ninguna función de este archivo escribe en la base.
 * Cada una tira un error si la consulta falla, para que la pantalla muestre
 * su mensaje con "Reintentar" y nunca datos a medias.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarProducto } from "@/lib/catalogo/consultas";
import { cargarAvisosDeVuelo } from "./avisos-vuelo";
import { sinDatoDeLlegada } from "./llegada-iguazu";
import { cuerpoComoTexto, esCancelacion } from "./reglas";
import {
  BUCKET_ADJUNTOS,
  type DetalleReserva,
  type EstadoReserva,
  type FilaReserva,
  type MailDeReserva,
  type ParteDeReserva,
  type RevisionDePrueba,
  type ProductoDeReserva,
  type TipoComponenteReserva,
  type VueloDeReserva,
} from "./tipos";

/** El enlace firmado del PDF dura 5 minutos (#2). */
export const VIGENCIA_ENLACE_PDF_SEGUNDOS = 300;

const PRODUCTO = "producto:producto_id(id,codigo,nombre)";
const CAMPOS_FILA =
  "id,estado,agencia,booking_id,booking_id_original,fecha_inicio,fecha_fin,pax,motivos_revision," +
  "posible_duplicada,de_prueba,created_at,vuelos,pedidos_especiales,producto_texto_agencia," +
  `${PRODUCTO},mail:mail_recibido_id(fecha_mail)`;
const CAMPOS_DETALLE = `${CAMPOS_FILA},mail_recibido_id,duplicada_de_id,pasajeros,habitacion`;
const CAMPOS_MAIL = "id,remitente,remitente_nombre,asunto,fecha_mail,carpeta,cuerpo_texto,cuerpo_html,adjuntos,created_at";

/* eslint-disable @typescript-eslint/no-explicit-any -- filas crudas de PostgREST, se tipan al mapear */

function verificar<T>(respuesta: { data: T | null; error: { message: string } | null }): T {
  if (respuesta.error) throw new Error(respuesta.error.message);
  return respuesta.data as T;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function aProducto(fila: any): ProductoDeReserva | null {
  return fila?.id ? { id: fila.id, codigo: fila.codigo, nombre: fila.nombre } : null;
}

function aFila(r: any, avisosVuelo: string[] = [], canceladaEnHistorial = false): FilaReserva {
  const motivos: string[] = Array.isArray(r.motivos_revision) ? r.motivos_revision : [];
  return {
    id: r.id,
    estado: r.estado as EstadoReserva,
    agencia: r.agencia,
    numero: texto(r.booking_id_original) ?? texto(r.booking_id),
    producto: aProducto(r.producto),
    fechaInicio: r.fecha_inicio ?? null,
    fechaFin: r.fecha_fin ?? null,
    pax: typeof r.pax === "number" ? r.pax : null,
    llego: r.mail?.fecha_mail ?? r.created_at,
    motivos,
    posibleDuplicada: Boolean(r.posible_duplicada),
    dePrueba: Boolean(r.de_prueba),
    sinDatoLlegada: sinDatoDeLlegada({
      productoCodigo: r.producto?.codigo ?? null,
      vuelos: Array.isArray(r.vuelos) ? r.vuelos : [],
      pedidos: r.pedidos_especiales ?? null,
    }),
    avisosVuelo,
    cancelacion: canceladaEnHistorial || esCancelacion(motivos),
  };
}

/**
 * Owner 2026-10-16: las reservas a las que la agencia les mandó una
 * cancelación, según su historial (el mail sumado con `cancelacion: true`,
 * M2-04). Cubre las que ya no estaban en un estado que se pudiera tocar.
 */
async function canceladasEnHistorial(cliente: SupabaseClient, ids?: string[]): Promise<Set<string>> {
  let consulta = cliente.from("evento_reserva").select("reserva_id").eq("tipo", "mail_agregado").contains("detalle", { cancelacion: true });
  if (ids) consulta = consulta.in("reserva_id", ids);
  const filas = verificar(await consulta) as any[];
  return new Set(filas.map((e) => e.reserva_id as string));
}

/**
 * Owner 2026-10-16: los avisos "Falta el vuelo…" de cada reserva, con el
 * detalle de cada producto (una vez por producto, con la sesión del usuario).
 */
async function avisosDe(cliente: SupabaseClient, filas: any[]): Promise<Map<string, string[]>> {
  return cargarAvisosDeVuelo(
    (id) => cargarProducto(cliente, id),
    filas.map((r) => ({
      id: r.id,
      productoId: r.producto?.id ?? null,
      estado: r.estado as EstadoReserva,
      productoTexto: texto(r.producto_texto_agencia),
      fechaInicio: r.fecha_inicio ?? null,
      fechaFin: r.fecha_fin ?? null,
      vuelos: Array.isArray(r.vuelos) ? r.vuelos : [],
      pedidos: r.pedidos_especiales ?? null,
    })),
  );
}

/** La lista de reservas (#2). El orden lo pone la pantalla (por llegada). */
export async function cargarReservas(cliente: SupabaseClient): Promise<FilaReserva[]> {
  const filas = verificar(
    await cliente.from("reserva").select(CAMPOS_FILA).order("created_at", { ascending: false }),
  ) as any[];
  const [avisos, canceladas] = await Promise.all([avisosDe(cliente, filas), canceladasEnHistorial(cliente)]);
  return filas.map((r) => aFila(r, avisos.get(r.id), canceladas.has(r.id)));
}

function aPasajeros(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((p: any) => (typeof p === "string" ? p.trim() : [texto(p?.nombre), texto(p?.apellido)].filter(Boolean).join(" ")))
    .filter((n) => n.length > 0);
}

function aVuelos(lista: unknown): VueloDeReserva[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((v) => v && typeof v === "object")
    .map((v: any) => ({
      numero: texto(v.numero),
      aerolinea: texto(v.aerolinea),
      origen: texto(v.origen),
      destino: texto(v.destino),
      fechaSalida: texto(v.fecha_salida),
      horaSalida: texto(v.hora_salida),
      fechaLlegada: texto(v.fecha_llegada),
      horaLlegada: texto(v.hora_llegada),
    }));
}

function aParte(c: any): ParteDeReserva {
  return {
    orden: c.orden,
    tipo: c.tipo as TipoComponenteReserva,
    producto: aProducto(c.producto),
    descripcion: texto(c.descripcion_ruta) ?? texto(c.texto_agencia),
    fechaInicio: c.fecha_inicio ?? null,
    fechaFin: c.fecha_fin ?? null,
    esTarea: Boolean(c.es_tarea),
  };
}

function aMail(m: any): MailDeReserva {
  const adjuntos: any[] = Array.isArray(m.adjuntos) ? m.adjuntos : [];
  return {
    id: m.id,
    remitente: m.remitente,
    remitenteNombre: texto(m.remitente_nombre),
    asunto: texto(m.asunto),
    fecha: m.fecha_mail ?? null,
    spam: m.carpeta === "spam",
    cuerpo: cuerpoComoTexto({ cuerpoTexto: m.cuerpo_texto ?? null, cuerpoHtml: m.cuerpo_html ?? null }),
    pdfs: adjuntos
      .filter((a) => typeof a?.ruta === "string" && a.ruta)
      .map((a) => ({ nombre: String(a.nombre ?? "adjunto.pdf"), ruta: a.ruta })),
  };
}

/**
 * Una reserva con sus partes y sus mails (#5 a #12). Null si no existe. Los
 * mails son el que la creó más los que se le sumaron (eventos con mail, M2-04),
 * por orden de llegada, con el que la creó primero.
 */
export async function cargarReserva(cliente: SupabaseClient, id: string): Promise<DetalleReserva | null> {
  const r = verificar(await cliente.from("reserva").select(CAMPOS_DETALLE).eq("id", id).maybeSingle()) as any;
  if (!r) return null;

  const [partes, eventos, avisos, canceladas] = await Promise.all([
    cliente
      .from("reserva_componente")
      .select(`orden,tipo,descripcion_ruta,texto_agencia,fecha_inicio,fecha_fin,es_tarea,${PRODUCTO}`)
      .eq("reserva_id", id)
      .order("orden"),
    cliente.from("evento_reserva").select("mail_recibido_id").eq("reserva_id", id).not("mail_recibido_id", "is", null),
    avisosDe(cliente, [r]),
    canceladasEnHistorial(cliente, [id]),
  ]);
  const filasPartes = verificar(partes) as any[];
  const idsSumados = (verificar(eventos) as any[]).map((e) => e.mail_recibido_id as string);
  const ids = [...new Set([r.mail_recibido_id as string, ...idsSumados])];
  const filasMails = verificar(await cliente.from("mail_recibido").select(CAMPOS_MAIL).in("id", ids)) as any[];

  const llegada = (m: any) => Date.parse(m.fecha_mail ?? m.created_at);
  const primero = filasMails.filter((m) => m.id === r.mail_recibido_id);
  const sumados = filasMails.filter((m) => m.id !== r.mail_recibido_id).sort((a, b) => llegada(a) - llegada(b));

  return {
    ...aFila(r, avisos.get(r.id), canceladas.has(r.id)),
    productoTextoAgencia: texto(r.producto_texto_agencia),
    duplicadaDeId: r.duplicada_de_id ?? null,
    pasajeros: aPasajeros(r.pasajeros),
    habitacion: texto(r.habitacion),
    pedidosEspeciales: texto(r.pedidos_especiales),
    vuelos: aVuelos(r.vuelos),
    partes: filasPartes.map(aParte),
    mails: [...primero, ...sumados].map(aMail),
  };
}

/**
 * Enlace firmado y de corta duración al PDF de un mail, generado con la
 * sesión del usuario (#2): el bucket es privado y sin sesión no se firma.
 */
export async function urlDelPdf(cliente: SupabaseClient, ruta: string): Promise<string> {
  const { data, error } = await cliente.storage
    .from(BUCKET_ADJUNTOS)
    .createSignedUrl(ruta, VIGENCIA_ENLACE_PDF_SEGUNDOS);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "No se pudo firmar el enlace del PDF.");
  return data.signedUrl;
}

// --- Modo prueba (spec M2-06) ----------------------------------------------------------

const CAMPOS_REVISION = "reserva_id,resultado,que_mal,nota,updated_at,autor:autor_id(nombre,email)";

/** Una fila de `revision_prueba` como la ve la pantalla. */
export function aRevision(v: any): RevisionDePrueba {
  return {
    reservaId: v.reserva_id,
    resultado: v.resultado === "mal" ? "mal" : "bien",
    queMal: Array.isArray(v.que_mal) ? v.que_mal : [],
    nota: texto(v.nota),
    autor: texto(v.autor?.nombre) ?? texto(v.autor?.email),
    fecha: v.updated_at,
  };
}

/** Las marcas del owner de todas las reservas de prueba, por reserva (para la medición, fila 14). */
export async function cargarRevisiones(cliente: SupabaseClient): Promise<Map<string, RevisionDePrueba>> {
  const filas = verificar(await cliente.from("revision_prueba").select(CAMPOS_REVISION)) as any[];
  return new Map(filas.map((v) => [v.reserva_id as string, aRevision(v)]));
}

/** La marca del owner de una reserva de prueba; null si todavía no la marcó nadie. */
export async function cargarRevision(cliente: SupabaseClient, reservaId: string): Promise<RevisionDePrueba | null> {
  const v = verificar(await cliente.from("revision_prueba").select(CAMPOS_REVISION).eq("reserva_id", reservaId).maybeSingle());
  return v ? aRevision(v) : null;
}
