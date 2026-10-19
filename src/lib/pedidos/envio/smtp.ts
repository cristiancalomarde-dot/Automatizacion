import nodemailer from "nodemailer";
import { asegurarServidorPermitido, type ConfigSmtp } from "./config";

/**
 * El SMTP de operations@ (spec M3-03, nodemailer). Manda el .eml ya armado
 * con el sobre que se le da: el sobre decide a quién llega, así que en modo
 * prueba lleva solo la casilla de prueba.
 *
 * - 465: SSL directo; 587: STARTTLS obligatorio.
 * - Una conexión por mail (no queda nada abierto).
 * - Los errores salen clasificados y sin la clave (#2): "clave", "no_responde",
 *   "rechazado" (con las direcciones) u "otro".
 *
 * El envío (`enviar.ts`) usa la interfaz `Transporte`; los tests pueden darle otra.
 */

export interface ResultadoSmtp {
  aceptados: string[];
  rechazados: string[];
}

export interface Transporte {
  enviar(m: { sobre: { de: string; para: string[] }; crudo: Buffer }): Promise<ResultadoSmtp>;
  cerrar(): void;
}

export type AbrirTransporte = (smtp: ConfigSmtp) => Transporte;

export type MotivoErrorSmtp = "clave" | "no_responde" | "rechazado" | "otro";

export class ErrorSmtp extends Error {
  constructor(
    readonly motivo: MotivoErrorSmtp,
    readonly direcciones: string[] = [],
  ) {
    super(`envío fallido: ${motivo}`);
    this.name = "ErrorSmtp";
  }

  /** Un error de la casilla (clave o servidor caído): los demás pedidos fallarían igual. */
  get esDeLaCasilla(): boolean {
    return this.motivo === "clave" || this.motivo === "no_responde";
  }
}

const NO_RESPONDE = new Set(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ECONNRESET", "ETLS", "EPROTOCOL", "EGREETING"]);

const direccion = (d: unknown): string => (typeof d === "string" ? d : ((d as { address?: string })?.address ?? "")).toLowerCase();

export function clasificarErrorSmtp(e: unknown): ErrorSmtp {
  if (e instanceof ErrorSmtp) return e;
  const err = e as { code?: string; responseCode?: number; rejected?: unknown[] };
  if (err?.code === "EAUTH" || err?.responseCode === 535) return new ErrorSmtp("clave");
  if (err?.code === "EENVELOPE") return new ErrorSmtp("rechazado", (err.rejected ?? []).map(direccion).filter(Boolean));
  if (err?.code && NO_RESPONDE.has(err.code)) return new ErrorSmtp("no_responde");
  return new ErrorSmtp("otro");
}

export const abrirTransporteSmtp: AbrirTransporte = (smtp) => {
  asegurarServidorPermitido(smtp.host);
  const transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.puerto,
    secure: smtp.seguro,
    requireTLS: smtp.starttls,
    auth: { user: smtp.usuario, pass: smtp.clave },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 45_000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    async enviar({ sobre, crudo }) {
      try {
        const info = await transporte.sendMail({ envelope: { from: sobre.de, to: sobre.para }, raw: crudo });
        return {
          aceptados: (info.accepted ?? []).map(direccion).filter(Boolean),
          rechazados: (info.rejected ?? []).map(direccion).filter(Boolean),
        };
      } catch (e) {
        throw clasificarErrorSmtp(e);
      }
    },
    cerrar() {
      transporte.close();
    },
  };
};
