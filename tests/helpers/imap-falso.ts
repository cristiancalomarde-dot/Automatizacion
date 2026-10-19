import { createServer, type AddressInfo, type Server, type Socket } from "node:net";

/**
 * Servidor IMAP falso para los tests de M2-07 (spec M2-07, anexo técnico).
 *
 * Atiende solo el subconjunto que usa imapflow para leer: CAPABILITY, LOGIN,
 * NAMESPACE (no lo anuncia: imapflow cae a `LIST "" ""`), LIST, EXAMINE,
 * UID SEARCH, UID FETCH, NOOP y LOGOUT. Todo lo demás (SELECT, STORE, COPY,
 * MOVE, EXPUNGE, APPEND, CREATE, DELETE, RENAME…) se rechaza con BAD y queda
 * en el registro de comandos, que es la prueba del criterio #15.
 *
 * - `BODY[]` sin PEEK marca el mail como leído (como un servidor real): si
 *   alguna vez se pidiera así, la marca `\Seen` lo delataría.
 * - El LOGIN se registra sin la contraseña (`LOGIN "usuario" ***`).
 * - Sin TLS: solo escucha en 127.0.0.1.
 * - M3-03: con `permitirAppend`, APPEND agrega el mail a la carpeta (la copia
 *   en Enviados de operations@). Sin esa opción se rechaza como siempre.
 */

export interface MensajeFalso {
  uid: number;
  /** El mail completo (.eml), con CRLF. */
  fuente: string;
  /** La fecha interna (la que mira SINCE). */
  fecha: Date;
  flags: string[];
}

export interface CarpetaFalsa {
  path: string;
  /** Atributos de LIST, ej. ["\\Junk"]. */
  atributos: string[];
  uidValidity: number;
  mensajes: MensajeFalso[];
  proximoUid: number;
}

export interface MailParaFalso {
  fuente: string;
  fecha: Date;
  flags?: string[];
}

export interface ImapFalso {
  puerto: number;
  /** Cada línea de comando recibida (sin el tag), en orden. */
  comandos: string[];
  /** Los UID cuyo contenido completo se pidió, por carpeta. */
  cuerposPedidos: Array<{ carpeta: string; uid: number }>;
  carpeta(path: string): CarpetaFalsa;
  agregar(path: string, mail: MailParaFalso): number;
  /** Mueve un mail a otra carpeta (le cambia el UID), como haría una persona desde Outlook. */
  mover(de: string, uid: number, a: string): number;
  /** Corta las conexiones nuevas (como un servidor caído) o las vuelve a aceptar. */
  apagado: boolean;
  /** Si es true, el servidor acepta la conexión pero nunca saluda (tiempo agotado). */
  mudo: boolean;
  detener(): Promise<void>;
}

const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fechaInterna(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getUTCDate())}-${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()} ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}:${dos(d.getUTCSeconds())} +0000`;
}

/** Un string IMAP: entre comillas si es ASCII simple; si no, un literal. */
function cadena(valor: string | null | undefined): string {
  if (valor === null || valor === undefined) return "NIL";
  if (/^[\x20-\x7e]*$/.test(valor)) return `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `{${Buffer.byteLength(valor)}}\r\n${valor}`;
}

function encabezados(fuente: string): Map<string, string> {
  const corte = fuente.search(/\r?\n\r?\n/);
  const cabeza = (corte === -1 ? fuente : fuente.slice(0, corte)).replace(/\r?\n[ \t]+/g, " ");
  const mapa = new Map<string, string>();
  for (const linea of cabeza.split(/\r?\n/)) {
    const i = linea.indexOf(":");
    if (i > 0) {
      const k = linea.slice(0, i).trim().toLowerCase();
      if (!mapa.has(k)) mapa.set(k, linea.slice(i + 1).trim());
    }
  }
  return mapa;
}

function direccionImap(valor: string | undefined): string {
  if (!valor) return "NIL";
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(valor);
  const nombre = m ? m[1].trim() || null : null;
  const dir = (m ? m[2] : valor).trim();
  const [buzon, host] = dir.split("@");
  return `((${cadena(nombre)} NIL ${cadena(buzon)} ${cadena(host ?? null)}))`;
}

