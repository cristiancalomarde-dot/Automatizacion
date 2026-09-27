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
  /** Fila del Excel (1-based) de donde sale. */
  fila: number;
  opciones: OpcionServicio[];
}

export type LineaClasificada =
  | { clase: "vacia" }
  | { clase: "etiqueta" }
  | { clase: "tarifa" }
  | { clase: "incluye"; texto: string }
  | { clase: "fin_seccion" }
  | { clase: "servicio"; servicios: Array<Omit<ServicioLeido, "fila" | "descripcion">> }
  | { clase: "dudosa"; motivo: string };

const TIPOS: Array<[RegExp, TipoServicio]> = [
  [/^accommodations?$/i, "alojamiento"],
  [/^excursions?$/i, "excursion"],
  [/^transfers?$/i, "traslado"],
  [/^bus(es)?$/i, "bus"],
  [/^cruises?$/i, "crucero"],
  [/^(ferry|ferries)$/i, "otro"],
  [/^car rentals?$/i, "otro"],
  [/^other services?$/i, "otro"],
];

const PREFIJO_SERVICIO =
  /^(accommodations?|excursions?|transfers?|bus(?:es)?|cruises?|ferry|ferries|car rentals?|other services?)\b\s*:?\s*(.*)$/i;
const ETIQUETA = /^(tarifas|net rates|netos usd|agency net)$/i;
const TARIFA = /^(dorm|dbl|sgl|twn|twin|tpl|triple|single|double|matrimonial)\b/i;
const INCLUYE = /^includes?\s*:/i;
const FIN_SECCION = /^paquetes?\b/i;
const BOOKING_SUPPLIER = /\.?\s*booking supplier\b\s*:?\s*/i;
const SEPARADOR_OPCIONES = /\s+\/\s*|\s*\/\s+/;
const SEPARADOR_TRAMOS = /\s*\+\s*/;
const NOCHES = /^(\d+)\s*nights?\b\s*/i;

function tipoDe(prefijo: string): TipoServicio {
  const limpio = prefijo.replace(/\s+/g, " ").trim();
  return TIPOS.find(([re]) => re.test(limpio))?.[1] ?? "otro";
}

function sinPuntoFinal(texto: string): string {
  return limpiarNombre(texto).replace(/[.\s]+$/, "");
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

  const prefijo = PREFIJO_SERVICIO.exec(texto);
  if (!prefijo) return { clase: "dudosa", motivo: "no calza con ningún patrón conocido" };

  const resto = prefijo[2].trim();
  if (!resto) return { clase: "etiqueta" }; // "Excursions", "Accommodation" solos: encabezado
  const tipo = tipoDe(prefijo[1]);

  const partes = resto.split(BOOKING_SUPPLIER);
  if (partes.length > 2) return { clase: "dudosa", motivo: "más de un \"Booking Supplier\"" };

  const tramosSP = partir(partes[0], SEPARADOR_TRAMOS);
  const tramosBS = partes.length === 2 ? partir(partes[1], SEPARADOR_TRAMOS) : null;
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

    const opcionesSP = partir(tramo, SEPARADOR_OPCIONES);
    const tramoBS = tramosBS ? (tramosBS.length === 1 ? tramosBS[0] : tramosBS[i]) : null;
    const opcionesBS = tramoBS !== null ? partir(tramoBS, SEPARADOR_OPCIONES) : null;
    if (opcionesBS && opcionesBS.length !== opcionesSP.length && opcionesBS.length !== 1) {
      return { clase: "dudosa", motivo: "cantidad de opciones \"/\" distinta entre Service Provider y Booking Supplier" };
    }
    if (opcionesSP.some((o) => !o) || opcionesBS?.some((o) => !o)) {
      return { clase: "dudosa", motivo: "nombre de proveedor vacío" };
    }

    servicios.push({
      tipo,
      noches,
      opciones: opcionesSP.map((sp, j) => ({
        prioridad: j + 1,
        serviceProvider: sp,
        bookingSupplier: opcionesBS ? (opcionesBS.length === 1 ? opcionesBS[0] : opcionesBS[j]) : null,
      })),
    });
  }
  return { clase: "servicio", servicios };
}
