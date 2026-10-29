/**
 * Tipos de los borradores de pedido a proveedores (spec M3-01, migración 0018).
 *
 * `armarPedidos` (armar.ts) recibe una reserva y lo que hace falta del
 * catálogo, ya leídos de la base (cargar.ts), y devuelve los pedidos, las
 * tareas y los avisos. No toca la base ni la red.
 */
import type { DetalleProducto, ProveedorResumen } from "@/lib/catalogo/tipos";
import type { EstadoReserva, HotelDeLaAgencia, TipoComponenteReserva } from "@/lib/reservas/tipos";
import type { CategoriaTour } from "@/lib/importador-tours/datos";
import type { ReglasItinerario } from "./itinerario";

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
  /**
   * M3-15: la excursión (por su nombre) a la que va el día, cuando el servicio junta varias en un
   * renglón ("Bodegas half Day and Alta Montaña"): el pedido las separa, cada una con su fecha.
   */
  servicio?: string;
  /** M3-15: cuándo ese día ("por la tarde (14:30 aprox.)"). */
  momento?: string;
  /**
   * M3-23: la regla vale solo dentro de ese tour (AR10: Torres del Paine antes que Perito Moreno) y
   * ahí reemplaza a la general del mismo servicio. Sin tour, vale en todos lados.
   */
  tour?: string;
}

/**
 * Una fila de `data/puntos-de-encuentro.csv` (M3-15, owner 2026-10-22): la excursión `servicio` del
 * servicio `orden` del paquete `codigo` no tiene pick up; el pasajero va directo a `punto`.
 */
export interface PuntoDeEncuentro {
  codigo: string;
  orden: number;
  servicio: string;
  punto: string;
}

/**
 * Una fila de `data/buses-el-chalten.csv` (M3-20, owner 2026-10-23): el servicio `orden` del paquete
 * `codigo` es el bus regular aeropuerto FTE → El Chaltén (`ida`) o El Chaltén → El Calafate
 * (`vuelta`). Sale con `renglon` (sin él, el nombre del catálogo), su `horario` y, si hay `dia`,
 * ese día del paquete. La ida busca el vuelo que llega a `aeropuerto`; si llega después de
 * `vueloDespuesDe`, el borrador lleva el `aviso` (interno, no va al proveedor).
 */
export interface BusElChalten {
  codigo: string;
  orden: number;
  tramo: "ida" | "vuelta";
  dia: number | null;
  aeropuerto: string | null;
  renglon: string | null;
  horario: string;
  vueloDespuesDe: string | null;
  aviso: string | null;
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

/**
 * Una fila de `data/alojamiento-se-pide-a.csv` (M3-22, owner 2026-10-23): el alojamiento `alojamiento`
 * del destino se le pide a `proveedor` (su nombre en el directorio), no al Booking Supplier del Excel.
 */
export interface AlojamientoSePideA {
  destino: string;
  alojamiento: string;
  proveedor: string;
  /** El proveedor del directorio (lo completa `cargar.ts`); null si no está. */
  proveedorDelDirectorio?: ProveedorResumen | null;
}

/**
 * Una fila de `data/tramos-se-piden-a.csv` (M3-25, owner 2026-10-27): el bus `ruta` ("Bariloche – El
 * Chaltén") del tour `tour`, que si no emite HI Travel, se le pide a `proveedor` (su nombre en el
 * directorio). Vale en los dos sentidos.
 */
export interface TramoSePideA {
  tour: string;
  ruta: string;
  proveedor: string;
  /** La hora de salida en ese sentido ("8:30 am"); solo vale si el bus va en el sentido de la ruta. */
  horario?: string;
  /** El proveedor del directorio (lo completa `cargar.ts`); null si no está. */
  proveedorDelDirectorio?: ProveedorResumen | null;
}

/**
 * Una fila de `data/alojamientos-sin-desayuno.csv` (M3-35, owner 2026-10-28): el alojamiento (su
 * nombre en el catálogo) no ofrece desayuno; el pedido no dice "con desayuno".
 */
export interface AlojamientoSinDesayuno {
  alojamiento: string;
  nota: string | null;
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
  /** Los alojamientos que no ofrecen desayuno (M3-35; sin la lista, todos con desayuno). */
  sinDesayuno?: readonly AlojamientoSinDesayuno[];
  /** A quién se le pide un alojamiento (M3-22, Factoria a Factoria; sin la lista, al del Excel). */
  alojamientoSePideA?: readonly AlojamientoSePideA[];
  /** Los buses de un tour que se le piden a un proveedor en vez de emitirlos HI Travel (M3-25; sin la lista, todos tarea). */
  tramosSePidenA?: readonly TramoSePideA[];
  /** Las opciones que elige el pasajero (M3-13; sin la lista, como antes). */
  opcionesPasajero?: readonly OpcionDelPasajero[];
  /** Las categorías tour ↔ paquete (M3-14, data/categorias-tour.csv; sin la lista, la regla general). */
  categoriasTour?: readonly CategoriaTour[];
  /** Las excursiones sin pick up, con su punto de encuentro (M3-15; sin la lista, todas con pick up). */
  puntosDeEncuentro?: readonly PuntoDeEncuentro[];
  /** Los buses de El Chaltén (M3-20, data/buses-el-chalten.csv; sin la lista, como antes). */
  busesElChalten?: readonly BusElChalten[];
  /** M3-24: blackouts, fechas especiales y días de los buses (data/*.csv; sin las reglas, ningún aviso del itinerario). */
  itinerario?: ReglasItinerario;
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
  | {
      ok: true;
      pedidos: PedidoArmado[];
      tareas: TareaArmada[];
      avisos: string[];
      /** M3-24: los avisos del itinerario ("Revisar antes de pedir"), en orden de fecha. También van en los borradores afectados. */
      itinerario: string[];
    }
  | { ok: false; error: string };

/** El marcador de la firma: la base rechaza una firma sin él (0018). */
export const MARCA_NOMBRE = "{{nombre_de_quien_envia}}";
