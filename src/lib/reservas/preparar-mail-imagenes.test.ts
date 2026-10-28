import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELOS } from "@/lib/ia/modelos";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { camposDeEml } from "@/lib/modo-prueba/leer-archivo";
import { emlPetzold, htmlPetzold, IMAGENES_PETZOLD, imagenPetzold, fichaIAPetzold } from "../../../tests/fixtures/journaway/petzold";
import { clienteFalso, respuestaCon } from "./__fixtures__/cargar";
import { leerAgencias } from "./agencias";
import { leerMailConIA } from "./extraer";
import { MAX_BYTES_IMAGENES, MAX_IMAGENES, prepararMail, type MailParaLeer } from "./preparar-mail";

// Spec M3-30 filas 2, 3 y 7: las imágenes del mail viajan a la IA en el lugar del cuerpo donde estaban.

const REGLAS = leerAgencias(readFileSync(join(process.cwd(), "data", "agencias.csv"), "utf-8"));
const OPCIONES = { agencias: REGLAS, instrucciones: "x".repeat(3000), precios: MODELOS.lectura_mail.precios };
const registro: RegistroUsoIA = { gastoDelMes: async () => 0, sumar: async () => {} };

function mailPetzold(): MailParaLeer {
  return {
    remitente: "operations@journaway.com",
    asunto: "Program Booking / Client Beispiel/ ID 66688059968",
    cuerpoTexto: "Dear Partner, (texto plano sin las imágenes)",
    cuerpoHtml: htmlPetzold(),
    adjuntos: IMAGENES_PETZOLD.map((i) => ({ nombre: i.cid.split("@")[0], tipo: "image/png", contenido: imagenPetzold(i.archivo), cid: i.cid })),
  };
}

/** Un PNG de `ancho` × `alto` con `relleno` bytes de más (solo la cabecera importa). */
function png(ancho: number, alto: number, relleno = 4000): Uint8Array {
  const b = new Uint8Array(33 + relleno);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, ancho);
  new DataView(b.buffer).setUint32(20, alto);
  return b;
}

/** Un JPEG con su marcador SOF0 (alto y ancho). */
function jpeg(ancho: number, alto: number, relleno = 4000): Uint8Array {
  const b = new Uint8Array(13 + relleno);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  const extra = new Uint8Array([alto >> 8, alto & 255, ancho >> 8, ancho & 255]);
  b.set(extra, 13);
  return b;
}

describe("prepararMail — las imágenes del cuerpo (fila 2)", () => {
  it("Petzold: las 3 imágenes cid: viajan en orden y el cuerpo lleva la marca [imagen N] bajo su título; los íconos http no", () => {
    const r = prepararMail(mailPetzold(), OPCIONES);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.imagenes.map((i) => [i.numero, i.nombre, i.tipo])).toEqual([
      [1, "image001.png", "image/png"],
      [2, "image002.png", "image/png"],
      [3, "image003.png", "image/png"],
    ]);
    expect(r.imagenes[0].base64).toBe(Buffer.from(imagenPetzold("img1.png")).toString("base64"));
    // La imagen 1 va después de "hotels and night bus"; las 2 y 3, después de "activities".
    const hoteles = r.cuerpo.indexOf("-Please book the following hotels and night bus:");
    const actividades = r.cuerpo.indexOf("-Please book the following activities:");
    const marca = (n: number) => r.cuerpo.indexOf(`[imagen ${n}]`);
    expect(hoteles).toBeGreaterThanOrEqual(0);
    expect(marca(1)).toBeGreaterThan(hoteles);
    expect(marca(1)).toBeLessThan(actividades);
    expect(marca(2)).toBeGreaterThan(actividades);
    expect(marca(3)).toBeGreaterThan(marca(2));
    expect(r.cuerpo).not.toMatch(/hubspot|phone_icon|mail_icon|cid:/);
    expect(r.adjuntosNoLeidos).toEqual([]);
    // El cuerpo es el del HTML (el texto plano no dice dónde estaban las imágenes).
    expect(r.cuerpoOriginal).toContain("Trip Number: 65037");
  });

  it("la llamada a la IA lleva el texto y después cada imagen con su marca; las fechas de las imágenes no quedan dudosas", async () => {
    const { cliente, create } = clienteFalso(respuestaCon(fichaIAPetzold()));
    const lectura = await leerMailConIA(mailPetzold(), { cliente, registro, mes: "2026-10" });
    const contenido = (create.mock.calls[0] as unknown as [{ messages: Array<{ content: Array<Record<string, unknown>> }> }])[0].messages[0].content;
    expect(contenido.map((b) => b.type)).toEqual(["text", "text", "image", "text", "image", "text", "image"]);
    expect(contenido[0].text).toContain("Imágenes del mail: 3");
    expect(contenido[1].text).toBe("[imagen 1]");
    expect(contenido[2]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png" } });
    expect(lectura.estado).toBe("leido");
    if (lectura.estado !== "leido") return;
    // "Astronomie-Tour" del 22.05.2027 solo está en la imagen: no es una fecha "que no aparece en el mail".
    expect(lectura.ficha.notas.filter((n) => /no aparece escrita/.test(n))).toEqual([]);
  });

  it("las imágenes chiquitas (logos) y las de un tipo que la IA no lee no viajan: quedan anotadas", () => {
    const r = prepararMail(
      {
        remitente: "operations@journaway.com",
        cuerpoHtml: `<p>Hola</p><img src="cid:logo"><img src="cid:tabla"><img src="cid:raro">`,
        adjuntos: [
          { nombre: "logo.png", tipo: "image/png", contenido: png(60, 30, 500), cid: "logo" },
          { nombre: "tabla.png", tipo: "image/png", contenido: png(450, 120), cid: "tabla" },
          { nombre: "raro.tiff", tipo: "image/tiff", contenido: new Uint8Array(9000), cid: "raro" },
        ],
      },
      OPCIONES,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.imagenes.map((i) => i.nombre)).toEqual(["tabla.png"]);
    expect(r.cuerpo).toMatch(/^Hola\s+\[imagen 1\]$/);
    expect(r.adjuntosNoLeidos).toEqual(["logo.png", "raro.tiff"]);
  });

  it("una imagen adjunta (no pegada en el cuerpo) también viaja, después de las del cuerpo", () => {
    const r = prepararMail(
      {
        remitente: "operations@journaway.com",
        cuerpoTexto: "Ver la foto adjunta",
        adjuntos: [{ nombre: "Reisepass.jpg", tipo: "image/jpeg", contenido: jpeg(800, 600) }],
      },
      OPCIONES,
    );
    expect(r.ok && r.imagenes.map((i) => [i.numero, i.nombre, i.tipo, i.adjunta])).toEqual([[1, "Reisepass.jpg", "image/jpeg", true]]);
    expect(r.ok && r.cuerpo).toBe("Ver la foto adjunta");
  });
});

