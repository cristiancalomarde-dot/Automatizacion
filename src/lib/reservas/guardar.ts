import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { direccionDelRemitente } from "./agencias";
import { huellaDelMail } from "./huella";
import {
  BUCKET_ADJUNTOS,
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
 * devuelve el que estaba (`nuevo: false`) y no sube nada. Los PDF se suben al
 * bucket privado `mail-adjuntos` en `<id del mail>/<nombre>`; del resto de los
 * adjuntos queda solo nombre, tipo y tamaño.
 */
export async function guardarMailRecibido(
  entrada: MailEntrada,
  cliente: Cliente = clientePorDefecto(),
): Promise<{ mail: MailRecibido; nuevo: boolean }> {
  const remitente = direccionDelRemitente(entrada.remitente) ?? entrada.remitente.trim().toLowerCase();
  const huella = huellaDelMail({
    messageId: entrada.messageId,
    remitente,
    fecha: entrada.fechaMail,
    asunto: entrada.asunto,
    cuerpo: entrada.cuerpoTexto ?? entrada.cuerpoHtml,
  });

  const existente = await buscarMailPorHuella(cliente, huella);
  if (existente) return { mail: existente, nuevo: false };

  const id = randomUUID();
  const usados = new Set<string>();
  const subidas: Array<{ ruta: string; contenido: Uint8Array; tipo: string }> = [];
  const adjuntos: AdjuntoGuardado[] = (entrada.adjuntos ?? []).map((a) => {
    const tamano = a.contenido?.byteLength ?? a.tamano ?? 0;
    if (!esPdf(a.tipo, a.nombre) || !a.contenido) return { nombre: a.nombre, tipo: a.tipo, tamano, ruta: null };
    let nombre = nombreParaStorage(a.nombre);
    for (let n = 2; usados.has(nombre); n++) nombre = `${n}-${nombreParaStorage(a.nombre)}`;
    usados.add(nombre);
    const ruta = `${id}/${nombre}`;
    subidas.push({ ruta, contenido: a.contenido, tipo: "application/pdf" });
    return { nombre: a.nombre, tipo: a.tipo, tamano, ruta };
  });

  const almacen = cliente.storage.from(BUCKET_ADJUNTOS);
  for (const s of subidas) {
    const { error } = await almacen.upload(s.ruta, s.contenido, { contentType: s.tipo, upsert: false });
    if (error) {
      await almacen.remove(subidas.map((x) => x.ruta));
      throw new Error(`No se pudo guardar un PDF adjunto: ${error.message}`);
    }
  }

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
 * reales no se tocan: la base lo impide.
 */
export async function borrarDatosDePrueba(
  cliente: Cliente = clientePorDefecto(),
): Promise<{ archivosBorrados: number }> {
  const { data, error } = await cliente.rpc("borrar_datos_de_prueba");
  if (error) throw new Error(`No se pudieron borrar los datos de prueba: ${error.message}`);
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
