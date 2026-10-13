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
