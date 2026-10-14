import type { SupabaseClient } from "@supabase/supabase-js";
import { borrarDatosDePrueba } from "@/lib/reservas/guardar";

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
