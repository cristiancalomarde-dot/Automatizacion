import { describe, expect, it } from "vitest";
import { MODELOS } from "@/lib/ia/modelos";
import { leerAgencias } from "./agencias";
import { mailDePrueba, pdfSintetico, textoDePrueba } from "./__fixtures__/cargar";
import {
  MAX_TOKENS_LECTURA,
  TOPE_POR_MAIL_USD,
  cuerpoDelMail,
  estimarPeorCaso,
  htmlATexto,
  limpiarCuerpo,
  prepararMail,
  revisarPdf,
} from "./preparar-mail";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Spec M2-02 filas 1-4 y 16-17 (qué entra y qué se le manda a la IA).

const REGLAS = leerAgencias(readFileSync(join(process.cwd(), "data", "agencias.csv"), "utf-8"));
const OPCIONES = { agencias: REGLAS, instrucciones: "x".repeat(3000), precios: MODELOS.lectura_mail.precios };

function pdfDePaginas(n: number): Uint8Array {
  const paginas = Array.from({ length: n }, (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R >> endobj`).join("\n");
  return new TextEncoder().encode(`%PDF-1.4\n${paginas}\n%%EOF\n`);
}

describe("prepararMail — la agencia por el remitente (filas 1 y 2)", () => {
  it("Kilroy, Journaway (operations@ y de@) y TourRadar se reconocen", () => {
    const base = { cuerpoTexto: "hola", asunto: "x" };
    expect(prepararMail({ ...base, remitente: "aarhus@kilroy.dk" }, OPCIONES)).toMatchObject({ ok: true, agencia: "Kilroy" });
    expect(prepararMail({ ...base, remitente: "operations@journaway.com" }, OPCIONES)).toMatchObject({ ok: true, agencia: "Journaway" });
    expect(prepararMail({ ...base, remitente: "Lea <de@journaway.com>" }, OPCIONES)).toMatchObject({ ok: true, agencia: "Journaway" });
    expect(prepararMail({ ...base, remitente: "system@sent-via.netsuite.com" }, OPCIONES)).toMatchObject({ ok: true, agencia: "TourRadar" });
  });

  it("un remitente que no es de una agencia piloto → para revisión con el motivo", () => {
    expect(prepararMail({ remitente: "alguien@gmail.com", cuerpoTexto: "hola" }, OPCIONES)).toEqual({
      ok: false,
      motivo: "remitente que no es de una agencia piloto",
    });
  });
});

describe("cuerpo del mail: texto plano o HTML convertido (mails reales de Kilroy, solo HTML)", () => {
  it("si el mail solo trae HTML, se pasa a texto limpio, con las tablas en renglones", () => {
    const texto = htmlATexto(textoDePrueba("kilroy-solo-html.html"));
    expect(texto).toContain("Tour code: HI_ARGENTINA_OD010D-677\nStart date: 06 Sep 2026\n");
    expect(texto).toContain("KILROY Reference.:DK7000001/test");
    expect(texto).toMatch(/Inventada\s*\|\s*Olga\s*\|\s*01JAN01/);
    expect(texto).toMatch(/Ficticio\s*\|\s*Pablo & Co\s*\|\s*02FEB02/);
    expect(texto).toContain("Café <ok> – fin");
    expect(texto).not.toMatch(/<(br|td|tr|th|p|table|style|script|meta)\b|color:red|alert\(1\)/i);
  });

  it("el texto plano manda; el HTML se usa solo si no hay texto", () => {
    expect(cuerpoDelMail({ remitente: "a@kilroy.dk", cuerpoTexto: "plano", cuerpoHtml: "<b>html</b>" })).toBe("plano");
    expect(cuerpoDelMail({ remitente: "a@kilroy.dk", cuerpoTexto: "  ", cuerpoHtml: "<b>html</b>" })).toBe("html");
  });

  it("un mail solo HTML llega a la IA como texto", () => {
    const r = prepararMail({ remitente: "aarhus@kilroy.dk", cuerpoHtml: textoDePrueba("kilroy-solo-html.html") }, OPCIONES);
    expect(r.ok && r.cuerpo).toContain("Start date: 06 Sep 2026");
    expect(r.ok && r.cuerpoOriginal).toContain("DK7000001/test");
  });
});

describe("adjuntos (filas 3 y 4)", () => {
  it("TourRadar: el PDF de la reserva se manda como documento", () => {
    const r = prepararMail(
      {
        remitente: "system@sent-via.netsuite.com",
        asunto: "Booking Statement 1376833",
        cuerpoTexto: "",
        adjuntos: [{ nombre: "Booking Statement 1376833.pdf", tipo: "application/pdf", contenido: pdfSintetico() }],
      },
      OPCIONES,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pdfs).toHaveLength(1);
    expect(r.pdfs[0]).toMatchObject({ nombre: "Booking Statement 1376833.pdf", paginas: 1 });
    expect(r.adjuntosNoLeidos).toEqual([]);
  });

  it("Kilroy sin adjuntos: solo el cuerpo", () => {
    const r = prepararMail(mailDePrueba("kilroy-od010d"), OPCIONES);
    expect(r.ok && r.pdfs).toEqual([]);
  });

  it("pasaportes e imágenes no se mandan: solo se anotan sus nombres", () => {
    const r = prepararMail(
      {
        ...mailDePrueba("journaway-spap05"),
        adjuntos: [
          { nombre: "Pasaporte 1.pdf", tipo: "application/pdf", contenido: pdfSintetico() },
          { nombre: "Pasaporte 2.jpg", tipo: "image/jpeg", tamano: 1000 },
        ],
      },
      OPCIONES,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pdfs).toEqual([]);
    expect(r.adjuntosNoLeidos).toEqual(["Pasaporte 1.pdf", "Pasaporte 2.jpg"]);
  });
});

describe("PDF ilegible (fila 17)", () => {
  it("un .pdf que no empieza con %PDF, uno vacío y uno protegido no se pueden abrir", () => {
    expect(revisarPdf(new TextEncoder().encode("<html>no soy un pdf</html>"))).toEqual({ ok: false });
    expect(revisarPdf(new Uint8Array())).toEqual({ ok: false });
    expect(revisarPdf(new TextEncoder().encode("%PDF-1.4\n1 0 obj << /Encrypt 5 0 R >> endobj\n%%EOF"))).toEqual({ ok: false });
    expect(revisarPdf(pdfSintetico())).toEqual({ ok: true, paginas: 1 });
  });

  it("el PDF de la reserva roto → para revisión con el motivo", () => {
    const r = prepararMail(
      {
        remitente: "system@sent-via.netsuite.com",
        cuerpoTexto: "",
        adjuntos: [{ nombre: "Booking Statement 1.pdf", tipo: "application/pdf", contenido: new TextEncoder().encode("roto") }],
      },
      OPCIONES,
    );
    expect(r).toEqual({ ok: false, motivo: "el PDF de la reserva no se puede abrir" });
  });
});

describe("tope por mail (fila 16)", () => {
  it("peor caso = (entrada estimada × precio + 4000 × precio de salida) / 1 M", () => {
    expect(MAX_TOKENS_LECTURA).toBe(4000);
    expect(TOPE_POR_MAIL_USD).toBe(0.1);
    // 3000 caracteres / 3 = 1000 tokens + 1 página = 3000 → 4000 × 2 + 4000 × 10
    expect(estimarPeorCaso({ caracteres: 3000, paginasPdf: 1, precios: MODELOS.lectura_mail.precios })).toBeCloseTo(0.048);
  });

  it("un cuerpo de 200.000 caracteres → mail demasiado grande", () => {
    const r = prepararMail({ remitente: "aarhus@kilroy.dk", cuerpoTexto: "Booking ".repeat(25_000) }, OPCIONES);
    expect(r).toEqual({ ok: false, motivo: "mail demasiado grande" });
  });

  it("un PDF de 40 páginas → mail demasiado grande", () => {
    const r = prepararMail(
      {
        remitente: "system@sent-via.netsuite.com",
        cuerpoTexto: "",
        adjuntos: [{ nombre: "Booking Statement 9.pdf", tipo: "application/pdf", contenido: pdfDePaginas(40) }],
      },
      OPCIONES,
    );
    expect(r).toEqual({ ok: false, motivo: "mail demasiado grande" });
  });

  it("el mail de Kilroy con 3 reservas y su respuesta citada entra bajo el tope, sin la cita repetida", () => {
    const mail = mailDePrueba("kilroy-dk1594100-respuesta");
    const r = prepararMail(mail, OPCIONES);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.peorCaso).toBeLessThan(TOPE_POR_MAIL_USD);
    expect(r.cuerpo).not.toContain("Enviado: viernes");
    expect(r.cuerpo.length).toBeLessThan((mail.cuerpoTexto ?? "").length);
    expect(r.cuerpo).toContain("HI_ARGENTINA_OD014-677");
  });
});

describe("limpiarCuerpo", () => {
  it("saca la firma después de '-- ' y los renglones citados con '>' que ya están arriba", () => {
    const cuerpo = "Tour code: X1\nStart date: 06 Sep 2026\n> Tour code: X1\n> Start date: 06 Sep 2026\n-- \nFirma\nTel 123";
    expect(limpiarCuerpo(cuerpo)).toBe("Tour code: X1\nStart date: 06 Sep 2026");
  });

  it("un mail citado con información nueva no se borra", () => {
    const cuerpo = "Please see below.\nDe: a@kilroy.dk\nEnviado: lunes\nAsunto: DK1\nTour code: NUEVO\nStart date: 01 Jan 2027";
    expect(limpiarCuerpo(cuerpo)).toContain("Tour code: NUEVO");
  });
});
