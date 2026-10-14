/**
 * Tipos de las reservas que entran por mail (spec M2-01, migración 0010).
 * Los nombres de campo de las filas son los de la base (snake_case).
 */

export const ESTADOS_RESERVA = [
  "recibida",
  "para_revision",
  "pedido_a_proveedor",
  "confirmada",
  "con_cambios",
  "rechazada",
  "cerrada",
  "descartada",
] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

/** Los únicos estados con los que puede nacer una reserva. */
export type EstadoInicialReserva = Extract<EstadoReserva, "recibida" | "para_revision">;

export type TipoEventoReserva =
  | "creada"
  | "estado_cambiado"
  | "mail_agregado"
  | "posible_duplicada"
  // M2-04 (migración 0012)
  | "datos_completados"
  | "datos_distintos"
  | "misma_referencia";

export type ResultadoIaLlamada = "ok" | "cortada" | "invalida" | "error" | "sin_presupuesto";

export const BUCKET_ADJUNTOS = "mail-adjuntos";

// --- mail_recibido --------------------------------------------------------------

export interface AdjuntoEntrada {
  nombre: string;
  /** Tipo MIME ("application/pdf", "image/png"…). */
  tipo: string;
  /** El contenido: solo se guarda si es un PDF. */
  contenido?: Uint8Array;
  /** Tamaño en bytes, si no viene el contenido. */
  tamano?: number;
}

export interface AdjuntoGuardado {
  nombre: string;
  tipo: string;
  tamano: number;
  /** Ruta en el bucket `mail-adjuntos` (solo los PDF); null si no se subió. */
  ruta: string | null;
}

export interface MailEntrada {
  origen: "imap" | "archivo";
  /** Inbox o Spam si vino por IMAP; null si es un archivo de `Insumos/`. */
  carpeta?: "inbox" | "spam" | null;
  archivoOrigen?: string | null;
  imapUidvalidity?: number | null;
  imapUid?: number | null;
  messageId?: string | null;
  remitente: string;
  remitenteNombre?: string | null;
  destinatarios?: string[];
  asunto?: string | null;
  fechaMail?: Date | string | null;
  cuerpoTexto?: string | null;
  cuerpoHtml?: string | null;
  adjuntos?: AdjuntoEntrada[];
  /** La agencia reconocida por el remitente; null si no se reconoció. */
  agencia?: string | null;
  dePrueba?: boolean;
}

export interface MailRecibido {
  id: string;
  origen: "imap" | "archivo";
  carpeta: "inbox" | "spam" | null;
  archivo_origen: string | null;
  imap_uidvalidity: number | null;
  imap_uid: number | null;
  message_id: string | null;
  huella: string;
  remitente: string;
  remitente_nombre: string | null;
  destinatarios: string[];
  asunto: string | null;
  fecha_mail: string | null;
  cuerpo_texto: string | null;
  cuerpo_html: string | null;
  adjuntos: AdjuntoGuardado[];
  agencia: string | null;
  de_prueba: boolean;
  procesado_en: string | null;
  error_proceso: string | null;
  created_at: string;
  updated_at: string;
}

// --- reserva ------------------------------------------------------------------------

/**
 * paquete: un producto del catálogo; tramo_bus: un bus público; servicio: un
 * servicio del tour mismo (el bus que reserva Imperio Inca, el transfer al
 * aeropuerto de Puerto Natales). Migración 0011.
 */
export type TipoComponenteReserva = "paquete" | "tramo_bus" | "servicio";

/** Cómo se reconoció el producto (M2-03): código exacto, nombre de la agencia o IA. */
export type OrigenEmparejado = "codigo" | "nombre" | "ia";

export interface ComponenteEntrada {
  tipo: TipoComponenteReserva;
  productoId?: string | null;
  productoComponenteId?: string | null;
  descripcionRuta?: string | null;
  /** Lo que mandó la agencia, tal cual. */
  textoAgencia?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  /** Bus que emite HI Travel a mano (Kupos, Plataforma10): tarea, sin proveedor. */
  esTarea?: boolean;
  /** El servicio del catálogo del que sale la parte (buses del tour, final de ARCH31/ARCH33). */
  productoServicioId?: string | null;
  /** A quién se le pide una parte de tipo servicio. */
  proveedorId?: string | null;
}

export interface ReservaEntrada {
  agencia: string;
  mailRecibidoId: string;
  /** Normalizado (`booking-id.ts`): el que se compara. */
  bookingId?: string | null;
  /** M2-04: tal como lo mandó la agencia, para mostrarlo. */
  bookingIdOriginal?: string | null;
  productoId?: string | null;
  /** M2-04: código o nombre de la agencia normalizado ("mismo producto" sin catálogo). */
  productoClaveAgencia?: string | null;
  /** M2-04 fila 8: la marca blanda y la reserva con la que se parece. */
  posibleDuplicada?: boolean;
  duplicadaDeId?: string | null;
  productoTextoAgencia?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  pax?: number | null;
  pasajeros?: unknown[];
  vuelos?: unknown[];
  habitacion?: string | null;
  pedidosEspeciales?: string | null;
  estado: EstadoInicialReserva;
  /** Obligatorios (uno o más) si el estado es `para_revision`; ninguno si es `recibida`. */
  motivosRevision?: string[];
  datosExtraidos?: unknown;
  dePrueba?: boolean;
  /** M2-03: cómo se reconoció el producto (solo con producto). */
  origenEmparejado?: OrigenEmparejado | null;
  confianzaEmparejado?: number | null;
  /** M2-03: lo que propuso la IA y no se aceptó (para quien revisa). */
  sugerenciaProductoId?: string | null;
  /** En el orden del tour (o de la lista de Journaway). */
  componentes?: ComponenteEntrada[];
}

export interface ReservaComponente {
  id: string;
  reserva_id: string;
  orden: number;
  tipo: TipoComponenteReserva;
  producto_id: string | null;
  producto_componente_id: string | null;
  descripcion_ruta: string | null;
  texto_agencia: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  es_tarea: boolean;
  producto_servicio_id: string | null;
  proveedor_id: string | null;
}

export interface Reserva {
  id: string;
  agencia: string;
  mail_recibido_id: string;
  booking_id: string | null;
  booking_id_original: string | null;
  producto_id: string | null;
  producto_clave_agencia: string | null;
  /** Calculada: el producto del catálogo o, si no emparejó, `producto_clave_agencia`. */
  clave_producto: string | null;
  producto_texto_agencia: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  pax: number | null;
  pasajeros: unknown[];
  vuelos: unknown[];
  habitacion: string | null;
  pedidos_especiales: string | null;
  estado: EstadoReserva;
  motivos_revision: string[];
  posible_duplicada: boolean;
  duplicada_de_id: string | null;
  datos_extraidos: unknown;
  de_prueba: boolean;
  origen_emparejado: OrigenEmparejado | null;
  confianza_emparejado: number | null;
  sugerencia_producto_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventoReserva {
  id: string;
  reserva_id: string;
  tipo: TipoEventoReserva;
  estado_anterior: EstadoReserva | null;
  estado_nuevo: EstadoReserva | null;
  mail_recibido_id: string | null;
  detalle: Record<string, unknown>;
  /** null = el sistema. */
  autor_id: string | null;
  created_at: string;
}
