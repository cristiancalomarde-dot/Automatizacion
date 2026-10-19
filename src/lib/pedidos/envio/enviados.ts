import { ImapFlow } from "imapflow";
import { TEXTOS } from "@/lib/textos";
import { asegurarServidorPermitido, type ConfigEnvio } from "./config";

/**
 * La copia de cada pedido en "Enviados" de operations@ (spec M3-03 fila 5),
 * por IMAP con imapflow (el patrón de `lectura-sales/casilla.ts`).
 *
 * - SOLO agrega (`APPEND`): nunca abre una carpeta para escribir, no borra,
 *   no mueve ni marca nada de lo que ya está. El mail nuevo entra como leído
 *   (`\Seen`), como cualquier enviado.
 * - La carpeta: la que el servidor marca como enviados (`\Sent`) o, si no,
 *   la primera que exista de `INBOX.Sent`, `Sent`, `Enviados`, `INBOX.Enviados`,
 *   `Sent Items`, `Sent Messages`. Si no hay ninguna, no se crea: queda el aviso.
 * - Si falla, el pedido igual cuenta como enviado: vuelve el motivo en llano
 *   (sin la clave, #2).
 */

export type ResultadoCopia = { ok: true; carpeta: string } | { ok: false; motivo: string };

export type GuardarEnEnviados = (config: ConfigEnvio, crudos: readonly Buffer[]) => Promise<ResultadoCopia>;

export interface CarpetaParaElegir {
  path: string;
  flags?: Iterable<string>;
  specialUse?: string | null;
}

const NOMBRES = ["INBOX.Sent", "Sent", "Enviados", "INBOX.Enviados", "Sent Items", "Sent Messages", "INBOX/Sent"];

/** La carpeta de enviados de la lista de carpetas; null si no hay ninguna. */
export function carpetaDeEnviados(carpetas: readonly CarpetaParaElegir[]): string | null {
  const marcada = carpetas.find((c) => c.specialUse === "\\Sent" || [...(c.flags ?? [])].some((f) => f.toLowerCase() === "\\sent"));
  if (marcada) return marcada.path;
  for (const nombre of NOMBRES) {
    const c = carpetas.find((x) => x.path.toLowerCase() === nombre.toLowerCase());
    if (c) return c.path;
  }
  return null;
}

export const guardarEnEnviadosImap: GuardarEnEnviados = async (config, crudos) => {
  const T = TEXTOS.pedidos.envio;
  asegurarServidorPermitido(config.imap.host);
  const cliente = new ImapFlow({
    host: config.imap.host,
    port: config.imap.puerto,
    secure: config.imap.seguro,
    auth: { user: config.smtp.usuario, pass: config.smtp.clave },
    logger: false,
    disableAutoIdle: true,
    disableAutoEnable: true,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  // Sin esto, un corte de la conexión después de conectar tira un error no atrapado.
  cliente.on("error", () => undefined);
  try {
    await cliente.connect();
  } catch (e) {
    cliente.close();
    const err = e as { authenticationFailed?: boolean; serverResponseCode?: string };
    return { ok: false, motivo: err?.authenticationFailed || err?.serverResponseCode === "AUTHENTICATIONFAILED" ? T.copiaClave : T.copiaNoResponde };
  }
  try {
    const lista = await cliente.list({ listOnly: true });
    const carpeta = carpetaDeEnviados(lista.map((c) => ({ path: c.path, flags: c.flags, specialUse: c.specialUse })));
    if (!carpeta) return { ok: false, motivo: T.sinCarpetaEnviados };
    for (const crudo of crudos) {
      const r = await cliente.append(carpeta, crudo, ["\\Seen"]);
      if (!r) return { ok: false, motivo: T.copiaNoResponde };
    }
    return { ok: true, carpeta };
  } catch {
    return { ok: false, motivo: T.copiaNoResponde };
  } finally {
    try {
      await cliente.logout();
    } catch {
      cliente.close();
    }
  }
};
