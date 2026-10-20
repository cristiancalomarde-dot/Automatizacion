import "server-only";

/**
 * Guardar "Mi nombre para la firma" (spec M3-06 fila 1), en el servidor y con
 * el cliente de la SESIÓN (RLS de 0021: cada uno edita solo su propio nombre
 * para la firma). Vacío, o igual al nombre de la cuenta de Google, guarda null:
 * la firma sigue al nombre de la cuenta.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { quienEnvia } from "@/lib/pedidos/envio/enviar";
import { nombreDeQuienFirma } from "@/lib/pedidos/pantalla";
import { TEXTOS } from "@/lib/textos";
import { normalizarNombreParaLaFirma } from "./nombre";

const T = TEXTOS.miFirma;

export type ResultadoFirma =
  | { ok: true; nombreFirma: string | null; firmaComo: string }
  | { ok: false; error: string; sinSesion?: true };

export async function guardarNombreParaLaFirma(cliente: SupabaseClient, texto: unknown): Promise<ResultadoFirma> {
  const persona = await quienEnvia(cliente);
  if (!persona) return { ok: false, error: T.error(T.motivos.sinSesion), sinSesion: true };
  const { data } = await cliente.auth.getUser();
  const nombreGoogle = data?.user ? nombreDeQuienFirma(data.user) : persona.email.split("@")[0];

  const normal = normalizarNombreParaLaFirma(texto, nombreGoogle);
  if (!normal.ok) return { ok: false, error: T.error(normal.error) };

  const { data: filas, error } = await cliente.from("usuario").update({ nombre_firma: normal.valor }).eq("id", persona.id).select("id");
  if (error) return { ok: false, error: T.error(T.motivos.conexion) };
  if (!filas || filas.length === 0) return { ok: false, error: T.error(T.motivos.noEstoyEnElEquipo) };
  return { ok: true, nombreFirma: normal.valor, firmaComo: normal.valor ?? nombreGoogle };
}
