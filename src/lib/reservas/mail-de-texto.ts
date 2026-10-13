import type { MailParaLeer } from "./preparar-mail";

/**
 * Un mail guardado como texto (los de prueba y los de `Insumos/Mails/texto/`):
 * una cabecera con `Remitente:`, `Asunto:` y `Fecha:` (opcionales salvo el
 * remitente), un renglón vacío y el cuerpo.
 */
export function parsearMailDeTexto(texto: string): MailParaLeer {
  const normal = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const corte = normal.indexOf("\n\n");
  const cabecera = corte >= 0 ? normal.slice(0, corte) : normal;
  const cuerpo = corte >= 0 ? normal.slice(corte + 2) : "";
  const campos: Record<string, string> = {};
  for (const renglon of cabecera.split("\n")) {
    const m = /^(Remitente|Asunto|Fecha):\s*(.*)$/i.exec(renglon);
    if (!m) throw new Error(`Cabecera del mail inválida: se esperaba "Remitente:", "Asunto:" o "Fecha:".`);
    campos[m[1].toLowerCase()] = m[2].trim();
  }
  if (!campos.remitente) throw new Error("Al mail le falta el renglón \"Remitente:\".");
  return {
    remitente: campos.remitente,
    asunto: campos.asunto || null,
    fechaMail: campos.fecha || null,
    cuerpoTexto: cuerpo,
    adjuntos: [],
  };
}
