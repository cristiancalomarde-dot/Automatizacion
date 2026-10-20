import "server-only";

/**
 * "Tomar esta reserva" y "Pasarla a otro" (spec M3-06 filas 4, 5, 8 y 9), en
 * el servidor y con el cliente de la SESIÓN (RLS, #1).
 *
 * 1. Sesión del equipo (@hitravel.com.ar); si no, nada.
 * 2. `asignar_responsable` (0021) en una transacción: la persona elegida tiene
 *    que estar en `usuario`; si el responsable ya no es el que vio la pantalla
 *    (`esperado`), no cambia nada; y deja la entrada del historial con autor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { quienEnvia } from "@/lib/pedidos/envio/enviar";
import { TEXTOS } from "@/lib/textos";
import { esIdDeReserva } from "../reglas";

const T = TEXTOS.reserva.responsable;
const M = T.motivos;

export interface EntradaTomar {
  reservaId: string;
  /** El responsable que vio la pantalla (null = sin responsable). */
  esperado: string | null;
}

export interface EntradaPasar extends EntradaTomar {
  /** A quién se la pasa (un id de `usuario`). */
  a: string;
}

export type ResultadoResponsable =
  | { ok: true; responsableId: string; responsable: string }
  | { ok: false; error: string; sinSesion?: true; cambio?: true };

const fallo = (motivo: string): ResultadoResponsable => ({ ok: false, error: T.error(motivo) });

function motivoDeError(code: string | undefined): ResultadoResponsable {
  switch (code) {
    case "HT401":
      return { ok: false, error: T.error(M.sinSesion), sinSesion: true };
    case "HT403":
      return fallo(M.noEstoyEnElEquipo);
    case "HT404":
    case "23503":
      return fallo(M.noEsDelEquipo);
    case "HT409":
      return { ok: false, error: T.error(M.cambio), cambio: true };
    case "P0002":
      return fallo(M.noExiste);
    default:
      return fallo(M.conexion);
  }
}

const esperadoValido = (v: unknown): v is string | null => v === null || (typeof v === "string" && esIdDeReserva(v));

async function asignar(cliente: SupabaseClient, reservaId: unknown, a: string | ((yo: string) => string), esperado: unknown): Promise<ResultadoResponsable> {
  const persona = await quienEnvia(cliente);
  if (!persona) return { ok: false, error: T.error(M.sinSesion), sinSesion: true };
  if (typeof reservaId !== "string" || !esIdDeReserva(reservaId)) return fallo(M.noExiste);
  if (!esperadoValido(esperado)) return fallo(M.cambio);
  const responsable = typeof a === "function" ? a(persona.id) : a;
  if (typeof responsable !== "string" || !esIdDeReserva(responsable)) return fallo(M.noEsDelEquipo);

  const { data, error } = await cliente.rpc("asignar_responsable", { p_reserva: reservaId, p_responsable: responsable, p_esperado: esperado });
  if (error) return motivoDeError(error.code);
  const r = (data ?? {}) as { responsable_id?: string; responsable?: string };
  return { ok: true, responsableId: r.responsable_id ?? responsable, responsable: r.responsable ?? "" };
}

/** La persona de la sesión queda como responsable. */
export function tomarReserva(cliente: SupabaseClient, entrada: EntradaTomar): Promise<ResultadoResponsable> {
  return asignar(cliente, entrada?.reservaId, (yo) => yo, entrada?.esperado ?? null);
}

/** Otra persona del equipo queda como responsable. */
export function pasarReserva(cliente: SupabaseClient, entrada: EntradaPasar): Promise<ResultadoResponsable> {
  return asignar(cliente, entrada?.reservaId, entrada?.a, entrada?.esperado ?? null);
}
