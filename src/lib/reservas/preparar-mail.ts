import type { PreciosModelo } from "@/lib/ia/modelos";
import { AGENCIA_DESCONOCIDA, agenciaDelRemitente, type ReglaRemitente } from "./agencias";
import { ESQUEMA_FICHA_IA } from "./esquema-ficha";
import type { AdjuntoEntrada, MailEntrada } from "./tipos";

/** El esquema de salida también entra como tokens de entrada. */
const LARGO_ESQUEMA = JSON.stringify(ESQUEMA_FICHA_IA).length;

/**
 * Antes de gastar en IA (spec M2-02 filas 1-4, 16 y 17; regla #3): de qué
 * agencia es el mail, qué cuerpo y qué adjuntos viajan, si el PDF se puede
 * abrir y cuánto puede costar en el peor caso.
 *
 * - Solo viajan el cuerpo y el PDF de la reserva. Pasaportes, imágenes y
 *   cualquier otro adjunto se anotan por nombre y no se mandan.
 * - Si el mail trae solo HTML (los "new booking" automáticos de Kilroy), se
 *   pasa a texto limpio, con las tablas en renglones "a | b | c".
 * - Del cuerpo se sacan la firma ("-- ") y los mails citados que repiten lo
 *   que ya está arriba.
 */

export const TOPE_POR_MAIL_USD = 0.1;
export const MAX_TOKENS_LECTURA = 4000;
export const MAX_CARACTERES_CUERPO = 30_000;
export const MAX_PAGINAS_PDF = 10;
export const MAX_BYTES_PDF = 5 * 1024 * 1024;
const TOKENS_POR_PAGINA_PDF = 3000;

export const MOTIVOS = {
  remitente: "remitente que no es de una agencia piloto",
  techo: "se agotó el presupuesto de IA del mes",
  grande: "mail demasiado grande",
  pdf: "el PDF de la reserva no se puede abrir",
  sinRespuesta: "la IA no respondió",
  invalida: "la respuesta de la IA no cumple el formato",
  cortada: "la respuesta de la IA se cortó por largo",
} as const;

export type MailParaLeer = Pick<MailEntrada, "remitente" | "asunto" | "fechaMail" | "cuerpoTexto" | "cuerpoHtml" | "adjuntos">;

// --- HTML a texto --------------------------------------------------------------------

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  Uuml: "Ü",
  Ouml: "Ö",
  Auml: "Ä",
  szlig: "ß",
  oslash: "ø",
  Oslash: "Ø",
  aring: "å",
  Aring: "Å",
  aelig: "æ",
  AElig: "Æ",
  ccedil: "ç",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e] ?? m;
  });
}

