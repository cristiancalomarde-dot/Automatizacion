import { AGENCIA_DESCONOCIDA, agenciaDelRemitente } from "./agencias";
import { respuestaMereceLectura, type ReservaParaRespuesta } from "./respuestas";

/**
 * Qué mails pasan a la IA, antes de gastar (#3). Lo usan el modo prueba
 * (M2-06) y la lectura de sales@ (M2-07): las dos entradas filtran igual.
 *
 * 1. Solo los remitentes de una agencia de `data/agencias.csv`. Lo demás (los
 *    pedidos de HI Travel a proveedores, las respuestas de los proveedores) no
 *    es un mail de agencia.
 * 2. Jysk no se lee (owner, 2026-10-13: el 95% son viajes a medida). El mail se
 *    registra, sin IA, para no volver a mirarlo.
 * 3. Journaway entra con M2-09.
 * 4. Solo los mails originales. Una respuesta o reenvío ("Re:", "SV:", "FW:"…)
 *    se lee solo si su asunto trae el número de una reserva cargada que está
 *    "para revisión" esperando un vuelo (owner, 2026-10-14; `respuestas.ts`).
 *    Ese cruce lo hace el código contra la base, sin IA.
 *
 * Solo decide: no guarda nada ni llama a la IA.
 */

/** Las agencias cuyos mails se leen hoy. Journaway se suma con M2-09. */
export const AGENCIAS_QUE_SE_LEEN: ReadonlySet<string> = new Set(["Kilroy", "TourRadar"]);

export type MotivoSalteo =
  | "no_es_agencia"
  | "jysk_no_se_lee"
  | "journaway_m2_09"
  | "agencia_no_se_lee"
  | "respuesta_sin_reserva"
  | "respuesta_no_espera_vuelo";

/** Por qué no se leyó, en llano (reportes y registro). */
export const TEXTO_SALTEO: Readonly<Record<MotivoSalteo, string>> = {
  no_es_agencia: "No es un mail de agencia",
  jysk_no_se_lee: "Jysk no se lee: sus reservas son viajes a medida (decisión del owner)",
  journaway_m2_09: "Journaway entra con M2-09",
  agencia_no_se_lee: "Esa agencia todavía no se lee",
  respuesta_sin_reserva: "Es una respuesta o un reenvío, y su número no es de una reserva cargada",
  respuesta_no_espera_vuelo: "Es una respuesta o un reenvío, y la reserva no está esperando un vuelo",
};

export type DecisionEntrada =
  | { leer: true; agencia: string; motivo: "original" | "espera_vuelo"; reservaIds: string[] }
  | { leer: false; agencia: string | null; motivo: MotivoSalteo; registrar: boolean };

export interface OpcionesFiltro {
  /** Las reservas de la agencia cuyos números trae el asunto (`cargarReservasDelAsunto`). Solo para respuestas. */
  buscarReservas: (asunto: string | null | undefined, agencia: string) => Promise<ReservaParaRespuesta[]>;
  dePrueba: boolean;
  agenciasQueSeLeen?: ReadonlySet<string>;
}

export async function decidirEntrada(
  mail: { remitente: string; asunto?: string | null },
  opciones: OpcionesFiltro,
): Promise<DecisionEntrada> {
  const agencia = agenciaDelRemitente(mail.remitente ?? "");
  if (agencia === AGENCIA_DESCONOCIDA) return { leer: false, agencia: null, motivo: "no_es_agencia", registrar: false };
  if (agencia === "Jysk") return { leer: false, agencia, motivo: "jysk_no_se_lee", registrar: true };
  if (!(opciones.agenciasQueSeLeen ?? AGENCIAS_QUE_SE_LEEN).has(agencia)) {
    return { leer: false, agencia, motivo: agencia === "Journaway" ? "journaway_m2_09" : "agencia_no_se_lee", registrar: false };
  }

  const sinBase = respuestaMereceLectura(mail.asunto, agencia, [], { dePrueba: opciones.dePrueba });
  if (sinBase.motivo === "original") return { leer: true, agencia, motivo: "original", reservaIds: [] };

  const reservas = await opciones.buscarReservas(mail.asunto, agencia);
  const d = respuestaMereceLectura(mail.asunto, agencia, reservas, { dePrueba: opciones.dePrueba });
  if (d.leer) return { leer: true, agencia, motivo: "espera_vuelo", reservaIds: d.reservaIds };
  return {
    leer: false,
    agencia,
    motivo: d.motivo === "no_espera_vuelo" ? "respuesta_no_espera_vuelo" : "respuesta_sin_reserva",
    registrar: false,
  };
}
