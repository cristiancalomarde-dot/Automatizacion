/**
 * Reglas puras de lectura del catálogo y del directorio (spec M1-06). Sin
 * acceso a la base: las pantallas y las consultas las usan para agrupar,
 * contar y decir el estado de cada servicio.
 */
import { TEXTOS } from "@/lib/textos";
import type { FilaCatalogo, FilaDirectorio, Servicio } from "./tipos";

// === Estado de un servicio (#15) ==============================================

export type TipoEstadoServicio = "con_mail" | "whatsapp" | "manual" | "sin_resolver";

export interface EstadoServicio {
  tipo: TipoEstadoServicio;
  /** Explicación para quien lee; en `sin_resolver`, qué falta y dónde se corrige. */
  motivo?: string;
}

const T = TEXTOS.estadoServicio;

/**
 * El estado mira al Booking Supplier: es a quien se le pide la reserva
 * (M1-04b). Un Service Provider sin emparejar no bloquea nada.
 */
export function estadoServicio(servicio: Servicio): EstadoServicio {
  if (servicio.reservaManual) {
    return {
      tipo: "manual",
      motivo: T.manualEn(servicio.bookingSupplierNombre ?? "un sistema propio"),
    };
  }

  const proveedor = servicio.bookingSupplier;

  if (servicio.sinResolver || servicio.paraRevisar || !proveedor) {
    if (servicio.nota) return { tipo: "sin_resolver", motivo: servicio.nota };
    if (servicio.bookingSupplierNombre && !proveedor) {
      return { tipo: "sin_resolver", motivo: T.motivoNoEnDirectorio(servicio.bookingSupplierNombre) };
    }
    if (!proveedor) return { tipo: "sin_resolver", motivo: T.motivoSinProveedor };
  }

  if (proveedor!.mails.length > 0) return { tipo: "con_mail" };
  if (proveedor!.canal === "whatsapp") return { tipo: "whatsapp" };
  return { tipo: "sin_resolver", motivo: T.motivoSinContacto(proveedor!.nombre) };
}

export function esPendiente(servicio: Servicio): boolean {
  return estadoServicio(servicio).tipo === "sin_resolver";
}

// === Agrupamientos (#14) ========================================================

/** Los 4 niveles de precio estándar, en el orden en que se muestran. */
export const NIVELES_ESTANDAR = ["Hostel", "Budget Hotel", "Hotel 3*", "Hotel 4*"] as const;

function porOrdenYPrioridad(a: Servicio, b: Servicio): number {
  return (a.orden ?? Number.MAX_SAFE_INTEGER) - (b.orden ?? Number.MAX_SAFE_INTEGER) || a.prioridad - b.prioridad;
}

export interface GrupoNivel {
  /** `null` = alojamiento cargado sin nivel. */
  nivel: string | null;
  ofrecido: boolean;
  servicios: Servicio[];
}

/**
 * Agrupa los alojamientos por nivel. Si el producto usa alguno de los 4
 * niveles estándar, se muestran los 4 (los vacantes como "no ofrecido"); los
 * niveles propios (Glamping…) van después, y los sin nivel al final.
 */
export function agruparAlojamientoPorNivel(servicios: Servicio[]): GrupoNivel[] {
  const alojamientos = servicios.filter((s) => s.tipo === "alojamiento").sort(porOrdenYPrioridad);
  const porNivel = new Map<string | null, Servicio[]>();
  for (const s of alojamientos) {
    const lista = porNivel.get(s.nivel) ?? [];
    lista.push(s);
    porNivel.set(s.nivel, lista);
  }

  const usaEstandar = NIVELES_ESTANDAR.some((n) => porNivel.has(n));
  const grupos: GrupoNivel[] = [];

  if (usaEstandar) {
    for (const nivel of NIVELES_ESTANDAR) {
      const lista = porNivel.get(nivel) ?? [];
      grupos.push({ nivel, ofrecido: lista.length > 0, servicios: lista });
    }
  }
  for (const [nivel, lista] of porNivel) {
    if (nivel === null || (NIVELES_ESTANDAR as readonly string[]).includes(nivel)) continue;
    grupos.push({ nivel, ofrecido: true, servicios: lista });
  }
  const sinNivel = porNivel.get(null);
  if (sinNivel) grupos.push({ nivel: null, ofrecido: true, servicios: sinNivel });

  return grupos;
}

