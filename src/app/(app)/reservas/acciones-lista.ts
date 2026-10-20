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
  const agencias = [...new Set(reglasDelArchivo().map((r) => r.agencia))].sort((a, b) => a.localeCompare(b, "es"));
  return cargarListaDeReservas(await createSupabaseServerClient(), { admins: process.env.ADMINS_EMAILS, agencias });
}
