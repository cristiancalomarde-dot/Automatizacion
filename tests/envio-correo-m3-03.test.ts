// @vitest-environment node
//
// Spec M3-03 — los adaptadores de correo contra servidores FALSOS locales
// (nunca Ferozo): el SMTP de operations@ (nodemailer, fila 3 y 7) y la copia
// en Enviados por IMAP (imapflow, fila 5: solo APPEND). Sin base.
import { afterEach, describe, expect, it } from "vitest";
import type { ConfigEnvio } from "@/lib/pedidos/envio/config";
import { carpetaDeEnviados, guardarEnEnviadosImap } from "@/lib/pedidos/envio/enviados";
import { abrirTransporteSmtp, ErrorSmtp } from "@/lib/pedidos/envio/smtp";
import { TEXTOS } from "@/lib/textos";
import { comandosDeEscritura, crearImapFalso, emlSintetico, type ImapFalso } from "./helpers/imap-falso";
import { crearSmtpFalso, type SmtpFalso } from "./helpers/smtp-falso";

const USUARIO = "operations@falso.test";
const CLAVE = "clave-de-prueba-456";
let smtp: SmtpFalso | null = null;
let imap: ImapFalso | null = null;

afterEach(async () => {
  await smtp?.detener();
  await imap?.detener();
  smtp = null;
  imap = null;
});

const crudo = Buffer.from(emlSintetico({ de: USUARIO, asunto: "Reserva Ana Prueba x2", fecha: new Date(), cuerpo: "Pedido de prueba" }));
const smtpDe = (puerto: number, clave = CLAVE) => ({ host: "127.0.0.1", puerto, seguro: false, starttls: false, usuario: USUARIO, clave });

function configCon(imapPuerto: number, clave = CLAVE): ConfigEnvio {
  return {
    smtp: smtpDe(1, clave),
    imap: { host: "127.0.0.1", puerto: imapPuerto, seguro: false },
    remitente: USUARIO,
    cc: [],
    destinoPrueba: "owner@falso.test",
    envioReal: true,
  };
}

describe("SMTP de operations@ contra el falso", { timeout: 30_000 }, () => {
  it("manda el .eml tal cual, al sobre que se le da (fila 3)", async () => {
    smtp = await crearSmtpFalso({ usuario: USUARIO, clave: CLAVE });
    const t = abrirTransporteSmtp(smtpDe(smtp.puerto));
    const r = await t.enviar({ sobre: { de: USUARIO, para: ["a@proveedor.test", "cc@falso.test"] }, crudo });
    t.cerrar();
    expect(r).toEqual({ aceptados: ["a@proveedor.test", "cc@falso.test"], rechazados: [] });
    expect(smtp.mensajes).toHaveLength(1);
    expect(smtp.mensajes[0].de).toBe(USUARIO);
    expect(smtp.mensajes[0].para).toEqual(["a@proveedor.test", "cc@falso.test"]);
    expect(smtp.mensajes[0].crudo.toString("utf8").trim()).toBe(crudo.toString("utf8").trim());
  });

  it("si el servidor rechaza uno de los destinatarios, sale a los otros y lo dice (fila 7)", async () => {
    smtp = await crearSmtpFalso({ usuario: USUARIO, clave: CLAVE, rechazar: ["no-existe@proveedor.test"] });
    const t = abrirTransporteSmtp(smtpDe(smtp.puerto));
    const r = await t.enviar({ sobre: { de: USUARIO, para: ["no-existe@proveedor.test", "si@proveedor.test"] }, crudo });
    expect(r).toEqual({ aceptados: ["si@proveedor.test"], rechazados: ["no-existe@proveedor.test"] });
    expect(smtp.mensajes[0].para).toEqual(["si@proveedor.test"]);
  });

  it("si rechaza a todos: error 'rechazado' con las direcciones", async () => {
    smtp = await crearSmtpFalso({ usuario: USUARIO, clave: CLAVE, rechazar: ["no-existe@proveedor.test"] });
    const t = abrirTransporteSmtp(smtpDe(smtp.puerto));
    const e = await t.enviar({ sobre: { de: USUARIO, para: ["no-existe@proveedor.test"] }, crudo }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorSmtp);
    expect(e).toMatchObject({ motivo: "rechazado", direcciones: ["no-existe@proveedor.test"] });
    expect(smtp.mensajes).toHaveLength(0);
  });

  it("con la clave equivocada: error 'clave', sin la clave en el mensaje", async () => {
    smtp = await crearSmtpFalso({ usuario: USUARIO, clave: CLAVE });
    const t = abrirTransporteSmtp(smtpDe(smtp.puerto, "otra-clave-999"));
    const e = await t.enviar({ sobre: { de: USUARIO, para: ["a@proveedor.test"] }, crudo }).catch((x: unknown) => x);
    expect(e).toMatchObject({ motivo: "clave" });
    expect((e as ErrorSmtp).esDeLaCasilla).toBe(true);
    expect(String((e as Error).message)).not.toContain("otra-clave-999");
    expect(smtp.mensajes).toHaveLength(0);
  });

  it("con el servidor caído: error 'no_responde'", async () => {
    smtp = await crearSmtpFalso({ usuario: USUARIO, clave: CLAVE });
    const puerto = smtp.puerto;
    await smtp.detener();
    smtp = null;
    const e = await abrirTransporteSmtp(smtpDe(puerto)).enviar({ sobre: { de: USUARIO, para: ["a@proveedor.test"] }, crudo }).catch((x: unknown) => x);
    expect(e).toMatchObject({ motivo: "no_responde" });
  });

  it("en los tests nunca habla con un servidor que no sea local (red de seguridad)", () => {
    expect(() => abrirTransporteSmtp({ ...smtpDe(465), host: "c1391889.ferozo.com" })).toThrow(/servidor local/);
  });
});

