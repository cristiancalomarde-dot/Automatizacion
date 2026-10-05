import { limpiarNombre } from "@/lib/importador-proveedores/nombre";

/**
 * Lectura de UNA celda de la columna de la sección 1 ("Construcción del
 * producto") de un bloque de producto del Excel de paquetes (spec M1-04 §3
 * #2, #5, #6, #9). Solo reglas simples: prefijos y patrones de texto
 * conocidos de la hoja "Readme AI". Lo que no calza queda "dudosa" (para la
 * IA o para revisar) — nunca se adivina.
 *
 * Formato de una línea de servicio, tal como la escribe el owner:
 *   "<Tipo>[:] <Service Provider>. Booking Supplier[:] <Booking Supplier>"
 * - "/" (con espacio al menos de un lado) = opciones en orden de prioridad
 *   de reserva. Una "/" pegada ("3* sup/4") es parte del nombre.
 * - "+" = tramos en secuencia ("2 Nights El Pueblito + 1 night Nacional inn
 *   Foz"): cada tramo es su propio servicio, con su Booking Supplier por
 *   posición.
 * - Niveles de alojamiento (Hostel / Budget Hotel / Hotel 3* / Hotel 4* /
 *   Glamping c/desayuno / c/MAP): cada línea "Accommodation…" es un nivel
 *   alternativo que el pasajero elige al reservar (NO una prioridad "/"). La
 *   etiqueta del nivel se toma solo si la línea la escribe; si no, queda null
 *   (para revisar) — nunca se deduce del nombre del hotel ni de la posición.
 *   Dentro de un nivel, las opciones "/" son la prioridad de reserva.
 * - Un "7" suelto entre dos nombres de hotel ("El Pueblito 7 Botanica") es
 *   una "/" mal tipeada (misma tecla con Shift; indicación del owner,
 *   2026-09-27). Solo en alojamientos, con al menos dos palabras antes y una
 *   palabra con mayúscula después; la corrección queda anotada.
 */

export type TipoServicio = "alojamiento" | "excursion" | "traslado" | "bus" | "crucero" | "otro";

export interface OpcionServicio {
  prioridad: number;
  serviceProvider: string;
  /** `null` = el Excel no lo escribe (no se asume que es el Service Provider). */
  bookingSupplier: string | null;
}

export interface ServicioLeido {
  tipo: TipoServicio;
  /** La línea del Excel tal cual (más su "Includes: …" si lo tiene). */
  descripcion: string;
  noches: number | null;
  /** Nivel de alojamiento (solo tipo "alojamiento"); null = la línea no lo escribe. */
  nivel: string | null;
  /** Fila del Excel (1-based) de donde sale. */
  fila: number;
  opciones: OpcionServicio[];
  /**
   * "Optional Excursion: …" / "Optional: …" (spec M1-04d #6): solo se pide si
   * la reserva lo incluye. Ausente = no es opcional.
   */
  opcional?: true;
}

export type LineaClasificada =
  | { clase: "vacia" }
  | { clase: "etiqueta" }
  | { clase: "tarifa" }
  | { clase: "incluye"; texto: string }
  | { clase: "fin_seccion" }
  | { clase: "nivel_sin_proveedor"; nivel: string }
  | {
      clase: "servicio";
      servicios: Array<Omit<ServicioLeido, "fila" | "descripcion">>;
      /** Correcciones de tipeo aplicadas a la línea (quedan en el reporte de la corrida). */
      correcciones: string[];
    }
  | { clase: "dudosa"; motivo: string };

const TIPOS: Array<[RegExp, TipoServicio]> = [
  [/^accomm?odations?$/i, "alojamiento"],
  [/^excursions?$/i, "excursion"],
  [/^transfers?$/i, "traslado"],
  [/^(public )?bus(es)?$/i, "bus"],
  [/^cruises?$/i, "crucero"],
  [/^(ferry|ferries)$/i, "otro"],
  [/^car rentals?$/i, "otro"],
  [/^other services?$/i, "otro"],
];

const PREFIJO_SERVICIO =
  /^(accomm?odations?|excursions?|transfers?|public bus(?:es)?|bus(?:es)?|cruises?|ferry|ferries|car rentals?|other services?)\b\s*[:.]?\s*(.*)$/i;
/** "Optional Excursion: …" / "Optional: …" (M1-04d #6): el resto se lee como cualquier línea. */
const OPCIONAL = /^optional\b\s*:?\s*/i;
/**
 * "Excursions en Natales", "Excursions in La Paz", "Excursions Aventura":
 * títulos de sección (confirmado por el owner, M1-04d #7). En plural, sin ":"
 * y sin Booking Supplier.
 */
const TITULO_EXCURSIONES = /^excursions\s+[^:]*$/i;
/**
 * Renglones que el owner confirmó que no son servicios (2026-10-03, M1-04d
 * #7): las notas de precios de OD013/OD016 (filas 222, 227 y 232) y las
 * etiquetas de la tabla de tarifas del W Trek (CH10). Se comparan
 * normalizadas (espacios y mayúsculas), sin parecidos.
 */
