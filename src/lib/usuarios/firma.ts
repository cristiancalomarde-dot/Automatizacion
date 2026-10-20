import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El nombre para la firma que guardó una persona (spec M3-06 fila 1), o null
 * si no guardó ninguno. Con el cliente de la sesión (RLS: el equipo lee
 * `usuario`).
 *
 * Nunca frena lo que lo usa (el envío, la pantalla de pedidos): si la lectura
 * falla, se firma como antes de M3-06 (el nombre de la cuenta de Google).
 */
export async function leerNombreParaLaFirma(cliente: SupabaseClient, usuarioId: string): Promise<string | null> {
  try {
    const { data, error } = await cliente.from("usuario").select("nombre_firma").eq("id", usuarioId).maybeSingle();
    if (error) return null;
    const v = (data as { nombre_firma?: unknown } | null)?.nombre_firma;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}