describe("copia en Enviados por IMAP contra el falso (fila 5)", { timeout: 30_000 }, () => {
  it("agrega el mail a la carpeta marcada \\Sent, como leído, usando solo APPEND", async () => {
    imap = await crearImapFalso({
      usuario: USUARIO,
      clave: CLAVE,
      permitirAppend: true,
      carpetas: [{ path: "INBOX" }, { path: "INBOX.Sent", atributos: ["\\Sent"] }, { path: "INBOX.Trash", atributos: ["\\Trash"] }],
    });
    const recibido = imap.agregar("INBOX", { fuente: emlSintetico({ de: "x@otro.test", asunto: "hola", fecha: new Date() }), fecha: new Date() });

    const r = await guardarEnEnviadosImap(configCon(imap.puerto), [crudo, crudo]);
    expect(r).toEqual({ ok: true, carpeta: "INBOX.Sent" });
    expect(imap.carpeta("INBOX.Sent").mensajes).toHaveLength(2);
    expect(imap.carpeta("INBOX.Sent").mensajes[0].fuente).toContain("Reserva Ana Prueba x2");
    expect(imap.carpeta("INBOX.Sent").mensajes[0].flags).toEqual(["\\Seen"]);
    // Lo que ya estaba no se tocó.
    expect(imap.carpeta("INBOX").mensajes.map((m) => [m.uid, m.flags])).toEqual([[recibido, []]]);
    // La única escritura es APPEND: ni SELECT, ni STORE, ni MOVE, ni EXPUNGE, ni CREATE.
    expect(new Set(comandosDeEscritura(imap.comandos).map((c) => c.split(" ")[0]))).toEqual(new Set(["APPEND"]));
    expect(imap.comandos.some((c) => /^(EXAMINE|SELECT)/i.test(c))).toBe(false);
    expect(imap.comandos.join("\n")).not.toContain(CLAVE);
  });

  it("sin carpeta marcada, usa la que se llama Sent / Enviados", () => {
    expect(carpetaDeEnviados([{ path: "INBOX" }, { path: "Enviados" }])).toBe("Enviados");
    expect(carpetaDeEnviados([{ path: "INBOX" }, { path: "Sent" }, { path: "Enviados" }])).toBe("Sent");
    expect(carpetaDeEnviados([{ path: "INBOX" }, { path: "inbox.sent" }])).toBe("inbox.sent");
    expect(carpetaDeEnviados([{ path: "INBOX" }, { path: "Cosas", specialUse: "\\Sent" }])).toBe("Cosas");
    expect(carpetaDeEnviados([{ path: "INBOX" }, { path: "Trash" }])).toBeNull();
  });

  it("si no hay carpeta de Enviados, no crea ninguna y avisa", async () => {
    imap = await crearImapFalso({ usuario: USUARIO, clave: CLAVE, permitirAppend: true, carpetas: [{ path: "INBOX" }] });
    expect(await guardarEnEnviadosImap(configCon(imap.puerto), [crudo])).toEqual({ ok: false, motivo: TEXTOS.pedidos.envio.sinCarpetaEnviados });
    expect(comandosDeEscritura(imap.comandos)).toEqual([]);
  });

  it("con la clave equivocada o la casilla caída, avisa sin la clave", async () => {
    imap = await crearImapFalso({ usuario: USUARIO, clave: CLAVE, permitirAppend: true, carpetas: [{ path: "INBOX.Sent" }] });
    const mal = await guardarEnEnviadosImap(configCon(imap.puerto, "otra-clave-999"), [crudo]);
    expect(mal).toEqual({ ok: false, motivo: TEXTOS.pedidos.envio.copiaClave });
    imap.apagado = true;
    expect(await guardarEnEnviadosImap(configCon(imap.puerto), [crudo])).toEqual({ ok: false, motivo: TEXTOS.pedidos.envio.copiaNoResponde });
    expect(imap.carpeta("INBOX.Sent").mensajes).toHaveLength(0);
  });
});
