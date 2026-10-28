import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { limpiarNombreJournaway } from "@/lib/importador-journaway/nombres";
import { parsearNombres } from "@/lib/importador-journaway/nombres";
import type { ProponerProducto } from "../emparejar/emparejar";
import type { FichaIA } from "../esquema-ficha";
import { limpiarFicha } from "../limpiar-ficha";
import { armarJournaway } from "./armar";
import { reconocerJournaway, type ContextoJournaway } from "./reconocer";
import { leerSenalesJournaway } from "./senales";
import { catalogoJournawayDePrueba } from "../../../../tests/fixtures/journaway/catalogo";
import { ACTIVIDADES_PETZOLD, ASUNTO_PETZOLD, fichaIAPetzold, textoPlanoPetzold } from "../../../../tests/fixtures/journaway/petzold";

/**
 * Spec M3-30 filas 4, 5, 6 y 6b: el mail Petzold (los servicios en imágenes,
 * en alemán, una fila por pax) sale SPAP05 sin IA para los nombres. La ficha
 * es la que devuelve la IA al leer el mail con sus imágenes (fixture).
 */

const senales = leerSenalesJournaway(readFileSync(join(process.cwd(), "data", "journaway-senales.csv"), "utf-8"));
const iaQueNoSeUsa = () => vi.fn<ProponerProducto>(async () => ({ resultado: { tipo: "respuesta", codigo: null, confianza: 0, motivo: "x" }, llamada: null, costo: 0 }));

function contexto(proponer?: ProponerProducto): ContextoJournaway {
  const { catalogo, journaway } = catalogoJournawayDePrueba();
  return { catalogo, journaway, senales, proponer };
}

/** La ficha limpia, como sale de `leerMailConIA` con imágenes (lo que no está en el texto no se puede chequear). */
function fichaLimpia(ficha: FichaIA = fichaIAPetzold()) {
  return limpiarFicha(
    ficha,
    { agencia: "Journaway", textoVerificable: `${ASUNTO_PETZOLD}\n${textoPlanoPetzold()}`, seMandoPdf: true, adjuntosNoLeidos: [] },
    { version_instrucciones: "lectura-mail.v5", modelo: "modelo-grabado" },
  );
}

const texto = `${ASUNTO_PETZOLD}\n${textoPlanoPetzold()}`;

describe("fila 4 — los nombres en alemán de Journaway se reconocen sin IA", () => {
  const nombres = parsearNombres(readFileSync(join(process.cwd(), "data", "journaway-nombres.csv"), "utf-8"));
  const codigoDe = (nombre: string) => nombres.find((n) => n.limpio === limpiarNombreJournaway(nombre))?.codigo ?? null;

  it("los 7 dan su código", () => {
    const A = ACTIVIDADES_PETZOLD;
    expect([A.astronomie, A.mondtal, A.quepiaco, A.tatio, A.dia1, A.dia2, A.dia3].map(codigoDe)).toEqual([
      "SPAE01",
      "SPAE03",
      "SPAE05",
      "SPAE04",
      "UYUO01",
      "UYUO01",
      "UYUO01",
    ]);
  });

  it("el traslado compartido de Calama es el shuttle SPAT01", () => {
    expect(codigoDe("Shared Transport: CJC - Accom. San Pedro de Atacama")).toBe("SPAT01");
  });
});

describe("filas 5, 6 y 6b — Petzold sale SPAP05", () => {
  it("SPAP05, día 1 = 22.05.2027, sin pedirle nada a la IA", async () => {
    const ia = iaQueNoSeUsa();
    const r = await reconocerJournaway(fichaLimpia(), texto, contexto(ia));
    expect(ia).not.toHaveBeenCalled();
    expect(r.reservas.map((x) => x.producto?.codigo ?? null)).toEqual(["SPAP05"]);
    const [reserva] = r.reservas;
    expect(reserva.paquete?.codigo).toBe("SPAP05");
    // Fila 5: una fila por pax no son dos tours. Un solo Astronomy Tour.
    expect(reserva.tours.filter((t) => t.producto?.codigo === "SPAE01")).toHaveLength(1);
    expect(reserva.tours.filter((t) => t.producto?.codigo === "SPAT01")).toHaveLength(1);
  });

  it("6b: el 'Night Bus Peru' no es parte de SPAP05: no va en la reserva y queda el motivo", async () => {
    const r = await reconocerJournaway(fichaLimpia(), texto, contexto(iaQueNoSeUsa()));
    const [reserva] = r.reservas;
    expect(reserva.tours.map((t) => t.nombre)).not.toContain("Night Bus Peru");
    expect(reserva.motivos).toEqual([
      "Journaway pide 'Night Bus Peru' (31.05–01.06), que no es parte de SPAP05: consultarlo con Journaway",
    ]);
  });

  it("las partes de SPAP05 con las fechas de la tabla", async () => {
    const { catalogo, journaway, detalle } = catalogoJournawayDePrueba();
    const { piezas } = await armarJournaway(
      fichaLimpia(),
      { catalogo, journaway: { catalogo: journaway, senales }, detalle },
      { remitente: "operations@journaway.com", asunto: ASUNTO_PETZOLD, cuerpoTexto: textoPlanoPetzold() },
    );
    expect(piezas).toHaveLength(1);
    const [p] = piezas;
    const porId = new Map(catalogo.productos.map((x) => [x.id, x.codigo]));
    expect(p.componentes.map((c) => [porId.get(c.productoId!), c.fechaInicio, c.fechaFin])).toEqual([
      ["SPAT01", "2027-05-22", "2027-05-22"],
      ["SPAE01", "2027-05-22", "2027-05-22"],
      ["SPAE03", "2027-05-23", "2027-05-23"],
      ["SPAE05", "2027-05-24", "2027-05-24"],
      ["SPAE04", "2027-05-25", "2027-05-25"],
      ["SPAT02", "2027-05-26", "2027-05-26"],
      ["UYUO01", "2027-05-26", "2027-05-28"],
    ]);
    expect([p.fechaInicio, p.fechaFin]).toEqual(["2027-05-22", "2027-05-28"]);
    expect(p.tripNumber).toBe("65037");
    expect(p.habitacion).toBe("1 DBL");
    expect(p.motivos).toContain("Journaway pide 'Night Bus Peru' (31.05–01.06), que no es parte de SPAP05: consultarlo con Journaway");
  });

  it("tres filas iguales con 2 pax no se juntan (no es una fila por pax)", async () => {
    const f = fichaIAPetzold();
    const astro = f.productos.find((x) => x.nombre === ACTIVIDADES_PETZOLD.astronomie)!;
    const r = await reconocerJournaway(fichaLimpia({ ...f, productos: [...f.productos, { ...astro }] }), texto, contexto(iaQueNoSeUsa()));
    expect(r.reservas[0].motivos.join(" ")).toMatch(/Sobra/);
  });
});
