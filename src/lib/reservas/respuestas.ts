import type { ReservaExistente } from "./intercambio";

/**
 * Qué respuestas se leen con IA (owner, 2026-10-14; plan M2 §3 y DECISIONS).
 * Por regla solo se leen los mails originales: las respuestas y reenvíos
 * ("Re:", "SV:", "AW:", "Fwd:"…) no pasan por la IA. La excepción son los
 * vuelos, que casi siempre llegan como respuesta ("Re: NEW FLIGHT: DK1562336
 * /emri - …"): una respuesta se lee solo si
 *
 * 1. su asunto trae el número de una reserva que existe (lo cruza el código,
 *    sin IA), y
 * 2. esa reserva está "para revisión" esperando un vuelo.
 *
 * Una vez leída, se suma a la reserva como cualquier mail del mismo
 * intercambio (`procesar-mail.ts`). El filtro de la casilla es de M2-07: esto
 * es solo la decisión, sin base ni IA.
 */

/** Respuesta o reenvío: el asunto empieza con Re:, RE:, SV:, Sv:, AW:, VS:, Fwd:, FW:, RV: (también repetidos). */
const PREFIJO_RESPUESTA = /^\s*(re|sv|aw|vs|fwd|fw|rv)\s*:/i;

export function esRespuesta(asunto: string | null | undefined): boolean {
  return PREFIJO_RESPUESTA.test(asunto ?? "");
}

/** Los números de reserva que trae el asunto, normalizados como `booking-id.ts`. */
export function numerosDelAsunto(asunto: string | null | undefined, agencia: string): string[] {
  const a = asunto ?? "";
  let numeros: string[] = [];
  if (agencia === "Kilroy" || agencia === "Jysk") {
    numeros = [...a.matchAll(/(?<![A-Za-z])([A-Za-z]{2}\d{5,})(?!\d)/g)].map((m) => m[1].toUpperCase());
  } else if (agencia === "TourRadar") {
    const statement = /booking statement\s+(\d{6,8})(?!\d)/i.exec(a);
    numeros = statement ? [statement[1]] : [...a.matchAll(/(?<!\d)(\d{7})(?!\d)/g)].map((m) => m[1]);
  } else if (agencia === "Journaway") {
    numeros = [...a.matchAll(/\bID\s*:?\s*(\d{11})(?!\d)/gi)].map((m) => m[1]);
  }
  return [...new Set(numeros)];
}

export type ReservaParaRespuesta = Pick<ReservaExistente, "id" | "agencia" | "booking_id" | "estado" | "motivos_revision" | "de_prueba">;

export type MotivoLectura = "original" | "espera_vuelo" | "no_espera_vuelo" | "sin_numero_conocido";

export interface DecisionLectura {
  leer: boolean;
  motivo: MotivoLectura;
  /** Las reservas que esperan el vuelo (a las que se va a sumar). */
  reservaIds: string[];
}

const FALTA_VUELO = /^Falta el vuelo de /;

export const esperaVuelo = (r: Pick<ReservaParaRespuesta, "estado" | "motivos_revision">) =>
  r.estado === "para_revision" && r.motivos_revision.some((m) => FALTA_VUELO.test(m));

/**
 * `reservas`: las candidatas (puede traer de todo; se filtra por agencia, por
 * prueba/real y por los números del asunto).
 */
export function respuestaMereceLectura(
  asunto: string | null | undefined,
  agencia: string,
  reservas: ReservaParaRespuesta[],
  opciones: { dePrueba: boolean },
): DecisionLectura {
  if (!esRespuesta(asunto)) return { leer: true, motivo: "original", reservaIds: [] };
  const numeros = new Set(numerosDelAsunto(asunto, agencia));
  const conocidas = reservas.filter(
    (r) => r.agencia === agencia && r.de_prueba === opciones.dePrueba && r.booking_id !== null && numeros.has(r.booking_id),
  );
  if (conocidas.length === 0) return { leer: false, motivo: "sin_numero_conocido", reservaIds: [] };
  const esperan = conocidas.filter(esperaVuelo);
  if (esperan.length === 0) return { leer: false, motivo: "no_espera_vuelo", reservaIds: [] };
  return { leer: true, motivo: "espera_vuelo", reservaIds: esperan.map((r) => r.id) };
}
