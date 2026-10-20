"use server";

import { reglasDelArchivo } from "@/lib/reservas/agencias";
import { cargarListaDeReservas, type ListaDeReservas } from "@/lib/reservas/lista/cargar-lista";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * La lista de reservas desde el servidor (spec M3-08 fila 5): la pantalla ya
 * no la consulta desde el navegador, así un operador no recibe los viajes
 * terminados aunque cambie un filtro. `ADMINS_EMAILS` se lee acá (#2).
 */
export async function cargarLaListaDeReservas(): Promise<ListaDeReservas> {
  return cargarListaDeReservas(await createSupabaseServerClient(), { admins: process.env.ADMINS_EMAILS, agencias: agenciasDelArchivo() });
}

/** Las agencias de `data/agencias.csv`, por nombre. Si el archivo no se puede leer, el filtro queda solo con "Todas". */
function agenciasDelArchivo(): string[] {
  try {
    return [...new Set(reglasDelArchivo().map((r) => r.agencia))].sort((a, b) => a.localeCompare(b, "es"));
  } catch {
    return [];
  }
}
