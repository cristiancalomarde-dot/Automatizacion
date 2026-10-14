/**
 * Reglas puras de lectura del catálogo y del directorio (spec M1-06). Sin
 * acceso a la base: las pantallas y las consultas las usan para agrupar,
 * contar y decir el estado de cada servicio.
 */
import { TEXTOS } from "@/lib/textos";
import type { ComponenteTour, FilaCatalogo, FilaDirectorio, Servicio } from "./tipos";

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

// === Etiquetas de transfer dentro de un tour (M1-09 #4) ============================

/**
 * Destinos que conservan sus traslados aunque estén en el medio del tour: el
 * transfer va dentro del 105 Premium. Es la misma lista que la regla general
 * de M1-08 (`src/lib/importador-tours/traslados.ts`).
 */
const DESTINOS_CON_TRANSFER = new Set(["IGR", "IGU"]);

export type Lado = "in" | "out";

/**
 * De qué lado queda UN traslado del paquete después de su ajuste en el tour
 * (M1-08): los lados que se piden (`quedan`) y los que el ajuste sacó
 * (`anulados`). Sin sentido conocido no queda ninguno. Lo usan las marcas de
 * la pantalla y los vuelos que pide una reserva (M2-03).
 */
export function ladosDeUnTraslado(s: Servicio): { quedan: Lado[]; anulados: Lado[] } {
  const lados: Lado[] =
    s.sentido === "llegada" ? ["in"] : s.sentido === "salida" ? ["out"] : s.sentido === "ida_y_vuelta" ? ["in", "out"] : [];
  const accion = s.ajusteTour?.accion;
  if (accion === "anular") return { quedan: [], anulados: lados.length ? lados : ["in", "out"] };
  const quedan: Lado[] =
    accion === "solo_llegada"
      ? ["in"]
      : accion === "solo_salida"
        ? ["out"]
        : accion === "invertir"
          ? lados.map((l): Lado => (l === "in" ? "out" : "in"))
          : lados;
  return { quedan, anulados: lados.filter((l) => !quedan.includes(l)) };
}

/** De qué lado queda cada traslado del paquete después de los ajustes del tour, y de cuál se anuló. */
function ladosDeTraslados(servicios: Servicio[]): { conserva: Set<Lado>; anulado: Set<Lado> } {
  const conserva = new Set<Lado>();
  const anulado = new Set<Lado>();
  for (const s of servicios) {
    if (s.tipo !== "traslado") continue;
    const { quedan, anulados } = ladosDeUnTraslado(s);
    for (const l of anulados) anulado.add(l);
    for (const l of quedan) conserva.add(l);
  }
  return { conserva, anulado };
}

interface PasoDelTour {
  componente: ComponenteTour;
  /** Día del tour de afuera en que empieza. */
  dia: number | null;
}

/**
 * Los paquetes de un tour en orden, con los de un tour de adentro (CHB31 en
 * 5C01) desplegados, y los días de los buses del tour (los propios y los de
 * los tours de adentro), en días del tour de afuera.
 */
function desplegar(componentes: ComponenteTour[], serviciosDelTour: Servicio[], desfase: number, pasos: PasoDelTour[], buses: number[]): void {
  for (const s of serviciosDelTour) {
    const dia = s.tipo === "bus" ? diaDeServicioDelTour(s.descripcion) : null;
    if (dia !== null) buses.push(dia + desfase);
  }
  for (const c of componentes) {
    const dia = c.diaDesde !== null ? c.diaDesde + desfase : null;
    if (c.tipo === "tramo_bus" || !c.producto) continue;
    const adentro = c.producto.esTour && c.producto.componentes?.length ? c.producto.componentes : null;
    if (adentro) desplegar(adentro, c.producto.servicios, (dia ?? 1) - 1, pasos, buses);
    else pasos.push({ componente: c, dia });
  }
}

export interface PasoConLlegada extends PasoDelTour {
  /** A este paquete se llega en bus (no hace falta vuelo de llegada). */
  llegaEnBus: boolean;
  /** De este paquete se sale en bus (no hace falta vuelo de salida). */
  saleEnBus: boolean;
}

/**
 * Los paquetes de un tour en orden (los de un tour de adentro desplegados) y
 * si a cada uno se llega o se sale en bus. Se llega en bus a todo paquete que
 * no es el primero y se sale en bus de todo el que no es el último (la regla
 * de M1-08). El primero llega en bus si el tour tiene un bus propio ese día o
 * antes (BOCHI04R); el último sale en bus si el tour tiene un bus propio
 * después de que empieza (la salida de Puerto Natales de ARCH31 y ARCH33).
 * Lo usan las marcas de la pantalla y los vuelos que pide una reserva (M2-03).
 */
