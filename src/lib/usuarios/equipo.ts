/**
 * Las personas del equipo (la tabla `usuario`, spec M3-06 filas 5 y 7) y quién
 * soy yo, con el cliente de la sesión (RLS: solo `authenticated` lee
 * `usuario`). Sin sesión: nadie. Se puede usar desde el navegador.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaDelEquipo } from "@/lib/reservas/responsable/filtro";
import { nombreVisible } from "./nombre";

export interface Equipo {
  /** El id de quien está en la sesión (null sin sesión). */
  yo: string | null;
  personas: PersonaDelEquipo[];
}

export async function cargarEquipo(cliente: SupabaseClient): Promise<Equipo> {
  const { data: sesion } = await cliente.auth.getUser();
  const yo = sesion?.user?.id ?? null;
  if (!yo) return { yo: null, personas: [] };
  const { data, error } = await cliente.from("usuario").select("id,nombre,nombre_firma,email");
  if (error) throw new Error(error.message);
  const personas = ((data ?? []) as Array<{ id: string; nombre: string | null; nombre_firma: string | null; email: string }>)
    .map((u) => ({ id: u.id, nombre: nombreVisible(u) ?? u.email }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { yo, personas };
}
