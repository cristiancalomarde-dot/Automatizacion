import { ImapFlow } from "imapflow";
import type { CarpetaListada } from "./carpetas";
import type { ConfigCasilla } from "./config";

/**
 * La casilla sales@ por IMAP, en SOLO LECTURA (spec M2-07 #1, #2, #10, #15).
 *
 * - Cada carpeta se abre con `getMailboxLock(path, { readOnly: true })`, que
 *   manda `EXAMINE` (nunca `SELECT`).
 * - Primero se bajan los sobres (remitente, fecha, asunto, Message-ID): el
 *   cuerpo se pide después y solo para los UID que elige quien llama. imapflow
 *   lo pide con `BODY.PEEK[]`, que no marca el mail como leído.
 * - Nunca se descarga dentro del loop de un fetch: primero se junta la lista
 *   y recién después se pide lo siguiente (un comando nuevo dentro del loop
 *   traba la conexión).
 * - No hay ningún método que marque, mueva, copie, borre o agregue mails.
 * - Los errores salen en llano y sin la clave (#2): "clave" o "no_responde".
 *
 * La corrida (`corrida.ts`) usa la interfaz `Casilla`; los tests pueden darle
 * otra implementación.
 */

export interface SobreMail {
  /** La carpeta real del servidor (ej. "INBOX.spam"). */
  carpeta: string;
  uid: number;
  messageId: string | null;
  /** La dirección del remitente, en minúscula. */
  remitente: string;
  remitenteNombre: string | null;
  asunto: string | null;
  fecha: Date | null;
}

export interface SobresDeCarpeta {
  uidValidity: number;
  sobres: SobreMail[];
}

export interface CasillaAbierta {
  carpetas(): Promise<CarpetaListada[]>;
  /** Los sobres de los mails desde `desde` (fecha interna del servidor). */
  sobres(carpeta: string, desde: Date): Promise<SobresDeCarpeta>;
  /** El mail completo (.eml) de cada UID pedido. */
  fuentes(carpeta: string, uids: readonly number[]): Promise<Map<number, Buffer>>;
  cerrar(): Promise<void>;
}

export type Casilla = () => Promise<CasillaAbierta>;

export type MotivoErrorCasilla = "clave" | "no_responde";

export class ErrorCasilla extends Error {
  constructor(readonly motivo: MotivoErrorCasilla) {
    super(motivo === "clave" ? "la clave de sales@ no es válida" : "la casilla no respondió");
    this.name = "ErrorCasilla";
  }
}

function aErrorCasilla(e: unknown): ErrorCasilla {
  if (e instanceof ErrorCasilla) return e;
  const err = e as { authenticationFailed?: boolean; responseText?: string; serverResponseCode?: string };
  if (err?.authenticationFailed || err?.serverResponseCode === "AUTHENTICATIONFAILED") return new ErrorCasilla("clave");
  return new ErrorCasilla("no_responde");
}

export async function abrirCasillaImap(config: ConfigCasilla & { esperaMs?: number }): Promise<CasillaAbierta> {
  const espera = config.esperaMs ?? 20_000;
  const cliente = new ImapFlow({
    host: config.host,
    port: config.puerto,
    secure: config.seguro,
    auth: { user: config.usuario, pass: config.clave },
    logger: false,
    disableAutoIdle: true,
    disableAutoEnable: true,
    connectionTimeout: espera,
    greetingTimeout: espera,
    socketTimeout: 120_000,
  });
  // Sin esto, un corte de la conexión después de conectar tira un error no atrapado.
  cliente.on("error", () => undefined);
  try {
    await cliente.connect();
  } catch (e) {
    cliente.close();
    throw aErrorCasilla(e);
  }

  const conCarpeta = async <T>(carpeta: string, f: () => Promise<T>): Promise<T> => {
    const candado = await cliente.getMailboxLock(carpeta, { readOnly: true });
    try {
      return await f();
    } finally {
      candado.release();
    }
  };

  return {
    async carpetas() {
      try {
        const lista = await cliente.list({ listOnly: true });
        return lista.map((c) => ({ path: c.path, atributos: [...c.flags] }));
      } catch (e) {
        throw aErrorCasilla(e);
      }
    },

    async sobres(carpeta, desde) {
      try {
        return await conCarpeta(carpeta, async () => {
          const mailbox = cliente.mailbox;
          const uidValidity = mailbox ? Number(mailbox.uidValidity) : 0;
          const uids = (await cliente.search({ since: desde }, { uid: true })) || [];
          const sobres: SobreMail[] = [];
          if (uids.length === 0) return { uidValidity, sobres };
          for await (const m of cliente.fetch(uids, { uid: true, envelope: true, internalDate: true }, { uid: true })) {
            const de = m.envelope?.from?.[0];
            const fecha = m.envelope?.date ? new Date(m.envelope.date) : m.internalDate ? new Date(m.internalDate) : null;
            const interna = m.internalDate ? new Date(m.internalDate) : fecha;
            // SINCE mira solo el día: lo anterior a `desde` queda afuera acá.
            if (interna && interna.getTime() < desde.getTime()) continue;
            sobres.push({
              carpeta,
              uid: m.uid,
              messageId: m.envelope?.messageId?.trim() || null,
              remitente: (de?.address ?? "").trim().toLowerCase(),
              remitenteNombre: de?.name?.trim() || null,
              asunto: m.envelope?.subject?.trim() || null,
              fecha: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null,
            });
          }
          return { uidValidity, sobres };
        });
      } catch (e) {
        throw aErrorCasilla(e);
      }
    },

    async fuentes(carpeta, uids) {
      const salida = new Map<number, Buffer>();
      if (uids.length === 0) return salida;
      try {
        return await conCarpeta(carpeta, async () => {
          for await (const m of cliente.fetch([...uids], { uid: true, source: true }, { uid: true })) {
            if (m.source) salida.set(m.uid, Buffer.from(m.source));
          }
          return salida;
        });
      } catch (e) {
        throw aErrorCasilla(e);
      }
    },

    async cerrar() {
      try {
        await cliente.logout();
      } catch {
        cliente.close();
      }
    },
  };
}
