/**
 * La configuración del envío de pedidos (spec M3-03 fila 1), leída de
 * variables de entorno (#2: la clave de operations@ vive solo ahí). Recibe el
 * entorno como parámetro: los tests lo arman a mano y nunca leen `.env.local`.
 *
 * - Falta el servidor, el usuario o la clave: no se envía nada y se dice qué
 *   falta en llano (sin abrir ninguna conexión).
 * - Modo prueba por defecto (#4): solo `PEDIDOS_ENVIO_REAL=si` manda a los
 *   proveedores.
 * - Puerto 465 = SSL directo; 587 = STARTTLS obligatorio. Por defecto 465.
 * - La copia en Enviados usa el IMAP de la misma casilla (por defecto el mismo
 *   servidor, puerto 993 con SSL).
 *
 * Ningún mensaje lleva la clave.
 */
import { TEXTOS } from "@/lib/textos";

type Entorno = Record<string, string | undefined>;

export interface ConfigSmtp {
  host: string;
  puerto: number;
  /** SSL desde el primer byte (465). */
  seguro: boolean;
  /** STARTTLS obligatorio (587). */
  starttls: boolean;
  usuario: string;
  clave: string;
}

export interface ConfigImapEnviados {
  host: string;
  puerto: number;
  seguro: boolean;
}

export interface ConfigEnvio {
  smtp: ConfigSmtp;
  imap: ConfigImapEnviados;
  /** La casilla que envía (operations@): el remitente y el usuario del IMAP. */
  remitente: string;
  cc: string[];
  destinoPrueba: string;
  /** Solo con `PEDIDOS_ENVIO_REAL=si`. */
  envioReal: boolean;
}

export type ResultadoConfig = { ok: true; config: ConfigEnvio } | { ok: false; error: string };

export const CC_POR_DEFECTO = "ccalomarde@hitravel.com.ar";
export const DESTINO_PRUEBA_POR_DEFECTO = "ccalomarde@hitravel.com.ar";

const MAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

export const esMail = (m: string): boolean => MAIL.test(m);

function puerto(valor: string | undefined, porDefecto: number): number | null {
  const v = valor?.trim();
  if (!v) return porDefecto;
  if (!/^\d{1,5}$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n < 65_536 ? n : null;
}

/** Un valor sin cargar: vacío o el "<PENDIENTE>" de .env.example. */
function sinCargar(v: string | undefined): boolean {
  return !v || !v.trim() || /^<[^>]*>$/.test(v.trim());
}

export function leerConfigEnvio(entrada: Entorno): ResultadoConfig {
  const T = TEXTOS.pedidos.envio;
  const env: Entorno = Object.fromEntries(
    Object.keys(entrada)
      .filter((k) => k.startsWith("PEDIDOS_"))
      .map((k) => [k, sinCargar(entrada[k]) ? undefined : entrada[k]]),
  );
  const host = env.PEDIDOS_SMTP_HOST?.trim() ?? "";
  const usuario = env.PEDIDOS_SMTP_USER?.trim() ?? "";
  const clave = env.PEDIDOS_SMTP_PASSWORD ?? "";
  if (!host || !usuario || !clave.trim()) return { ok: false, error: T.faltaConfigurar };

  const puertoSmtp = puerto(env.PEDIDOS_SMTP_PORT, 465);
  if (puertoSmtp === null) return { ok: false, error: T.configMal("PEDIDOS_SMTP_PORT") };
  const puertoImap = puerto(env.PEDIDOS_IMAP_PORT, 993);
  if (puertoImap === null) return { ok: false, error: T.configMal("PEDIDOS_IMAP_PORT") };
  if (!esMail(usuario)) return { ok: false, error: T.configMal("PEDIDOS_SMTP_USER") };

  const cc = (env.PEDIDOS_CC ?? "")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
  if (!cc.every(esMail)) return { ok: false, error: T.configMal("PEDIDOS_CC") };

  const destinoPrueba = env.PEDIDOS_DESTINO_PRUEBA?.trim().toLowerCase() || DESTINO_PRUEBA_POR_DEFECTO;
  if (!esMail(destinoPrueba)) return { ok: false, error: T.configMal("PEDIDOS_DESTINO_PRUEBA") };

  return {
    ok: true,
    config: {
      smtp: { host, puerto: puertoSmtp, seguro: puertoSmtp === 465, starttls: puertoSmtp === 587, usuario, clave },
      imap: { host: env.PEDIDOS_IMAP_HOST?.trim() || host, puerto: puertoImap, seguro: puertoImap === 993 },
      remitente: usuario.toLowerCase(),
      cc: cc.length ? cc : [CC_POR_DEFECTO],
      destinoPrueba,
      envioReal: env.PEDIDOS_ENVIO_REAL?.trim().toLowerCase() === "si",
    },
  };
}

const LOCALES = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * Red de seguridad de los tests (M3-03): corriendo con vitest, el correo solo
 * se habla con un servidor local (el SMTP y el IMAP falsos). Nunca con Ferozo.
 */
export function asegurarServidorPermitido(host: string, env: Entorno = process.env): void {
  if ((env.VITEST || env.NODE_ENV === "test") && !LOCALES.has(host.trim().toLowerCase())) {
    throw new Error("En las pruebas automáticas el correo solo se manda a un servidor local.");
  }
}
