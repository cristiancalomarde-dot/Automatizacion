import * as XLSX from "xlsx";
import { destinoDeEncabezado, primeraCiudad, ultimaCiudad } from "./ciudades";

/**
 * Lector de los Word de catálogo (spec M1-05 §2, "Itinerarios"): de cada tour
 * saca el título (código, nombre, noches), el itinerario "DAY N: …" y la
 * lista del "What's Included", que trae las estadías ("N nights
 * Accommodation in X") y los buses ("Night Bus from A to B") en orden.
 *
 * Solo lee y normaliza; no decide nada. Lo que no entiende lo deja en
 * `problemas` (o sin destino) y el armado manda el tour a revisión.
 */

export interface DiaItinerario {
  numero: number;
  /** El texto del encabezado después de "DAY N:". */
  titulo: string;
  /** Encabezado + párrafos hasta el día siguiente. */
  texto: string;
}

export type ItemIncluido =
  | { tipo: "estadia"; noches: number; destino: string | null; texto: string }
  | { tipo: "bus"; desde: string | null; hasta: string | null; nocturnoTexto: boolean; texto: string };

export interface ItinerarioWord {
  codigo: string;
  titulo: string;
  nombre: string;
  /** Noches del título ("(8 nights)", o "(7 DAYS)" = 6); null si el título no las dice. */
  noches: number | null;
  dias: DiaItinerario[];
  items: ItemIncluido[];
  problemas: string[];
}

// --- .docx → párrafos ----------------------------------------------------------

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Los párrafos con texto de un `word/document.xml`, en orden. */
export function parrafosDeDocumentXml(xml: string): string[] {
  return xml
    .split(/<\/w:p>/)
    .map((p) =>
      decodificarEntidades(
        (p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""),
      ),
    )
    .filter((t) => t.trim() !== "");
}

/** Los párrafos de un .docx (es un zip: se abre con SheetJS-CFB, como en el loop). */
export function leerParrafosDocx(contenido: Uint8Array): string[] {
  const zip = XLSX.CFB.read(contenido, { type: "buffer" });
  const i = zip.FullPaths.findIndex((p: string) => p.replace(/\\/g, "/").endsWith("word/document.xml"));
  if (i === -1) throw new Error("El .docx no tiene word/document.xml.");
  const archivo = zip.FileIndex[i];
  return parrafosDeDocumentXml(Buffer.from(archivo.content as Uint8Array).toString("utf8"));
}

// --- sección de un tour -------------------------------------------------------------

const CODIGO = /^([A-Z0-9]*[A-Z][A-Z0-9]*\d[A-Z0-9]*|\d[A-Z0-9]*[A-Z][A-Z0-9]*)(?=[\s\-–]|$)/;
const NOCHES_TITULO = [/\(\s*(\d+)\s*nights?\s*\)/i, /[-–]\s*(\d+)\s*nights?\s*$/i];
const DIAS_TITULO = /\(\s*(\d+)\s*days?\s*\)/i;

/** Un párrafo corto que empieza con un código y dice su duración: el título de un tour. */
function esTituloDeTour(parrafo: string): boolean {
  const t = parrafo.trim();
  if (t.length > 160 || !CODIGO.test(t)) return false;
  return NOCHES_TITULO.some((r) => r.test(t)) || DIAS_TITULO.test(t) || /^[A-Z0-9]+\s*[-–]\s+[A-Z ]+$/.test(t);
}

function nochesDelTitulo(titulo: string): number | null {
  for (const r of NOCHES_TITULO) {
    const m = r.exec(titulo);
    if (m) return Number(m[1]);
  }
  const d = DIAS_TITULO.exec(titulo);
  return d ? Number(d[1]) - 1 : null;
}

function nombreDelTitulo(titulo: string, codigo: string): string {
  return titulo
    .trim()
    .slice(codigo.length)
    .replace(/^\s*[-–]?\s*/, "")
    .replace(/\s*\(\s*\d+\s*(nights?|days?)\s*\)\s*$/i, "")
    .replace(/\s*[-–]\s*\d+\s*nights?\s*$/i, "")
    .trim();
}

