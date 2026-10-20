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
import { nombreVisible } from "@/lib/usuarios/nombre";
import { cuerpoComoTexto, esCancelacion } from "./reglas";
import {
  BUCKET_ADJUNTOS,
  type CambioDeResponsable,
  type CorreccionDeReserva,
  type ConfirmacionDeProducto,
  type ContactoDelCliente,
  type DetalleReserva,
  type EnvioDeReserva,
  type PedidoDeReservaVista,
  type HotelDeLaAgencia,
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
  "posible_duplicada,de_prueba,created_at,vuelos,pedidos_especiales,producto_texto_agencia,pasajeros," +
  // M2-09 (0016): el lado del traslado que lleva otra reserva del mismo pedido (para los avisos de vuelo).
  // 0017: los demás productos de la misma reserva (Journaway: SPAP01 + SPAP03).
  // M3-06 (0021): quién la lleva.
  `sin_traslado_de,otros_productos,${PRODUCTO},mail:mail_recibido_id(fecha_mail),responsable_id,responsable:responsable_id(nombre,nombre_firma,email)`;
// M3-05: lo que sugirió la IA y no se aceptó, para confirmarlo desde el detalle.
const CAMPOS_DETALLE = `${CAMPOS_FILA},mail_recibido_id,duplicada_de_id,habitacion,trip_number,hoteles_agencia,contacto_cliente,notas,sugerencia:sugerencia_producto_id(id,codigo,nombre)`;
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

const otrosIds = (r: any): string[] => (Array.isArray(r.otros_productos) ? r.otros_productos : []);

/** Owner 2026-10-17: código y nombre de los demás productos de las reservas (una sola consulta). */
async function otrosProductosDe(cliente: SupabaseClient, filas: any[]): Promise<Map<string, ProductoDeReserva>> {
  const ids = [...new Set(filas.flatMap(otrosIds))];
  if (ids.length === 0) return new Map();
  const productos = verificar(await cliente.from("producto").select("id,codigo,nombre").in("id", ids)) as any[];
  return new Map(productos.map((p) => [p.id as string, aProducto(p)!]));
}

function aFila(
  r: any,
  avisosVuelo: string[] = [],
  canceladaEnHistorial = false,
  otros: Map<string, ProductoDeReserva> = new Map(),
  conPedidoSinEnviar = false,
): FilaReserva {
  const motivos: string[] = Array.isArray(r.motivos_revision) ? r.motivos_revision : [];
  return {
    id: r.id,
    estado: r.estado as EstadoReserva,
    agencia: r.agencia,
    numero: texto(r.booking_id_original) ?? texto(r.booking_id),
    producto: aProducto(r.producto),
    otrosProductos: otrosIds(r)
      .map((id) => otros.get(id))
      .filter((p): p is ProductoDeReserva => !!p),
    fechaInicio: r.fecha_inicio ?? null,
    fechaFin: r.fecha_fin ?? null,
    pax: typeof r.pax === "number" ? r.pax : null,
    pasajeros: aPasajeros(r.pasajeros),
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
    pedidoIncompleto: r.estado === "pedido_a_proveedor" && conPedidoSinEnviar,
    responsableId: r.responsable_id ?? null,
    responsable: nombreVisible(r.responsable),
  };
}

/** Spec M3-03 fila 8: las reservas con algún pedido que no está enviado (la marca "pedido incompleto"). */
async function conPedidosSinEnviar(cliente: SupabaseClient, ids?: string[]): Promise<Set<string>> {
  let consulta = cliente.from("reserva_pedido").select("reserva_id").neq("estado", "enviado");
  if (ids) consulta = consulta.in("reserva_id", ids);
  const filas = verificar(await consulta) as any[];
  return new Set(filas.map((p) => p.reserva_id as string));
}

const CAMPOS_PEDIDO = "id,proveedores,destinatarios,estado,enviado_en,enviado_por_nombre,motivo_fallo,sin_destinatario,reenvios,created_at";

function aPedidoVista(p: any): PedidoDeReservaVista {
  return {
    id: p.id,
    proveedores: Array.isArray(p.proveedores) ? p.proveedores : [],
    destinatarios: Array.isArray(p.destinatarios) ? p.destinatarios : [],
    estado: p.estado,
    enviadoEn: p.enviado_en ?? null,
    enviadoPor: texto(p.enviado_por_nombre),
    motivoFallo: texto(p.motivo_fallo),
    sinDestinatario: texto(p.sin_destinatario),
    reenvios: typeof p.reenvios === "number" ? p.reenvios : 0,
  };
}

function aEnvio(e: any): EnvioDeReserva {
  const d = e.detalle ?? {};
  return {
    tipo: e.tipo,
    fecha: e.created_at,
    persona: texto(d.persona) ?? "",
    cantidad: typeof d.cantidad === "number" ? d.cantidad : 0,
    proveedores: Array.isArray(d.proveedores) ? d.proveedores.filter((x: unknown) => typeof x === "string") : [],
    destino: texto(d.destino),
    reenvio: d.reenvio === true,
  };
}

/** M3-05: "<persona> confirmó el producto OD031 (sugerido por la IA)" o "<persona> eligió OD031". */
function aConfirmacion(e: any): ConfirmacionDeProducto {
  const d = e.detalle ?? {};
  return { fecha: e.created_at, persona: texto(d.persona) ?? "", codigo: texto(d.codigo) ?? "", sugerida: d.sugerida === true };
}

const TIPO_CAMBIO: Record<string, CambioDeResponsable["tipo"]> = {
  reserva_tomada: "tomada",
  reserva_pasada: "pasada",
  responsable_por_envio: "envio",
};

/** M3-06 fila 8: "<persona> tomó la reserva", "<persona> se la pasó a <otra>" o "Responsable: <persona> (envió los primeros pedidos)". */
function aCambioDeResponsable(e: any): CambioDeResponsable {
  const d = e.detalle ?? {};
  const persona = texto(d.persona) ?? "";
  return { tipo: TIPO_CAMBIO[e.tipo], fecha: e.created_at, persona, responsable: texto(d.responsable) ?? persona };
}

const TIPO_CORRECCION: Record<string, CorreccionDeReserva["tipo"]> = {
  vuelos_corregidos: "vuelos",
  dato_revisado: "revisado",
  dato_corregido: "corregido",
};

/** M3-07 fila 7: "<persona> corrigió los vuelos: …", "<persona> marcó como revisado: pax" o "<persona> corrigió: fechas". */
function aCorreccion(e: any): CorreccionDeReserva {
  const d = e.detalle ?? {};
  const vuelos = (Array.isArray(d.vuelos) ? d.vuelos : [])
    .filter((v: any) => v && typeof v === "object")
    .map((v: any) => ({
      lado: v.lado === "salida" ? ("salida" as const) : ("llegada" as const),
      numero: texto(v.numero) ?? "",
      aeropuerto: texto(v.aeropuerto) ?? "",
      fecha: texto(v.fecha),
      hora: texto(v.hora),
    }));
  const diasCorridos = typeof d.dias_corridos === "number" && d.dias_corridos !== 0 ? d.dias_corridos : null;
  return { tipo: TIPO_CORRECCION[e.tipo], fecha: e.created_at, persona: texto(d.persona) ?? "", vuelos, dato: texto(d.dato), nota: d.nota === true, diasCorridos };
}

/** M3-07 fila 6: a qué proveedores hay que avisarles que el vuelo cambió después de enviarles el pedido. */
function proveedoresAAvisar(eventos: any[]): string[] {
  const nombres = eventos
    .filter((e) => e.tipo === "vuelos_corregidos")
    .flatMap((e) => (Array.isArray(e.detalle?.avisar) ? e.detalle.avisar : []))
    .flatMap((a: any) => (Array.isArray(a?.proveedores) ? a.proveedores : []))
    .filter((n: unknown): n is string => typeof n === "string" && !!n.trim());
  return [...new Set(nombres)] as string[];
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
      sinTrasladoDe: r.sin_traslado_de ?? null,
      otrosProductos: otrosIds(r),
    })),
  );
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La lista de reservas (#2). El orden lo pone la pantalla. Con
 * `sinTerminadasAntesDe` (spec M3-08 fila 5, la lista de un operador) la base
 * no devuelve los viajes cuyo fin es anterior a esa fecha; los sin fecha de
 * fin, sí.
 */
export async function cargarReservas(
  cliente: SupabaseClient,
  opciones: { sinTerminadasAntesDe?: string } = {},
): Promise<FilaReserva[]> {
  let consulta = cliente.from("reserva").select(CAMPOS_FILA);
  if (opciones.sinTerminadasAntesDe !== undefined) {
    if (!FECHA.test(opciones.sinTerminadasAntesDe)) throw new Error("Fecha inválida para la lista de reservas.");
    consulta = consulta.or(`fecha_fin.is.null,fecha_fin.gte.${opciones.sinTerminadasAntesDe}`);
  }
  const filas = verificar(await consulta.order("created_at", { ascending: false })) as any[];
  const [avisos, canceladas, otros, sinEnviar] = await Promise.all([
    avisosDe(cliente, filas),
    canceladasEnHistorial(cliente),
    otrosProductosDe(cliente, filas),
    conPedidosSinEnviar(cliente),
  ]);
  return filas.map((r) => aFila(r, avisos.get(r.id), canceladas.has(r.id), otros, sinEnviar.has(r.id)));
}

function aPasajeros(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((p: any) => (typeof p === "string" ? p.trim() : [texto(p?.nombre), texto(p?.apellido)].filter(Boolean).join(" ")))
    .filter((n) => n.length > 0);
}

/** Los vuelos guardados como los muestra la pantalla (M3-07 los usa también para la versión que vio). */
export function aVuelos(lista: unknown): VueloDeReserva[] {
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
    descripcion: texto(c.descripcion_ruta) ?? (c.producto?.id ? null : texto(c.texto_agencia)),
    fechaInicio: c.fecha_inicio ?? null,
    fechaFin: c.fecha_fin ?? null,
    esTarea: Boolean(c.es_tarea),
    pickUp: texto(c.pick_up),
    textoAgencia: texto(c.texto_agencia),
  };
}

