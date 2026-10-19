/**
 * El mail de un pedido (spec M3-03 filas 2, 3 y 4), sin red: a quién va (el
 * sobre SMTP), los encabezados y el texto, y el .eml ya armado. El mismo .eml
 * es el que sale por SMTP y el que se guarda en Enviados.
 *
 * - Modo prueba (#4): el sobre y el "Para" llevan SOLO la casilla de prueba,
 *   sin CC; el asunto empieza con "[PRUEBA]" y arriba del texto va para quién
 *   iba. Nunca sale a un proveedor, tenga los destinatarios que tenga.
 * - Envío real: a los mails del proveedor, con el CC, desde operations@.
 * - La firma lleva el nombre de quien aprueba (`textoParaEnviar`, M3-01).
 */
import { randomUUID } from "node:crypto";
import MailComposer from "nodemailer/lib/mail-composer";
import { TEXTOS } from "@/lib/textos";
import { textoParaEnviar } from "../plantilla";
import type { ConfigEnvio } from "./config";

export interface PedidoParaMail {
  asunto: string;
  cuerpo: string;
  firma: string;
  destinatarios: string[];
  proveedores: string[];
}

export interface MailArmado {
  /** Lo que se le dice al servidor SMTP (MAIL FROM / RCPT TO): es lo que decide a quién llega. */
  sobre: { de: string; para: string[] };
  campos: {
    from: { name: string; address: string };
    to: string[];
    cc: string[];
    subject: string;
    text: string;
    messageId: string;
    date: Date;
  };
}

/** Un Message-ID nuevo, del dominio de la casilla que envía. */
export function nuevoMessageId(remitente: string): string {
  const dominio = remitente.split("@")[1] || "hitravel.com.ar";
  return `<${randomUUID()}.pedido@${dominio}>`;
}

export function armarMail(
  pedido: PedidoParaMail,
  o: { nombre: string; config: ConfigEnvio; messageId: string; fecha: Date },
): MailArmado {
  const T = TEXTOS.pedidos.envio;
  if (pedido.destinatarios.length === 0) throw new Error(T.sinMail);
  const texto = textoParaEnviar(pedido, o.nombre);
  const from = { name: T.remitente, address: o.config.remitente };

  if (!o.config.envioReal) {
    const para = [o.config.destinoPrueba];
    const ibaPara = T.ibaPara(pedido.proveedores.join(" y ") || "—", pedido.destinatarios.join(", "));
    return {
      sobre: { de: o.config.remitente, para },
      campos: {
        from,
        to: para,
        cc: [],
        subject: `${T.prefijoPrueba}${pedido.asunto}`,
        text: `${ibaPara}\n\n${texto}\n`,
        messageId: o.messageId,
        date: o.fecha,
      },
    };
  }

  const to = [...new Set(pedido.destinatarios.map((m) => m.trim()).filter(Boolean))];
  const cc = o.config.cc.filter((m) => !to.some((t) => t.toLowerCase() === m.toLowerCase()));
  return {
    sobre: { de: o.config.remitente, para: [...to, ...cc] },
    campos: { from, to, cc, subject: pedido.asunto, text: `${texto}\n`, messageId: o.messageId, date: o.fecha },
  };
}

/** El .eml del mail (el mismo para SMTP y para Enviados). */
export async function componerMail(m: MailArmado): Promise<Buffer> {
  const { cc, ...resto } = m.campos;
  return new MailComposer({ ...resto, ...(cc.length ? { cc } : {}) }).compile().build();
}
