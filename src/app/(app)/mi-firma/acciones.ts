"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEXTOS } from "@/lib/textos";
import { guardarNombreParaLaFirma, type ResultadoFirma } from "@/lib/usuarios/guardar-firma";

/**
 * Guardar "Mi nombre para la firma" (spec M3-06 fila 1), con la sesión del
 * usuario (RLS de 0021: cada uno edita solo el suyo). La lógica vive en
 * `src/lib/usuarios/guardar-firma.ts`; acá solo se arma el cliente.
 */
export async function guardarMiNombreParaLaFirma(texto: string): Promise<ResultadoFirma> {
  try {
    return await guardarNombreParaLaFirma(await createSupabaseServerClient(), texto);
  } catch {
    return { ok: false, error: TEXTOS.miFirma.error(TEXTOS.miFirma.motivos.conexion) };
  }
}
