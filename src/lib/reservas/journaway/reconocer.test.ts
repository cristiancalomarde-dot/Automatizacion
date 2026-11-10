import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ProponerProducto } from "../emparejar/emparejar";
import {
  casoJournaway,
  conCodigo,
  conTitulo,
  lecturaDeVariante,
  original,
  OVERLAND,
  overlandCorrido,
  SAN_PEDRO,
  sinTour,
  type Variante,
} from "../../../../tests/fixtures/journaway/fichas";
import { catalogoJournawayDePrueba } from "../../../../tests/fixtures/journaway/catalogo";
import { reconocerJournaway, type ContextoJournaway } from "./reconocer";
import { leerSenalesJournaway } from "./senales";

/**
 * Spec M2-09 filas 1 a 7: el reconocedor, con fichas ya extraídas (sin IA
 * para leer). La IA de la propuesta de producto es falsa y cuenta las llamadas.
 */

const senales = leerSenalesJournaway(readFileSync(join(process.cwd(), "data", "journaway-senales.csv"), "utf-8"));

function contexto(proponer?: ProponerProducto): ContextoJournaway {
  const { catalogo, journaway } = catalogoJournawayDePrueba();
  return { catalogo, journaway, senales, proponer };
}

function iaQueNoSabe() {
  return vi.fn<ProponerProducto>(async () => ({
    resultado: { tipo: "respuesta", codigo: null, confianza: 0.95, motivo: "no está" },
    llamada: null,
    costo: 0,
  }));
}

const textoDe = (c: { mail: { asunto?: string | null; cuerpoTexto?: string | null } }) => `${c.mail.asunto ?? ""}\n${c.mail.cuerpoTexto ?? ""}`;

async function reconocer(v: Variante, proponer: ProponerProducto = iaQueNoSabe()) {
  const caso = lecturaDeVariante(v);
  return reconocerJournaway(caso.ficha, textoDe(caso), contexto(proponer));
}

const codigos = (r: Awaited<ReturnType<typeof reconocer>>) => r.reservas.map((x) => x.producto?.codigo ?? null);

describe("los 4 mails de ejemplo (spec M2-09 §3)", () => {
  it("A: IGRE01 con la nota de half-day, sin IA", async () => {
    const ia = iaQueNoSabe();
    const caso = casoJournaway("A");
    const r = await reconocerJournaway(caso.ficha, textoDe(caso), contexto(ia));
    expect(codigos(r)).toEqual(["IGRE01"]);
    expect(r.reservas[0].motivos).toEqual([]);
    expect(r.reservas[0].notas).toContain("Journaway lo llama half-day; es el full day");
    expect(r.reservas[0].tours[0]).toMatchObject({ fecha: "2027-06-14", pickUp: "Hotel Rafain Centro" });
    expect(ia).not.toHaveBeenCalled();
  });

  it("B: IGRE02, sin la nota de half-day", async () => {
    const r = await reconocer(original("B"));
    expect(codigos(r)).toEqual(["IGRE02"]);
    expect(r.reservas[0].motivos).toEqual([]);
    expect(r.reservas[0].notas.join(" ")).not.toMatch(/half-day/);
  });

  it("C: SPAP01 + SPAP03 (la única combinación que cierra), cada tour con su fecha; SPAP01 sin el traslado de salida", async () => {
    const r = await reconocer(original("C"));
    expect(codigos(r)).toEqual(["SPAP01", "SPAP03"]);
    const [a, c] = r.reservas;
    expect(a.motivos).toEqual([]);
    expect(c.motivos).toEqual([]);
    expect(a.tours.map((t) => t.producto?.codigo).sort()).toEqual(["SPAE01", "SPAE02", "SPAE03", "SPAE04"]);
    expect(c.tours.map((t) => t.producto?.codigo).sort()).toEqual(["SPAE05", "SPAE06", "SPAE07"]);
    expect(c.tours.find((t) => t.producto?.codigo === "SPAE07")?.fecha).toBe("2027-03-21");
    expect(a.sinTrasladoDe).toBe("salida");
    expect(c.sinTrasladoDe).toBeNull();
  });

  it("D: SPAP05 (llega el 11.10, Overland el 15.10: 4 noches), con los 3 días del Overland en UYUO01", async () => {
    const r = await reconocer(original("D"));
    expect(codigos(r)).toEqual(["SPAP05"]);
    expect(r.reservas[0].motivos).toEqual([]);
    const overland = r.reservas[0].tours.filter((t) => t.producto?.codigo === "UYUO01");
    expect(overland.map((t) => t.fecha)).toEqual(["2026-10-15", "2026-10-16", "2026-10-17"]);
  });
});

