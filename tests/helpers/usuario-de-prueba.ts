import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Sesión `authenticated` real para leer el catálogo como lo hace la app (RLS:
 * solo `authenticated` puede leer). Crea un usuario temporal con la service
 * role, entra con mail y contraseña y devuelve el cliente con esa sesión.
 * `borrar()` lo elimina al terminar: no queda huella en Supabase Auth.
 *
 * La contraseña es aleatoria por corrida y no sale de este proceso (#2).
 */
export async function crearSesionDePrueba(): Promise<{
  cliente: SupabaseClient;
  borrar: () => Promise<void>;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `test-m1-06-${randomUUID().slice(0, 8)}@hitravel.com.ar`;
  const password = `${randomUUID()}Aa1!`;

  const { data: creado, error: errorAlta } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (errorAlta || !creado.user) throw new Error(`No se pudo crear el usuario de prueba: ${errorAlta?.message}`);

  const cliente = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: errorIngreso } = await cliente.auth.signInWithPassword({ email, password });
  if (errorIngreso) {
    await admin.auth.admin.deleteUser(creado.user.id);
    throw new Error(`No se pudo ingresar con el usuario de prueba: ${errorIngreso.message}`);
  }

  return {
    cliente,
    borrar: async () => {
      await cliente.auth.signOut();
      await admin.auth.admin.deleteUser(creado.user!.id);
    },
  };
}