export const NOTAS_SIN_SERVICIO = [
  "Hosteria HI: 80 DBL y 60 SGL",
  "Rincon 93 Sent 105 Quijote 130",
  "o Kau Yatun o Design o Esplendor o Rochester",
  "Self Guided Tent DBL",
  "Self Guided Refugio",
];
const NOTAS_NORMALIZADAS = new Set(NOTAS_SIN_SERVICIO.map((n) => limpiarNombre(n).toLowerCase()));
/** Títulos de la tabla de costos (incluye los del Excel vigente: "Excursions Net Rates", "Net Prices", "Tarifas W Trek"). */
const ETIQUETA = /^(tarifas( w trek)?|net rates|net prices|netos usd|agency net|excursions? net (rates|prices)|net (rates|prices) excursions?)$/i;
/** Filas de tarifa por habitación ("DBL", "Dorm Alta"; en COMPBO20: "En Dorm a compartir", "Hab SGL"). */
const TARIFA = /^((en|hab)\s+)?(dorm|dbl|sgl|twn|twin|tpl|triple|single|double|matrimonial)\b/i;
const INCLUYE = /^includes?\s*:/i;
const FIN_SECCION = /^paquetes?\b/i;
/**
 * "Booking Supplier", con los typos del Excel vigente que confirmó el owner
 * (M1-04d #5): "Booking Booking Supplier", "Bookind Supplier", "Bookinkg
 * Supplier", "Booking Suplier"; y separadores raros antes ("… / Booking
 * Supplier: X", "…: Booking Supplier: X").
 */
const BOOKING_SUPPLIER = /[\s./:]*\b(?:booking\s+)?book(?:ing|ind|inkg)\s+sup{1,2}lier\b\s*:?\s*/i;
/** Lo que queda antes del "Booking Supplier" no puede nombrar a "Book…": sería un "Booking Supplier" mal escrito. */
const BOOKING_MAL_ESCRITO = /\bbook/i;
/** "c/" pegado (= "con", ej. "c/ trekking y canoa") no separa opciones (M1-04d). */
const SEPARADOR_OPCIONES = /\s+\/\s*|(?<!\b[cC])\/\s+/;
const SEPARADOR_TRAMOS = /\s*\+\s*/;
const NOCHES = /^(\d+)\s*nights?\b\s*/i;
/** "El Pueblito 7 Botanica": dos palabras, un 7 suelto y una palabra con mayúscula. */
const SIETE_POR_BARRA = /(\p{L}[\p{L}.'*]*\s+\p{L}[\p{L}.'*]*)\s+7\s+(?=\p{Lu})/gu;
export const CORRECCION_SIETE = "\"7\" leído como \"/\"";
/** Una celda que es SOLO la etiqueta de un nivel, sin proveedor ("Budget Hotel", "Hostel"). */
const SOLO_NIVEL = /^(hostel|budget hotel|hotel\s*\d\s*\*|glamping)$/i;

/**
 * Etiqueta del nivel de alojamiento, solo si el texto la escribe. Estrellas
 * ambiguas ("3* sup/4") o más de una categoría en la misma línea → null.
 */
export function nivelDeAlojamiento(texto: string): string | null {
  const t = limpiarNombre(texto);
  if (/\bglamping\b/i.test(t)) {
    if (/c\/\s*desay/i.test(t)) return "Glamping c/desayuno";
    if (/c\/\s*map\b/i.test(t)) return "Glamping c/MAP";
    return "Glamping";
  }
  if (/\bbudget\b/i.test(t)) return "Budget Hotel";
  if (/\d\s*\*[^/+]*\/\s*\d\b/.test(t)) return null; // "3* sup/4": ¿3* superior o 4*?
  const estrellas = new Set([...t.matchAll(/(\d)\s*\*/g)].map((m) => m[1]));
  if (estrellas.size > 1) return null;
  if (estrellas.size === 1) return `Hotel ${[...estrellas][0]}*`;
  if (/\bhostel\b/i.test(t)) return "Hostel";
  return null;
}

function tipoDe(prefijo: string): TipoServicio {
  const limpio = prefijo.replace(/\s+/g, " ").trim();
  return TIPOS.find(([re]) => re.test(limpio))?.[1] ?? "otro";
}

function sinPuntoFinal(texto: string): string {
  return limpiarNombre(texto).replace(/^[.:\s]+/, "").replace(/[.:\s]+$/, "");
}

function partir(texto: string, separador: RegExp): string[] {
  return texto.split(separador).map(sinPuntoFinal);
}

