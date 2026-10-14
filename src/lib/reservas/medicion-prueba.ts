/**
 * La medición del modo prueba (spec M2-06 fila 14; PRD riesgo #1).
 *
 * - % de reservas marcadas "mal" sobre las revisadas, y aparte el % con el
 *   producto mal (el número del PRD).
 * - Una reserva "para revisión" con un motivo correcto la marca el owner como
 *   "bien": acá solo se cuentan las marcas.
 * - Más del 20% mal = "se frena: no activar M2-07". Mientras falten reservas
 *   por marcar, no hay veredicto.
 *
 * Pura: la usan la pantalla y el resumen (`--resumen`), así dan el mismo número.
 */

export const LIMITE_MAL = 0.2;

export const QUE_MAL = ["producto", "fechas", "pasajeros", "vuelos", "estado_motivo", "otro"] as const;
export type QueMal = (typeof QUE_MAL)[number];

export interface MarcaParaMedir {
  resultado: "bien" | "mal";
  queMal: readonly string[];
}

export interface Medicion {
  total: number;
  revisadas: number;
  faltan: number;
  mal: number;
  productoMal: number;
  /** % sobre las revisadas; null si no hay ninguna revisada. */
  porcentajeMal: number | null;
  porcentajeProductoMal: number | null;
  /** Null mientras falten reservas por marcar. */
  veredicto: "seguir" | "frenar" | null;
}

/** Una entrada por reserva de prueba: su marca, o null si todavía no se marcó. */
export function medirRevision(marcas: ReadonlyArray<MarcaParaMedir | null>): Medicion {
  const hechas = marcas.filter((m): m is MarcaParaMedir => m !== null);
  const mal = hechas.filter((m) => m.resultado === "mal");
  const productoMal = mal.filter((m) => m.queMal.includes("producto")).length;
  const pct = (n: number) => (hechas.length ? (n / hechas.length) * 100 : null);
  const faltan = marcas.length - hechas.length;
  const porcentajeMal = pct(mal.length);
  return {
    total: marcas.length,
    revisadas: hechas.length,
    faltan,
    mal: mal.length,
    productoMal,
    porcentajeMal,
    porcentajeProductoMal: pct(productoMal),
    veredicto: faltan > 0 || porcentajeMal === null ? null : porcentajeMal > LIMITE_MAL * 100 ? "frenar" : "seguir",
  };
}

const redondo = (n: number) => `${Math.round(n)}%`;

/** "Revisadas 17 de 17 · 2 mal (12%) · se puede seguir" (lo que ve el owner arriba de la lista). */
export function textoMedicion(m: Medicion): string {
  const partes = [`Revisadas ${m.revisadas} de ${m.total}`];
  if (m.porcentajeMal !== null) partes.push(`${m.mal} mal (${redondo(m.porcentajeMal)})`);
  if (m.faltan > 0) partes.push(`faltan ${m.faltan} por revisar`);
  else if (m.veredicto === "seguir") partes.push("se puede seguir");
  else if (m.veredicto === "frenar") partes.push("se frena: no activar M2-07");
  return partes.join(" · ");
}
