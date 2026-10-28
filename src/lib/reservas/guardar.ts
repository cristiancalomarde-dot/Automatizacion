import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { direccionDelRemitente } from "./agencias";
import { huellaDelMail } from "./huella";
import {
  BUCKET_ADJUNTOS,
  type AdjuntoEntrada,
  type AdjuntoGuardado,
  type EstadoReserva,
  type EventoReserva,
  type MailEntrada,
  type MailRecibido,
  type Reserva,
  type ReservaComponente,
  type ReservaEntrada,
  type TipoEventoReserva,
} from "./tipos";

/**
 * Guardar reservas que entran por mail (spec M2-01). Solo servidor: usa la
 * service role (`src/lib/supabase/admin.ts`), salvo que se le pase otro
 * cliente. No lee mails ni llama a la IA: guarda lo que le pasan.
 *
 * Privacidad (`docs/arquitectura/secretos.md`): los errores nunca incluyen el
 * cuerpo del mail ni los datos de los pasajeros.
 */

type Cliente = SupabaseClient;
const clientePorDefecto = (): Cliente => createSupabaseAdminClient();

function esPdf(tipo: string, nombre: string): boolean {
  return tipo.toLowerCase() === "application/pdf" || /\.pdf$/i.test(nombre);
}

/** M3-30: las imágenes que acepta el bucket (migración 0024). */
const TIPOS_IMAGEN_GUARDADA = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** El tipo con que se sube: PDF o una imagen que el bucket acepta; null si no se sube. */
function tipoParaSubir(a: { tipo: string; nombre: string }): string | null {
  if (esPdf(a.tipo, a.nombre)) return "application/pdf";
  const tipo = a.tipo.toLowerCase().replace("image/jpg", "image/jpeg");
  return TIPOS_IMAGEN_GUARDADA.includes(tipo) ? tipo : null;
}

type Subida = { ruta: string; contenido: Uint8Array; tipo: string };

/**
 * Los adjuntos tal como quedan en `mail_recibido.adjuntos` y lo que hay que
 * subir: los PDF y las imágenes con contenido van al bucket en
 * `<id del mail>/<nombre>`; del resto queda nombre, tipo y tamaño.
 */
function planDeAdjuntos(id: string, entrada: readonly AdjuntoEntrada[], usados = new Set<string>()): { adjuntos: AdjuntoGuardado[]; subidas: Subida[] } {
  const subidas: Subida[] = [];
  const adjuntos: AdjuntoGuardado[] = entrada.map((a) => {
    const tamano = a.contenido?.byteLength ?? a.tamano ?? 0;
    const tipo = tipoParaSubir(a);
    if (!tipo || !a.contenido) return { nombre: a.nombre, tipo: a.tipo, tamano, ruta: null };
    let nombre = nombreParaStorage(a.nombre);
    for (let n = 2; usados.has(nombre); n++) nombre = `${n}-${nombreParaStorage(a.nombre)}`;
    usados.add(nombre);
    const ruta = `${id}/${nombre}`;
    subidas.push({ ruta, contenido: a.contenido, tipo });
    return { nombre: a.nombre, tipo: a.tipo, tamano, ruta };
  });
  return { adjuntos, subidas };
}

async function subir(cliente: Cliente, subidas: Subida[]): Promise<void> {
  const almacen = cliente.storage.from(BUCKET_ADJUNTOS);
  for (const s of subidas) {
    const { error } = await almacen.upload(s.ruta, s.contenido, { contentType: s.tipo, upsert: false });
    if (error) {
      await almacen.remove(subidas.map((x) => x.ruta));
      throw new Error(`No se pudo guardar un adjunto del mail: ${error.message}`);
    }
  }
}

/**
 * M3-30 (reprocesar un mail ya guardado): sube los PDF y las imágenes que el
 * mail guardado todavía no tiene en el bucket y actualiza `adjuntos`. Lo que
 * ya tenía ruta no se toca. Devuelve cuántos archivos subió.
 */
