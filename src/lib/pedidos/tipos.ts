/**
 * Tipos de los borradores de pedido a proveedores (spec M3-01, migración 0018).
 *
 * `armarPedidos` (armar.ts) recibe una reserva y lo que hace falta del
 * catálogo, ya leídos de la base (cargar.ts), y devuelve los pedidos, las
 * tareas y los avisos. No toca la base ni la red.
 */
import type { DetalleProducto, ProveedorResumen } from "@/lib/catalogo/tipos";
import type { EstadoReserva, HotelDeLaAgencia, TipoComponenteReserva } from "@/lib/reservas/tipos";

/** Un pasajero como lo guarda la reserva (M2-02); los campos que no vinieron faltan. */
export interface PasajeroDeReserva {
  nombre?: string | null;
  apellido?: string | null;
  tratamiento?: string | null;
  nacionalidad?: string | null;
  fecha_nacimiento?: string | null;
  pasaporte?: string | null;
  telefono?: string | null;
}

/** Un vuelo como lo guarda la reserva (fechas y horas del aeropuerto, sin convertir). */
export interface VueloDeReserva {
  numero?: string | null;
  aerolinea?: string | null;
  origen?: string | null;
  destino?: string | null;
  fecha_salida?: string | null;
  hora_salida?: string | null;
  fecha_llegada?: string | null;
  hora_llegada?: string | null;
}

/** Una fila de `reserva_componente`, como la usa el armado. */
export interface ParteParaPedidos {
  id: string;
  orden: number;
  tipo: TipoComponenteReserva;
  productoId: string | null;
  productoComponenteId: string | null;
  descripcionRuta: string | null;
  textoAgencia: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  esTarea: boolean;
  productoServicioId: string | null;
  proveedorId: string | null;
  pickUp: string | null;
}

export interface ReservaParaPedidos {
  id: string;
  estado: EstadoReserva;
  agencia: string;
  /** El número de la agencia tal como vino (o el normalizado). */
  numero: string | null;
  productoId: string | null;
  /** Owner 2026-10-17 (0017): los demás productos de la misma reserva. */
  otrosProductos: string[];
  fechaInicio: string | null;
  fechaFin: string | null;
  pax: number | null;
  pasajeros: PasajeroDeReserva[];
  vuelos: VueloDeReserva[];
  habitacion: string | null;
  pedidosEspeciales: string | null;
  /** M2-09: avisos de la reserva que no mandan a revisión (se leen para la restricción alimentaria). */
  notas?: string[];
  /** M2-09: el contacto del pasajero principal; su teléfono completa la ficha del que no trae uno. */
  contactoCliente?: { nombre?: string | null; email?: string | null; telefono?: string | null } | null;
  /** M2-09: lo que reserva la agencia ("booked by us"): no se pide. */
  hotelesAgencia: HotelDeLaAgencia[];
  /** M2-09: el lado del traslado que lleva otra reserva del mismo pedido. */
  sinTrasladoDe: "llegada" | "salida" | null;
  partes: ParteParaPedidos[];
}

/** El día de un servicio dentro de su paquete (`data/dias-servicio.csv`). */
export interface DiaDeServicio {
  codigo: string;
  orden: number;
  dia: number;
}

/**
 * Una fila de `data/excursiones-con-entrada.csv`: la excursión (por código de producto
 * o por una parte del nombre) que en las reservas de Journaway se pide con entradas.
 * "revisar" no se aplica hasta que el owner la pase a "si".
 */
export interface ExcursionConEntrada {
  codigo: string | null;
  patron: string | null;
  estado: "si" | "revisar";
}

/** Una fila de `data/proveedores-ficha-completa.csv`: el proveedor (por nombre) que pide la ficha completa por pasajero. */
export interface ProveedorFichaCompleta {
  proveedor: string;
}

/**
 * Una fila de `data/hostel-segun-habitacion.csv` (M3-11): en ese destino, el orden de los hostels
 * según la habitación (dorm o privada). Los que no están en la lista no se ofrecen.
 */
export interface HostelSegunHabitacion {
  destino: string;
  habitacion: "dorm" | "privada";
  orden: string[];
}

/**
 * Una fila de `data/opciones-pasajero.csv` (M3-13, owner 2026-10-22): si los pedidos especiales
 * de la reserva traen la elección (la palabra `eleccion`), en el servicio `orden` del paquete
 * `codigo` se elige la opción `servicio` ("elegir"), se pide solo `servicio` ("renombrar") o se
 * pide además `servicio` a `proveedor` ("agregar").
 */
export interface OpcionDelPasajero {
  codigo: string;
  orden: number;
  eleccion: string;
  accion: "elegir" | "renombrar" | "agregar";
  servicio: string;
  /** El nombre del proveedor en el directorio (solo "agregar"). */
  proveedor: string | null;
  /** El proveedor del directorio (lo completa `cargar.ts`); null si no está. */
  proveedorDelDirectorio?: ProveedorResumen | null;
}

export interface CatalogoParaPedidos {
  /** El detalle (`cargarProducto`) del producto de la reserva, de los otros productos y de cada parte. */
  detalles: ReadonlyMap<string, DetalleProducto>;
  /** Los proveedores de las partes de tipo servicio (el bus de Imperio Inca, el transfer a PNT). */
  proveedores: ReadonlyMap<string, ProveedorResumen>;
  dias: readonly DiaDeServicio[];
  /** Las excursiones que en Journaway se piden con entradas (sin la lista, ninguna). */
  entradas?: readonly ExcursionConEntrada[];
  /** Los proveedores que piden la ficha completa por pasajero (sin la lista, ninguno). */
  fichaCompleta?: readonly ProveedorFichaCompleta[];
  /** El hostel según la habitación (M3-11; sin la lista, el orden del Excel). */
  hostelSegunHabitacion?: readonly HostelSegunHabitacion[];
  /** Las opciones que elige el pasajero (M3-13; sin la lista, como antes). */
  opcionesPasajero?: readonly OpcionDelPasajero[];
}

/** La plantilla del mail (`data/plantillas/pedido-proveedor.md`), ya separada en sus partes. */
export interface Plantilla {
  asunto: string;
  cuerpo: string;
  firma: string;
}

/** Lo que cubre un pedido, para saber qué partes de la reserva ya se pidieron. */
export interface ParteCubierta {
  parteId: string | null;
  productoServicioId: string | null;
  producto: string | null;
  fecha: string | null;
}

export interface PedidoArmado {
  /** Los mails normalizados (ordenados, con coma) o "sin-mail:<proveedor>". */
  casilla: string;
  destinatarios: string[];
  proveedores: Array<{ id: string; nombre: string }>;
  partes: ParteCubierta[];
  asunto: string;
  cuerpo: string;
  /** Con `{{nombre_de_quien_envia}}`: lo completa M3-03 con quien aprueba. */
  firma: string;
  /** Por qué no tiene destinatario (proveedor sin mail); null si lo tiene. */
  sinDestinatario: string | null;
  /** Lo que conviene completar antes de enviar ("Falta la fecha de…"). */
  avisos: string[];
}

export type TipoTarea = "emitir_boleto" | "reservar_a_mano" | "whatsapp" | "revisar";

export interface TareaArmada {
  tipo: TipoTarea;
  texto: string;
  detalle: Record<string, unknown>;
}

export type ResultadoArmado =
  | { ok: true; pedidos: PedidoArmado[]; tareas: TareaArmada[]; avisos: string[] }
  | { ok: false; error: string };

/** El marcador de la firma: la base rechaza una firma sin él (0018). */
export const MARCA_NOMBRE = "{{nombre_de_quien_envia}}";
