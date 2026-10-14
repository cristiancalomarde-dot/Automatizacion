import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leerArchivoDeMail, listarArchivos, textoDelDocx } from "./leer-archivo";

// Spec M2-06 filas 1 y 2 — fixtures INVENTADOS (sin datos reales).
const DIR = join(__dirname, "__fixtures__");
const PDF_SUELTO = "1# Booking Statement 0000044 - 00000044 - vendorbill notas del owner.pdf";

describe("listarArchivos (fila 1)", () => {
  it("una carpeta: solo los .docx, .pdf y .eml, en orden alfabético", () => {
    const nombres = listarArchivos(DIR).map((r) => r.split(/[\\/]/).pop());
    expect(nombres).toEqual([PDF_SUELTO, "kilroy-copia.docx", "kilroy-inventado.eml", "tourradar-con-pdf.eml"]);
  });

  it("un archivo: ese solo", () => {
    expect(listarArchivos(join(DIR, "kilroy-inventado.eml"))).toEqual([join(DIR, "kilroy-inventado.eml")]);
  });

  it("varias rutas: una detrás de la otra, sin repetir", () => {
    const eml = join(DIR, "kilroy-inventado.eml");
    expect(listarArchivos([eml, eml, join(DIR, "kilroy-copia.docx")])).toHaveLength(2);
  });

  it("una ruta que no existe: error claro", () => {
    expect(() => listarArchivos(join(DIR, "no-existe"))).toThrow(/No existe .*no-existe/);
  });

  it("un archivo de otro tipo: error claro", () => {
    expect(() => listarArchivos(join(DIR, "notas.txt"))).toThrow(/solo se procesan \.docx, \.pdf y \.eml/);
  });
});

describe("leerArchivoDeMail (fila 2): los tres formatos terminan en el mismo 'mail de entrada'", () => {
  it(".eml estilo Kilroy: remitente, asunto, fecha y cuerpo", async () => {
    const m = await leerArchivoDeMail(join(DIR, "kilroy-inventado.eml"));
    expect(m).toMatchObject({
      origen: "archivo",
      archivoOrigen: "kilroy-inventado.eml",
      remitente: "testtown@kilroy.dk",
      remitenteNombre: "KILROY Testtown",
      destinatarios: ["sales@hitravel.com.ar"],
      asunto: "DK0000042/abcd - Overland San Pedro de Atacama to Uyuni and La Paz - 7 Days - KILROY booking request",
      fechaMail: "2026-10-12T07:30:00.000Z",
      adjuntos: [],
      dePrueba: true,
    });
    expect(m.cuerpoTexto).toContain("KILROY Reference.:DK0000042/abcd");
  });

  it(".eml con un PDF adjunto: el PDF viaja con su contenido; la imagen, sin contenido", async () => {
    const m = await leerArchivoDeMail(join(DIR, "tourradar-con-pdf.eml"));
    expect(m.remitente).toBe("system@sent-via.netsuite.com");
    expect(m.asunto).toBe("Booking Statement 0000042 - 00000042 - vendorbill");
    const pdf = m.adjuntos!.find((a) => a.tipo === "application/pdf")!;
    expect(pdf.nombre).toBe("Booking Statement 0000042.pdf");
    expect(Buffer.from(pdf.contenido!).subarray(0, 5).toString()).toBe("%PDF-");
    const imagen = m.adjuntos!.find((a) => a.tipo === "image/png")!;
    expect(imagen.contenido).toBeUndefined();
    expect(imagen.tamano).toBeGreaterThan(0);
  });

  it(".docx: solo el texto, con el remitente y el asunto de la agencia que figura en la copia; sin imágenes", async () => {
    const m = await leerArchivoDeMail(join(DIR, "kilroy-copia.docx"));
    expect(m).toMatchObject({
      origen: "archivo",
      archivoOrigen: "kilroy-copia.docx",
      remitente: "testtown@kilroy.dk",
      asunto: "DK0000043/efgh - Iguazu Falls Combined - KILROY booking request",
      fechaMail: "2026-10-12T12:30:00.000Z",
      adjuntos: [],
    });
    expect(m.cuerpoTexto).toContain("Tour code: HI_ARGENTINA_OD010D-677");
    expect(m.cuerpoTexto).toContain("Hola, les reenvío la reserva.");
    expect(m.cuerpoTexto).not.toMatch(/drawing|image1|PNG/i);
  });

  it(".pdf suelto: un mail de TourRadar con el PDF adjunto; el asunto sale del nombre sin las notas del owner", async () => {
    const m = await leerArchivoDeMail(join(DIR, PDF_SUELTO));
    expect(m).toMatchObject({
      origen: "archivo",
      remitente: "system@sent-via.netsuite.com",
      asunto: "Booking Statement 0000044 - 00000044 - vendorbill",
      cuerpoTexto: "",
    });
    expect(m.adjuntos).toHaveLength(1);
    expect(m.adjuntos![0]).toMatchObject({ nombre: "Booking Statement 0000044 - 00000044 - vendorbill.pdf", tipo: "application/pdf" });
    expect(m.adjuntos![0].contenido!.byteLength).toBe(readFileSync(join(DIR, PDF_SUELTO)).byteLength);
  });

  it("idempotencia: el Message-ID sale del contenido del archivo (mismo contenido = mismo id; nunca el Message-ID real)", async () => {
    const a = await leerArchivoDeMail(join(DIR, "kilroy-inventado.eml"));
    const b = await leerArchivoDeMail(join(DIR, "kilroy-inventado.eml"));
    expect(a.messageId).toBe(b.messageId);
    expect(a.messageId).toMatch(/^<archivo-[0-9a-f]{64}@modo-prueba\.hitravel\.local>$/);
    expect(a.messageId).not.toContain("inventado-1@kilroy.dk");
    const c = await leerArchivoDeMail(join(DIR, "tourradar-con-pdf.eml"));
    expect(c.messageId).not.toBe(a.messageId);
  });

  it("un .docx de 9 MB casi todo imágenes: el texto sale de word/document.xml y no trae las imágenes", () => {
    const texto = textoDelDocx(new Uint8Array(readFileSync(join(DIR, "kilroy-copia.docx"))));
    expect(texto.split("\n")).toContain("Asunto: DK0000043/efgh - Iguazu Falls Combined - KILROY booking request");
    expect(texto.length).toBeLessThan(1000);
  });
});
