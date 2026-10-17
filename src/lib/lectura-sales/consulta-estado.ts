import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lecturaActiva } from "./config";
import { lineaDeLectura, type CorridaParaLinea, type LineaLectura } from "./estado";

/**
 * Arma la línea de §4 del lado del servidor, con la sesión del usuario (RLS:
 * el equipo lee `lectura_casilla`). Apagada no consulta nada. Si la consulta
 * falla, la línea lo dice y la lista se muestra igual.
 */
export async function lineaDeLaLectura(supabase: SupabaseClient, ahora: Date = new Date()): Promise<LineaLectura> {
  if (!lecturaActiva()) return lineaDeLectura({ activa: false, ahora, ultima: null, ultimaBuena: null, noSePudoLeer: 0 });
  try {
    const columnas = "estado,inicio,miro,de_agencias,reservas_nuevas,reservas_actualizadas,avisos,errores";
    const [ultima, buena, noLeidos] = await Promise.all([
      supabase.from("lectura_casilla").select(columnas).in("estado", ["anduvo_bien", "con_aviso", "fallo"]).order("inicio", { ascending: false }).limit(1),
      supabase.from("lectura_casilla").select("inicio").in("estado", ["anduvo_bien", "con_aviso"]).order("inicio", { ascending: false }).limit(1),
      supabase.from("mail_recibido").select("id", { count: "exact", head: true }).eq("estado_lectura", "no_se_pudo_leer").eq("de_prueba", false),
    ]);
    if (ultima.error || buena.error || noLeidos.error) throw new Error("consulta");
    return lineaDeLectura({
      activa: true,
      ahora,
      ultima: (ultima.data?.[0] as CorridaParaLinea | undefined) ?? null,
      ultimaBuena: (buena.data?.[0] as { inicio: string } | undefined) ?? null,
      noSePudoLeer: noLeidos.count ?? 0,
    });
  } catch {
    return lineaDeLectura({ activa: true, ahora, error: true, ultima: null, ultimaBuena: null, noSePudoLeer: 0 });
  }
}
