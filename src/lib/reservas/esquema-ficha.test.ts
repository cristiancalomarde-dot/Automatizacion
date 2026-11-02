import { describe, expect, it } from "vitest";
import { fichaGrabada } from "./__fixtures__/cargar";
import { ESQUEMA_FICHA_IA, validarFichaIA } from "./esquema-ficha";

// Spec M2-02 fila 5: cada dato con su valor y su confianza; las listas, con
// confianza por elemento. Si falta una confianza, la respuesta se rechaza.

describe("esquema de la ficha (fila 5)", () => {
  it("todas las respuestas grabadas válidas cumplen el esquema", () => {
    for (const nombre of [
      "kilroy-od010d",
      "kilroy-5c01",
      "kilroy-dk1576932",
      "kilroy-dk1594100",
      "kilroy-rio-starter",
      "tourradar-1376833",
      "tourradar-1377598-opcionales",
      "tourradar-cancelacion-1363612",
      "tourradar-cargo-1377598",
      "journaway-spap05",
      "journaway-all-san-pedro",
      "journaway-iguazu-arg",
      "pdf-ilegible",
    ]) {
      expect(validarFichaIA(fichaGrabada(nombre)), nombre).toMatchObject({ ok: true });
    }
  });

  it("si falta la confianza de un dato, se rechaza", () => {
    const x = fichaGrabada("kilroy-od010d");
    x.pax = { valor: 2 };
    expect(validarFichaIA(x)).toMatchObject({ ok: false, error: expect.stringMatching(/pax/) });
  });

  it("si falta la confianza de un elemento de una lista, se rechaza", () => {
    const x = fichaGrabada("journaway-spap05") as { vuelos: Array<Record<string, unknown>> };
    delete x.vuelos[2].confianza;
    expect(validarFichaIA(x)).toMatchObject({ ok: false, error: expect.stringMatching(/vuelos\[2\]/) });
  });

  it("una confianza fuera de 0..1, un tipo de mail desconocido o un campo de más se rechazan", () => {
    const a = fichaGrabada("kilroy-od010d");
    a.pax = { valor: 2, confianza: 1.5 };
    expect(validarFichaIA(a).ok).toBe(false);
    const b = fichaGrabada("kilroy-od010d");
    b.tipo_mail = { valor: "orden_de_compra", confianza: 1 };
    expect(validarFichaIA(b).ok).toBe(false);
    const c = fichaGrabada("kilroy-od010d");
    c.accion = "mandar mail";
    expect(validarFichaIA(c).ok).toBe(false);
  });

  it("el esquema que va a la API es estricto: sin propiedades de más en ningún objeto", () => {
    const objetos: Array<Record<string, unknown>> = [];
    const recorrer = (n: unknown) => {
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      if (o.type === "object") objetos.push(o);
      Object.values(o).forEach(recorrer);
    };
    recorrer(ESQUEMA_FICHA_IA);
    expect(objetos.length).toBeGreaterThan(5);
    for (const o of objetos) {
      expect(o.additionalProperties).toBe(false);
      expect(Object.keys(o.properties as object).sort()).toEqual([...(o.required as string[])].sort());
    }
  });
});

describe("esquema compatible con la API (límite de 16 parámetros con unión)", () => {
  it("el esquema que va a la API no tiene uniones (anyOf ni listas de tipos)", () => {
    const texto = JSON.stringify(ESQUEMA_FICHA_IA);
    expect(texto).not.toMatch(/anyOf|oneOf|"type":\[/);
  });

  it("la IA marca lo vacío con \"\" (y 0 en pax y noches): se lee como vacío", () => {
    const x = fichaGrabada("kilroy-od010d") as Record<string, unknown> & { productos: Array<Record<string, unknown>> };
    x.titulo_paquete = { valor: "", confianza: 0 };
    x.agencia = { valor: "", confianza: 0 };
    x.pax = { valor: 0, confianza: 0 };
    x.aviso = "";
    x.productos[0].codigo = "";
    x.productos[0].noches = 0;
    x.productos[0].fecha_fin = "";
    const r = validarFichaIA(x);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ficha.titulo_paquete.valor).toBeNull();
    expect(r.ficha.agencia.valor).toBeNull();
    expect(r.ficha.pax.valor).toBeNull();
    expect(r.ficha.aviso).toBeNull();
    expect(r.ficha.productos[0]).toMatchObject({ codigo: null, noches: null, fecha_fin: null });
  });
});

describe("M3-43 — pasaporte y teléfono de cada pasajero", () => {
  it("el esquema pide pasaporte y teléfono por pasajero (vacío si el mail no los escribe)", () => {
    const pasajero = (ESQUEMA_FICHA_IA.properties.pasajeros as { items: { properties: Record<string, unknown> } }).items;
    expect(Object.keys(pasajero.properties)).toEqual(expect.arrayContaining(["pasaporte", "telefono"]));
  });

  it("Kilroy con el teléfono en el cuerpo: viaja; sin pasaporte escrito, queda vacío", () => {
    const r = validarFichaIA(fichaGrabada("kilroy-dk1576932"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ficha.pasajeros.map((p) => [p.pasaporte, p.telefono])).toEqual([
      [null, "+45 00000001"],
      [null, "+45 00000002"],
    ]);
  });

  it("Adventure360 escribe pasaporte y teléfono: viajan los dos", () => {
    const r = validarFichaIA(fichaGrabada("adventure360-brarch26"));
    expect(r.ok && r.ficha.pasajeros[0]).toMatchObject({ pasaporte: "000000000", telefono: "+440000000000" });
  });

  it("un mail sin los datos los deja vacíos; si la IA no manda el campo (forma anterior a v6), queda vacío sin rechazar la lectura", () => {
    const r = validarFichaIA(fichaGrabada("kilroy-od010d"));
    expect(r.ok && r.ficha.pasajeros.every((p) => p.pasaporte === null && p.telefono === null)).toBe(true);
    const x = fichaGrabada("kilroy-od010d") as { pasajeros: Array<Record<string, unknown>> };
    delete x.pasajeros[0].telefono;
    delete x.pasajeros[0].pasaporte;
    const sin = validarFichaIA(x);
    expect(sin.ok && sin.ficha.pasajeros[0]).toMatchObject({ pasaporte: null, telefono: null });
    // Un tipo inválido sí se rechaza.
    const y = fichaGrabada("kilroy-od010d") as { pasajeros: Array<Record<string, unknown>> };
    y.pasajeros[0].telefono = 4512345678;
    expect(validarFichaIA(y)).toMatchObject({ ok: false, error: expect.stringMatching(/pasajeros\[0\]\.telefono/) });
  });
});