export async function completarAdjuntosDelMail(
  mail: Pick<MailRecibido, "id" | "adjuntos">,
  entrada: readonly AdjuntoEntrada[],
  cliente: Cliente = clientePorDefecto(),
): Promise<{ adjuntos: AdjuntoGuardado[]; subidos: number }> {
  const guardados = mail.adjuntos ?? [];
  const yaSubido = (a: AdjuntoEntrada) => guardados.some((g) => g.ruta && g.nombre === a.nombre);
  const usados = new Set(guardados.filter((g) => g.ruta).map((g) => g.ruta!.split("/").pop()!));
  const plan = planDeAdjuntos(mail.id, entrada.filter((a) => !yaSubido(a)), usados);
  if (plan.subidas.length === 0) return { adjuntos: guardados, subidos: 0 };
  await subir(cliente, plan.subidas);

  // Cada adjunto viejo sin ruta toma la ruta del que se subió con su nombre; los demás se suman al final.
  const nuevos = plan.adjuntos.filter((a) => a.ruta);
  const tomados = new Set<AdjuntoGuardado>();
  const adjuntos = guardados.map((g) => {
    if (g.ruta) return g;
    const n = nuevos.find((x) => !tomados.has(x) && x.nombre === g.nombre);
    if (!n) return g;
    tomados.add(n);
    return n;
  });
  adjuntos.push(...nuevos.filter((n) => !tomados.has(n)));
  const { error } = await cliente.from("mail_recibido").update({ adjuntos, updated_at: new Date().toISOString() }).eq("id", mail.id);
  if (error) {
    await cliente.storage.from(BUCKET_ADJUNTOS).remove(plan.subidas.map((s) => s.ruta));
    throw new Error(`No se pudieron guardar los adjuntos del mail: ${error.message}`);
  }
  return { adjuntos, subidos: plan.subidas.length };
}

/** Nombre apto para una clave de Storage (sin `#`, acentos ni barras). */
function nombreParaStorage(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._() -]/g, "_")
    .trim();
  return limpio === "" ? "adjunto.pdf" : limpio;
}

async function buscarMailPorHuella(cliente: Cliente, huella: string): Promise<MailRecibido | null> {
  const { data, error } = await cliente.from("mail_recibido").select("*").eq("huella", huella).maybeSingle();
  if (error) throw new Error(`No se pudo buscar el mail por su huella: ${error.message}`);
  return data as MailRecibido | null;
}

/**
 * Guarda el mail original, una sola vez por huella (fila 2). Si ya existía,
 * devuelve el que estaba (`nuevo: false`) y no sube nada. Los PDF y las
 * imágenes (M3-30) se suben al bucket privado `mail-adjuntos` en
 * `<id del mail>/<nombre>`; del resto de los adjuntos queda solo nombre, tipo
 * y tamaño.
 */
export async function guardarMailRecibido(
  entrada: MailEntrada,
  cliente: Cliente = clientePorDefecto(),
): Promise<{ mail: MailRecibido; nuevo: boolean }> {
  const remitente = direccionDelRemitente(entrada.remitente) ?? entrada.remitente.trim().toLowerCase();
  // M2-07 pasa la huella armada con el sobre (sin el cuerpo), para reconocer el mail antes de bajarlo.
  const huella = entrada.huella ?? huellaDelMail({
    messageId: entrada.messageId,
    remitente,
    fecha: entrada.fechaMail,
    asunto: entrada.asunto,
    cuerpo: entrada.cuerpoTexto ?? entrada.cuerpoHtml,
  });

  const existente = await buscarMailPorHuella(cliente, huella);
  if (existente) return { mail: existente, nuevo: false };

  const id = randomUUID();
  const { adjuntos, subidas } = planDeAdjuntos(id, entrada.adjuntos ?? []);
  const almacen = cliente.storage.from(BUCKET_ADJUNTOS);
  await subir(cliente, subidas);

  const fecha = entrada.fechaMail ? new Date(entrada.fechaMail).toISOString() : null;
  const { data, error } = await cliente
    .from("mail_recibido")
    .insert({
      id,
      origen: entrada.origen,
      carpeta: entrada.origen === "imap" ? (entrada.carpeta ?? null) : null,
      archivo_origen: entrada.archivoOrigen ?? null,
      imap_uidvalidity: entrada.imapUidvalidity ?? null,
      imap_uid: entrada.imapUid ?? null,
      message_id: entrada.messageId ?? null,
      huella,
      remitente,
      remitente_nombre: entrada.remitenteNombre ?? null,
      destinatarios: entrada.destinatarios ?? [],
      asunto: entrada.asunto ?? null,
      fecha_mail: fecha,
      cuerpo_texto: entrada.cuerpoTexto ?? null,
      cuerpo_html: entrada.cuerpoHtml ?? null,
      adjuntos,
      agencia: entrada.agencia ?? null,
      de_prueba: entrada.dePrueba ?? false,
    })
    .select("*")
    .single();

  if (error) {
    if (subidas.length) await almacen.remove(subidas.map((s) => s.ruta));
    // Otro proceso lo guardó entre la búsqueda y el insert: se devuelve ese.
    if (error.code === "23505") {
      const ganador = await buscarMailPorHuella(cliente, huella);
      if (ganador) return { mail: ganador, nuevo: false };
      // M2-04 fila 1: el mismo mensaje IMAP (carpeta + UIDVALIDITY + UID) ya estaba.
      if (entrada.origen === "imap" && entrada.imapUid != null) {
        const { data: mismo } = await cliente
          .from("mail_recibido")
          .select("*")
          .eq("carpeta", entrada.carpeta ?? "")
          .eq("imap_uidvalidity", entrada.imapUidvalidity ?? 0)
          .eq("imap_uid", entrada.imapUid)
          .maybeSingle();
        if (mismo) return { mail: mismo as MailRecibido, nuevo: false };
      }
    }
    throw new Error(`No se pudo guardar el mail: ${error.message}`);
  }
  return { mail: data as MailRecibido, nuevo: true };
}

