import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { simpleParser, type AddressObject } from "mailparser";
import * as XLSX from "xlsx";
import { parrafosDeDocumentXml } from "@/lib/importador-tours/word";
import { AGENCIA_DESCONOCIDA, agenciaDelRemitente, direccionDelRemitente } from "@/lib/reservas/agencias";
import type { AdjuntoEntrada, MailEntrada } from "@/lib/reservas/tipos";

/**
 * Los lectores del modo prueba (spec M2-06 filas 1 y 2): un archivo de
 * `Insumos/` pasa al mismo "mail de entrada" (`MailEntrada`) que va a armar el
 * lector IMAP de M2-07, así el circuito de M2-02 a M2-04 es uno solo.
 *
 * - `.eml`: el mail tal cual (mailparser), con su remitente, asunto, fecha,
 *   cuerpo y adjuntos. Los PDF y las imágenes (M3-30, con su `cid` si están
 *   pegadas en el cuerpo) viajan con su contenido; del resto, solo nombre,
 *   tipo y tamaño.
 * - `.docx`: una copia de Outlook pegada en Word. Solo el texto de
 *   `word/document.xml` (las imágenes no se leen). El remitente, el asunto y la
 *   fecha son los del encabezado ("De: … Asunto: …") cuyo remitente es una
 *   agencia de `data/agencias.csv`; si no hay encabezado, la primera dirección
 *   de agencia que aparece en el texto.
 * - `.pdf` suelto: un Booking Statement de TourRadar, como un mail de
 *   system@sent-via.netsuite.com con ese PDF adjunto. El asunto sale del
 *   nombre del archivo ("Booking Statement N - M - vendorbill"), sin las notas
 *   que el owner agrega al nombre.
 *
 * Idempotencia (fila 7): el Message-ID es la huella del contenido del archivo
 * (`<archivo-<sha256>@modo-prueba.hitravel.local>`). Nunca el Message-ID real
 * del .eml: si no, la lectura real de M2-07 creería que ese mail ya se
 * procesó. Solo lee archivos locales: no toca la casilla (fila 9).
 */

export const EXTENSIONES_MAIL = [".docx", ".pdf", ".eml"] as const;

const esDeMail = (ruta: string) => (EXTENSIONES_MAIL as readonly string[]).includes(extname(ruta).toLowerCase());

/**
 * Los archivos a procesar: un archivo, o los .docx/.pdf/.eml de una carpeta
 * (sin subcarpetas) en orden alfabético. Varias rutas, una detrás de otra.
 */
export function listarArchivos(rutas: string | readonly string[]): string[] {
  const salida: string[] = [];
  for (const ruta of typeof rutas === "string" ? [rutas] : rutas) {
    if (!existsSync(ruta)) throw new Error(`No existe ${ruta}: no se procesó nada.`);
    if (statSync(ruta).isDirectory()) {
      const nombres = readdirSync(ruta)
        .filter((n) => esDeMail(n) && statSync(join(ruta, n)).isFile())
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      salida.push(...nombres.map((n) => join(ruta, n)));
    } else {
      if (!esDeMail(ruta)) throw new Error(`${basename(ruta)}: solo se procesan .docx, .pdf y .eml.`);
      salida.push(ruta);
    }
  }
  return [...new Set(salida)];
}

export function huellaDeArchivo(contenido: Uint8Array): string {
  return createHash("sha256").update(contenido).digest("hex");
}

const messageIdDeArchivo = (contenido: Uint8Array) => `<archivo-${huellaDeArchivo(contenido)}@modo-prueba.hitravel.local>`;

// --- .docx -----------------------------------------------------------------------------

/** El texto de un .docx, renglón por renglón (los saltos de Outlook son `<w:br/>`). Sin imágenes. */
export function textoDelDocx(contenido: Uint8Array): string {
  const zip = XLSX.CFB.read(contenido, { type: "buffer" });
  const i = zip.FullPaths.findIndex((p: string) => p.replace(/\\/g, "/").endsWith("word/document.xml"));
  if (i === -1) throw new Error("El .docx no tiene word/document.xml.");
  const xml = Buffer.from(zip.FileIndex[i].content as Uint8Array).toString("utf8");
  const conSaltos = xml.replace(/<w:br\s*\/>/g, "<w:t>\n</w:t>").replace(/<w:tab\s*\/>/g, "<w:t> </w:t>");
  return parrafosDeDocumentXml(conSaltos).join("\n").replace(/ /g, " ");
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12, ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11,
  dic: 12, january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11,
  december: 12, jan: 1, apr: 4, aug: 8, dec: 12,
};

/**
 * La fecha de un encabezado copiado ("lunes, 12 de octubre de 2026 09:30",
 * "Friday, 9 October 2026 at 4:54 AM", "28 jul 2026, a las 10:39"). Outlook
 * la muestra en la hora de Argentina (-03:00). Null si no se entiende.
 */