export function pasosDelTour(componentes: ComponenteTour[], serviciosDelTour: Servicio[]): PasoConLlegada[] {
  const pasos: PasoDelTour[] = [];
  const buses: number[] = [];
  desplegar(componentes, serviciosDelTour, 0, pasos, buses);
  return pasos.map((paso, i) => ({
    ...paso,
    llegaEnBus: i > 0 || (paso.dia !== null && buses.some((b) => b <= paso.dia!)),
    saleEnBus: i < pasos.length - 1 || (paso.dia !== null && buses.some((b) => b > paso.dia!)),
  }));
}

/**
 * Las marcas "Transfer de llegada / de salida" de cada paquete de un tour,
 * coherentes con lo que se pide de verdad (spec M1-09 §3 #4). Un lado se
 * muestra si el paquete conserva un traslado de ese lado después de los
 * ajustes de M1-08, o si la marca del componente lo pide, no hay ajuste que
 * lo anule y no se llega (o sale) con un bus del tour.
 *
 * Se llega en bus a todo paquete que no es el primero y se sale en bus de
 * todo el que no es el último (la regla de M1-08). El primero llega en bus si
 * el tour tiene un bus propio ese día o antes (BOCHI04R); el último sale en
 * bus si el tour tiene un bus propio después de que empieza (la salida de
 * Puerto Natales de ARCH31 y ARCH33). Iguazú conserva sus marcas.
 *
 * Devuelve componentes nuevos (también los del tour de adentro); no muta.
 */
export function etiquetasTransferEnTour(componentes: ComponenteTour[], serviciosDelTour: Servicio[]): ComponenteTour[] {
  const efectivas = new Map<ComponenteTour, { in: boolean; out: boolean }>();
  for (const { componente: c, llegaEnBus, saleEnBus } of pasosDelTour(componentes, serviciosDelTour)) {
    const producto = c.producto!;
    if (DESTINOS_CON_TRANSFER.has(producto.destino ?? "")) continue;
    const { conserva, anulado } = ladosDeTraslados(producto.servicios);
    efectivas.set(c, {
      in: conserva.has("in") || (c.transferIn && !llegaEnBus && !anulado.has("in")),
      out: conserva.has("out") || (c.transferOut && !saleEnBus && !anulado.has("out")),
    });
  }

  const aplicar = (lista: ComponenteTour[]): ComponenteTour[] =>
    lista.map((c) => {
      const e = efectivas.get(c);
      const adentro = c.producto?.componentes;
      const conAdentro = adentro && c.producto ? { ...c, producto: { ...c.producto, componentes: aplicar(adentro) } } : c;
      return e ? { ...conAdentro, transferIn: e.in, transferOut: e.out } : conAdentro;
    });
  return aplicar(componentes);
}

// === Noches por servicio (M1-07 #8, #9) ============================================

export interface ParteDelPaquete {
  nocheDesde: number;
  noches: number;
  lugar: string | null;
  /** "1 noche en Puerto Natales" / "W Trek Standard, 4 noches en refugios (Las Torres)". */
  etiqueta: string;
  /** Los servicios de esa parte (los alojamientos de todos los niveles van juntos). */
  servicios: Servicio[];
}

/**
 * Un paquete que guarda en qué noches va cada servicio (CH10), en partes
 * ordenadas por noche. Los alojamientos de los distintos niveles que van en
 * las mismas noches forman una sola parte (el pasajero elige uno). Devuelve
 * null si ningún servicio tiene noches: el paquete se muestra como siempre.
 */
export function partesPorNoche(servicios: Servicio[]): { partes: ParteDelPaquete[]; resto: Servicio[] } | null {
  if (!servicios.some((s) => (s.tramosNoches ?? []).length > 0)) return null;
  const partes = new Map<string, ParteDelPaquete>();
  const resto: Servicio[] = [];
  for (const s of [...servicios].sort(porOrdenYPrioridad)) {
    const tramos = s.tramosNoches ?? [];
    if (tramos.length === 0) {
      resto.push(s);
      continue;
    }
    for (const t of tramos) {
      const quien = s.tipo === "alojamiento" ? "alojamiento" : `orden-${s.orden}`;
      const clave = `${t.nocheDesde}|${t.noches}|${t.lugar ?? ""}|${quien}`;
      let parte = partes.get(clave);
      if (!parte) {
        const noches = TEXTOS.producto.nochesEn(TEXTOS.producto.noches(t.noches), t.lugar);
        const proveedor = s.bookingSupplierNombre ?? s.bookingSupplier?.nombre;
        const etiqueta = s.tipo === "alojamiento" ? noches : `${queEs(s)}, ${noches}${proveedor ? ` (${proveedor})` : ""}`;
        parte = { nocheDesde: t.nocheDesde, noches: t.noches, lugar: t.lugar, etiqueta, servicios: [] };
        partes.set(clave, parte);
      }
      parte.servicios.push(s);
    }
  }
  return { partes: [...partes.values()].sort((a, b) => a.nocheDesde - b.nocheDesde), resto };
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