describe("fila 1 — nuestro código, primero", () => {
  it("el mail A con IGRE01 da IGRE01 por código, sin IA", async () => {
    const ia = iaQueNoSabe();
    const r = await reconocer(conCodigo(original("A"), "IGRE01"), ia);
    expect(codigos(r)).toEqual(["IGRE01"]);
    expect(r.reservas[0].origen).toBe("codigo");
    expect(ia).not.toHaveBeenCalled();
  });

  it("un código que no está en el catálogo va a revisión", async () => {
    const r = await reconocer(conCodigo(original("A"), "SPAP99"));
    expect(r.reservas).toHaveLength(1);
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].motivos).toEqual(["El código SPAP99 no está en el catálogo"]);
  });

  it("un código que contradice los tours va a revisión con las dos versiones", async () => {
    const r = await reconocer(conCodigo(original("C"), "SPAP02"));
    expect(r.reservas).toHaveLength(1);
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].motivos[0]).toMatch(/El mail dice SPAP02, pero los tours dan SPAP01 \+ SPAP03/);
  });

  it("el mail D con SPAP06: para HI Travel es el mismo tour (owner 2026-10-12): se usa el código, con una nota", async () => {
    const r = await reconocer(conCodigo(original("D"), "SPAP06"));
    expect(codigos(r)).toEqual(["SPAP06"]);
    expect(r.reservas[0].motivos).toEqual([]);
    expect(r.reservas[0].notas.join(" ")).toMatch(/El mail dice SPAP06, pero son 4 noches en San Pedro: sería SPAP05/);
  });

  describe("M3-54: un código para un solo tour no se come los demás (67734240405)", () => {
    // El mail trae FTEE05 (el Chaltén) y la IA lo copió a todos los renglones.
    const nombres = {
      traslado: "Shared Transfer: IGU - La Reserva Virgin Lodge",
      cataratas: "From Puerto Iguazú: Half-day tour to the Argentine Iguazú Falls",
      perito: "From El Calafate: Full-day tour to the Perito Moreno Glacier",
      chalten: "From El Calafate: Full-day tour to El Chaltén",
      esmeralda: "From Ushuaia: Hike through Tierra del Fuego to the Emerald Lagoon",
    };
    const variante = (): Variante => {
      const v = original("A");
      const renglon = (nombre: string, fecha: string) => ({ ...v.ficha.productos[0], nombre, codigo: "FTEE05", fecha_inicio: fecha, fecha_fin: null, punto_recogida: null });
      return {
        texto: `${v.texto}\nFTEE05`,
        ficha: {
          ...v.ficha,
          productos: [
            renglon(nombres.cataratas, "2026-12-08"),
            renglon(nombres.perito, "2026-12-10"),
            renglon(nombres.chalten, "2026-12-12"),
            renglon(nombres.esmeralda, "2026-12-16"),
            { ...renglon(nombres.traslado, "2026-12-07"), codigo: null },
          ],
        },
      };
    };
    const porCercania: Record<string, string> = {
      [nombres.traslado]: "IGRT01",
      [nombres.perito]: "FTEE01",
      [nombres.chalten]: "FTEE05",
      [nombres.esmeralda]: "USHE07",
    };
    const iaQueSabe = () =>
      vi.fn<ProponerProducto>(async ({ pedido }) => ({
        resultado: { tipo: "respuesta", codigo: porCercania[pedido.nombre] ?? null, confianza: 0.95, motivo: "parecido" },
        llamada: null,
        costo: 0,
      }));

    it("cada tour sale con su producto: por nombre o por cercanía (la IA)", async () => {
      const ia = iaQueSabe();
      const r = await reconocer(variante(), ia);
      expect(ia).toHaveBeenCalledTimes(4);
      expect(codigos(r)).toEqual(["IGRE01", "FTEE01", "FTEE05", "USHE07", "IGRT01"]);
      expect(r.reservas.flatMap((x) => x.motivos)).toEqual([]);
    });

    it("si la IA no reconoce uno, va a revisión: nunca todo como FTEE05", async () => {
      const r = await reconocer(variante(), iaQueNoSabe());
      expect(codigos(r)).toEqual([null]);
      expect(r.reservas[0].motivos).toContain(`No se reconoce el tour '${nombres.perito}'`);
    });

    it("si el código del mail no sale de ningún tour, va a revisión", async () => {
      const ia = vi.fn<ProponerProducto>(async ({ pedido }) => ({
        resultado: { tipo: "respuesta", codigo: pedido.nombre === nombres.chalten ? "FTEE01" : (porCercania[pedido.nombre] ?? null), confianza: 0.95, motivo: "parecido" },
        llamada: null,
        costo: 0,
      }));
      const r = await reconocer(variante(), ia);
      expect(codigos(r)).toEqual([null]);
      expect(r.reservas[0].motivos[0]).toMatch(/El mail dice FTEE05, pero los tours dan IGRE01 \+ FTEE01 \+ FTEE01 \+ USHE07 \+ IGRT01/);
    });
  });

  it("un vuelo (LA156) o un registro (HRB 203540) no son códigos", async () => {
    const r = await reconocer(original("C"));
    expect(r.reservas.every((x) => x.origen !== "codigo")).toBe(true);
  });
});