/** El HTML de un mail como texto: renglones por `<br>`, párrafos y filas; celdas separadas por " | ". */
export function htmlATexto(html: string): string {
  const t = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/(td|th)\s*>\s*(?=<(td|th)\b)/gi, " | ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|tr|table|li|ul|ol|h[1-6]|blockquote|section|article|header|footer)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodificarEntidades(t)
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** El cuerpo en texto: el texto plano si lo hay; si no, el HTML convertido. */
export function cuerpoDelMail(mail: MailParaLeer): string {
  if (mail.cuerpoTexto && mail.cuerpoTexto.trim()) return mail.cuerpoTexto;
  return mail.cuerpoHtml ? htmlATexto(mail.cuerpoHtml) : "";
}

// --- Limpieza de citas y firmas ---------------------------------------------------------

const CABECERA_CITA = /^(de|from|enviado|enviado el|sent|para|to|cc|asunto|subject|fecha|date)\s*:/i;
const INICIO_CITA = /^(de|from)\s*:|^-{2,}\s*(original message|mensaje original)|^on .+ wrote:$|^el .+ escribió:$/i;
const normalizarRenglon = (l: string) => l.replace(/^[>\s]+/, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Saca la firma (todo después de un renglón "-- ") y los mails citados que
 * repiten lo que ya está arriba (80% o más de sus renglones). Un mail citado
 * con información nueva se deja entero.
 */
export function limpiarCuerpo(cuerpo: string): string {
  let renglones = cuerpo.replace(/\r\n?/g, "\n").split("\n");
  const firma = renglones.findIndex((l) => l === "-- " || l === "--");
  if (firma >= 0) renglones = renglones.slice(0, firma);

  // Bloques: el primero y uno nuevo por cada cabecera de mail citado.
  const bloques: string[][] = [[]];
  renglones.forEach((l, i) => {
    const anterior = renglones[i - 1];
    if (INICIO_CITA.test(l.trim()) && (anterior === undefined || !CABECERA_CITA.test(anterior.trim()))) bloques.push([]);
    bloques[bloques.length - 1].push(l);
  });

  const vistos = new Set<string>();
  const salida: string[] = [];
  bloques.forEach((bloque, i) => {
    const contenido = bloque.map(normalizarRenglon).filter((l) => l && !CABECERA_CITA.test(l));
    const repetidos = contenido.filter((l) => vistos.has(l)).length;
    const esCitaRepetida = i > 0 && contenido.length > 0 && repetidos / contenido.length >= 0.8;
    for (const l of bloque) {
      const normal = normalizarRenglon(l);
      // Renglones citados con ">" que ya están arriba: fuera.
      const citadoRepetido = /^\s*>/.test(l) && vistos.has(normal);
      if (!esCitaRepetida && !citadoRepetido) salida.push(l);
      if (normal) vistos.add(normal);
    }
  });

  return salida.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// --- Adjuntos y PDF ---------------------------------------------------------------------

const esPdf = (a: AdjuntoEntrada) => a.tipo.toLowerCase() === "application/pdf" || /\.pdf$/i.test(a.nombre);

/** El PDF de la reserva: un PDF de TourRadar, o uno que se llama "Booking Statement". */
function esPdfDeReserva(a: AdjuntoEntrada, agencia: string): boolean {
  if (!esPdf(a)) return false;
  if (/pass(port|ap)|reisepass/i.test(a.nombre)) return false;
  return agencia === "TourRadar" || /booking\s*statement/i.test(a.nombre);
}

/** Se puede abrir: empieza con %PDF, no está protegido con clave, tiene páginas. */
export function revisarPdf(bytes: Uint8Array | undefined): { ok: true; paginas: number } | { ok: false } {
  if (!bytes || bytes.byteLength < 8) return { ok: false };
  const texto = Buffer.from(bytes).toString("latin1");
  if (!texto.startsWith("%PDF")) return { ok: false };
  if (/\/Encrypt\b/.test(texto)) return { ok: false };
  const paginas = (texto.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;
  return { ok: true, paginas: Math.max(paginas, 1) };
}

export function estimarPeorCaso(opciones: { caracteres: number; paginasPdf: number; precios: PreciosModelo }): number {
  const entrada = opciones.caracteres / 3 + TOKENS_POR_PAGINA_PDF * opciones.paginasPdf;
  return (entrada * opciones.precios.entradaPorMillon + MAX_TOKENS_LECTURA * opciones.precios.salidaPorMillon) / 1_000_000;
}

export interface PdfParaLeer {
  nombre: string;
  base64: string;
  paginas: number;
}

export type MailPreparado =
  | {
      ok: true;
      agencia: string;
      /** El cuerpo que viaja (limpio de firma y citas repetidas). */
      cuerpo: string;
      /** El cuerpo entero en texto, para los controles literales. */
      cuerpoOriginal: string;
      pdfs: PdfParaLeer[];
      adjuntosNoLeidos: string[];
      peorCaso: number;
    }
  | { ok: false; motivo: string };

export function prepararMail(
  mail: MailParaLeer,
  opciones: { agencias?: ReglaRemitente[]; instrucciones: string; precios: PreciosModelo },
): MailPreparado {
  const agencia = agenciaDelRemitente(mail.remitente, opciones.agencias);
  if (agencia === AGENCIA_DESCONOCIDA) return { ok: false, motivo: MOTIVOS.remitente };

  const cuerpoOriginal = cuerpoDelMail(mail);
  const cuerpo = limpiarCuerpo(cuerpoOriginal);
  if (cuerpo.length > MAX_CARACTERES_CUERPO) return { ok: false, motivo: MOTIVOS.grande };

  const pdfs: PdfParaLeer[] = [];
  const adjuntosNoLeidos: string[] = [];
  for (const a of mail.adjuntos ?? []) {
    if (!esPdfDeReserva(a, agencia)) {
      adjuntosNoLeidos.push(a.nombre);
      continue;
    }
    const revision = revisarPdf(a.contenido);
    if (!revision.ok || !a.contenido) return { ok: false, motivo: MOTIVOS.pdf };
    if (a.contenido.byteLength > MAX_BYTES_PDF || revision.paginas > MAX_PAGINAS_PDF) {
      return { ok: false, motivo: MOTIVOS.grande };
    }
    pdfs.push({ nombre: a.nombre, base64: Buffer.from(a.contenido).toString("base64"), paginas: revision.paginas });
  }

  const paginasPdf = pdfs.reduce((s, p) => s + p.paginas, 0);
  if (paginasPdf > MAX_PAGINAS_PDF) return { ok: false, motivo: MOTIVOS.grande };
  const caracteres =
    opciones.instrucciones.length + LARGO_ESQUEMA + cuerpo.length + (mail.asunto ?? "").length + 200;
  const peorCaso = estimarPeorCaso({ caracteres, paginasPdf, precios: opciones.precios });
  if (peorCaso > TOPE_POR_MAIL_USD) return { ok: false, motivo: MOTIVOS.grande };

  return { ok: true, agencia, cuerpo, cuerpoOriginal, pdfs, adjuntosNoLeidos, peorCaso };
}
