// @vitest-environment node
//
// Spec M3-03 filas 2, 3 y 4: el mail de cada pedido. En modo prueba va SOLO a
// la casilla de prueba (sin CC), con "[PRUEBA]" y el proveedor real arriba; en
// envío real, a los mails del proveedor con el CC, desde operations@, con el
// nombre de quien aprueba en la firma.
import { simpleParser } from "mailparser";
import { describe, expect, it } from "vitest";
import { TEXTOS } from "@/lib/textos";
import type { ConfigEnvio } from "./config";
import { armarMail, componerMail, nuevoMessageId } from "./mensaje";

const config = (envioReal: boolean): ConfigEnvio => ({
  smtp: { host: "127.0.0.1", puerto: 2525, seguro: false, starttls: false, usuario: "operations@hitravel.com.ar", clave: "x" },
  imap: { host: "127.0.0.1", puerto: 1143, seguro: false },
  remitente: "operations@hitravel.com.ar",
  cc: ["ccalomarde@hitravel.com.ar"],
  destinoPrueba: "owner@hitravel.com.ar",
  envioReal,
});

const pedido = {
  asunto: "Reserva Ana Prueba x2 · OD010D",
  cuerpo: "¡Hola! Les pedimos la reserva de Iguazú.",
  firma: "{{nombre_de_quien_envia}}\nHi Travel South America",
  destinatarios: ["reservas8@cuencadelplata.com", "otra@cuencadelplata.com"],
  proveedores: ["Cuenca del Plata"],
};

const fecha = new Date("2026-10-19T17:32:00.000Z");

describe("el mail de un pedido", () => {
  it("modo prueba: el único destinatario es la casilla de prueba, sin CC, asunto [PRUEBA] y para quién iba (fila 2)", async () => {
    const m = armarMail(pedido, { nombre: "Valentina", config: config(false), messageId: "<a@hitravel.com.ar>", fecha });
    expect(m.sobre).toEqual({ de: "operations@hitravel.com.ar", para: ["owner@hitravel.com.ar"] });
    const leido = await simpleParser(await componerMail(m));
    expect(leido.to && "value" in leido.to ? leido.to.value.map((d) => d.address) : []).toEqual(["owner@hitravel.com.ar"]);
    expect(leido.cc).toBeUndefined();
    expect(leido.subject).toBe(`[PRUEBA] ${pedido.asunto}`);
    expect(leido.text?.split("\n")[0]).toBe(TEXTOS.pedidos.envio.ibaPara("Cuenca del Plata", "reservas8@cuencadelplata.com, otra@cuencadelplata.com"));
    expect(leido.text).toContain("Valentina\nHi Travel South America");
    expect(leido.messageId).toBe("<a@hitravel.com.ar>");
  });

  it("envío real: a los mails del proveedor, CC, desde operations@ y firma con el nombre (fila 3)", async () => {
    const m = armarMail(pedido, { nombre: "Valentina Pérez", config: config(true), messageId: "<b@hitravel.com.ar>", fecha });
    expect(m.sobre).toEqual({
      de: "operations@hitravel.com.ar",
      para: ["reservas8@cuencadelplata.com", "otra@cuencadelplata.com", "ccalomarde@hitravel.com.ar"],
    });
    const leido = await simpleParser(await componerMail(m));
    expect(leido.from?.value[0]).toMatchObject({ address: "operations@hitravel.com.ar", name: TEXTOS.pedidos.envio.remitente });
    expect(leido.to && "value" in leido.to ? leido.to.value.map((d) => d.address) : []).toEqual(pedido.destinatarios);
    expect(leido.cc && "value" in leido.cc ? leido.cc.value.map((d) => d.address) : []).toEqual(["ccalomarde@hitravel.com.ar"]);
    expect(leido.subject).toBe(pedido.asunto);
    expect(leido.text?.trim()).toBe(`${pedido.cuerpo}\n\nValentina Pérez\nHi Travel South America`);
    expect(leido.text).not.toContain("PRUEBA");
    expect(leido.date?.toISOString()).toBe(fecha.toISOString());
  });

  it("un CC que ya es destinatario no se repite en el sobre", () => {
    const m = armarMail({ ...pedido, destinatarios: ["ccalomarde@hitravel.com.ar"] }, { nombre: "V", config: config(true), messageId: "<c@x>", fecha });
    expect(m.sobre.para).toEqual(["ccalomarde@hitravel.com.ar"]);
  });

  it("sin nombre de quien envía no se arma (la firma no sale vacía, fila 4)", () => {
    expect(() => armarMail(pedido, { nombre: " ", config: config(true), messageId: "<d@x>", fecha })).toThrow(/nombre/);
  });

  it("un pedido sin destinatario no se arma", () => {
    expect(() => armarMail({ ...pedido, destinatarios: [] }, { nombre: "V", config: config(true), messageId: "<e@x>", fecha })).toThrow();
  });

  it("el Message-ID nuevo es del dominio de la casilla y no se repite", () => {
    const a = nuevoMessageId("operations@hitravel.com.ar");
    expect(a).toMatch(/^<[0-9a-f-]+\.pedido@hitravel\.com\.ar>$/);
    expect(nuevoMessageId("operations@hitravel.com.ar")).not.toBe(a);
  });
});
