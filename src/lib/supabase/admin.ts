import "server-only";
import { createClient } from "@supabase/supabase-js";
import { obtenerServiceRoleKeySupabase, obtenerUrlSupabase } from "./env";

/**
 * Cliente de Supabase con la Service Role Key: salta RLS.
 *
 * Uso exclusivo de servidor (el `import "server-only"` hace fallar el build
 * si algún componente de cliente llega a importar este archivo). Se usa para:
 * - dar de alta la fila `usuario` la primera vez que alguien válido entra;
 * - borrar la cuenta de Supabase Auth que se crea por una cuenta rechazada
 *   por dominio (no debe quedar ninguna huella de una cuenta de afuera).
 *
 * Ver docs/arquitectura/secretos.md — nunca se usa en el navegador.
 */
export function createSupabaseAdminClient() {
  return createClient(obtenerUrlSupabase(), obtenerServiceRoleKeySupabase(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
