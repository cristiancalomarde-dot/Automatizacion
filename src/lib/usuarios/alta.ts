import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DatosAltaUsuario {
  id: string;
  email: string;
  nombre: string | null;
}

/**
 * Alta automática de usuario (spec M1-01 #5): la primera vez que una cuenta
 * válida del dominio entra, se crea su fila en `usuario` con rol `operador`.
 * Una segunda entrada de la misma cuenta no duplica la fila.
 *
 * Se resuelve con un `upsert` por `id` (la primary key = el id de
 * Supabase Auth) e `ignoreDuplicates: true`: si la fila ya existe, no hace
 * nada (ni la duplica ni pisa cambios manuales de rol hechos después). Corre
 * con el cliente admin (Service Role) porque `authenticated` no tiene policy
 * de insert/update sobre `usuario` (ver supabase/migrations/0001_usuario.sql).
 */
export async function darDeAltaUsuarioOperador(
  admin: SupabaseClient,
  datos: DatosAltaUsuario,
): Promise<void> {
  const { error } = await admin.from("usuario").upsert(
    {
      id: datos.id,
      email: datos.email,
      nombre: datos.nombre,
      rol: "operador",
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(`No se pudo dar de alta el usuario: ${error.message}`);
  }
}
