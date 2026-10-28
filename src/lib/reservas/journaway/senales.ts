import { leerCsv } from "@/lib/importador-productos/csv";
import { limpiarNombreJournaway } from "@/lib/importador-journaway/nombres";
import type { CatalogoParaEmparejar } from "../emparejar/catalogo";

/**
 * Las señales de Journaway (spec M2-09 #3, #6 y #7), en
 * `data/journaway-senales.csv`, editable por el owner: columnas senal,
 * texto, codigos (separados por espacio), dia y nota.
 *
 * - `hotel_tayka`: un tour con pick up en ese hotel es el Overland de Imperio Inca.
 * - `dia_overland`: el nombre con que Journaway escribe cada día del Overland (`dia` 1, 2, 3).
 * - `familia_tayka`: el título que indica la familia Tayka y sus paquetes (SPAP05 SPAP06).
 * - `titulo_noches`: el título con N/D que nombra un paquete ("Tayka Hotels 7N/8D" → SPAP05).
 * - `aeropuerto`: por dónde llegan y salen esos paquetes (CJC): fecha los traslados y cuenta las noches.
 * - `nota_tour`: una nota para la reserva cuando el tour dice ese texto y es ese producto.
 * - `parte_de` (M3-30): un renglón del mail cuyo nombre dice ese texto es parte de ese producto
 *   (los hoteles Tayka y el bus nocturno Uyuni - La Paz son parte del Overland): no se pide aparte.
 *
 * Solo lee y valida. Un código que no está en el catálogo frena con un
 * mensaje claro antes de procesar el mail (`verificarSenales`).
 */

export const ARCHIVO_SENALES_JOURNAWAY = "journaway-senales.csv";
const RUTA = `data/${ARCHIVO_SENALES_JOURNAWAY}`;

const SENALES = ["hotel_tayka", "dia_overland", "familia_tayka", "titulo_noches", "aeropuerto", "nota_tour", "parte_de"] as const;
type Senal = (typeof SENALES)[number];

export interface SenalesJournaway {
  /** Normalizados (sin acentos, en minúscula). */
  hotelesTayka: string[];
  diasOverland: Array<{ dia: number; limpio: string; codigo: string }>;
  familiaTayka: { claves: string[]; codigos: string[] };
  /** `clave`: el texto compacto (sin espacios, barras ni acentos) para buscarlo en el título. */
  titulos: Array<{ clave: string; texto: string; codigo: string }>;
  aeropuertos: Array<{ iata: string; paquetes: string[] }>;
  notas: Array<{ clave: string; codigo: string; nota: string }>;
  /** M3-30: `clave` normalizada (sin acentos, en minúscula). */
  partesDe: Array<{ clave: string; codigo: string }>;
  /** Fila del CSV de cada código, para el mensaje de error. */
  filas: Array<{ fila: number; codigos: string[] }>;
}

/** Sin acentos ni mayúsculas. */
export function normal(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Para buscar un texto dentro de un título: sin espacios, barras, guiones ni acentos ("7N/8D" = "7n8d"). */
export function compacto(texto: string): string {
  return normal(texto).replace(/[^a-z0-9+&]/g, "");
}

export function leerSenalesJournaway(texto: string): SenalesJournaway {
  const s: SenalesJournaway = {
    hotelesTayka: [],
    diasOverland: [],
    familiaTayka: { claves: [], codigos: [] },
    titulos: [],
    aeropuertos: [],
    notas: [],
    partesDe: [],
    filas: [],
  };
  leerCsv(texto).forEach((r, i) => {
    const fila = i + 2;
    const senal = (r.senal ?? "").trim() as Senal;
    const valor = (r.texto ?? "").replace(/\s+/g, " ").trim();
    const codigos = (r.codigos ?? "").split(/\s+/).filter(Boolean);
    const error = (que: string) => new Error(`${RUTA}, fila ${fila}: ${que}. No se procesó el mail.`);
    if (!SENALES.includes(senal)) throw error(`señal «${r.senal ?? ""}» desconocida (usar ${SENALES.join(" | ")})`);
    if (!valor) throw error("falta el texto");
    const unCodigo = () => {
      if (codigos.length !== 1) throw error("va un solo código");
      return codigos[0];
    };
    s.filas.push({ fila, codigos });
    switch (senal) {
      case "hotel_tayka":
        s.hotelesTayka.push(normal(valor));
        break;
      case "dia_overland": {
        const dia = Number((r.dia ?? "").trim());
        if (!Number.isInteger(dia) || dia < 1) throw error("falta el día del Overland (1, 2 o 3)");
        s.diasOverland.push({ dia, limpio: limpiarNombreJournaway(valor), codigo: unCodigo() });
        break;
      }
      case "familia_tayka":
        if (codigos.length === 0) throw error("faltan los códigos de la familia");
        s.familiaTayka.claves.push(compacto(valor));
        s.familiaTayka.codigos = [...new Set([...s.familiaTayka.codigos, ...codigos])];
        break;
      case "titulo_noches":
        s.titulos.push({ clave: compacto(valor), texto: valor, codigo: unCodigo() });
        break;
      case "aeropuerto":
        if (!/^[A-Za-z]{3}$/.test(valor)) throw error("el aeropuerto va con su código de 3 letras (CJC)");
        if (codigos.length === 0) throw error("faltan los paquetes que usan ese aeropuerto");
        s.aeropuertos.push({ iata: valor.toUpperCase(), paquetes: codigos });
        break;
      case "nota_tour":
        if (!(r.nota ?? "").trim()) throw error("falta la nota");
        s.notas.push({ clave: normal(valor), codigo: unCodigo(), nota: (r.nota ?? "").trim() });
        break;
      case "parte_de":
        s.partesDe.push({ clave: normal(valor), codigo: unCodigo() });
        break;
    }
  });
  return s;
}

/** Todos los códigos de las señales están en el catálogo; si no, frena con la fila. */
export function verificarSenales(s: SenalesJournaway, catalogo: CatalogoParaEmparejar): void {
  const existe = new Set(catalogo.productos.map((p) => p.codigo));
  for (const { fila, codigos } of s.filas) {
    const falta = codigos.find((c) => !existe.has(c));
    if (falta) throw new Error(`${RUTA}, fila ${fila}: el código ${falta} no está en el catálogo. No se procesó el mail.`);
  }
}