describe("fila 2 — cada tour suelto se reconoce por su nombre", () => {
  it("los 7 del mail C y los 4 de San Pedro del mail D dan su SPAE sin IA; 'salt flats' en minúscula también", async () => {
    const ia = iaQueNoSabe();
    const c = await reconocer(original("C"), ia);
    const d = await reconocer(original("D"), ia);
    expect(ia).not.toHaveBeenCalled();
    const todos = [...c.reservas, ...d.reservas].flatMap((x) => x.tours);
    expect(todos.every((t) => t.producto && t.origen === "nombre")).toBe(true);
    const saltFlats = todos.filter((t) => /salt flats/i.test(t.nombre));
    expect(saltFlats.map((t) => t.producto?.codigo)).toEqual(["SPAE05", "SPAE05"]);
  });

  it("un nombre inventado pregunta a la IA y, si no hay confianza, va a revisión sin descartar el tour", async () => {
    const ia = iaQueNoSabe();
    const v = original("A");
    const inventado: Variante = {
      texto: v.texto.replace("From Foz do Iguaçu: Half-day tour to the Argentinean side of Iguazú Falls", "Tour to the Moon Crater"),
      ficha: { ...v.ficha, productos: [{ ...v.ficha.productos[0], nombre: "Tour to the Moon Crater" }] },
    };
    const r = await reconocer(inventado, ia);
    expect(ia).toHaveBeenCalledTimes(1);
    expect(r.reservas).toHaveLength(1);
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].motivos).toEqual(["No se reconoce el tour 'Tour to the Moon Crater'"]);
    expect(r.reservas[0].tours.map((t) => t.nombre)).toEqual(["Tour to the Moon Crater"]);
  });
});

describe("fila 3 — 'Half-day tour to the Argentinean side' es IGRE01", () => {
  it("nunca IGRE02 ni IGRP02", async () => {
    const r = await reconocer(original("A"));
    expect(codigos(r)).not.toContain("IGRE02");
    expect(codigos(r)).not.toContain("IGRP02");
  });
});

describe("fila 4 — el paquete se arma con la lista de tours", () => {
  it("Astronomy + Rainbow + Moon Valley + Tatio + Salt Flats da SPAP02", async () => {
    let v = sinTour(original("C"), "Red Rocks");
    v = sinTour(v, "Laguna Cejar");
    const r = await reconocer(v);
    expect(codigos(r)).toEqual(["SPAP02"]);
    expect(r.reservas[0].sinTrasladoDe).toBeNull();
  });
});

describe("fila 5 — si los tours no alcanzan o sobran, no se elige a ciegas", () => {
  it("el mail C sin Laguna Cejar: revisión con 'sobra … Red Rocks', sin SPAP01/02/03", async () => {
    const r = await reconocer(sinTour(original("C"), "Laguna Cejar"));
    expect(r.reservas).toHaveLength(1);
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].motivos[0]).toMatch(/^Estos tours no arman ningún paquete conocido: sobra .*Red Rocks/);
    expect(r.reservas[0].tours).toHaveLength(6);
  });

  it("solo Astronomy + Moon Valley: revisión, sin producto", async () => {
    let v = original("C");
    for (const t of ["Tatio", "Quepiaco", "Rainbow", "Red Rocks", "Laguna Cejar"]) v = sinTour(v, t);
    const r = await reconocer(v);
    expect(r.reservas).toHaveLength(1);
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].motivos[0]).toMatch(/^Estos tours no arman ningún paquete conocido/);
  });
});

