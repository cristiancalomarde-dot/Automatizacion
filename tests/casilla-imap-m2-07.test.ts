// @vitest-environment node
//
// Spec M2-07 — el adaptador de la casilla (imapflow) contra el servidor IMAP
// falso. Sin base ni IA. Criterios #2 (carpetas), #10 (sobre primero, cuerpo
// solo de lo pedido), #15 (ninguna escritura, solo EXAMINE, marcas intactas)
// y #17 (casilla caída y clave equivocada).
import { afterEach, describe, expect, it } from "vitest";
import { abrirCasillaImap, ErrorCasilla } from "@/lib/lectura-sales/casilla";
import { comandosDeEscritura, crearImapFalso, emlSintetico, type ImapFalso } from "./helpers/imap-falso";

const USUARIO = "sales@falso.test";
const CLAVE = "clave-de-prueba-123";
let falso: ImapFalso | null = null;

afterEach(async () => {
  await falso?.detener();
  falso = null;
});

const config = (f: ImapFalso, clave = CLAVE) => ({ host: "127.0.0.1", puerto: f.puerto, seguro: false, usuario: USUARIO, clave });

describe("casilla IMAP (solo lectura) contra el falso", { timeout: 30_000 }, () => {
  it("#15: lista, baja sobres y cuerpos con EXAMINE y BODY.PEEK; nunca escribe ni marca como leído", async () => {
    falso = await crearImapFalso({ usuario: USUARIO, clave: CLAVE, carpetas: [{ path: "INBOX" }, { path: "INBOX.spam" }, { path: "Trash" }] });
    const ahora = new Date();
    const noLeido = falso.agregar("INBOX", { fuente: emlSintetico({ de: "a@kilroy.dk", asunto: "NEW BOOKING DK0000001", fecha: ahora }), fecha: ahora });
    falso.agregar("INBOX", { fuente: emlSintetico({ de: "b@otro.test", asunto: "hola", fecha: ahora }), fecha: ahora, flags: ["\\Seen"] });
    falso.agregar("INBOX.spam", { fuente: emlSintetico({ de: "c@kilroy.dk", asunto: "NEW BOOKING DK0000002", fecha: ahora }), fecha: ahora });

    const casilla = await abrirCasillaImap(config(falso));
    try {
      const carpetas = await casilla.carpetas();
      expect(carpetas.map((c) => c.path)).toEqual(["INBOX", "INBOX.spam", "Trash"]);
      const desde = new Date(ahora.getTime() - 86_400_000);
      const inbox = await casilla.sobres("INBOX", desde);
      expect(inbox.uidValidity).toBeGreaterThan(0);
      expect(inbox.sobres.map((s) => s.remitente)).toEqual(["a@kilroy.dk", "b@otro.test"]);
      expect(inbox.sobres[0]).toMatchObject({ uid: noLeido, asunto: "NEW BOOKING DK0000001", carpeta: "INBOX" });
      expect(inbox.sobres[0].messageId).toMatch(/@falso\.test>$/);

      const fuentes = await casilla.fuentes("INBOX", [noLeido]);
      expect(fuentes.get(noLeido)?.toString("utf8")).toContain("NEW BOOKING DK0000001");
      await casilla.sobres("INBOX.spam", desde);
    } finally {
      await casilla.cerrar();
    }

    expect(comandosDeEscritura(falso.comandos)).toEqual([]);
    expect(falso.comandos.some((c) => /^EXAMINE/i.test(c))).toBe(true);
    expect(falso.comandos.filter((c) => /FETCH/i.test(c) && /BODY/i.test(c)).every((c) => /BODY\.PEEK\[\]/i.test(c))).toBe(true);
    // Solo se pidió el cuerpo del que se eligió.
    expect(falso.cuerposPedidos).toEqual([{ carpeta: "INBOX", uid: noLeido }]);
    // Las marcas quedan como estaban: el no leído sigue no leído.
    expect(falso.carpeta("INBOX").mensajes.map((m) => m.flags)).toEqual([[], ["\\Seen"]]);
    expect(falso.carpeta("INBOX.spam").mensajes[0].flags).toEqual([]);
    // La contraseña no queda en ningún registro.
    expect(falso.comandos.join("\n")).not.toContain(CLAVE);
  });

  it("#17: con la clave equivocada, falla con 'la clave de sales@ no es válida' (sin la clave en el mensaje)", async () => {
    falso = await crearImapFalso({ usuario: USUARIO, clave: CLAVE, carpetas: [{ path: "INBOX" }] });
    const error = await abrirCasillaImap(config(falso, "otra-clave-999")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorCasilla);
    expect((error as ErrorCasilla).motivo).toBe("clave");
    expect(String((error as Error).message)).not.toContain("otra-clave-999");
  });

  it("#17: con el servidor caído, falla con 'la casilla no respondió'", async () => {
    falso = await crearImapFalso({ usuario: USUARIO, clave: CLAVE, carpetas: [{ path: "INBOX" }] });
    falso.apagado = true;
    const error = await abrirCasillaImap(config(falso)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorCasilla);
    expect((error as ErrorCasilla).motivo).toBe("no_responde");
  });

  it("#17: si el servidor no saluda, se corta por tiempo y falla con 'no respondió'", async () => {
    falso = await crearImapFalso({ usuario: USUARIO, clave: CLAVE, carpetas: [{ path: "INBOX" }] });
    falso.mudo = true;
    const error = await abrirCasillaImap({ ...config(falso), esperaMs: 1_500 }).catch((e: unknown) => e);
    expect((error as ErrorCasilla).motivo).toBe("no_responde");
  });
});