function sobre(fuente: string): string {
  const h = encabezados(fuente);
  const de = direccionImap(h.get("from"));
  return `(${cadena(h.get("date"))} ${cadena(h.get("subject"))} ${de} ${de} ${de} ${direccionImap(h.get("to"))} NIL NIL ${cadena(
    h.get("in-reply-to"),
  )} ${cadena(h.get("message-id"))})`;
}

/** Separa una línea de comando en tokens (átomos, "cadenas" y (listas) planas). */
function tokens(linea: string): string[] {
  const salida: string[] = [];
  let i = 0;
  while (i < linea.length) {
    const c = linea[i];
    if (c === " ") {
      i++;
    } else if (c === '"') {
      let v = "";
      i++;
      while (i < linea.length && linea[i] !== '"') {
        if (linea[i] === "\\") i++;
        v += linea[i++];
      }
      i++;
      salida.push(v);
    } else if (c === "(") {
      let nivel = 0;
      const ini = i;
      do {
        if (linea[i] === "(") nivel++;
        if (linea[i] === ")") nivel--;
        i++;
      } while (i < linea.length && nivel > 0);
      salida.push(linea.slice(ini, i));
    } else {
      const ini = i;
      while (i < linea.length && linea[i] !== " ") {
        if (linea[i] === "[") {
          while (i < linea.length && linea[i] !== "]") i++;
        }
        i++;
      }
      salida.push(linea.slice(ini, i));
    }
  }
  return salida;
}

function enConjunto(conjunto: string, uid: number, maximo: number): boolean {
  return conjunto.split(",").some((parte) => {
    const [a, b] = parte.split(":");
    const n = (x: string) => (x === "*" ? maximo : Number(x));
    if (b === undefined) return n(a) === uid;
    const [lo, hi] = [n(a), n(b)].sort((x, y) => x - y);
    return uid >= lo && uid <= hi;
  });
}

function fechaSince(criterio: string): Date | null {
  const m = /SINCE\s+"?(\d{1,2})-([A-Za-z]{3})-(\d{4})"?/i.exec(criterio);
  if (!m) return null;
  const mes = MESES.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  return new Date(Date.UTC(Number(m[3]), mes, Number(m[1])));
}

