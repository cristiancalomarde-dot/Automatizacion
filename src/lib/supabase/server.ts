import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { obtenerAnonKeySupabase, obtenerUrlSupabase } from "./env";

/**
 * Cliente de Supabase para Server Components y Route Handlers, atado a las
 * cookies de la sesión actual. Usa la clave "anon" (RLS aplica normalmente).
 *
 * Para operaciones que necesitan saltar RLS (alta de usuario, borrar una
 * cuenta rechazada por dominio) usar `createSupabaseAdminClient` en su lugar.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(obtenerUrlSupabase(), obtenerAnonKeySupabase(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Se llamó desde un Server Component (no puede escribir cookies).
          // El middleware se encarga de refrescar la sesión en ese caso.
        }
      },
    },
  });
}