// --- What's Included ------------------------------------------------------------------

const INCLUIDO = /^\W*(what.s\s+)?included\W*$/i;
const NO_INCLUIDO = /^\W*(what.s\s+)?not\s+included\W*$/i;
const ESTADIA = /^\W*(\d+)\s+nights?\s+(?:accommodation|accomodation)\b(.*)$/i;
const NOCTURNO_INCLUIDO = /\b(night|nigh|overnight|pm)\b/i;

function leerBus(linea: string): ItemIncluido | null {
  // El último "bus … to …" de la línea ("shuttle or bus to X or bus from A to B").
  const partes = [...linea.matchAll(/\bbus(?:es)?\b/gi)];
  for (let k = partes.length - 1; k >= 0; k--) {
    const resto = linea.slice(partes[k].index! + partes[k][0].length);
    const m = /^\s+(?:from\s+)?(.+?)\s+to\s+(.+)$/i.exec(resto);
    if (!m) continue;
    const antes = linea.slice(0, partes[k].index!);
    return {
      tipo: "bus",
      desde: ultimaCiudad(m[1]),
      hasta: primeraCiudad(m[2]),
      nocturnoTexto: NOCTURNO_INCLUIDO.test(antes),
      texto: linea.trim(),
    };
  }
  return null;
}

function leerIncluidos(lineas: string[]): ItemIncluido[] {
  const items: ItemIncluido[] = [];
  let encabezado: string | null = null;
  for (const linea of lineas) {
    const estadia = ESTADIA.exec(linea);
    if (estadia) {
      items.push({
        tipo: "estadia",
        noches: Number(estadia[1]),
        destino: primeraCiudad(estadia[2]) ?? (encabezado ? destinoDeEncabezado(encabezado) : null),
        texto: linea.trim(),
      });
      continue;
    }
    const bus = leerBus(linea);
    if (bus) {
      items.push(bus);
      continue;
    }
    if (/including:?\s*$/i.test(linea.trim())) encabezado = linea;
  }
  return items;
}

// --- itinerario -----------------------------------------------------------------------------

const DIA = /^\s*DAY\s+(\d+)\s*:\s*(.*)$/i;

/**
 * El itinerario de un tour, o null si ningún párrafo es su título. La sección
 * va desde el título hasta el título del tour siguiente.
 */
export function leerItinerario(parrafos: string[], codigo: string): ItinerarioWord | null {
  const inicio = parrafos.findIndex((p) => {
    const t = p.trim();
    const m = CODIGO.exec(t);
    return m !== null && m[1] === codigo && esTituloDeTour(t);
  });
  if (inicio === -1) return null;
  let fin = parrafos.findIndex((p, i) => i > inicio && esTituloDeTour(p));
  if (fin === -1) fin = parrafos.length;
  const seccion = parrafos.slice(inicio + 1, fin);
  const titulo = parrafos[inicio].trim();
  const problemas: string[] = [];

  const dias: DiaItinerario[] = [];
  for (const p of seccion) {
    const m = DIA.exec(p);
    if (m) dias.push({ numero: Number(m[1]), titulo: m[2].trim(), texto: p.trim() });
    else if (dias.length && !INCLUIDO.test(p)) dias[dias.length - 1].texto += `\n${p.trim()}`;
    if (INCLUIDO.test(p)) break;
  }

  const desde = seccion.findIndex((p) => INCLUIDO.test(p));
  let items: ItemIncluido[] = [];
  if (desde === -1) {
    problemas.push("el Word no tiene la lista “Included” de este tour");
  } else {
    let hasta = seccion.findIndex((p, i) => i > desde && NO_INCLUIDO.test(p));
    if (hasta === -1) hasta = seccion.length;
    items = leerIncluidos(seccion.slice(desde + 1, hasta));
  }

  return { codigo, titulo, nombre: nombreDelTitulo(titulo, codigo), noches: nochesDelTitulo(titulo), dias, items, problemas };
}
