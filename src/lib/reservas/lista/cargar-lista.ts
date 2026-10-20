/**
 * La lista de reservas como la arma el servidor (spec M3-08 filas 5 y 6): con
 * el cliente de la sesión (RLS, #1), decide por el mail de la sesión si es
 * administradora (`ADMINS_EMAILS`, que pasa quien llama). A un operador la
 * base no le devuelve los viajes terminados (fin antes de hoy, hora
 * Argentina): no alcanza con esconderlos en la pantalla. Solo lectura (#14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarReservas } from "@/lib/reservas/consultas";
import type { FilaReserva } from "@/lib/reservas/tipos";
import { esAdministradora, hoyEnArgentina } from "./terminadas";

export interface ListaDeReservas {
  filas: FilaReserva[];
  /** Si ve además la vista "Viajes terminados". */
  esAdmin: boolean;
  /** Hoy en Argentina ("AAAA-MM-DD"), el mismo con el que se filtró. */
  hoy: string;
  /** Las agencias del filtro (las de `data/agencias.csv`). */
  agencias: string[];
}

export async function cargarListaDeReservas(
  cliente: SupabaseClient,
  opciones: { admins: string | undefined; agencias: string[]; ahora?: Date },
): Promise<ListaDeReservas> {
  const hoy = hoyEnArgentina(opciones.ahora);
  const { data } = await cliente.auth.getUser();
  const esAdmin = esAdministradora(data?.user?.email ?? null, opciones.admins);
  const filas = await cargarReservas(cliente, esAdmin ? {} : { sinTerminadasAntesDe: hoy });
  return { filas, esAdmin, hoy, agencias: opciones.agencias };
}