export async function crearImapFalso(opciones: {
  usuario: string;
  clave: string;
  carpetas: Array<{ path: string; atributos?: string[] }>;
  /**
   * M3-03: acepta APPEND (la copia en Enviados de operations@). Por defecto no:
   * para la lectura de sales@ (M2-07) un APPEND sigue siendo una escritura prohibida.
   */
  permitirAppend?: boolean;
}): Promise<ImapFalso> {
  const carpetas = new Map<string, CarpetaFalsa>();
  // Como un servidor real: cada casilla nueva con su propio UIDVALIDITY (si no, dos falsos parecerían el mismo mail).
  let validez = 1 + Math.floor(Math.random() * 2_000_000_000);
  for (const c of opciones.carpetas) {
    carpetas.set(c.path, { path: c.path, atributos: c.atributos ?? [], uidValidity: validez++, mensajes: [], proximoUid: 1 });
  }
  const sockets = new Set<Socket>();

  const falso: ImapFalso = {
    puerto: 0,
    comandos: [],
    cuerposPedidos: [],
    apagado: false,
    mudo: false,
    carpeta(path) {
      const c = carpetas.get(path);
      if (!c) throw new Error(`El falso no tiene la carpeta ${path}`);
      return c;
    },
    agregar(path, mail) {
      const c = falso.carpeta(path);
      const uid = c.proximoUid++;
      c.mensajes.push({ uid, fuente: mail.fuente, fecha: mail.fecha, flags: [...(mail.flags ?? [])] });
      return uid;
    },
    mover(de, uid, a) {
      const origen = falso.carpeta(de);
      const i = origen.mensajes.findIndex((m) => m.uid === uid);
      const [m] = origen.mensajes.splice(i, 1);
      return falso.agregar(a, { fuente: m.fuente, fecha: m.fecha, flags: m.flags });
    },
    async detener() {
      for (const s of sockets) s.destroy();
      await new Promise<void>((r) => servidor.close(() => r()));
    },
  };

  function atender(socket: Socket) {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    if (falso.apagado) {
      socket.destroy();
      return;
    }
    if (falso.mudo) return;
    let autenticado = false;
    let abierta: CarpetaFalsa | null = null;
    let resto = Buffer.alloc(0);
    // M3-03: un APPEND trae el mail como literal ({n} y después n bytes).
    let literal: { bytes: number; alTerminar: (datos: Buffer) => void } | null = null;
    const enviar = (s: string) => socket.write(`${s}\r\n`);
    enviar("* OK Servidor IMAP falso listo");

    socket.on("data", (datos: Buffer) => {
      resto = Buffer.concat([resto, datos]);
      for (;;) {
        if (literal) {
          if (resto.length < literal.bytes) return;
          const contenido = resto.subarray(0, literal.bytes);
          resto = resto.subarray(literal.bytes);
          const l = literal;
          literal = null;
          l.alTerminar(Buffer.from(contenido));
          continue;
        }
        const fin = resto.indexOf("\r\n");
        if (fin === -1) return;
        const linea = resto.subarray(0, fin).toString("utf8");
        resto = resto.subarray(fin + 2);
        // El CRLF que cierra un APPEND después del literal.
        if (!linea) continue;
        responder(linea);
      }
    });

    function responder(linea: string) {
      const t = tokens(linea);
      const tag = t[0] ?? "*";
      let cmd = (t[1] ?? "").toUpperCase();
      let args = t.slice(2);
      if (cmd === "UID") {
        cmd = `UID ${(args[0] ?? "").toUpperCase()}`;
        args = args.slice(1);
      }
      falso.comandos.push(cmd === "LOGIN" ? `LOGIN "${args[0]}" ***` : linea.slice(tag.length + 1));
      const ok = (texto = "Hecho") => enviar(`${tag} OK ${texto}`);

      switch (cmd) {
        case "CAPABILITY":
          enviar("* CAPABILITY IMAP4rev1");
          return ok();
        case "NOOP":
          return ok();
        case "LOGOUT":
          enviar("* BYE Chau");
          ok();
          socket.end();
          return;
        case "LOGIN":
          if (args[0] === opciones.usuario && args[1] === opciones.clave) {
            autenticado = true;
            return ok("Adentro");
          }
          return enviar(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials`);
      }
      if (!autenticado) return enviar(`${tag} NO Primero LOGIN`);

      switch (cmd) {
        case "APPEND": {
          const tamano = /^\{(\d+)\}$/.exec(args[args.length - 1] ?? "");
          if (!opciones.permitirAppend || !tamano) return enviar(`${tag} BAD Comando no soportado por el falso`);
          const destino = carpetas.get(args[0]);
          if (!destino) return enviar(`${tag} NO [TRYCREATE] No existe la carpeta`);
          const flags = args.slice(1, -1).find((a) => a.startsWith("("));
          literal = {
            bytes: Number(tamano[1]),
            alTerminar: (contenido) => {
              const uid = falso.agregar(destino.path, {
                fuente: contenido.toString("utf8"),
                fecha: new Date(),
                flags: flags ? flags.slice(1, -1).split(" ").filter(Boolean) : [],
              });
              enviar(`${tag} OK [APPENDUID ${destino.uidValidity} ${uid}] APPEND completed`);
            },
          };
          return enviar("+ Listo para el mail");
        }
        case "LIST": {
          if (args[1] === "") {
            enviar('* LIST (\\Noselect) "." ""');
            return ok();
          }
          for (const c of carpetas.values()) {
            enviar(`* LIST (\\HasNoChildren${c.atributos.map((a) => ` ${a}`).join("")}) "." ${cadena(c.path)}`);
          }
          return ok();
        }
        case "EXAMINE": {
          const c = carpetas.get(args[0]);
          if (!c) return enviar(`${tag} NO No existe la carpeta`);
          abierta = c;
          enviar("* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)");
          enviar(`* ${c.mensajes.length} EXISTS`);
          enviar("* 0 RECENT");
          enviar(`* OK [UIDVALIDITY ${c.uidValidity}] UIDs valid`);
          enviar(`* OK [UIDNEXT ${c.proximoUid}] Predicted next UID`);
          return enviar(`${tag} OK [READ-ONLY] EXAMINE completed`);
        }
        case "UID SEARCH": {
          if (!abierta) return enviar(`${tag} BAD Ninguna carpeta abierta`);
          const desde = fechaSince(args.join(" "));
          const uids = abierta.mensajes.filter((m) => !desde || m.fecha.getTime() >= desde.getTime()).map((m) => m.uid);
          enviar(`* SEARCH${uids.map((u) => ` ${u}`).join("")}`);
          return ok();
        }
        case "UID FETCH": {
          if (!abierta) return enviar(`${tag} BAD Ninguna carpeta abierta`);
          const conjunto = args[0];
          const items = args.slice(1).join(" ").toUpperCase();
          const maximo = Math.max(0, ...abierta.mensajes.map((m) => m.uid));
          abierta.mensajes.forEach((m, i) => {
            if (!enConjunto(conjunto, m.uid, maximo)) return;
            const partes: string[] = [`UID ${m.uid}`];
            const pideCuerpo = /BODY(\.PEEK)?\[\]/.test(items) || /\bRFC822\b(?!\.)/.test(items);
            const sinPeek = /BODY\[\]/.test(items) || /\bRFC822\b(?!\.)/.test(items);
            if (sinPeek && !m.flags.includes("\\Seen")) m.flags.push("\\Seen");
            if (items.includes("FLAGS")) partes.push(`FLAGS (${m.flags.join(" ")})`);
            if (items.includes("INTERNALDATE")) partes.push(`INTERNALDATE "${fechaInterna(m.fecha)}"`);
            if (items.includes("RFC822.SIZE")) partes.push(`RFC822.SIZE ${Buffer.byteLength(m.fuente)}`);
            if (items.includes("ENVELOPE")) partes.push(`ENVELOPE ${sobre(m.fuente)}`);
            let literal = "";
            if (pideCuerpo) {
              falso.cuerposPedidos.push({ carpeta: abierta!.path, uid: m.uid });
              literal = `BODY[] {${Buffer.byteLength(m.fuente)}}\r\n${m.fuente}`;
            }
            socket.write(`* ${i + 1} FETCH (${partes.join(" ")}${literal ? ` ${literal}` : ""})\r\n`);
          });
          return ok();
        }
        default:
          return enviar(`${tag} BAD Comando no soportado por el falso`);
      }
    }
  }

  const servidor: Server = createServer(atender);
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", () => r()));
  falso.puerto = (servidor.address() as AddressInfo).port;
  return falso;
}

/** Los comandos que modifican una casilla (criterio #15): nunca tienen que aparecer. */
export const COMANDOS_DE_ESCRITURA = [
  "SELECT",
  "STORE",
  "UID STORE",
  "COPY",
  "UID COPY",
  "MOVE",
  "UID MOVE",
  "EXPUNGE",
  "UID EXPUNGE",
  "APPEND",
  "DELETE",
  "RENAME",
  "CREATE",
] as const;

/** Los comandos de escritura que aparecen en el registro (vacío = la casilla no se tocó). */
export function comandosDeEscritura(comandos: readonly string[]): string[] {
  return comandos.filter((c) => {
    const verbo = c.split(" ").slice(0, 2).join(" ").toUpperCase();
    const primero = verbo.split(" ")[0];
    return (COMANDOS_DE_ESCRITURA as readonly string[]).some((w) => w === verbo || (!w.includes(" ") && w === primero));
  });
}

/** Un .eml mínimo para los casos sintéticos. */
export function emlSintetico(o: { de: string; asunto: string; fecha: Date; messageId?: string | null; cuerpo?: string }): string {
  return [
    `From: ${o.de}`,
    "To: sales@hitravel.com.ar",
    `Subject: ${o.asunto}`,
    `Date: ${o.fecha.toUTCString()}`,
    ...(o.messageId === null ? [] : [`Message-ID: ${o.messageId ?? `<${Math.random().toString(36).slice(2)}@falso.test>`}`]),
    "Content-Type: text/plain; charset=utf-8",
    "",
    o.cuerpo ?? "Cuerpo inventado para el test de M2-07.",
    "",
  ].join("\r\n");
}
