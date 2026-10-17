/**
 * Las variables de la lectura de sales@ (spec M2-07 #1 y #21, regla #2).
 * El servidor, el usuario y la clave salen SOLO de variables de entorno; si
 * falta alguna no hay configuración y la corrida no intenta conectarse.
 */

type Entorno = Record<string, string | undefined>;

export interface ConfigCasilla {
  host: string;
  usuario: string;
  clave: string;
  puerto: number;
  /** IMAP con SSL. Solo se apaga contra la máquina local (el servidor falso de los tests). */
  seguro: boolean;
}

const LOCALES = new Set(["127.0.0.1", "localhost", "::1"]);

export function configCasilla(env: Entorno = process.env): ConfigCasilla | null {
  const host = env.SALES_IMAP_HOST?.trim();
  const usuario = env.SALES_IMAP_USER?.trim();
  const clave = env.SALES_IMAP_PASSWORD;
  if (!host || !usuario || !clave || !clave.trim()) return null;
  const puerto = Number(env.SALES_IMAP_PORT?.trim() || 993);
  return { host, usuario, clave, puerto: Number.isInteger(puerto) && puerto > 0 ? puerto : 993, seguro: !LOCALES.has(host) };
}

/** La lectura automática corre solo con `LECTURA_SALES_ACTIVA=si` (se carga con el OK del owner). */
export function lecturaActiva(env: Entorno = process.env): boolean {
  return env.LECTURA_SALES_ACTIVA?.trim().toLowerCase() === "si";
}
