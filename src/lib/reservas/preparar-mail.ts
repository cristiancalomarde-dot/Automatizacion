import type { PreciosModelo } from "@/lib/ia/modelos";
import { AGENCIA_DESCONOCIDA, agenciaDelRemitente, type ReglaRemitente } from "./agencias";
import { ESQUEMA_FICHA_IA } from "./esquema-ficha";
import { htmlATexto } from "./html-a-texto";
import type { AdjuntoEntrada, MailEntrada } from "./tipos";

/** El esquema de salida también entra como tokens de entrada. */
const LARGO_ESQUEMA = JSON.stringify(ESQUEMA_FICHA_IA).length;

/**
 * Antes de gastar en IA (spec M2-02 filas 1-4, 16 y 17; regla #3): de qué
 * agencia es el mail, qué cuerpo y qué adjuntos viajan, si el PDF se puede
 * abrir y cuánto puede costar en el peor caso.
 *
 * - Viajan el cuerpo, el PDF de la reserva y (M3-30) las imágenes del mail:
 *   las pegadas en el cuerpo (`<img src="cid:…">`) en su lugar, marcadas
 *   "[imagen N]", y las adjuntas después. Los íconos de la firma por http no
 *   son imágenes del mail; las chiquitas (logos) y los tipos que la IA no lee
 *   se anotan por nombre, como los demás adjuntos (pasaportes en PDF, etc.).
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

/** M3-30 (#3): hasta cuántas imágenes y cuántos bytes de imágenes se leen por mail. */
export const MAX_IMAGENES = 8;
export const MAX_BYTES_IMAGENES = 5 * 1024 * 1024;
/** Más chica que esto es un logo o un ícono: no se lee. */
export const MIN_BYTES_IMAGEN = 2 * 1024;
const MIN_PIXELES_IMAGEN = 20_000;
/** La IA achica cada imagen a ~1,15 MP: ~1600 tokens como mucho (ancho × alto / 750). */
const MAX_TOKENS_POR_IMAGEN = 1600;
/** Los tipos de imagen que lee la IA. */
export type TipoImagen = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

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

export { htmlATexto } from "./html-a-texto";

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

export function estimarPeorCaso(opciones: {
  caracteres: number;
  paginasPdf: number;
  precios: PreciosModelo;
  /** M3-30: los tokens de las imágenes que viajan. */
  tokensImagenes?: number;
}): number {
  const entrada = opciones.caracteres / 3 + TOKENS_POR_PAGINA_PDF * opciones.paginasPdf + (opciones.tokensImagenes ?? 0);
  return (entrada * opciones.precios.entradaPorMillon + MAX_TOKENS_LECTURA * opciones.precios.salidaPorMillon) / 1_000_000;
}

export interface PdfParaLeer {
  nombre: string;
  base64: string;
  paginas: number;
}

// --- Imágenes (M3-30) -------------------------------------------------------------------

export interface ImagenParaLeer {
  /** La N de la marca "[imagen N]" del cuerpo. */
  numero: number;
  nombre: string;
  tipo: TipoImagen;
  base64: string;
  /** Adjunta (no pegada en el cuerpo): va después del texto, sin lugar en el cuerpo. */
  adjunta: boolean;
  tokens: number;
}

/** El tipo y el tamaño en píxeles, por los primeros bytes (PNG, JPEG, GIF, WebP). */
export function revisarImagen(bytes: Uint8Array): { tipo: TipoImagen; ancho: number | null; alto: number | null } | null {
  const b = bytes;
  const vista = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { tipo: "image/png", ancho: vista.getUint32(16), alto: vista.getUint32(20) };
  }
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { tipo: "image/gif", ancho: vista.getUint16(6, true), alto: vista.getUint16(8, true) };
  }
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { tipo: "image/webp", ancho: null, alto: null };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    // Los marcadores SOF (C0-CF salvo C4, C8 y CC) llevan alto y ancho.
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
        return { tipo: "image/jpeg", alto: vista.getUint16(i + 5), ancho: vista.getUint16(i + 7) };
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) {
        i += m === 0xff ? 1 : 2;
        continue;
      }
      i += 2 + vista.getUint16(i + 2);
    }
    return { tipo: "image/jpeg", ancho: null, alto: null };
  }
  return null;
}