export function fechaDeEncabezado(texto: string): string | null {
  const t = texto.toLowerCase();
  const m = /(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\.?\s+(?:de\s+)?(\d{4})/.exec(t);
  if (!m) return null;
  const mes = MESES[m[2].normalize("NFD").replace(/[̀-ͯ]/g, "")];
  if (!mes) return null;
  const hora = /(\d{1,2})[:.](\d{2})\s*(am|pm|a\.\s*m\.|p\.\s*m\.)?/.exec(t.slice(m.index + m[0].length));
  let h = hora ? Number(hora[1]) : 0;
  const min = hora ? Number(hora[2]) : 0;
  const ampm = hora?.[3]?.replace(/[.\s]/g, "");
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  const dos = (n: number) => String(n).padStart(2, "0");
  const fecha = new Date(`${m[3]}-${dos(mes)}-${dos(Number(m[1]))}T${dos(h)}:${dos(min)}:00-03:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

interface EncabezadoCopiado {
  remitente: string;
  direccion: string | null;
  asunto: string | null;
  fecha: string | null;
  destinatarios: string[];
}

const DIRECCION_EN_TEXTO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

function direccionDe(valor: string): string | null {
  const mailto = /\[mailto:([^\]]+)\]/i.exec(valor);
  if (mailto) return direccionDelRemitente(mailto[1]);
  const entre = /<([^<>]+@[^<>]+)>/.exec(valor);
  if (entre) return direccionDelRemitente(entre[1]);
  return direccionDelRemitente((valor.match(DIRECCION_EN_TEXTO) ?? [""])[0]);
}

/** Los encabezados "De: / Enviado: / Para: / Asunto:" (o en inglés) y los "El …, X escribió:". */
export function encabezadosCopiados(texto: string): EncabezadoCopiado[] {
  const lineas = texto.split("\n").map((l) => l.trim());
  const salida: EncabezadoCopiado[] = [];
  lineas.forEach((linea, i) => {
    const de = /^(?:de|from)\s*:\s*(.+)$/i.exec(linea);
    if (de) {
      const enc: EncabezadoCopiado = { remitente: de[1].trim(), direccion: direccionDe(de[1]), asunto: null, fecha: null, destinatarios: [] };
      for (const l of lineas.slice(i + 1, i + 8)) {
        if (/^(?:de|from)\s*:/i.test(l)) break;
        const campo = /^(enviado(?: el)?|sent|date|fecha|para|to|cc|asunto|subject)\s*:\s*(.*)$/i.exec(l);
        if (!campo) continue;
        const nombre = campo[1].toLowerCase();
        if (["asunto", "subject"].includes(nombre)) {
          enc.asunto = campo[2].trim() || null;
          break;
        }
        if (["para", "to"].includes(nombre)) {
          enc.destinatarios = (campo[2].match(DIRECCION_EN_TEXTO) ?? []).map((d) => d.toLowerCase());
        } else if (nombre !== "cc") {
          enc.fecha = fechaDeEncabezado(campo[2]);
        }
      }
      salida.push(enc);
      return;
    }
    const escribio = /^(?:el|on)\s+(.+?),\s*(?:a las\s*)?(.*?)([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)\s*(?:escribió|wrote)\s*:?\s*$/i.exec(linea);
    if (escribio) {
      salida.push({
        remitente: escribio[3],
        direccion: direccionDelRemitente(escribio[3]),
        asunto: null,
        fecha: fechaDeEncabezado(`${escribio[1]} ${escribio[2]}`),
        destinatarios: [],
      });
    }
  });
  return salida;
}

function mailDeDocx(nombre: string, contenido: Uint8Array): MailEntrada {
  const texto = textoDelDocx(contenido);
  const encabezados = encabezadosCopiados(texto);
  const deAgencia = encabezados.find((e) => e.direccion && agenciaDelRemitente(e.direccion) !== AGENCIA_DESCONOCIDA);
  // Sin encabezado de agencia: la primera dirección de agencia que aparece en el texto (fila 3).
  const enTexto = deAgencia
    ? null
    : ((texto.match(DIRECCION_EN_TEXTO) ?? []).map((d) => d.toLowerCase()).find((d) => agenciaDelRemitente(d) !== AGENCIA_DESCONOCIDA) ?? null);
  const elegido = deAgencia ?? encabezados[0] ?? null;
  const remitente = deAgencia?.direccion ?? enTexto ?? elegido?.direccion ?? "";
  const nombreVisible = deAgencia ? deAgencia.remitente.replace(/\[mailto:[^\]]*\]|<[^>]*>/g, "").replace(/\s+en nombre de.*$/i, "").trim() : "";
  return {
    origen: "archivo",
    carpeta: null,
    archivoOrigen: nombre,
    messageId: messageIdDeArchivo(contenido),
    remitente,
    remitenteNombre: nombreVisible && nombreVisible.toLowerCase() !== remitente ? nombreVisible : null,
    destinatarios: elegido?.destinatarios ?? [],
    asunto: elegido?.asunto ?? null,
    fechaMail: elegido?.fecha ?? null,
    cuerpoTexto: texto,
    cuerpoHtml: null,
    adjuntos: [],
    dePrueba: true,
  };
}

// --- .pdf ------------------------------------------------------------------------------

const REMITENTE_STATEMENT = "system@sent-via.netsuite.com";

function mailDePdf(nombre: string, contenido: Uint8Array): MailEntrada {
  const sinExtension = basename(nombre, extname(nombre));
  const statement = /booking statement\s+\d+\s*-\s*\d+\s*-\s*[a-z]+/i.exec(sinExtension);
  const asunto = statement ? statement[0].replace(/\s+/g, " ") : sinExtension.replace(/^\d+#\s*/, "");
  return {
    origen: "archivo",
    carpeta: null,
    archivoOrigen: nombre,
    messageId: messageIdDeArchivo(contenido),
    remitente: REMITENTE_STATEMENT,
    remitenteNombre: "TourRadar Finance",
    destinatarios: [],
    asunto,
    fechaMail: null,
    cuerpoTexto: "",
    cuerpoHtml: null,
    adjuntos: [{ nombre: `${asunto}.pdf`, tipo: "application/pdf", contenido }],
    dePrueba: true,
  };
}

// --- .eml ------------------------------------------------------------------------------

function direcciones(a: AddressObject | AddressObject[] | undefined): string[] {
  const lista = Array.isArray(a) ? a : a ? [a] : [];
  return lista.flatMap((x) => x.value.map((v) => (v.address ?? "").toLowerCase())).filter(Boolean);
}

/**
 * Lo que se lee de un .eml (remitente, asunto, fecha, cuerpo, adjuntos): el
 * mismo parseo para el modo prueba y para la lectura de sales@ (M2-07).
 */
export async function camposDeEml(
  contenido: Uint8Array,
): Promise<Pick<MailEntrada, "remitente" | "remitenteNombre" | "destinatarios" | "asunto" | "fechaMail" | "cuerpoTexto" | "cuerpoHtml" | "adjuntos">> {
  const m = await simpleParser(Buffer.from(contenido), { skipImageLinks: true, skipTextToHtml: true });
  const de = m.from?.value[0];
  const adjuntos: AdjuntoEntrada[] = m.attachments.map((a) => {
    const tipo = (a.contentType ?? "application/octet-stream").toLowerCase();
    const nombreAdjunto = a.filename ?? (tipo === "application/pdf" ? "adjunto.pdf" : "adjunto");
    const esPdf = tipo === "application/pdf" || /\.pdf$/i.test(nombreAdjunto);
    if (esPdf) return { nombre: nombreAdjunto, tipo: "application/pdf", contenido: new Uint8Array(a.content) };
    // M3-30: las imágenes viajan con su contenido y, si están pegadas en el cuerpo, con su Content-ID.
    if (tipo.startsWith("image/")) {
      const cid = a.cid?.trim().replace(/^<|>$/g, "") || null;
      return { nombre: nombreAdjunto, tipo, contenido: new Uint8Array(a.content), cid };
    }
    return { nombre: nombreAdjunto, tipo, tamano: a.size ?? a.content.byteLength };
  });
  return {
    remitente: (de?.address ?? "").toLowerCase(),
    remitenteNombre: de?.name?.trim() || null,
    destinatarios: direcciones(m.to),
    asunto: m.subject?.trim() || null,
    fechaMail: m.date ? m.date.toISOString() : null,
    cuerpoTexto: m.text ?? null,
    cuerpoHtml: typeof m.html === "string" ? m.html : null,
    adjuntos,
  };
}

async function mailDeEml(nombre: string, contenido: Uint8Array): Promise<MailEntrada> {
  return {
    origen: "archivo",
    carpeta: null,
    archivoOrigen: nombre,
    messageId: messageIdDeArchivo(contenido),
    ...(await camposDeEml(contenido)),
    dePrueba: true,
  };
}

/** Lee un archivo de mail (.eml, .docx o .pdf) y lo devuelve como mail de entrada, marcado de prueba. */
export async function leerArchivoDeMail(ruta: string): Promise<MailEntrada> {
  const nombre = basename(ruta);
  const contenido = new Uint8Array(readFileSync(ruta));
  const ext = extname(ruta).toLowerCase();
  if (ext === ".eml") return mailDeEml(nombre, contenido);
  if (ext === ".docx") return mailDeDocx(nombre, contenido);
  if (ext === ".pdf") return mailDePdf(nombre, contenido);
  throw new Error(`${nombre}: solo se procesan .docx, .pdf y .eml.`);
}
