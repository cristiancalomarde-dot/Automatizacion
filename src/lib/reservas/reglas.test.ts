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
  motivoEnPantalla,
  ordenarParaTrabajar,
  ordenarPorLlegada,
} from "./reglas";

// Spec M2-05 #6: cada motivo de "para revisión" se lee en voz de la app.

const GENERICO = "Esta reserva necesita que alguien la revise.";
const PROHIBIDO = [/\bIA\b/, /owner/i, /\bM[1-9]\b/, /data\//, /\b[01][.,]\d{2}\b/, /\b[a-z]+_[a-z_]+\b/, /\.(csv|xlsx|ts)\b/];

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
    expect(motivoEnPantalla(ME.lecturaFallida(MP.cortada)).frase).toBe(
      "No se pudo leer el mail de la agencia. Los datos de la reserva quedaron sin completar.",
    );
    expect(motivoEnPantalla(ME.codigoNoCargado("X1", null)).frase).toBe(
      "El producto que pide la agencia no está en el catálogo.",
    );
    expect(motivoEnPantalla(ME.noSeguro("Iguazu", { codigo: "OD010A", confianza: 0.62 })).frase).toBe(
      "No se pudo reconocer el producto con seguridad. Revisá el mail para confirmar cuál es.",
    );
    expect(motivoEnPantalla(ME.faltaVuelo("in", null, "el traslado de OD019")).frase).toBe(
      "Faltan los datos de vuelo, y el producto incluye traslados.",
    );
    expect(motivoEnPantalla(MI.ambigua(3, "DK1")).frase).toBe(
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
    const { detalle } = motivoEnPantalla(motivo);
    if (detalle) for (const p of PROHIBIDO) expect(detalle, `${detalle} contiene ${p}`).not.toMatch(p);
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

  it("frasesDeMotivos no repite el mismo renglón, pero cada vuelo que falta tiene el suyo", () => {
    const frases = frasesDeMotivos([
      ME.faltaVuelo("in", null, "el traslado de A"),
      ME.faltaVuelo("in", null, "el traslado de A"),
      ME.faltaVuelo("out", null, "el traslado de A"),
      MI.posibleDuplicada,
      MI.posibleDuplicada,
    ]);
    expect(frases).toEqual([
      { frase: "Faltan los datos de vuelo, y el producto incluye traslados.", detalle: "Vuelo de llegada, para el traslado de A." },
      { frase: "Faltan los datos de vuelo, y el producto incluye traslados.", detalle: "Vuelo de salida, para el traslado de A." },
      { frase: "Esta reserva se parece a otra (misma agencia, producto y fechas). Revisala antes de seguir.", detalle: null },
    ]);
  });
});

