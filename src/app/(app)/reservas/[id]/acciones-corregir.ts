"use server";

import {
  corregirDato,
  corregirVuelos,
  marcarResuelto,
  revisarDato,
  type EntradaCorregirDato,
  type EntradaCorregirVuelos,
  type EntradaMarcarResuelto,
  type EntradaRevisarDato,
  type ResultadoCorregir,
} from "@/lib/reservas/corregir/corregir";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEXTOS } from "@/lib/textos";

/**
 * "Corregir vuelos", "Está bien así" y "Corregir" (fechas o pax) en el detalle
 * de una reserva (spec M3-07), con la sesión del usuario (RLS, #1). La lógica
 * vive en `src/lib/reservas/corregir/`; acá solo se arma el cliente y un error
 * inesperado se dice en llano. Archivo aparte (como M3-05 y M3-06) para no
 * romper los mocks de las otras acciones del detalle.
 */
const T = TEXTOS.reserva.corregir;
const FALLA: ResultadoCorregir = { ok: false, error: T.error(T.motivos.conexion) };

export async function corregirVuelosDeReserva(entrada: EntradaCorregirVuelos): Promise<ResultadoCorregir> {
  try {
    return await corregirVuelos(await createSupabaseServerClient(), entrada);
  } catch {
    return FALLA;
  }
}

export async function marcarDatoRevisado(entrada: EntradaRevisarDato): Promise<ResultadoCorregir> {
  try {
    return await revisarDato(await createSupabaseServerClient(), entrada);
  } catch {
    return FALLA;
  }
}

export async function corregirDatoDeReserva(entrada: EntradaCorregirDato): Promise<ResultadoCorregir> {
  try {
    return await corregirDato(await createSupabaseServerClient(), entrada);
  } catch {
    return FALLA;
  }
}

/** Spec M3-39: "Marcar como resuelto" un motivo de revisión, con la nota de cómo se resolvió. */
export async function marcarMotivoResuelto(entrada: EntradaMarcarResuelto): Promise<ResultadoCorregir> {
  try {
    return await marcarResuelto(await createSupabaseServerClient(), entrada);
  } catch {
    return FALLA;
  }
}
