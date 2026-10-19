import type { AddressInfo } from "node:net";
import { SMTPServer } from "smtp-server";

/**
 * Servidor SMTP falso para los tests de M3-03 (spec M3-03, anexo técnico):
 * nunca se habla con el correo real. Escucha solo en 127.0.0.1, sin TLS.
 *
 * - Guarda cada mail recibido con su sobre (MAIL FROM / RCPT TO), que es lo
 *   que decide a quién llega de verdad, y el .eml completo.
 * - `rechazar`: direcciones que el servidor rechaza en RCPT TO (550), como
 *   haría uno real con un buzón que no existe.
 * - `demoraMs`: tarda en aceptar cada mail (para los envíos simultáneos).
 * - `apagado`: corta las conexiones nuevas (servidor caído).
 * - La clave se compara, pero no se guarda en ningún registro.
 */
export interface MailRecibido {
  de: string;
  para: string[];
  crudo: Buffer;
}

export interface SmtpFalso {
  puerto: number;
  mensajes: MailRecibido[];
  /** Cuántas veces alguien se autenticó (bien o mal). */
  ingresos: number;
  rechazar: Set<string>;
  demoraMs: number;
  detener(): Promise<void>;
}

export async function crearSmtpFalso(opciones: { usuario: string; clave: string; rechazar?: string[]; demoraMs?: number }): Promise<SmtpFalso> {
  const falso: SmtpFalso = {
    puerto: 0,
    mensajes: [],
    ingresos: 0,
    rechazar: new Set((opciones.rechazar ?? []).map((m) => m.toLowerCase())),
    demoraMs: opciones.demoraMs ?? 0,
    detener: async () => undefined,
  };

  const servidor = new SMTPServer({
    secure: false,
    disabledCommands: ["STARTTLS"],
    allowInsecureAuth: true,
    authMethods: ["PLAIN", "LOGIN"],
    logger: false,
    banner: "SMTP falso de M3-03",
    onAuth(auth, _sesion, listo) {
      falso.ingresos++;
      if (auth.username === opciones.usuario && auth.password === opciones.clave) return listo(null, { user: auth.username });
      const e = Object.assign(new Error("Invalid credentials"), { responseCode: 535 });
      return listo(e);
    },
    onRcptTo(direccion, _sesion, listo) {
      if (falso.rechazar.has(direccion.address.toLowerCase())) {
        return listo(Object.assign(new Error("No such user here"), { responseCode: 550 }));
      }
      return listo();
    },
    onData(flujo, sesion, listo) {
      const partes: Buffer[] = [];
      flujo.on("data", (d: Buffer) => partes.push(d));
      flujo.on("end", () => {
        const guardar = () => {
          falso.mensajes.push({
            de: sesion.envelope.mailFrom ? sesion.envelope.mailFrom.address : "",
            para: sesion.envelope.rcptTo.map((r) => r.address),
            crudo: Buffer.concat(partes),
          });
          listo();
        };
        if (falso.demoraMs > 0) setTimeout(guardar, falso.demoraMs);
        else guardar();
      });
    },
  });
  servidor.on("error", () => undefined);

  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", () => r()));
  falso.puerto = (servidor.server.address() as AddressInfo).port;
  falso.detener = () => new Promise<void>((r) => servidor.close(() => r()));
  return falso;
}
