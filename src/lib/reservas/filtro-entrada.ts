import { AGENCIA_DESCONOCIDA, agenciaDelRemitente } from "./agencias";
import { numerosDelAsunto, respuestaMereceLectura, type ReservaParaRespuesta } from "./respuestas";

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
 * 3b. Kilroy: un original es reserva nueva solo con "NEW BOOKING" o "KILROY
 *    booking request" en el asunto; si no, y no nombra una reserva ya cargada,
 *    es un pedido de cotización: se registra sin IA (owner, 2026-10-15).
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
  | "respuesta_no_espera_vuelo"
  | "pedido_cotizacion";

/** Por qué no se leyó, en llano (reportes y registro). */
export const TEXTO_SALTEO: Readonly<Record<MotivoSalteo, string>> = {
  no_es_agencia: "No es un mail de agencia",
  jysk_no_se_lee: "Jysk no se lee: sus reservas son viajes a medida (decisión del owner)",
  journaway_m2_09: "Journaway entra con M2-09",
  agencia_no_se_lee: "Esa agencia todavía no se lee",
  respuesta_sin_reserva: "Es una respuesta o un reenvío, y su número no es de una reserva cargada",
  respuesta_no_espera_vuelo: "Es una respuesta o un reenvío, y la reserva no está esperando un vuelo",
  pedido_cotizacion: "Es un pedido de cotización, no una reserva (por ahora no se lee)",
};

/**
 * Kilroy (owner, 2026-10-15): una reserva nueva siempre trae "NEW BOOKING" o
 * "KILROY booking request" en el asunto. Los pedidos de cotización vienen en
 * cualquier formato (a veces con un número DK/NL adelante) y nunca dicen esas
 * frases: por ahora se registran sin IA y sin reserva.
 */
const RESERVA_KILROY = /new booking|kilroy booking request/i;

export type DecisionEntrada =
  | { leer: true; agencia: string; motivo: "original" | "espera_vuelo"; reservaIds: string[] }
  | { leer: false; agencia: string | null; motivo: MotivoSalteo; registrar: boolean };

export interface OpcionesFiltro {
  /** Las reservas de la agencia cuyos números trae el asunto (`cargarReservasDelAsunto`). Para respuestas y para los originales de Kilroy sin las frases de reserva. */
  buscarReservas: (asunto: string | null | undefined, agencia: string) => Promise<ReservaParaRespuesta[]>;
  dePrueba: boolean;
  agenciasQueSeLeen?: ReadonlySet<string>;
}

export async function decidirEntrada(
  mail: { remitente: string; asunto?: string | null; cuerpoTexto?: string | null },
  opciones: OpcionesFiltro,
): Promise<DecisionEntrada> {
  const agencia = agenciaDelRemitente(mail.remitente ?? "");
  if (agencia === AGENCIA_DESCONOCIDA) return { leer: false, agencia: null, motivo: "no_es_agencia", registrar: false };
  if (agencia === "Jysk") return { leer: false, agencia, motivo: "jysk_no_se_lee", registrar: true };
  if (!(opciones.agenciasQueSeLeen ?? AGENCIAS_QUE_SE_LEEN).has(agencia)) {
    return { leer: false, agencia, motivo: agencia === "Journaway" ? "journaway_m2_09" : "agencia_no_se_lee", registrar: false };
  }

  const sinBase = respuestaMereceLectura(mail.asunto, agencia, [], { dePrueba: opciones.dePrueba });
  if (sinBase.motivo === "original") {
    if (agencia !== "Kilroy") return { leer: true, agencia, motivo: "original", reservaIds: [] };
    // Sin asunto (una copia .docx sin encabezado), se mira el cuerpo.
    const asunto = mail.asunto?.trim();
    if (asunto ? RESERVA_KILROY.test(asunto) : RESERVA_KILROY.test(mail.cuerpoTexto ?? "")) {
      return { leer: true, agencia, motivo: "original", reservaIds: [] };
    }
    // Un original que nombra una reserva ya cargada (cambio, cancelación, vuelo) sigue por M2-04.
    const numeros = new Set(numerosDelAsunto(mail.asunto, agencia));
    const conocidas = numeros.size
      ? (await opciones.buscarReservas(mail.asunto, agencia)).filter(
          (r) => r.agencia === agencia && r.de_prueba === opciones.dePrueba && r.booking_id !== null && numeros.has(r.booking_id),
        )
      : [];
    if (conocidas.length) return { leer: true, agencia, motivo: "original", reservaIds: [] };
    return { leer: false, agencia, motivo: "pedido_cotizacion", registrar: true };
  }

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
