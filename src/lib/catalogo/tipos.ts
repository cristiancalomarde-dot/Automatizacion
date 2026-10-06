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
  orden: number;
  tipo: "paquete" | "tramo_bus";
  diaDesde: number | null;
  noches: number | null;
  nocturno: boolean | null;
  transferIn: boolean;
  transferOut: boolean;
  descripcionRuta: string | null;
  /** Solo en `paquete`: el producto componente, con sus servicios. */
  producto: (ProductoBase & { esTour: boolean; servicios: Servicio[] }) | null;
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
