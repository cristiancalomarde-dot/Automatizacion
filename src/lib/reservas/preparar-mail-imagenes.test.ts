import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELOS } from "@/lib/ia/modelos";
import type { RegistroUsoIA } from "@/lib/ia/techo-gasto";
import { camposDeEml } from "@/lib/modo-prueba/leer-archivo";
import { emlPetzold, htmlPetzold, IMAGENES_PETZOLD, imagenPetzold, fichaIAPetzold } from "../../../tests/fixtures/journaway/petzold";
import { mailKilroyPesado, pngDeTamano, TAMANOS_KILROY_PESADO } from "../../../tests/fixtures/kilroy/imagenes-pesadas";
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

  // M3-49 cambió estos dos casos: antes el mail entero quedaba "demasiado grande"; ahora se dejan afuera
  // las imágenes que no entran y el mail se lee igual.
  it(`más de ${MAX_IMAGENES} imágenes → viajan ${MAX_IMAGENES}, la que sobra queda anotada (M3-49)`, () => {
    const adjuntos = Array.from({ length: MAX_IMAGENES + 1 }, (_, i) => ({ nombre: `i${i}.png`, tipo: "image/png", contenido: png(500, 500), cid: `c${i}` }));
    const html = adjuntos.map((a) => `<img src="cid:${a.cid}">`).join("");
    const r = prepararMail({ remitente: "operations@journaway.com", cuerpoHtml: html, adjuntos }, OPCIONES);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.imagenes).toHaveLength(MAX_IMAGENES);
    expect(r.adjuntosNoLeidos).toHaveLength(1);
    expect(r.cuerpo.match(/\[imagen \d+\]/g)).toEqual(Array.from({ length: MAX_IMAGENES }, (_, i) => `[imagen ${i + 1}]`));
  });

  it("una imagen que sola pesa más que el tope queda afuera y el mail se lee igual (M3-49)", () => {
    const grande = png(1000, 1000, MAX_BYTES_IMAGENES);
    const r = prepararMail(
      { remitente: "operations@journaway.com", cuerpoHtml: `<p>Hola</p><img src="cid:a">`, adjuntos: [{ nombre: "a.png", tipo: "image/png", contenido: grande, cid: "a" }] },
      OPCIONES,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.imagenes).toEqual([]);
    expect(r.adjuntosNoLeidos).toEqual(["a.png"]);
    expect(r.cuerpo).toBe("Hola");
  });
});