/** Junta las alternativas ("/" del Excel) de cada servicio: mismo `orden`, por prioridad. */
export function agruparPorOrden(servicios: Servicio[]): Servicio[][] {
  const grupos: Servicio[][] = [];
  for (const s of [...servicios].sort(porOrdenYPrioridad)) {
    const ultimo = grupos.at(-1);
    if (ultimo && s.orden !== null && ultimo[0].orden === s.orden && ultimo[0].nivel === s.nivel) {
      ultimo.push(s);
    } else {
      grupos.push([s]);
    }
  }
  return grupos;
}

/** Ids de proveedores distintos (Service Provider y Booking Supplier) de una lista de servicios. */
export function proveedoresDeServicios(servicios: Servicio[]): Set<string> {
  const ids = new Set<string>();
  for (const s of servicios) {
    if (s.serviceProvider) ids.add(s.serviceProvider.id);
    if (s.bookingSupplier) ids.add(s.bookingSupplier.id);
  }
  return ids;
}

// === Tours (#16) ====================================================================

/**
 * El día de los buses con proveedor de un tour hoy vive solo en la
 * descripción que arma el importador de M1-05 ("sale el día 6 del tour").
 */
export function diaDeServicioDelTour(descripcion: string | null): number | null {
  const encontrado = descripcion?.match(/sale el d[ií]a (\d+) del tour/i);
  return encontrado ? Number(encontrado[1]) : null;
}

export function duracionTour(
  componentes: { diaDesde: number | null; noches: number | null }[],
): number | null {
  let fin: number | null = null;
  for (const c of componentes) {
    if (c.diaDesde === null) continue;
    const dia = c.diaDesde + (c.noches ?? 0);
    fin = fin === null ? dia : Math.max(fin, dia);
  }
  return fin;
}

// === Búsqueda y filtros (#2, #8) =====================================================

export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarCatalogo(filas: FilaCatalogo[], busqueda: string): FilaCatalogo[] {
  const q = normalizarTexto(busqueda);
  if (!q) return filas;
  return filas.filter((f) =>
    [f.codigo, f.nombre, ...f.codigosExternos.flatMap((c) => [c.codigo, c.nombreExterno ?? ""])].some(
      (texto) => normalizarTexto(texto).includes(q),
    ),
  );
}

export function tieneMail(proveedor: { mails: string[] }): boolean {
  return proveedor.mails.length > 0;
}

export function filtrarDirectorio(
  filas: FilaDirectorio[],
  filtro: { soloSinMail: boolean; busqueda: string },
): FilaDirectorio[] {
  const q = normalizarTexto(filtro.busqueda);
  return filas.filter(
    (f) =>
      (!filtro.soloSinMail || !tieneMail(f)) &&
      (!q || [f.nombre, f.ciudad ?? "", ...f.mails].some((t) => normalizarTexto(t).includes(q))),
  );
}

// === Nombre corto de un servicio ======================================================

/**
 * Lo que se pide, en corto: el hotel en los alojamientos; en el resto, la
 * línea del Excel sin el "Booking Supplier: …" ni el prefijo de tipo.
 */
export function queEs(servicio: Servicio): string {
  if (servicio.tipo === "alojamiento" && servicio.serviceProviderNombre) return servicio.serviceProviderNombre;
  const linea = (servicio.descripcion ?? "").split("\n")[0];
  const sinProveedor = linea.split(/\.?\s*Booking Sup+lier/i)[0];
  const sinPrefijo = sinProveedor.replace(/^(Optional\s+)?(Excursion|Excursión|Accommodation|Accomodation)\s*:\s*/i, "");
  return sinPrefijo.trim() || servicio.serviceProviderNombre || "";
}