export function clasificarLinea(celda: string): LineaClasificada {
  const texto = limpiarNombre(celda ?? "");
  if (!texto) return { clase: "vacia" };
  if (ETIQUETA.test(texto)) return { clase: "etiqueta" };
  if (INCLUYE.test(texto)) return { clase: "incluye", texto };
  if (FIN_SECCION.test(texto)) return { clase: "fin_seccion" };
  if (TARIFA.test(texto)) return { clase: "tarifa" };
  if (NOTAS_NORMALIZADAS.has(texto.toLowerCase())) return { clase: "etiqueta" };

  const opcional = OPCIONAL.test(texto);
  const sinOpcional = opcional ? texto.replace(OPCIONAL, "") : texto;
  const tieneBookingSupplier = BOOKING_SUPPLIER.test(sinOpcional);
  if (!tieneBookingSupplier && TITULO_EXCURSIONES.test(sinOpcional)) return { clase: "etiqueta" };

  const prefijo = PREFIJO_SERVICIO.exec(sinOpcional);
  let tipo: TipoServicio;
  let resto: string;
  if (prefijo) {
    resto = prefijo[2].trim();
    if (!resto) return { clase: "etiqueta" }; // "Excursions", "Accommodation" solos: encabezado
    tipo = tipoDe(prefijo[1]);
  } else if (tieneBookingSupplier) {
    // Sin tipo escrito pero con a quién reservarle ("W Trek Standard. Booking
    // Supplier: Las Torres", "Overland … Booking Supplier: Imperio Inca",
    // "Optional:2nd Night at Fitz Camp…"): servicio "otro", con la línea tal
    // cual (M1-04d).
    resto = sinOpcional;
    tipo = "otro";
  } else {
    if (SOLO_NIVEL.test(texto)) return { clase: "nivel_sin_proveedor", nivel: nivelDeAlojamiento(texto)! };
    return { clase: "dudosa", motivo: "no calza con ningún patrón conocido" };
  }

  const partes = resto.split(BOOKING_SUPPLIER);
  if (partes.length > 2) return { clase: "dudosa", motivo: "más de un \"Booking Supplier\"" };
  if (BOOKING_MAL_ESCRITO.test(partes[0])) return { clase: "dudosa", motivo: "\"Booking Supplier\" mal escrito" };

  const correcciones: string[] = [];
  if (tipo === "alojamiento") {
    const corregido = partes[0].replace(SIETE_POR_BARRA, "$1 / ");
    if (corregido !== partes[0]) {
      partes[0] = corregido;
      correcciones.push(CORRECCION_SIETE);
    }
  }

  const nivel = tipo === "alojamiento" ? nivelDeAlojamiento(partes[0]) : null;
  const tramosBS = partes.length === 2 ? partir(partes[1], SEPARADOR_TRAMOS) : null;
  // Fuera del alojamiento, un "+" con un solo Booking Supplier es parte del
  // nombre de UNA excursión ("Pinguinera + Gaiman", OD025), no dos tramos
  // (M1-04d). Los tramos "+" siguen valiendo en los alojamientos combinados
  // y cuando el Booking Supplier también trae "+".
  const unSoloServicio = tipo !== "alojamiento" && (tramosBS === null || tramosBS.length === 1);
  const tramosSP = unSoloServicio ? [sinPuntoFinal(partes[0])] : partir(partes[0], SEPARADOR_TRAMOS);
  if (tramosBS && tramosBS.length !== tramosSP.length && tramosBS.length !== 1) {
    return { clase: "dudosa", motivo: "cantidad de tramos \"+\" distinta entre Service Provider y Booking Supplier" };
  }

  const servicios: Array<Omit<ServicioLeido, "fila" | "descripcion">> = [];
  for (let i = 0; i < tramosSP.length; i++) {
    let tramo = tramosSP[i];
    let noches: number | null = null;
    const n = NOCHES.exec(tramo);
    if (n) {
      noches = Number(n[1]);
      tramo = tramo.slice(n[0].length);
    }

    let opcionesSP = partir(tramo, SEPARADOR_OPCIONES);
    const tramoBS = tramosBS ? (tramosBS.length === 1 ? tramosBS[0] : tramosBS[i]) : null;
    const opcionesBS = tramoBS !== null ? partir(tramoBS, SEPARADOR_OPCIONES) : null;
    // Un solo servicio y varios Booking Suppliers en orden ("Transfer GIG -
    // Accommodation in Rio. Booking Supplier: Buzios Transfers / Alex"): el
    // mismo servicio se le pide a cada uno, en ese orden de prioridad (M1-04d).
    if (opcionesBS && opcionesSP.length === 1 && opcionesBS.length > 1) {
      opcionesSP = opcionesBS.map(() => opcionesSP[0]);
    }
    if (opcionesBS && opcionesBS.length !== opcionesSP.length && opcionesBS.length !== 1) {
      return { clase: "dudosa", motivo: "cantidad de opciones \"/\" distinta entre Service Provider y Booking Supplier" };
    }
    if (opcionesSP.some((o) => !o) || opcionesBS?.some((o) => !o)) {
      return { clase: "dudosa", motivo: "nombre de proveedor vacío" };
    }

    servicios.push({
      tipo,
      noches,
      nivel,
      ...(opcional ? { opcional: true as const } : {}),
      opciones: opcionesSP.map((sp, j) => ({
        prioridad: j + 1,
        serviceProvider: sp,
        bookingSupplier: opcionesBS ? (opcionesBS.length === 1 ? opcionesBS[0] : opcionesBS[j]) : null,
      })),
    });
  }
  return { clase: "servicio", servicios, correcciones };
}