describe("M3-49 — un mail con imágenes pesadas se lee igual", () => {
  const kilroy = (): MailParaLeer => ({ remitente: "copenhagen@kilroy.dk", asunto: "DK9349014 - NEW BOOKING", ...mailKilroyPesado("DK9349014") });

  // Por peso: sin la más pesada (3.707.515) quedan 136.771 + 3.386.877 = 3.523.648 bytes, que entran en 5 MB.
  it("fila 1: DK1595014 da ok; queda afuera la más pesada y viajan las otras dos, en su orden", () => {
    const r = prepararMail(kilroy(), OPCIONES);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.agencia).toBe("Kilroy");
    expect(r.imagenes.map((i) => [i.numero, i.adjunta, Buffer.from(i.base64, "base64").byteLength])).toEqual([
      [1, false, TAMANOS_KILROY_PESADO.extra],
      [2, false, TAMANOS_KILROY_PESADO.pasaporte1],
    ]);
  });

  it("fila 2: la que queda afuera se anota; el cuerpo lleva solo las marcas de las que viajan, 1..N sin huecos", () => {
    const r = prepararMail(kilroy(), OPCIONES);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.adjuntosNoLeidos).toEqual(["image.png"]);
    expect(r.cuerpo.match(/\[imagen \d+\]/g)).toEqual(["[imagen 1]", "[imagen 2]"]);
    expect(r.cuerpo).toMatch(/Extra Requests \(transfers etc\):\s+\[imagen 1\]\s+Passenger 1 Information/);
    expect(r.cuerpo).toMatch(/Passport:\s+\[imagen 2\]\s+Passenger 2 Information/);
    expect(r.cuerpo).toMatch(/Passenger 2 Information[^[]*Passport:\s+This is a firm booking\./);
    expect(r.cuerpo).not.toMatch(/cid:/);
    expect(r.cuerpo).toContain("Tour code: HI_ARGENTINA_OD010D-677");
  });

  // Segundo caso real (Kilroy "2 new bookings - DK1598967", 2026-11-06): 5 PNG pegados, ~7,2 MB. Tamaños y medidas
  // aproximados, sacados del .msg, en el orden del archivo; el texto es sintético.
  it("fila 1: DK1598967 — cae solo la de ~4,0 MB y viajan las otras 4 (~3,3 MB), con la del vuelo bajo 'Flight info:'", () => {
    const pngs = [
      { cid: "p1", medidas: [1440, 1920], bytes: 4_000_000 },
      { cid: "vuelo", medidas: [1242, 2208], bytes: 3_000_000 },
      { cid: "p3", medidas: [1118, 367], bytes: 65_000 },
      { cid: "p4", medidas: [1136, 371], bytes: 68_000 },
      { cid: "p5", medidas: [1139, 773], bytes: 140_000 },
    ];
    const adjuntos = pngs.map((p) => ({ nombre: "image.png", tipo: "image/png", contenido: pngDeTamano(p.medidas[0], p.medidas[1], p.bytes), cid: p.cid }));
    const html = [
      "<p>NEW BOOKING 1</p>",
      `<img src="cid:p1">`,
      "<p>Flight info:</p>",
      `<img src="cid:vuelo">`,
      "<p>NEW BOOKING 2</p>",
      `<img src="cid:p3"><img src="cid:p4"><img src="cid:p5">`,
      "<p>This is a firm booking.</p>",
    ].join("");
    const r = prepararMail({ remitente: "copenhagen@kilroy.dk", asunto: "2 new bookings - DK9598967/test", cuerpoHtml: html, adjuntos }, OPCIONES);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.imagenes.map((i) => [i.numero, Buffer.from(i.base64, "base64").byteLength])).toEqual([
      [1, 3_000_000],
      [2, 65_000],
      [3, 68_000],
      [4, 140_000],
    ]);
    expect(r.adjuntosNoLeidos).toEqual(["image.png"]);
    expect(r.cuerpo.replace(/\s+/g, " ")).toBe(
      "NEW BOOKING 1 Flight info: [imagen 1] NEW BOOKING 2 [imagen 2] [imagen 3] [imagen 4] This is a firm booking.",
    );
  });

  it("fila 1: se dejan afuera las más pesadas, no las últimas; las marcas quedan 1..N sin huecos", () => {
    const mega = 1024 * 1024;
    const adjuntos = [
      { nombre: "a.png", tipo: "image/png", contenido: png(500, 500, 2 * mega), cid: "a" },
      { nombre: "b.png", tipo: "image/png", contenido: png(500, 500, 3 * mega), cid: "b" },
      { nombre: "c.png", tipo: "image/png", contenido: png(500, 500, 2 * mega), cid: "c" },
      { nombre: "d.png", tipo: "image/png", contenido: png(500, 500, 0.5 * mega), cid: "d" },
    ];
    const html = `<p>uno</p><img src="cid:a"><p>dos</p><img src="cid:b"><p>tres</p><img src="cid:c"><p>cuatro</p><img src="cid:d">`;
    const r = prepararMail({ remitente: "operations@journaway.com", cuerpoHtml: html, adjuntos }, OPCIONES);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.imagenes.map((i) => [i.numero, i.nombre])).toEqual([
      [1, "a.png"],
      [2, "c.png"],
      [3, "d.png"],
    ]);
    expect(r.adjuntosNoLeidos).toEqual(["b.png"]);
    expect(r.cuerpo.replace(/\s+/g, " ")).toBe("uno [imagen 1] dos tres [imagen 2] cuatro [imagen 3]");
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