/**
 * Crea una reserva con su estado inicial (`recibida` o `para_revision`, la
 * base rechaza cualquier otro) y sus componentes en orden. La entrada
 * "creada" del historial la agrega la base.
 */
/**
 * M2-09 (migración 0016): los datos de Journaway (número de viaje, hoteles de
 * la agencia, contacto, notas y el lado del traslado que lleva otra reserva).
 * Solo viajan si vienen: una reserva de Kilroy o TourRadar se guarda igual
 * que antes de la migración.
 */
function columnasJournaway(e: ReservaEntrada): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (e.tripNumber) c.trip_number = e.tripNumber;
  if (e.otrosProductos?.length) c.otros_productos = e.otrosProductos;
  if (e.hotelesAgencia?.length) c.hoteles_agencia = e.hotelesAgencia;
  if (e.contactoCliente) c.contacto_cliente = e.contactoCliente;
  if (e.notas?.length) c.notas = e.notas;
  if (e.sinTrasladoDe) c.sin_traslado_de = e.sinTrasladoDe;
  return c;
}

export async function crearReserva(
  entrada: ReservaEntrada,
  cliente: Cliente = clientePorDefecto(),
): Promise<{ reserva: Reserva; componentes: ReservaComponente[] }> {
  const { data, error } = await cliente
    .from("reserva")
    .insert({
      agencia: entrada.agencia,
      mail_recibido_id: entrada.mailRecibidoId,
      booking_id: entrada.bookingId ?? null,
      booking_id_original: entrada.bookingIdOriginal ?? null,
      producto_id: entrada.productoId ?? null,
      producto_clave_agencia: entrada.productoClaveAgencia ?? null,
      posible_duplicada: entrada.posibleDuplicada ?? false,
      duplicada_de_id: entrada.duplicadaDeId ?? null,
      producto_texto_agencia: entrada.productoTextoAgencia ?? null,
      fecha_inicio: entrada.fechaInicio ?? null,
      fecha_fin: entrada.fechaFin ?? null,
      pax: entrada.pax ?? null,
      pasajeros: entrada.pasajeros ?? [],
      vuelos: entrada.vuelos ?? [],
      habitacion: entrada.habitacion ?? null,
      pedidos_especiales: entrada.pedidosEspeciales ?? null,
      estado: entrada.estado,
      motivos_revision: entrada.motivosRevision ?? [],
      datos_extraidos: entrada.datosExtraidos ?? null,
      de_prueba: entrada.dePrueba ?? false,
      origen_emparejado: entrada.origenEmparejado ?? null,
      confianza_emparejado: entrada.confianzaEmparejado ?? null,
      sugerencia_producto_id: entrada.sugerenciaProductoId ?? null,
      ...columnasJournaway(entrada),
    })
    .select("*")
    .single();
  // `code` viaja en el error: 23505 = ya existe la reserva de ese booking_id + producto (M2-04 fila 11).
  if (error) throw Object.assign(new Error(`No se pudo crear la reserva: ${error.message}`), { code: error.code });
  const reserva = data as Reserva;

  const filas = (entrada.componentes ?? []).map((c, i) => ({
    reserva_id: reserva.id,
    orden: i + 1,
    tipo: c.tipo,
    producto_id: c.productoId ?? null,
    producto_componente_id: c.productoComponenteId ?? null,
    descripcion_ruta: c.descripcionRuta ?? null,
    texto_agencia: c.textoAgencia ?? null,
    fecha_inicio: c.fechaInicio ?? null,
    fecha_fin: c.fechaFin ?? null,
    es_tarea: c.esTarea ?? false,
    producto_servicio_id: c.productoServicioId ?? null,
    proveedor_id: c.proveedorId ?? null,
    // M2-09 (0016): solo si viene, así las demás agencias no dependen de la migración.
    ...(c.pickUp ? { pick_up: c.pickUp } : {}),
  }));
  if (filas.length === 0) return { reserva, componentes: [] };

  const { data: componentes, error: errorComponentes } = await cliente
    .from("reserva_componente")
    .insert(filas)
    .select("*")
    .order("orden");
  if (errorComponentes) {
    throw new Error(`Se creó la reserva ${reserva.id} pero no sus componentes: ${errorComponentes.message}`);
  }
  return { reserva, componentes: componentes as ReservaComponente[] };
}

