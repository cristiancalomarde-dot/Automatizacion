"use server";

import { confirmarProducto, type EntradaConfirmar, type ResultadoConfirmar } from "@/lib/reservas/confirmar/confirmar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEXTOS } from "@/lib/textos";

/**
 * "Confirmar: es <código> <nombre>" y "Elegir otro producto" en el detalle de
 * una reserva para revisión (spec M3-05), con la sesión del usuario (RLS, #1).
 * La lógica vive en `src/lib/reservas/confirmar/`; acá solo se arma el cliente
 * y un error inesperado se dice en llano.
 */
export async function confirmarProductoDeReserva(entrada: EntradaConfirmar): Promise<ResultadoConfirmar> {
  try {
    return await confirmarProducto(await createSupabaseServerClient(), entrada);
  } catch {
    const T = TEXTOS.reserva.confirmarProducto;
    return { ok: false, error: T.error(T.motivos.conexion) };
  }
}
