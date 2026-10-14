"use server";

import { guardarMarca, type MarcaEntrada, type ResultadoMarca } from "@/lib/reservas/revision-prueba";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * La marca del owner sobre una reserva de prueba (spec M2-06 fila 13): "está
 * bien" o "hay que corregir" (qué y una nota). Con la sesión del usuario (RLS,
 * #1); rechaza las reservas reales. Es la única escritura de las pantallas de
 * reservas.
 */
export async function marcarReservaDePrueba(entrada: MarcaEntrada): Promise<ResultadoMarca> {
  try {
    return await guardarMarca(await createSupabaseServerClient(), entrada);
  } catch {
    return { ok: false, error: "No se pudo guardar la marca." };
  }
}
