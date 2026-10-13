import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { parsearMailDeTexto } from "@/lib/reservas/mail-de-texto";
import type { MailParaLeer } from "@/lib/reservas/preparar-mail";

/**
 * Arma un mail a partir de un archivo, para `probar:lectura` y `eval:lectura`
 * (spec M2-02 fila 24). Acá el mail ya llega armado: leer `.docx` y `.eml`
 * es M2-06.
 *
 * - `.txt` con cabecera (`Remitente:`, `Asunto:`, `Fecha:`, renglón vacío,
 *   cuerpo) → ese mail. Sin cabecera (los textos de `Insumos/Mails/texto/`),
 *   el archivo entero es el cuerpo y el remitente sale de `datos`.
 * - `.html` → el cuerpo en HTML (como los "new booking" de Kilroy).
 * - `.pdf` → un mail con ese PDF adjunto (como los Booking Statement de
 *   TourRadar, que llegan desde system@sent-via.netsuite.com).
 */
export function mailDeArchivo(
  ruta: string,
  datos: { remitente?: string; asunto?: string; cuerpo?: string } = {},
): MailParaLeer {
  const ext = extname(ruta).toLowerCase();
  if (ext === ".pdf") {
    return {
      remitente: datos.remitente ?? "system@sent-via.netsuite.com",
      asunto: datos.asunto ?? basename(ruta, ext),
      cuerpoTexto: datos.cuerpo ?? "",
      adjuntos: [{ nombre: basename(ruta), tipo: "application/pdf", contenido: new Uint8Array(readFileSync(ruta)) }],
    };
  }
  const texto = readFileSync(ruta, "utf-8");
  if (ext === ".html" || ext === ".htm") {
    if (!datos.remitente) throw new Error("Para un .html hace falta --remitente.");
    return { remitente: datos.remitente, asunto: datos.asunto ?? null, cuerpoHtml: texto, adjuntos: [] };
  }
  if (/^﻿?Remitente:/i.test(texto)) {
    const mail = parsearMailDeTexto(texto);
    return { ...mail, remitente: datos.remitente ?? mail.remitente, asunto: datos.asunto ?? mail.asunto };
  }
  if (!datos.remitente) throw new Error(`${basename(ruta)} no tiene cabecera "Remitente:": pasá el remitente.`);
  return { remitente: datos.remitente, asunto: datos.asunto ?? null, cuerpoTexto: texto, adjuntos: [] };
}