/**
 * Cambia el estado de una reserva. A `para_revision` hace falta al menos un
 * motivo; a cualquier otro estado, los motivos se limpian. La entrada
 * "estado_cambiado" del historial la agrega la base (con el autor de la
 * sesión, o el sistema).
 */
export async function cambiarEstado(
  reservaId: string,
  estado: EstadoReserva,
  opciones: { motivos?: string[] } = {},
  cliente: Cliente = clientePorDefecto(),
): Promise<Reserva> {
  const motivos = estado === "para_revision" ? (opciones.motivos ?? []) : [];
  if (estado === "para_revision" && motivos.length === 0) {
    throw new Error("Una reserva para revisión necesita al menos un motivo.");
  }
  const { data, error } = await cliente
    .from("reserva")
    .update({ estado, motivos_revision: motivos, updated_at: new Date().toISOString() })
    .eq("id", reservaId)
    .select("*")
    .single();
  if (error) throw new Error(`No se pudo cambiar el estado de la reserva ${reservaId}: ${error.message}`);
  return data as Reserva;
}

/** Agrega al historial un hecho que no es un cambio de estado (mail nuevo del intercambio, posible duplicada). */
export async function agregarEvento(
  reservaId: string,
  evento: {
    tipo: Exclude<TipoEventoReserva, "creada" | "estado_cambiado">;
    mailRecibidoId?: string | null;
    detalle?: Record<string, unknown>;
  },
  cliente: Cliente = clientePorDefecto(),
): Promise<EventoReserva> {
  const { data, error } = await cliente
    .from("evento_reserva")
    .insert({
      reserva_id: reservaId,
      tipo: evento.tipo,
      mail_recibido_id: evento.mailRecibidoId ?? null,
      detalle: evento.detalle ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(`No se pudo agregar el evento a la reserva ${reservaId}: ${error.message}`);
  return data as EventoReserva;
}

/**
 * Borra todo lo que tiene la marca "de prueba" (reservas, componentes,
 * historial, llamadas a la IA y mails) y sus PDF en Storage. Las reservas
 * reales no se tocan: la base lo impide. Es el `--borrar` del modo prueba
 * (M2-06): los tests NO la usan, usan `borrarDatosDePruebaDe`.
 */
export async function borrarDatosDePrueba(
  cliente: Cliente = clientePorDefecto(),
): Promise<{ archivosBorrados: number }> {
  const { data, error } = await cliente.rpc("borrar_datos_de_prueba");
  if (error) throw new Error(`No se pudieron borrar los datos de prueba: ${error.message}`);
  return borrarPdfsDePrueba(cliente, data);
}

/**
 * Borra solo lo "de prueba" que cuelga de esos mails (sus reservas, partes,
 * historial y llamadas a la IA), esas llamadas a la IA y sus PDF (migración
 * 0013). Lo que no tiene la marca de prueba no se toca. Para los tests: no
 * borra las reservas de prueba del modo prueba ni las de otro test.
 */
export async function borrarDatosDePruebaDe(
  alcance: { mails: readonly string[]; llamadas?: readonly string[] },
  cliente: Cliente = clientePorDefecto(),
): Promise<{ archivosBorrados: number }> {
  if (alcance.mails.length === 0 && !alcance.llamadas?.length) return { archivosBorrados: 0 };
  const { data, error } = await cliente.rpc("borrar_datos_de_prueba_de", {
    p_mails: [...alcance.mails],
    p_llamadas: [...(alcance.llamadas ?? [])],
  });
  if (error) throw new Error(`No se pudieron borrar los datos de prueba: ${error.message}`);
  return borrarPdfsDePrueba(cliente, data);
}

async function borrarPdfsDePrueba(cliente: Cliente, data: unknown): Promise<{ archivosBorrados: number }> {
  const rutas = ((data as Array<string | { ruta: string }> | null) ?? []).map((r) =>
    typeof r === "string" ? r : r.ruta,
  );
  const almacen = cliente.storage.from(BUCKET_ADJUNTOS);
  for (let i = 0; i < rutas.length; i += 100) {
    const { error: errorStorage } = await almacen.remove(rutas.slice(i, i + 100));
    if (errorStorage) throw new Error(`No se pudieron borrar los PDF de prueba: ${errorStorage.message}`);
  }
  return { archivosBorrados: rutas.length };
}
