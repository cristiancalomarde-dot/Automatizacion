import { normalizarNombre } from "@/lib/importador-proveedores/nombre";
import { elegirPorDestino, type CandidatoProveedor } from "./destinos";
import type { AliasProveedor, ModoAlias } from "./equivalencias";
import type { ServicioLeido, TipoServicio } from "./linea";

/**
 * Emparejado de Service Provider / Booking Supplier (spec M1-04 §3 #6-#7,
 * M1-04b §3 #3-#4 y M1-04d §3 #2-#4):
 *
 * 1. Nombre exacto contra `proveedor.nombre_normalizado` (M1-03), tras la
 *    normalización estándar (espacios y mayúsculas). Si coincide con más de
 *    un proveedor (mismo nombre en dos ciudades), con el destino del paquete
 *    se elige el de esa ciudad (`elegirPorDestino`); sin destino, o si igual
 *    no queda uno, no se elige ninguno.
 * 2. Si no, la lista de equivalencias que revisó el owner (`proveedor_alias`),
 *    la del destino del paquete (M1-04d; un alias sin destino vale para todos):
 *    - modo `alias`:
 *      - `confirmado` → resuelve el proveedor;
 *      - `para_revisar` con proveedor → lo asigna, pero el servicio queda con
 *        `proveedor_para_revisar` y la nota del alias;
 *      - `para_revisar` sin proveedor → sin resolver, con la nota.
 *    - modo `por_service_provider` (Tremun, Dazzler: grupos sin central): el
 *      proveedor sale del nombre del hotel (Service Provider), buscando las
 *      equivalencias `alias` del mismo destino cuyo nombre esté escrito,
 *      como palabras enteras, en el del hotel ("Holtel 3* Rincon del
 *      Calafate" → "Rincon del Calafate"). Si no hay ninguna, o hay dos que
 *      llevan a proveedores distintos, esa opción queda sin resolver.
 *    - modo `manual` (Kupos.cl): no se le escribe a nadie; el servicio queda
 *      `reserva_manual`, sin proveedor y sin bandera de revisión.
 * 3. Si tampoco, queda sin resolver con el nombre del Excel.
 *
 * Sin fuzzy-matching ni IA; nunca crea proveedores.
 *
 * `proveedor_sin_resolver` mira el Booking Supplier: es a quien se le pide la
 * reserva (el mail sale a él). Un Service Provider sin emparejar se queda con
 * su nombre de texto y no marca revisión si el Booking Supplier está resuelto
 * (M1-04b §5).
 */

export interface ProveedorExistente extends CandidatoProveedor {
  nombre_normalizado: string;
}

type AliasIndice = Pick<AliasProveedor, "alias_normalizado" | "proveedor_id" | "estado" | "nota"> & {
  /** Destino del alias (M1-04d); ausente = vale para todos los destinos. */
  destino?: string | null;
  /** Ausente = `alias`. */
  modo?: ModoAlias;
};

export interface IndiceProveedores {
  /** Nombre normalizado → ids (todos los que tienen ese nombre). */
  exactos: Map<string, string[]>;
  /** Nombre normalizado → proveedores (con ciudad y contacto, para desempatar). */
  porNombre: Map<string, ProveedorExistente[]>;
  /** `${destino}|${alias_normalizado}` (o `*|…` si el alias no tiene destino). */
  alias: Map<string, Required<Pick<AliasIndice, "proveedor_id" | "estado" | "nota" | "modo">>>;
  /** Equivalencias modo `alias` por destino, para resolver por el hotel. */
  aliasPorDestino: Map<string, Array<{ palabras: string; proveedor_id: string | null; estado: AliasIndice["estado"]; nota: string | null }>>;
}

const TODOS = "*";

