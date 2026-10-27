"use server";

import { avisosDelItinerarioDeLaReserva, type ResultadoItinerario } from "@/lib/pedidos/itinerario-reserva";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEXTOS } from "@/lib/textos";

/**
 * "Revisar antes de pedir" en el detalle de una reserva (spec M3-24), con la sesión del usuario
 * (RLS, #1). La lógica vive en `src/lib/pedidos/itinerario-reserva.ts`; acá solo se arma el cliente
 * y un error inesperado se dice en llano.
 */
export async function avisosDelItinerario(reservaId: string): Promise<ResultadoItinerario> {
  try {
    return await avisosDelItinerarioDeLaReserva(await createSupabaseServerClient(), reservaId);
  } catch {
    return { ok: false, error: TEXTOS.reserva.revisarAntes.error };
  }
}
