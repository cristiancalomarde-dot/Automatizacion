/**
 * Un pedido escrito por una persona del equipo (spec M3-09), sin base ni red:
 * la lectura de los mails a mano y la validación antes de guardarlo.
 *
 * Se puede importar desde el navegador: no lee archivos. El borrador inicial
 * (que usa la plantilla) está en `a-mano-borrador.ts`, solo para el servidor.
 */
import { esIdDeReserva } from "@/lib/reservas/reglas";
import { TEXTOS } from "@/lib/textos";
import type { PasajeroDeReserva } from "./tipos";

const T = TEXTOS.pedidos.aMano;

/** La casilla de un pedido a mano: "a-mano:<uuid>" (0023), nunca choca con la de un armado. */
export const CASILLA_A_MANO = "a-mano:";

export interface BorradorAMano {
  asunto: string;
  cuerpo: string;
  /** La firma de siempre, con `{{nombre_de_quien_envia}}`. */
  firma: string;
}

export interface DatosParaAMano {
  numero: string | null;
  pax: number | null;
  pasajeros: readonly PasajeroDeReserva[];
}

// Un mail: algo antes de la @, un dominio con al menos un punto y nada vacío entre puntos.
const MAIL = /^[^\s@,;]+@[^\s@,;.]+(?:\.[^\s@,;.]+)+$/;

/** Uno o más mails escritos a mano (separados por coma, punto y coma o espacios), en minúscula y sin repetir. */
export function leerMails(texto: string): { ok: true; mails: string[] } | { ok: false; error: string } {
  const partes = (typeof texto === "string" ? texto : "")
    .split(/[\s,;]+/)
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
  if (partes.length === 0) return { ok: false, error: T.sinDestinatario };
  if (!partes.every((m) => MAIL.test(m))) return { ok: false, error: T.mailInvalido };
  return { ok: true, mails: [...new Set(partes)] };
}

export interface EntradaAMano {
  reservaId: string;
  /** El proveedor del directorio elegido; null si el mail se escribió a mano. */
  proveedorId: string | null;
  /** Los mails como los dejó la persona (completados del directorio o escritos). */
  mails: string;
  asunto: string;
  cuerpo: string;
}

export type PedidoAManoValido = Omit<EntradaAMano, "mails"> & { mails: string[] };

const MAX_ASUNTO = 300;
const MAX_CUERPO = 20_000;
const comoTexto = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * Antes de guardar (filas 2 y 10): un mail válido, asunto y texto. Un texto
 * igual al borrador inicial no dice qué se le pide al proveedor: tampoco se
 * guarda.
 */
export function validarPedidoAMano(e: EntradaAMano, inicial?: Pick<BorradorAMano, "cuerpo"> | null): { ok: true; pedido: PedidoAManoValido } | { ok: false; error: string } {
  if (!e || typeof e.reservaId !== "string" || !esIdDeReserva(e.reservaId)) return { ok: false, error: "No existe la reserva." };
  if (e.proveedorId !== null && (typeof e.proveedorId !== "string" || !esIdDeReserva(e.proveedorId))) return { ok: false, error: T.proveedorInvalido };
  const mails = leerMails(e.mails);
  if (!mails.ok) return mails;
  const asunto = typeof e.asunto === "string" ? e.asunto.replace(/\s+/g, " ").trim() : "";
  const cuerpo = typeof e.cuerpo === "string" ? e.cuerpo.replace(/\s+$/, "") : "";
  if (!asunto || !cuerpo.trim()) return { ok: false, error: T.sinTexto };
  if (inicial && comoTexto(cuerpo) === comoTexto(inicial.cuerpo)) return { ok: false, error: T.sinTexto };
  if (asunto.length > MAX_ASUNTO) return { ok: false, error: `El asunto es muy largo (máximo ${MAX_ASUNTO} caracteres).` };
  if (cuerpo.length > MAX_CUERPO) return { ok: false, error: `El texto es muy largo (máximo ${MAX_CUERPO} caracteres).` };
  return { ok: true, pedido: { reservaId: e.reservaId, proveedorId: e.proveedorId, mails: mails.mails, asunto, cuerpo } };
}

/** Un pedido a mano: por la marca de la base (0023) o, si la fila no la trae, por su casilla. */
export const esPedidoAMano = (p: { a_mano?: boolean | null; casilla?: string }): boolean => p.a_mano === true || (p.casilla ?? "").startsWith(CASILLA_A_MANO);

/** Cómo se nombra un pedido: el proveedor y, si no está en el directorio, el mail. */
export const nombreDelPedido = (p: { proveedores: readonly string[]; destinatarios: readonly string[] }): string =>
  p.proveedores.join(" y ") || p.destinatarios.join(", ");
