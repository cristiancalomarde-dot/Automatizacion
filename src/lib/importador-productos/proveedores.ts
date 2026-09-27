import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import type { ServicioLeido, TipoServicio } from "./linea";

/**
 * Emparejado de Service Provider / Booking Supplier contra
 * `proveedor.nombre_normalizado` (cargado en M1-03), spec M1-04 §3 #6-#7.
 *
 * - Solo match exacto tras la normalización estándar de M1-03 (espacios y
 *   mayúsculas). Sin fuzzy-matching (Anexo técnico de la spec).
 * - Si el nombre coincide con más de un proveedor (mismo nombre en dos
 *   destinos) tampoco se elige uno: queda "sin resolver".
 * - Nunca crea proveedores: devuelve ids existentes o `null`.
 */

export interface ProveedorExistente {
  id: string;
  nombre_normalizado: string;
}

export type IndiceProveedores = Map<string, string[]>;

export function crearIndiceProveedores(proveedores: ProveedorExistente[]): IndiceProveedores {
  const indice: IndiceProveedores = new Map();
  for (const p of proveedores) {
    const ids = indice.get(p.nombre_normalizado) ?? [];
    ids.push(p.id);
    indice.set(p.nombre_normalizado, ids);
  }
  return indice;
}

export function resolverProveedor(nombre: string | null, indice: IndiceProveedores): string | null {
  if (!nombre) return null;
  const ids = indice.get(normalizarNombre(nombre));
  return ids && ids.length === 1 ? ids[0] : null;
}

/** Una fila de `producto_servicio` (columnas de 0002 + 0004), sin `producto_id`. */
export interface FilaServicio {
  /** Posición del servicio dentro del bloque; las opciones "/" comparten `orden`. */
  orden: number;
  prioridad: number;
  tipo_servicio: TipoServicio;
  descripcion: string;
  service_provider_nombre: string;
  booking_supplier_nombre: string | null;
  service_provider_id: string | null;
  booking_supplier_id: string | null;
  proveedor_sin_resolver: boolean;
}

export function armarFilasServicio(servicios: ServicioLeido[], indice: IndiceProveedores): FilaServicio[] {
  const filas: FilaServicio[] = [];
  servicios.forEach((servicio, i) => {
    for (const opcion of servicio.opciones) {
      const spId = resolverProveedor(opcion.serviceProvider, indice);
      const bsId = resolverProveedor(opcion.bookingSupplier, indice);
      filas.push({
        orden: i + 1,
        prioridad: opcion.prioridad,
        tipo_servicio: servicio.tipo,
        descripcion: servicio.descripcion,
        service_provider_nombre: opcion.serviceProvider,
        booking_supplier_nombre: opcion.bookingSupplier,
        service_provider_id: spId,
        booking_supplier_id: bsId,
        proveedor_sin_resolver: spId === null || bsId === null,
      });
    }
  });
  return filas;
}