const esImagen = (a: AdjuntoEntrada) => a.tipo.toLowerCase().startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|tiff?|heic)$/i.test(a.nombre);
const normalCid = (cid: string) => {
  let c = cid.trim().replace(/^<|>$/g, "");
  try {
    c = decodeURIComponent(c);
  } catch {
    // un cid con un % suelto queda como vino
  }
  return c.toLowerCase();
};
const ETIQUETA_IMG = /<img\b[^>]*>/gi;
const SRC_CID = /\bsrc\s*=\s*["']?\s*cid:([^"'\s>]+)/i;

interface ImagenCandidata {
  a: AdjuntoEntrada & { contenido: Uint8Array };
  tipo: TipoImagen;
  tokens: number;
}

/**
 * Las imágenes que viajan, numeradas: primero las pegadas en el cuerpo, en el
 * orden del HTML; después las adjuntas. Las que no se leen (sin contenido,
 * chiquitas o de un tipo que la IA no lee) quedan afuera.
 */
function imagenesDelMail(mail: MailParaLeer): { candidatas: ImagenCandidata[]; html: string | null } {
  const candidatas: ImagenCandidata[] = [];
  for (const a of mail.adjuntos ?? []) {
    if (!esImagen(a) || !a.contenido) continue;
    const revision = revisarImagen(a.contenido);
    const pixeles = revision?.ancho && revision.alto ? revision.ancho * revision.alto : null;
    const chiquita = a.contenido.byteLength < MIN_BYTES_IMAGEN || (pixeles !== null && pixeles < MIN_PIXELES_IMAGEN);
    if (!revision || chiquita) continue;
    const tokens = pixeles ? Math.min(MAX_TOKENS_POR_IMAGEN, Math.ceil(pixeles / 750)) : MAX_TOKENS_POR_IMAGEN;
    candidatas.push({ a: a as ImagenCandidata["a"], tipo: revision.tipo, tokens });
  }
  return { candidatas, html: mail.cuerpoHtml ?? null };
}

/** El HTML con cada `<img src="cid:…">` que viaja cambiado por "[imagen N]" (las demás `<img>` se van). */
function ubicarImagenes(html: string, candidatas: ImagenCandidata[]): { html: string; orden: ImagenCandidata[] } {
  const porCid = new Map(candidatas.filter((c) => c.a.cid).map((c) => [normalCid(c.a.cid!), c]));
  const orden: ImagenCandidata[] = [];
  const conMarcas = html.replace(ETIQUETA_IMG, (etiqueta) => {
    const cid = SRC_CID.exec(etiqueta)?.[1];
    const c = cid ? porCid.get(normalCid(cid)) : undefined;
    if (!c) return "";
    if (!orden.includes(c)) orden.push(c);
    return `<br>[imagen ${orden.indexOf(c) + 1}]<br>`;
  });
  return { html: conMarcas, orden };
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
      /** M3-30: las imágenes que viajan, en el orden de sus marcas. */
      imagenes: ImagenParaLeer[];
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

  // M3-30: si el HTML tiene imágenes pegadas que viajan, el cuerpo sale del HTML con sus marcas
  // (el texto plano no dice dónde estaban); si no, como siempre.
  const deImagenes = imagenesDelMail(mail);
  const ubicadas = deImagenes.html ? ubicarImagenes(deImagenes.html, deImagenes.candidatas) : { html: "", orden: [] };
  const cuerpoOriginal = ubicadas.orden.length ? htmlATexto(ubicadas.html) : cuerpoDelMail(mail);
  const cuerpo = limpiarCuerpo(cuerpoOriginal);
  if (cuerpo.length > MAX_CARACTERES_CUERPO) return { ok: false, motivo: MOTIVOS.grande };

  const enOrden = [...ubicadas.orden, ...deImagenes.candidatas.filter((c) => !ubicadas.orden.includes(c))];
  const imagenes: ImagenParaLeer[] = enOrden.map((c, i) => ({
    numero: i + 1,
    nombre: c.a.nombre,
    tipo: c.tipo,
    base64: Buffer.from(c.a.contenido).toString("base64"),
    adjunta: i >= ubicadas.orden.length,
    tokens: c.tokens,
  }));
  const bytesImagenes = enOrden.reduce((s, c) => s + c.a.contenido.byteLength, 0);
  if (imagenes.length > MAX_IMAGENES || bytesImagenes > MAX_BYTES_IMAGENES) return { ok: false, motivo: MOTIVOS.grande };

  const pdfs: PdfParaLeer[] = [];
  const adjuntosNoLeidos: string[] = [];
  for (const a of mail.adjuntos ?? []) {
    if (esImagen(a)) {
      if (!enOrden.some((c) => c.a === a)) adjuntosNoLeidos.push(a.nombre);
      continue;
    }
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
  const tokensImagenes = imagenes.reduce((s, i) => s + i.tokens, 0);
  const peorCaso = estimarPeorCaso({ caracteres, paginasPdf, precios: opciones.precios, tokensImagenes });
  if (peorCaso > TOPE_POR_MAIL_USD) return { ok: false, motivo: MOTIVOS.grande };

  return { ok: true, agencia, cuerpo, cuerpoOriginal, pdfs, imagenes, adjuntosNoLeidos, peorCaso };
}