describe("fila 6 — los hoteles Tayka llevan a SPAP05 o SPAP06", () => {
  it("con el Overland corrido al 16.10 son 5 noches: SPAP06", async () => {
    const r = await reconocer(overlandCorrido(original("D"), 1));
    expect(codigos(r)).toEqual(["SPAP06"]);
    expect(r.reservas[0].motivos).toEqual([]);
  });

  it("sin Siloli: revisión con 'falta el día 2 del Overland'", async () => {
    const r = await reconocer(sinTour(original("D"), "Siloli"));
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].motivos).toContain("Falta el día 2 del Overland");
  });

  it("sin el Tatio: revisión con 'falta … Tatio para SPAP05', y no se elige SPAP05 igual", async () => {
    const r = await reconocer(sinTour(original("D"), "Tatio"));
    expect(r.reservas).toHaveLength(1);
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].motivos.join(" ")).toMatch(/Falta .*Tatio.* para SPAP05/);
    expect(r.reservas[0].sugerencia?.codigo).toBe("SPAP05");
  });

  it("las noches que no dan 4 ni 5 van a revisión", async () => {
    const r = await reconocer(overlandCorrido(original("D"), 3));
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].motivos.join(" ")).toMatch(/7 noches en San Pedro/);
  });
});

describe("fila 7 — el título como tercera señal", () => {
  it("título 8N/9D con 4 noches: elegir entre 7N/8D y 8N/9D nunca manda a revisión (owner 2026-10-12): SPAP05 con una nota", async () => {
    const r = await reconocer(conTitulo(original("D"), "San Pedro de Atacama + Uyuni Salt Flats in Tayka Hotels 8N/9D"));
    expect(codigos(r)).toEqual(["SPAP05"]);
    expect(r.reservas[0].motivos).toEqual([]);
    expect(r.reservas[0].notas.join(" ")).toMatch(/El título dice 8N\/9D, pero los tours dan 4 noches en San Pedro/);
  });

  it("solo el título 7N/8D y el Overland, sin tours de San Pedro: revisión por faltar tours", async () => {
    let v = conTitulo(original("D"), "San Pedro de Atacama + Uyuni Salt Flats in Tayka Hotels 7N/8D");
    for (const t of ["Astronomy", "Moon Valley", "Quepiaco", "Tatio", "LA148"]) v = sinTour(v, t);
    v = { ...v, ficha: { ...v.ficha, vuelos: v.ficha.vuelos.filter((x) => x.numero !== "LA148") } };
    const r = await reconocer(v);
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].motivos.join(" ")).toMatch(/Falta .* para SPAP05/);
  });
});

/** Cambia el nombre de un tour en la ficha y en el texto, como lo escribió Journaway en otro mail. */
function renombrado(v: Variante, antes: string, despues: string): Variante {
  return {
    texto: v.texto.split(antes).join(despues),
    ficha: { ...v.ficha, productos: v.ficha.productos.map((p) => (p.nombre === antes ? { ...p, nombre: despues } : p)) },
  };
}

describe("M3-52 — Tayka: SPAP05 salvo que las fechas digan otra cosa (owner 2026-11-09)", () => {
  it("las variantes de nombre del mail 66925083976 (of the Moon Valley, of the Tatio, ', and Laguna Colorada') dan SPAP05", async () => {
    let v = renombrado(original("D"), SAN_PEDRO.moon, "Tour of the Moon Valley");
    v = renombrado(v, SAN_PEDRO.tatio, "Tour of the Tatio Geysers");
    v = renombrado(v, OVERLAND.dia1, "From San Pedro: Sol de Mañana Geysers, Licancabur Volcano, and Laguna Colorada");
    const r = await reconocer(v);
    expect(codigos(r)).toEqual(["SPAP05"]);
    expect(r.reservas[0].motivos).toEqual([]);
  });

  it("sin el día 1 del Overland, las noches no se cuentan desde los otros días: se sugiere SPAP05, no SPAP06", async () => {
    // Como en 66925083976: Siloli corrido un día; contado desde ahí daba 5 noches (SPAP06).
    const r = await reconocer(overlandCorrido(sinTour(original("D"), "Sol de Mañana"), 1));
    expect(r.reservas[0].producto).toBeNull();
    expect(r.reservas[0].sugerencia?.codigo).toBe("SPAP05");
    expect(r.reservas[0].motivos).toContain("Falta el día 1 del Overland");
    expect(r.reservas[0].motivos.join(" ")).not.toMatch(/SPAP06|noches/);
  });
});
