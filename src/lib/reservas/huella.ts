import { createHash } from "node:crypto";

/**
 * Huella de un mail (spec M2-01 fila 2): lo que hace que el mismo mail no se
 * guarde dos veces (tampoco si se ve en Inbox y en Spam). Es su Message-ID
 * normalizado; si no tiene, `sha256:` del remitente, la fecha, el asunto y
 * el cuerpo.
 */

export interface DatosHuella {
  messageId?: string | null;
  remitente: string;
  fecha?: Date | string | null;
  asunto?: string | null;
  cuerpo?: string | null;
}

/** El Message-ID sin `<>` ni espacios, en minúscula; null si viene vacío. */
export function normalizarMessageId(messageId: string | null | undefined): string | null {
  if (!messageId) return null;
  const limpio = messageId.trim().replace(/^<+/, "").replace(/>+$/, "").trim().toLowerCase();
  return limpio === "" ? null : limpio;
}

function fechaIso(fecha: Date | string | null | undefined): string {
  if (!fecha) return "";
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return Number.isNaN(d.getTime()) ? String(fecha) : d.toISOString();
}

const normalizarTexto = (texto: string | null | undefined) => (texto ?? "").replace(/\r\n?/g, "\n").trim();

export function huellaDelMail(datos: DatosHuella): string {
  const messageId = normalizarMessageId(datos.messageId);
  if (messageId) return messageId;

  // JSON de un arreglo: los campos no se confunden al concatenarse.
  const contenido = JSON.stringify([
    datos.remitente.trim().toLowerCase(),
    fechaIso(datos.fecha),
    normalizarTexto(datos.asunto),
    normalizarTexto(datos.cuerpo),
  ]);
  return `sha256:${createHash("sha256").update(contenido, "utf8").digest("hex")}`;
}