/** M2-09: lo que reserva la agencia ("booked by us"), solo para mostrar. */
function aHoteles(lista: unknown): HotelDeLaAgencia[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((h: any) => h && typeof h === "object" && texto(h.nombre))
    .map((h: any) => ({ nombre: texto(h.nombre)!, desde: texto(h.desde), hasta: texto(h.hasta) }));
}

function aContacto(c: any): ContactoDelCliente | null {
  if (!c || typeof c !== "object") return null;
  const contacto = { nombre: texto(c.nombre), email: texto(c.email), telefono: texto(c.telefono) };
  return contacto.nombre || contacto.email || contacto.telefono ? contacto : null;
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

  const [partes, eventos, avisos, canceladas, otros, pedidos, envios] = await Promise.all([
    cliente
      .from("reserva_componente")
      .select(`orden,tipo,descripcion_ruta,texto_agencia,fecha_inicio,fecha_fin,es_tarea,pick_up,${PRODUCTO}`)
      .eq("reserva_id", id)
      .order("orden"),
    cliente.from("evento_reserva").select("mail_recibido_id").eq("reserva_id", id).not("mail_recibido_id", "is", null),
    avisosDe(cliente, [r]),
    canceladasEnHistorial(cliente, [id]),
    otrosProductosDe(cliente, [r]),
    cliente.from("reserva_pedido").select(CAMPOS_PEDIDO).eq("reserva_id", id).order("created_at"),
    cliente
      .from("evento_reserva")
      .select("tipo,detalle,created_at")
      .eq("reserva_id", id)
      .in("tipo", ["pedidos_enviados", "envio_de_prueba", "producto_confirmado", ...Object.keys(TIPO_CAMBIO), ...Object.keys(TIPO_CORRECCION)])
      .order("created_at"),
  ]);
  const filasPedidos = (verificar(pedidos) as any[]).map(aPedidoVista);
  const historial = verificar(envios) as any[];
  const filasPartes = verificar(partes) as any[];
  const idsSumados = (verificar(eventos) as any[]).map((e) => e.mail_recibido_id as string);
  const ids = [...new Set([r.mail_recibido_id as string, ...idsSumados])];
  const filasMails = verificar(await cliente.from("mail_recibido").select(CAMPOS_MAIL).in("id", ids)) as any[];

  const llegada = (m: any) => Date.parse(m.fecha_mail ?? m.created_at);
  const primero = filasMails.filter((m) => m.id === r.mail_recibido_id);
  const sumados = filasMails.filter((m) => m.id !== r.mail_recibido_id).sort((a, b) => llegada(a) - llegada(b));

  return {
    ...aFila(r, avisos.get(r.id), canceladas.has(r.id), otros, filasPedidos.some((p) => p.estado !== "enviado")),
    productoTextoAgencia: texto(r.producto_texto_agencia),
    duplicadaDeId: r.duplicada_de_id ?? null,
    habitacion: texto(r.habitacion),
    pedidosEspeciales: texto(r.pedidos_especiales),
    vuelos: aVuelos(r.vuelos),
    partes: filasPartes.map(aParte),
    mails: [...primero, ...sumados].map(aMail),
    tripNumber: texto(r.trip_number),
    hotelesAgencia: aHoteles(r.hoteles_agencia),
    contactoCliente: aContacto(r.contacto_cliente),
    notas: Array.isArray(r.notas) ? r.notas.filter((n: unknown): n is string => typeof n === "string" && !!n.trim()) : [],
    pedidos: filasPedidos,
    envios: historial.filter((e) => e.tipo === "pedidos_enviados" || e.tipo === "envio_de_prueba").map(aEnvio),
    sugerencia: aProducto(r.sugerencia),
    confirmacionesProducto: historial.filter((e) => e.tipo === "producto_confirmado").map(aConfirmacion),
    responsables: historial.filter((e) => e.tipo in TIPO_CAMBIO).map(aCambioDeResponsable),
    correcciones: historial.filter((e) => e.tipo in TIPO_CORRECCION).map(aCorreccion),
    avisarCambioDeVuelo: proveedoresAAvisar(historial),
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
