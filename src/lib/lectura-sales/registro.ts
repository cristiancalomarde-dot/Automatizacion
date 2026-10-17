import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El registro de corridas en `lectura_casilla` (spec M2-07 #8, #18, #19).
 * Solo servidor (service role): el equipo lo lee por RLS, nadie con sesión
 * lo escribe. Las filas llevan solo números y textos en llano: nunca
 * remitentes, asuntos, cuerpos ni claves.
 */

export type OrigenCorrida = "cron" | "manual";
export type EstadoCorrida = "en_curso" | "anduvo_bien" | "con_aviso" | "fallo" | "salteada" | "apagada";

/** Una corrida colgada más de esto no bloquea a la siguiente (#8). */
export const MINUTOS_CORRIDA_COLGADA = 15;

export interface FilaCorrida {
  origen: OrigenCorrida;
  estado: EstadoCorrida;
  inicio: string;
  fin: string | null;
  carpetas: string[];
  miro: number;
  de_agencias: number;
  procesados: number;
  reservas_nuevas: number;
  reservas_actualizadas: number;
  pendientes: number;
  no_se_pudo_leer: number;
  avisos: string[];
  errores: string[];
}

export const TEXTO_CORRIDA_COLGADA = `quedó colgada más de ${MINUTOS_CORRIDA_COLGADA} minutos`;

export function filaVacia(origen: OrigenCorrida, estado: EstadoCorrida, inicio: Date): FilaCorrida {
  return {
    origen,
    estado,
    inicio: inicio.toISOString(),
    fin: null,
    carpetas: [],
    miro: 0,
    de_agencias: 0,
    procesados: 0,
    reservas_nuevas: 0,
    reservas_actualizadas: 0,
    pendientes: 0,
    no_se_pudo_leer: 0,
    avisos: [],
    errores: [],
  };
}

/** Guarda una corrida que no leyó nada (apagada, salteada, falló sin clave). */
export async function registrarCorrida(admin: SupabaseClient, fila: FilaCorrida): Promise<string> {
  const { data, error } = await admin.from("lectura_casilla").insert(fila).select("id").single();
  if (error) throw new Error(`No se pudo registrar la corrida: ${error.message}`);
  return data.id as string;
}

/**
 * Toma el candado (#8): da por fallida la corrida en curso de hace más de 15
 * minutos y abre una nueva "en_curso". Si ya hay una en curso, devuelve null
 * (el índice único parcial de 0015 impide dos a la vez).
 */
export async function tomarCandado(admin: SupabaseClient, origen: OrigenCorrida, ahora: Date): Promise<string | null> {
  const limite = new Date(ahora.getTime() - MINUTOS_CORRIDA_COLGADA * 60_000).toISOString();
  const colgadas = await admin
    .from("lectura_casilla")
    .update({ estado: "fallo", fin: ahora.toISOString(), errores: [TEXTO_CORRIDA_COLGADA] })
    .eq("estado", "en_curso")
    .lt("inicio", limite);
  if (colgadas.error) throw new Error(`No se pudo revisar las corridas en curso: ${colgadas.error.message}`);
  const { data, error } = await admin.from("lectura_casilla").insert(filaVacia(origen, "en_curso", ahora)).select("id").single();
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(`No se pudo abrir la corrida: ${error.message}`);
  }
  return data.id as string;
}

export async function terminarCorrida(admin: SupabaseClient, id: string, fila: FilaCorrida): Promise<void> {
  const { error } = await admin.from("lectura_casilla").update(fila).eq("id", id);
  if (error) throw new Error(`No se pudo cerrar la corrida: ${error.message}`);
}