describe("el detalle concreto de cada motivo (frase en llano + qué vuelo, qué producto, qué código)", () => {
  const d = (motivo: string) => motivoEnPantalla(motivo);

  it("falta el vuelo: cuál, a qué ciudad y para qué traslado", () => {
    expect(d(ME.faltaVuelo("in", { ciudad: "Calama", codigos: ["CJC"] }, "el traslado de OD030"))).toEqual({
      frase: "Faltan los datos de vuelo, y el producto incluye traslados.",
      detalle: "Vuelo de llegada a Calama (CJC), para el traslado de OD030.",
    });
    expect(d(ME.faltaVuelo("out", { ciudad: "Puerto Natales", codigos: ["PNT", "PUQ"] }, "el traslado al aeropuerto")).detalle).toBe(
      "Vuelo de salida de Puerto Natales (PNT o PUQ), para el traslado al aeropuerto.",
    );
  });

  it("producto que existe pero todavía no está cargado: no dice que no está en el catálogo", () => {
    const m = d(ME.productoNoCargado("ARUY01", "Argentina and Uruguay"));
    expect(m.frase).toBe("El producto que pide la agencia existe, pero todavía no está cargado en el catálogo.");
    expect(m.detalle).toBe("Es ARUY01 (Argentina and Uruguay).");
  });

  it("producto que no está en el catálogo: cómo lo pide la agencia", () => {
    expect(d(ME.codigoNoCargado("HI_TRAVEL_ARCH_EXP", "Patagonia Express")).detalle).toBe(
      "La agencia lo pide como HI_TRAVEL_ARCH_EXP (Patagonia Express).",
    );
    expect(d(ME.codigoNoCargado("X1", null)).detalle).toBe("La agencia lo pide como X1.");
    expect(d(ME.noEstaEnCatalogo("Iguazu Falls on a Shoestring")).detalle).toBe(
      "La agencia lo pide como Iguazu Falls on a Shoestring.",
    );
  });

  it("producto no seguro: cómo lo pide la agencia y qué podría ser, sin números de confianza", () => {
    expect(d(ME.noSeguro("Iguazu", { codigo: "OD010A", confianza: 0.62 })).detalle).toBe(
      "La agencia lo pide como Iguazu. Podría ser OD010A.",
    );
    expect(d(ME.noSeguro("Iguazu Falls on a Shoestring (3N)")).detalle).toBe(
      "La agencia lo pide como Iguazu Falls on a Shoestring (3N).",
    );
    expect(d(ME.nochesNoCoinciden("Iguazu", "OD010A", 3, 2)).detalle).toBe(
      "La agencia lo pide como Iguazu. Podría ser OD010A, pero ese tour tiene 3 noches y el mail pide 2.",
    );
    expect(d(ME.codigoFueraDeLista("Iguazu")).detalle).toBe("La agencia lo pide como Iguazu.");
    expect(d(ME.iaInvalida("Iguazu")).detalle).toBe("La agencia lo pide como Iguazu.");
    expect(d(ME.iaNoDisponible("Iguazu")).detalle).toBe("La agencia lo pide como Iguazu.");
    expect(d(ME.techo).detalle).toBe("Se llegó al tope de gasto del mes.");
    expect(d(ME.iaNoRespondio).detalle).toBeNull();
  });

  it("referencia ambigua: cuántas reservas y con qué número", () => {
    expect(d(MI.ambigua(2, "DK1531608")).detalle).toBe("Hay 2 reservas con el número DK1531608.");
  });

  it("lectura fallida: por qué, en llano", () => {
    expect(d(ME.lecturaFallida(MP.pdf)).detalle).toBe("El PDF de la reserva no se puede abrir.");
    expect(d(ME.lecturaFallida(MP.techo)).detalle).toBe("Se llegó al tope de gasto del mes.");
    expect(d(ME.lecturaFallida("algo nuevo")).detalle).toBeNull();
  });

  it("cargo extra de TourRadar: dice el monto si lo hay, y si no, igual se entiende", () => {
    expect(d(ME.cargoExtra({ importe: 120.5, moneda: "USD" })).frase).toBe(
      "TourRadar mandó un cargo extra (+120.50 USD): puede ser un servicio nuevo. Revisalo.",
    );
    expect(d(ME.cargoExtra({ importe: null, moneda: null }))).toEqual({
      frase: "TourRadar mandó un cargo extra: puede ser un servicio nuevo. Revisalo.",
      detalle: null,
    });
  });

  it("si el motivo guardado no trae detalle, queda solo la frase", () => {
    expect(d("falta_vuelo")).toEqual({ frase: "Faltan los datos de vuelo, y el producto incluye traslados.", detalle: null });
    expect(d("algo_que_nadie_escribio")).toEqual({ frase: GENERICO, detalle: null });
    expect(d(MI.posibleDuplicada).detalle).toBeNull();
  });

  it("fraseDeMotivo junta la frase y el detalle en un texto", () => {
    expect(fraseDeMotivo(ME.faltaVuelo("in", { ciudad: "Calama", codigos: ["CJC"] }, "el traslado de OD030"))).toBe(
      "Faltan los datos de vuelo, y el producto incluye traslados. Vuelo de llegada a Calama (CJC), para el traslado de OD030.",
    );
  });
});

describe("lista: orden y total", () => {
  const fila = (id: string, llego: string, dePrueba = false) => ({ id, llego, dePrueba });

  it("la que llegó más recientemente, arriba", () => {
    const filas = [fila("a", "2026-10-01T10:00:00Z"), fila("b", "2026-10-03T10:00:00Z"), fila("c", "2026-10-02T10:00:00Z")];
    expect(ordenarPorLlegada(filas).map((f) => f.id)).toEqual(["b", "c", "a"]);
  });

  it("owner 2026-10-15: primero las para revisión; en cada grupo, el viaje más próximo arriba y sin fecha al final", () => {
    const f = (id: string, estado: string, fechaInicio: string | null, llego = "2026-10-01T10:00:00Z") => ({ id, estado, fechaInicio, llego });
    const filas = [
      f("recibida-sin-fecha", "recibida", null),
      f("revision-lejos", "para_revision", "2027-03-01"),
      f("recibida-cerca", "recibida", "2026-11-01"),
      f("revision-sin-fecha", "para_revision", null),
      f("revision-cerca", "para_revision", "2026-10-20"),
      f("recibida-lejos", "recibida", "2027-01-01"),
      // Mismo viaje y estado: la que llegó más recientemente, arriba.
      f("revision-cerca-nueva", "para_revision", "2026-10-20", "2026-10-05T10:00:00Z"),
    ];
    expect(ordenarParaTrabajar(filas).map((x) => x.id)).toEqual([
      "revision-cerca-nueva",
      "revision-cerca",
      "revision-lejos",
      "revision-sin-fecha",
      "recibida-cerca",
      "recibida-lejos",
      "recibida-sin-fecha",
    ]);
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
