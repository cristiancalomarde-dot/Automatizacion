// Spec M3-03 fila 1 y 2: la configuración del envío sale de variables de
// entorno (acá armadas a mano: nunca se leen las de .env.local). Sin casilla
// no se intenta enviar; sin PEDIDOS_ENVIO_REAL=si, modo prueba.
import { describe, expect, it } from "vitest";
import { TEXTOS } from "@/lib/textos";
import { leerConfigEnvio } from "./config";

const BASE = {
  PEDIDOS_SMTP_HOST: "smtp.falso.test",
  PEDIDOS_SMTP_PORT: "465",
  PEDIDOS_SMTP_USER: "operations@hitravel.com.ar",
  PEDIDOS_SMTP_PASSWORD: "clave-inventada",
};

describe("configuración del envío (filas 1 y 2)", () => {
  it.each(["PEDIDOS_SMTP_HOST", "PEDIDOS_SMTP_USER", "PEDIDOS_SMTP_PASSWORD"])("sin %s: no se envía y dice qué falta en llano", (falta) => {
    const r = leerConfigEnvio({ ...BASE, [falta]: "" });
    expect(r).toEqual({ ok: false, error: TEXTOS.pedidos.envio.faltaConfigurar });
  });

  it("el <PENDIENTE> de .env.example cuenta como no cargado", () => {
    expect(leerConfigEnvio({ ...BASE, PEDIDOS_SMTP_PASSWORD: "<PENDIENTE>" })).toEqual({ ok: false, error: TEXTOS.pedidos.envio.faltaConfigurar });
    const r = leerConfigEnvio({ ...BASE, PEDIDOS_SMTP_PORT: "<PENDIENTE>", PEDIDOS_CC: "<PENDIENTE>" });
    expect(r.ok && r.config.smtp.puerto).toBe(465);
  });

  it("un puerto que no es un número también frena", () => {
    expect(leerConfigEnvio({ ...BASE, PEDIDOS_SMTP_PORT: "abc" }).ok).toBe(false);
  });

  it("modo prueba por defecto, con la casilla de prueba y el CC por defecto", () => {
    const r = leerConfigEnvio(BASE);
    if (!r.ok) throw new Error(r.error);
    expect(r.config.envioReal).toBe(false);
    expect(r.config.destinoPrueba).toBe("ccalomarde@hitravel.com.ar");
    expect(r.config.cc).toEqual(["ccalomarde@hitravel.com.ar"]);
    expect(r.config.remitente).toBe("operations@hitravel.com.ar");
  });

  it.each([
    ["si", true],
    ["SI", true],
    [" si ", true],
    ["no", false],
    ["true", false],
    ["sí", false],
    ["", false],
  ])("PEDIDOS_ENVIO_REAL=%j → envío real %s", (valor, real) => {
    const r = leerConfigEnvio({ ...BASE, PEDIDOS_ENVIO_REAL: valor });
    expect(r.ok && r.config.envioReal).toBe(real);
  });

  it("465 es SSL directo; 587 es STARTTLS obligatorio; el IMAP por defecto es el mismo servidor en 993", () => {
    const ssl = leerConfigEnvio(BASE);
    const tls = leerConfigEnvio({ ...BASE, PEDIDOS_SMTP_PORT: "587" });
    const porDefecto = leerConfigEnvio({ ...BASE, PEDIDOS_SMTP_PORT: "" });
    if (!ssl.ok || !tls.ok || !porDefecto.ok) throw new Error("config");
    expect(ssl.config.smtp).toMatchObject({ host: "smtp.falso.test", puerto: 465, seguro: true, starttls: false });
    expect(tls.config.smtp).toMatchObject({ puerto: 587, seguro: false, starttls: true });
    expect(porDefecto.config.smtp.puerto).toBe(465);
    expect(ssl.config.imap).toEqual({ host: "smtp.falso.test", puerto: 993, seguro: true });
  });

  it("CC en lista (con coma), destino de prueba propio e IMAP propio", () => {
    const r = leerConfigEnvio({
      ...BASE,
      PEDIDOS_CC: " a@hitravel.com.ar, B@HITRAVEL.COM.AR ,",
      PEDIDOS_DESTINO_PRUEBA: "owner@hitravel.com.ar",
      PEDIDOS_IMAP_HOST: "imap.falso.test",
      PEDIDOS_IMAP_PORT: "143",
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.config.cc).toEqual(["a@hitravel.com.ar", "b@hitravel.com.ar"]);
    expect(r.config.destinoPrueba).toBe("owner@hitravel.com.ar");
    expect(r.config.imap).toEqual({ host: "imap.falso.test", puerto: 143, seguro: false });
  });

  it("un CC o un destino de prueba que no es un mail frena (no se adivina)", () => {
    expect(leerConfigEnvio({ ...BASE, PEDIDOS_CC: "ccalomarde@" }).ok).toBe(false);
    expect(leerConfigEnvio({ ...BASE, PEDIDOS_DESTINO_PRUEBA: "ccalomarde@" }).ok).toBe(false);
  });

  it("la clave no aparece en ningún mensaje de error", () => {
    const r = leerConfigEnvio({ ...BASE, PEDIDOS_SMTP_PORT: "x" });
    expect(JSON.stringify(r)).not.toContain("clave-inventada");
  });
});
