/**
 * Tipos de lectura del catálogo y del directorio (spec M1-06). Son la forma
 * en que las pantallas ven los datos; las consultas (`consultas.ts`) traducen
 * las filas de Supabase a estos tipos. Solo lectura (DECISIONS 2026-10-06).
 */

export type Canal = "mail" | "whatsapp" | null;

export type TipoServicio = "alojamiento" | "excursion" | "traslado" | "bus" | "crucero" | "otro";

export interface ProveedorResumen {
  id: string;
  nombre: string;
  mails: string[];
  canal: Canal;
  telefono: string | null;
}

export type SentidoTraslado = "llegada" | "salida" | "ida_y_vuelta" | "sin_sentido";

/** Cómo queda un servicio de un paquete dentro de un tour (M1-08, `tour_servicio_ajuste`). */
export interface AjusteEnTour {
  accion: "anular" | "solo_llegada" | "solo_salida" | "reemplazar" | "invertir";
  /** Texto nuevo (reemplazar; opcional en las demás). */
  texto: string | null;
  motivo: string;
  origen: "regla" | "excepcion";
}

/** En qué noches del paquete va un servicio (M1-07, `producto_servicio_noches`). */
export interface TramoNoches {
  nocheDesde: number;
  noches: number;
  lugar: string | null;
}

export interface Servicio {
  id: string;
  productoId: string;
  tipo: TipoServicio;
  nivel: string | null;
  orden: number | null;
  prioridad: number;
  descripcion: string | null;
  opcional: boolean;
  reservaManual: boolean;
  sinResolver: boolean;
  paraRevisar: boolean;
  nota: string | null;
  filaExcel: number | null;
  serviceProviderNombre: string | null;
  bookingSupplierNombre: string | null;
  serviceProvider: ProveedorResumen | null;
  bookingSupplier: ProveedorResumen | null;
  /** Vacío o ausente = el servicio no dice en qué noches va (se muestra como un bloque). */
  tramosNoches?: TramoNoches[];
  /** Solo traslados (M1-08). Ausente = sin dato. */
  sentido?: SentidoTraslado | null;
  /** M1-08: no se pide siempre (a pedido del pax/vendedor, o según la variante vendida). */
  aPedido?: "a_pedido" | "segun_reserva" | null;
  aPedidoNota?: string | null;
  /** M1-08: solo dentro de un tour, cómo queda en ese tour. Ausente = se pide tal cual. */
  ajusteTour?: AjusteEnTour;
}

export interface CodigoExterno {
  agencia: string;
  codigo: string;
  nombreExterno: string | null;
}

export interface ProductoBase {
  id: string;
  codigo: string;
  nombre: string;
  ciudades: string[];
  destino: string | null;
  updatedAt: string;
}

export interface FilaCatalogo extends ProductoBase {
  esTour: boolean;
  codigosExternos: CodigoExterno[];
  cantidadProveedores: number;
  cantidadPendientes: number;
}

export interface ComponenteTour {
  /** Id de la fila de `producto_componente` (M2-03 lo guarda en la reserva). */
  id?: string;
  orden: number;
  tipo: "paquete" | "tramo_bus";
  diaDesde: number | null;
  noches: number | null;
  nocturno: boolean | null;
  transferIn: boolean;
  transferOut: boolean;
  descripcionRuta: string | null;
  /**
   * Solo en `paquete`: el producto componente, con sus servicios. Si es un
   * tour (CHB31 dentro de 5C01), `componentes` trae su secuencia (M1-07).
   */
  producto: (ProductoBase & { esTour: boolean; servicios: Servicio[]; componentes?: ComponenteTour[] }) | null;
}

export interface DetalleProducto extends ProductoBase {
  esTour: boolean;
  codigosExternos: CodigoExterno[];
  servicios: Servicio[];
  componentes: ComponenteTour[];
}

export interface FilaDirectorio {
  id: string;
  nombre: string;
  mails: string[];
  canal: Canal;
  telefono: string | null;
  aclaraciones: string | null;
  ciudad: string | null;
  cantidadProductos: number;
}

export interface ProductoDelProveedor {
  id: string;
  codigo: string;
  nombre: string;
  rol: "booking_supplier" | "service_provider" | "ambos";
}

export interface DetalleProveedor extends Omit<FilaDirectorio, "cantidadProductos"> {
  productos: ProductoDelProveedor[];
}

export interface Pendiente {
  servicioId: string;
  producto: { id: string; codigo: string; nombre: string };
  servicio: string;
  proveedorNombre: string | null;
  proveedorId: string | null;
  motivo: string;
  filaExcel: number | null;
}