describe("prepararMail — tope de gasto con imágenes (fila 3)", () => {
  it("las imágenes suman al peor caso", () => {
    const sin = prepararMail({ ...mailPetzold(), adjuntos: [] }, OPCIONES);
    const con = prepararMail(mailPetzold(), OPCIONES);
    expect(sin.ok && con.ok).toBe(true);
    if (!sin.ok || !con.ok) return;
    expect(con.peorCaso).toBeGreaterThan(sin.peorCaso);
  });

  it(`más de ${MAX_IMAGENES} imágenes → mail demasiado grande`, () => {
    const adjuntos = Array.from({ length: MAX_IMAGENES + 1 }, (_, i) => ({ nombre: `i${i}.png`, tipo: "image/png", contenido: png(500, 500), cid: `c${i}` }));
    const html = adjuntos.map((a) => `<img src="cid:${a.cid}">`).join("");
    expect(prepararMail({ remitente: "operations@journaway.com", cuerpoHtml: html, adjuntos }, OPCIONES)).toEqual({
      ok: false,
      motivo: "mail demasiado grande",
    });
  });

  it("imágenes que pesan más que el tope → mail demasiado grande", () => {
    const grande = png(1000, 1000, MAX_BYTES_IMAGENES);
    expect(
      prepararMail({ remitente: "operations@journaway.com", cuerpoHtml: `<img src="cid:a">`, adjuntos: [{ nombre: "a.png", tipo: "image/png", contenido: grande, cid: "a" }] }, OPCIONES),
    ).toEqual({ ok: false, motivo: "mail demasiado grande" });
  });
});

describe("Kilroy con los datos de los pax en una imagen (fila 7)", () => {
  it("la imagen cid: de un mail de Kilroy viaja a la IA", () => {
    const r = prepararMail(
      {
        remitente: "aarhus@kilroy.dk",
        asunto: "DK1600000 new booking",
        cuerpoHtml: `<p>Tour code: HI_ARGENTINA_OD010D-677</p><p>Passenger details:</p><img src="cid:pax@kilroy"><p>Best regards</p>`,
        adjuntos: [{ nombre: "pax.png", tipo: "image/png", contenido: png(600, 200), cid: "pax@kilroy" }],
      },
      OPCIONES,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.agencia).toBe("Kilroy");
    expect(r.imagenes.map((i) => i.nombre)).toEqual(["pax.png"]);
    expect(r.cuerpo).toMatch(/Passenger details:\s+\[imagen 1\]\s+Best regards/);
  });
});

describe("camposDeEml — las imágenes del .eml (fila 1)", () => {
  it("las imágenes cid: llegan con su contenido y su cid", async () => {
    const campos = await camposDeEml(new Uint8Array(await emlPetzold()));
    expect(campos.cuerpoHtml).toContain(`cid:${IMAGENES_PETZOLD[0].cid}`);
    expect(campos.adjuntos?.map((a) => [a.nombre, a.tipo, a.cid, a.contenido?.byteLength])).toEqual(
      IMAGENES_PETZOLD.map((i) => [i.cid.split("@")[0], "image/png", i.cid, imagenPetzold(i.archivo).byteLength]),
    );
  });
});
