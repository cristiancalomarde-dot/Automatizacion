import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import type { AliasProveedor } from "./equivalencias";
import type { ServicioLeido, TipoServicio } from "./linea";

/**
 * Emparejado de Service Provider / Booking Supplier (spec M1-04 §3 #6-#7 y
 * M1-04b §3 #3-#4):
 *
 * 1. Nombre exacto contra `proveedor.nombre_normalizado` (M1-03), tras la
 *    normalización estándar (espacios y mayúsculas). Si coincide con más de
 *    un proveedor (mismo nombre en dos destinos) no se elige uno.
 * 2. Si no, la lista de equivalencias que revisó el owner (`proveedor_alias`):
 *    - `confirmado` → resuelve el proveedor;
 *    - `para_revisar` con proveedor → lo asigna, pero el servicio queda con
 *      `proveedor_para_revisar` y la nota del alias;
 *    - `para_revisar` sin proveedor → sin resolver, con la nota.
 * 3. Si tampoco, queda sin resolver con el nombre del Excel.
 *
 * Sin fuzzy-matching ni IA; nunca crea proveedores.
 *
 * `proveedor_sin_resolver` mira el Booking Supplier: es a quien se le pide la
 * reserva (el mail sale a él). Un Service Provider sin emparejar se queda con
 * su nombre de texto y no marca revisión si el Booking Supplier está resuelto
 * (M1-04b §5).
 */

export interface ProveedorExistente {
  id: string;
  nombre_normalizado: string;
}

export interface IndiceProveedores {
  exactos: Map<string, string[]>;
  alias: Map<string, Pick<AliasProveedor, "proveedor_id" | "estado" | "nota">>;
}

export function crearIndiceProveedores(
  proveedores: ProveedorExistente[],
  alias: Array<Pick<AliasProveedor, "alias_normalizado" | "proveedor_id" | "estado" | "nota">> = [],
): IndiceProveedores {
  const exactos = new Map<string, string[]>();
  for (const p of proveedores) {
    const ids = exactos.get(p.nombre_normalizado) ?? [];
    ids.push(p.id);
    exactos.set(p.nombre_normalizado, ids);
  }
  return {
    exactos,
    alias: new Map(alias.map((a) => [a.alias_normalizado, { proveedor_id: a.proveedor_id, estado: a.estado, nota: a.nota }])),
  };
}

export interface Resolucion {
  id: string | null;
  /** Se resolvió (o no) por un alias `para_revisar`. */
  paraRevisar: boolean;
  nota: string | null;
}

export function resolverProveedor(nombre: string | null, indice: IndiceProveedores): Resolucion {
  if (!nombre) return { id: null, paraRevisar: false, nota: null };
  const clave = normalizarNombre(nombre);
  const ids = indice.exactos.get(clave);
  if (ids && ids.length === 1) return { id: ids[0], paraRevisar: false, nota: null };
  const alias = indice.alias.get(clave);
  if (!alias) return { id: null, paraRevisar: false, nota: null };
  const paraRevisar = alias.estado === "para_revisar";
  return { id: alias.proveedor_id, paraRevisar, nota: paraRevisar ? alias.nota : null };
}

/** Una fila de `producto_servicio` (columnas de 0002 + 0004 + 0005), sin `producto_id`. */
export interface FilaServicio {
  /** Posición del servicio dentro del bloque; las opciones "/" comparten `orden`. */
  orden: number;
  prioridad: number;
  tipo_servicio: TipoServicio;
  /** Nivel de alojamiento (Hostel, Hotel 3*…); null en no-alojamientos o si el Excel no lo escribe. */
  nivel: string | null;
  /** Fila del Excel de la línea; los tramos "+" de una misma línea comparten fila (y nivel). */
  fila_excel: number | null;
  descripcion: string;
  service_provider_nombre: string;
  booking_supplier_nombre: string | null;
  service_provider_id: string | null;
  booking_supplier_id: string | null;
  /** El Booking Supplier (a quien se le pide la reserva) no quedó emparejado. */
  proveedor_sin_resolver: boolean;
  /** Se emparejó (o no) con un alias que el owner todavía tiene que confirmar. */
  proveedor_para_revisar: boolean;
  /** Nota del alias para revisar (qué falta confirmar). */
  proveedor_nota: string | null;
}

export function armarFilasServicio(servicios: ServicioLeido[], indice: IndiceProveedores): FilaServicio[] {
  const filas: FilaServicio[] = [];
  servicios.forEach((servicio, i) => {
    for (const opcion of servicio.opciones) {
      const sp = resolverProveedor(opcion.serviceProvider, indice);
      const bs = resolverProveedor(opcion.bookingSupplier, indice);
      const notas = [...new Set([sp.nota, bs.nota].filter((n): n is string => n !== null))];
      filas.push({
        orden: i + 1,
        prioridad: opcion.prioridad,
        tipo_servicio: servicio.tipo,
        nivel: servicio.nivel,
        fila_excel: servicio.fila > 0 ? servicio.fila : null,
        descripcion: servicio.descripcion,
        service_provider_nombre: opcion.serviceProvider,
        booking_supplier_nombre: opcion.bookingSupplier,
        service_provider_id: sp.id,
        booking_supplier_id: bs.id,
        proveedor_sin_resolver: bs.id === null,
        proveedor_para_revisar: sp.paraRevisar || bs.paraRevisar,
        proveedor_nota: notas.length ? notas.join(" | ") : null,
      });
    }
  });
  return filas;
}
