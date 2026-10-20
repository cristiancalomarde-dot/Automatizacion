"use server";

import { pasarReserva, tomarReserva, type EntradaPasar, type EntradaTomar, type ResultadoResponsable } from "@/lib/reservas/responsable/asignar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEXTOS } from "@/lib/textos";

/**
 * "Tomar esta reserva" y "Pasarla a otro" en el detalle (spec M3-06), con la
 * sesión del usuario (RLS, #1). La lógica vive en
 * `src/lib/reservas/responsable/`; acá solo se arma el cliente y un error
 * inesperado se dice en llano. Archivo aparte (como M3-05) para no romper los
 * mocks de las otras acciones del detalle.
 */
const R = TEXTOS.reserva.responsable;

export async function tomarEstaReserva(entrada: EntradaTomar): Promise<ResultadoResponsable> {
  try {
    return await tomarReserva(await createSupabaseServerClient(), entrada);
  } catch {
    return { ok: false, error: R.error(R.motivos.conexion) };
  }
}

export async function pasarlaAOtro(entrada: EntradaPasar): Promise<ResultadoResponsable> {
  try {
    return await pasarReserva(await createSupabaseServerClient(), entrada);
  } catch {
    return { ok: false, error: R.error(R.motivos.conexion) };
  }
}