/** Para comparar palabras enteras: sin acentos, minúsculas, solo letras y números. */
function palabras(texto: string): string {
  return ` ${texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

export function crearIndiceProveedores(proveedores: ProveedorExistente[], alias: AliasIndice[] = []): IndiceProveedores {
  const exactos = new Map<string, string[]>();
  const porNombre = new Map<string, ProveedorExistente[]>();
  for (const p of proveedores) {
    exactos.set(p.nombre_normalizado, [...(exactos.get(p.nombre_normalizado) ?? []), p.id]);
    porNombre.set(p.nombre_normalizado, [...(porNombre.get(p.nombre_normalizado) ?? []), p]);
  }
  const mapa: IndiceProveedores["alias"] = new Map();
  const aliasPorDestino: IndiceProveedores["aliasPorDestino"] = new Map();
  for (const a of alias) {
    const destino = a.destino ?? TODOS;
    const modo = a.modo ?? "alias";
    mapa.set(`${destino}|${a.alias_normalizado}`, { proveedor_id: a.proveedor_id, estado: a.estado, nota: a.nota, modo });
    if (modo === "alias") {
      aliasPorDestino.set(destino, [
        ...(aliasPorDestino.get(destino) ?? []),
        { palabras: palabras(a.alias_normalizado), proveedor_id: a.proveedor_id, estado: a.estado, nota: a.nota },
      ]);
    }
  }
  return { exactos, porNombre, alias: mapa, aliasPorDestino };
}

/** La equivalencia de un nombre para un destino: la del destino, o una sin destino. */
export function buscarAlias(indice: IndiceProveedores, nombre: string, destino?: string | null) {
  const clave = normalizarNombre(nombre);
  return (destino ? indice.alias.get(`${destino}|${clave}`) : undefined) ?? indice.alias.get(`${TODOS}|${clave}`);
}

export interface Resolucion {
  id: string | null;
  /** Se resolvió (o no) por un alias `para_revisar`. */
  paraRevisar: boolean;
  nota: string | null;
  /** Modo `manual` (Kupos.cl): no se le escribe a ningún proveedor. */
  manual?: boolean;
}

function porServiceProvider(
  bookingSupplier: string,
  serviceProvider: string | null,
  indice: IndiceProveedores,
  destino: string | null | undefined,
): Resolucion {
  const hotel = palabras(serviceProvider ?? "");
  const candidatos = [...(indice.aliasPorDestino.get(destino ?? TODOS) ?? []), ...(destino ? (indice.aliasPorDestino.get(TODOS) ?? []) : [])]
    .filter((a) => a.proveedor_id !== null && a.palabras.trim() !== "" && hotel.includes(a.palabras));
  const ids = [...new Set(candidatos.map((a) => a.proveedor_id))];
  if (ids.length === 1) {
    const paraRevisar = candidatos.some((a) => a.estado === "para_revisar");
    const notas = candidatos.filter((a) => a.estado === "para_revisar" && a.nota).map((a) => a.nota as string);
    return { id: ids[0], paraRevisar, nota: paraRevisar && notas.length ? notas.join(" | ") : null };
  }
  const motivo =
    ids.length === 0
      ? `"${bookingSupplier}" se reserva hotel por hotel y "${serviceProvider ?? ""}" no tiene equivalencia en ${destino ?? "este destino"}`
      : `"${bookingSupplier}" se reserva hotel por hotel y "${serviceProvider ?? ""}" calza con más de una equivalencia`;
  return { id: null, paraRevisar: false, nota: motivo };
}

export function resolverProveedor(
  nombre: string | null,
  indice: IndiceProveedores,
  contexto: { destino?: string | null; serviceProvider?: string | null } = {},
): Resolucion {
  if (!nombre) return { id: null, paraRevisar: false, nota: null };
  const clave = normalizarNombre(nombre);
  const mismos = indice.porNombre.get(clave) ?? [];
  if (mismos.length === 1) return { id: mismos[0].id, paraRevisar: false, nota: null };
  if (mismos.length > 1) {
    const { elegido } = elegirPorDestino(mismos, contexto.destino);
    if (elegido) return { id: elegido.id, paraRevisar: false, nota: null };
  }
  const alias = buscarAlias(indice, nombre, contexto.destino);
  if (!alias) return { id: null, paraRevisar: false, nota: null };
  if (alias.modo === "manual") return { id: null, paraRevisar: false, nota: null, manual: true };
  if (alias.modo === "por_service_provider") {
    return porServiceProvider(nombre, contexto.serviceProvider ?? null, indice, contexto.destino);
  }
  const paraRevisar = alias.estado === "para_revisar";
  return { id: alias.proveedor_id, paraRevisar, nota: paraRevisar ? alias.nota : null };
}

/** Una fila de `producto_servicio` (columnas de 0002 + 0004 + 0005 + 0006), sin `producto_id`. */
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
  /** "Optional …": solo se pide si la reserva lo incluye (M1-04d). */
  opcional: boolean;
  /** Se gestiona a mano, fuera de la app (ej. pasajes en Kupos.cl, M1-04d). */
  reserva_manual: boolean;
}

export function armarFilasServicio(
  servicios: ServicioLeido[],
  indice: IndiceProveedores,
  destino?: string | null,
): FilaServicio[] {
  const filas: FilaServicio[] = [];
  servicios.forEach((servicio, i) => {
    for (const opcion of servicio.opciones) {
      const sp = resolverProveedor(opcion.serviceProvider, indice, { destino });
      const bs = resolverProveedor(opcion.bookingSupplier, indice, { destino, serviceProvider: opcion.serviceProvider });
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
        proveedor_sin_resolver: bs.id === null && !bs.manual,
        proveedor_para_revisar: sp.paraRevisar || bs.paraRevisar,
        proveedor_nota: notas.length ? notas.join(" | ") : null,
        opcional: servicio.opcional === true,
        reserva_manual: bs.manual === true,
      });
    }
  });
  return filas;
}
