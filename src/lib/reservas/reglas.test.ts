import { describe, expect, it } from "vitest";
import { MOTIVOS_EMPAREJADO as ME } from "./emparejar/motivos";
import { MOTIVOS_INTERCAMBIO as MI } from "./intercambio";
import { MOTIVOS as MP } from "./preparar-mail";
import {
  CATEGORIAS_MOTIVO,
  categoriaDeMotivo,
  contarReservas,
  cuerpoComoTexto,
  esIdDeReserva,
  frasesDeMotivos,
  fraseDeMotivo,
  ordenarPorLlegada,
} from "./reglas";

// Spec M2-05 #6: cada motivo de "para revisión" se lee en voz de la app.

const GENERICO = "Esta reserva necesita que alguien la revise.";
const PROHIBIDO = [/\bIA\b/, /owner/i, /\bM[1-9]\b/, /data\//, /\b[01][.,]\d{2}\b/, /_/, /\.(csv|xlsx|ts)\b/];

/**
 * Un ejemplo de cada motivo que pueden escribir M2-01 a M2-04, por su
 * nombre en el módulo que lo genera. Si aparece un motivo nuevo sin ejemplo
 * acá, el test de completitud falla y obliga a darle su frase.
 */
const EJEMPLOS_EMPAREJADO: Record<keyof typeof ME, string[]> = {
  codigoNoCargado: [ME.codigoNoCargado("HI_TRAVEL_ARCH_EXP", "Patagonia Express"), ME.codigoNoCargado("X1", null)],
  noEstaEnCatalogo: [ME.noEstaEnCatalogo("Iguazu Falls on a Shoestring")],
  noSeguro: [ME.noSeguro("Iguazu"), ME.noSeguro("Iguazu", { codigo: "OD010A", confianza: 0.62 })],
  codigoFueraDeLista: [ME.codigoFueraDeLista("Iguazu")],
  nochesNoCoinciden: [ME.nochesNoCoinciden("Iguazu", "OD010A", 3, 2)],
  techo: [ME.techo],
  iaNoRespondio: [ME.iaNoRespondio],
  iaInvalida: [ME.iaInvalida("Iguazu")],
  iaNoDisponible: [ME.iaNoDisponible("Iguazu")],
  dudosos: [ME.dudosos(["fechas", "pax"])],
  tipoMail: Object.values(ME.tipoMail),
  sinProducto: [ME.sinProducto],
  sinFechaInicio: [ME.sinFechaInicio],
  lecturaFallida: Object.values(MP).map((m) => ME.lecturaFallida(m)),
  faltaVuelo: [
    ME.faltaVuelo("in", { ciudad: "Calama", codigos: ["CJC"] }, "el traslado de BOCHI04R"),
    ME.faltaVuelo("out", null, "el traslado al aeropuerto de Puerto Natales"),
  ],
  elegirVariante: [ME.elegirVariante("OD019")],
  productoNoCargado: [ME.productoNoCargado("ARUY01", "Argentina and Uruguay")],
  cargoExtra: [ME.cargoExtra({ importe: 120, moneda: "EUR" }), ME.cargoExtra({ importe: null, moneda: null })],
};

const EJEMPLOS_INTERCAMBIO: Record<keyof typeof MI, string[]> = {
  datosDistintos: [MI.datosDistintos],
  cancelacion: [MI.cancelacion],
  cancelacionSinReserva: [MI.cancelacionSinReserva],
  llegaronVuelos: [MI.llegaronVuelos],
  ambigua: [MI.ambigua(2, "DK1531608")],
  posibleDuplicada: [MI.posibleDuplicada],
};

describe("frase de cada motivo de revisión (#6)", () => {
  it("las seis frases de la spec, literales", () => {
    expect(fraseDeMotivo(ME.lecturaFallida(MP.cortada))).toBe(
      "No se pudo leer el mail de la agencia. Los datos de la reserva quedaron sin completar.",
    );
    expect(fraseDeMotivo(ME.productoNoCargado("ARUY01", "Argentina and Uruguay"))).toBe(
      "El producto que pide la agencia no está en el catálogo.",
    );
    expect(fraseDeMotivo(ME.noSeguro("Iguazu", { codigo: "OD010A", confianza: 0.62 }))).toBe(
      "No se pudo reconocer el producto con seguridad. Revisá el mail para confirmar cuál es.",
    );
    expect(fraseDeMotivo(ME.faltaVuelo("in", null, "el traslado de OD019"))).toBe(
      "Faltan los datos de vuelo, y el producto incluye traslados.",
    );
    expect(fraseDeMotivo(MI.ambigua(3, "DK1"))).toBe(
      "Hay más de una reserva con este número de la agencia y no se sabe a cuál corresponde este mail.",
    );
    expect(fraseDeMotivo(MI.posibleDuplicada)).toBe(
      "Esta reserva se parece a otra (misma agencia, producto y fechas). Revisala antes de seguir.",
    );
  });

  it("un motivo desconocido muestra la frase genérica", () => {
    expect(fraseDeMotivo("algo_que_nadie_escribio")).toBe(GENERICO);
    expect(fraseDeMotivo("")).toBe(GENERICO);
  });

  it("los ejemplos cubren todos los motivos que existen (si se suma uno, hay que darle su frase)", () => {
    expect(Object.keys(EJEMPLOS_EMPAREJADO).sort()).toEqual(Object.keys(ME).sort());
    expect(Object.keys(EJEMPLOS_INTERCAMBIO).sort()).toEqual(Object.keys(MI).sort());
    expect(Object.keys(EJEMPLOS_EMPAREJADO.tipoMail).length).toBeGreaterThan(0);
  });

  const todos = [...Object.entries(EJEMPLOS_EMPAREJADO), ...Object.entries(EJEMPLOS_INTERCAMBIO)].flatMap(
    ([nombre, ejemplos]) => ejemplos.map((m) => [nombre, m] as const),
  );

  it.each(todos)("%s tiene su frase propia y en voz de la app", (_nombre, motivo) => {
    expect(categoriaDeMotivo(motivo)).not.toBe("generico");
    const frase = fraseDeMotivo(motivo);
    expect(frase).not.toBe(GENERICO);
    for (const p of PROHIBIDO) expect(frase, `${frase} contiene ${p}`).not.toMatch(p);
  });

  it("toda categoría tiene su frase y ninguna dice jerga interna", () => {
    for (const c of CATEGORIAS_MOTIVO) {
      const frase = fraseDeMotivo(c);
      expect(frase.length).toBeGreaterThan(10);
      for (const p of PROHIBIDO) expect(frase).not.toMatch(p);
    }
  });

  it("un motivo guardado como código de la lista cerrada también se traduce", () => {
    expect(fraseDeMotivo("falta_vuelo")).toBe("Faltan los datos de vuelo, y el producto incluye traslados.");
  });

  it("mantiene lo útil: el monto del cargo extra y el código de la variante", () => {
    expect(fraseDeMotivo(ME.cargoExtra({ importe: 120, moneda: "EUR" }))).toBe(
      "TourRadar mandó un cargo extra (+120 EUR): puede ser un servicio nuevo. Revisalo.",
    );
    expect(fraseDeMotivo(ME.elegirVariante("OD019"))).toContain("OD019");
    expect(fraseDeMotivo(ME.dudosos(["fechas", "pax"]))).toContain("fechas, cantidad de pasajeros");
  });

  it("frasesDeMotivos no repite la misma frase (dos vuelos que faltan = un renglón)", () => {
    const frases = frasesDeMotivos([
      ME.faltaVuelo("in", null, "el traslado de A"),
      ME.faltaVuelo("out", null, "el traslado de A"),
      MI.posibleDuplicada,
    ]);
    expect(frases).toEqual([
      "Faltan los datos de vuelo, y el producto incluye traslados.",
      "Esta reserva se parece a otra (misma agencia, producto y fechas). Revisala antes de seguir.",
    ]);
  });
});

describe("lista: orden y total", () => {
  const fila = (id: string, llego: string, dePrueba = false) => ({ id, llego, dePrueba });

  it("la que llegó más recientemente, arriba", () => {
    const filas = [fila("a", "2026-10-01T10:00:00Z"), fila("b", "2026-10-03T10:00:00Z"), fila("c", "2026-10-02T10:00:00Z")];
    expect(ordenarPorLlegada(filas).map((f) => f.id)).toEqual(["b", "c", "a"]);
  });

  it("cuenta las reales y las de prueba", () => {
    expect(contarReservas([fila("a", "x"), fila("b", "x", true), fila("c", "x", true)])).toEqual({ total: 3, dePrueba: 2 });
  });
});

describe("id de reserva", () => {
  it("solo un uuid es un id válido", () => {
    expect(esIdDeReserva("6f1c2b4e-2d3a-4b5c-9d8e-0a1b2c3d4e5f")).toBe(true);
    expect(esIdDeReserva("123")).toBe(false);
    expect(esIdDeReserva("../catalogo")).toBe(false);
    expect(esIdDeReserva("")).toBe(false);
  });
});

describe("cuerpo del mail como texto (#13)", () => {
  it("usa el texto plano si lo hay", () => {
    expect(cuerpoComoTexto({ cuerpoTexto: "Hola\n<b>x</b>", cuerpoHtml: "<p>otro</p>" })).toBe("Hola\n<b>x</b>");
  });

  it("si solo hay HTML, le saca las etiquetas y deja el texto", () => {
    const html = '<p>Booking <a href="http://x.test">link</a></p><script>alert(1)</script><img src="http://x.test/a.png">';
    const texto = cuerpoComoTexto({ cuerpoTexto: null, cuerpoHtml: html });
    expect(texto).toContain("Booking link");
    expect(texto).not.toMatch(/<|alert/);
  });

  it("sin cuerpo, vacío", () => {
    expect(cuerpoComoTexto({ cuerpoTexto: null, cuerpoHtml: null })).toBe("");
  });
});
