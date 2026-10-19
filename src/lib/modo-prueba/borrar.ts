import type { SupabaseClient } from "@supabase/supabase-js";
import { borrarDatosDePrueba, borrarDatosDePruebaDe } from "@/lib/reservas/guardar";

/**
 * El `--borrar` del modo prueba (spec M2-06 fila 8): borra TODAS las reservas
 * de prueba con sus partes, historial, mails, PDF, llamadas a la IA y marcas
 * del owner (migraciones 0010, 0013 y 0014). Las reales no se tocan (la base
 * lo impide) y el gasto en `uso_ia` no se borra, porque fue real.
 *
 * Solo se usa cuando se pide explícito (`npm run probar:mails -- --borrar`).
 * Los tests borran solo lo suyo (`borrarDatosDePruebaDe`); el único test que
 * llama a esto lo hace solo si no hay otros datos de prueba cargados
 * (`tests/limpieza-acotada.test.ts` lo controla).
 */
export async function borrarTodoLoDePrueba(admin: SupabaseClient): Promise<{ archivosBorrados: number }> {
  return borrarDatosDePrueba(admin);
}

/**
 * M2-09 (owner 2026-10-17): `npm run probar:mails -- --journaway --borrar`
 * borra SOLO lo de prueba de Journaway, para volver a correr sus 4 mails: los
 * mails de prueba de la agencia Journaway y lo que cuelga de ellos (reservas,
 * partes, historial, llamadas a la IA, marcas del owner y PDF), con
 * `borrar_datos_de_prueba_de` (0013/0014). Las reservas reales y lo de prueba
 * de Kilroy y TourRadar no se tocan; el gasto en `uso_ia` tampoco.
 */
export async function borrarPruebaDeJournaway(admin: SupabaseClient): Promise<{ mails: number; reservas: number; archivosBorrados: number }> {
  const mails: string[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await admin
      .from("mail_recibido")
      .select("id")
      .eq("de_prueba", true)
      .eq("agencia", "Journaway")
      .order("id")
      .range(desde, desde + 999);
    if (error) throw new Error(`No se pudieron buscar los mails de prueba de Journaway: ${error.message}`);
    mails.push(...(data ?? []).map((m) => m.id as string));
    if ((data ?? []).length < 1000) break;
  }
  if (mails.length === 0) return { mails: 0, reservas: 0, archivosBorrados: 0 };
  const { count, error } = await admin
    .from("reserva")
    .select("id", { count: "exact", head: true })
    .eq("de_prueba", true)
    .in("mail_recibido_id", mails);
  if (error) throw new Error(`No se pudieron contar las reservas de prueba de Journaway: ${error.message}`);
  const { archivosBorrados } = await borrarDatosDePruebaDe({ mails }, admin);
  return { mails: mails.length, reservas: count ?? 0, archivosBorrados };
}
