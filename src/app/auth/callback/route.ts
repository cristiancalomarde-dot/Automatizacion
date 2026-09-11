import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { esCorreoDelDominioPermitido, obtenerDominioPermitido } from "@/lib/auth/dominio";
import { darDeAltaUsuarioOperador } from "@/lib/usuarios/alta";

/**
 * Callback de OAuth de Google vía Supabase Auth (spec M1-01 #3, #4, #5).
 *
 * 1. Intercambia el `code` por una sesión.
 * 2. Repite el chequeo de dominio del lado del servidor — no confía en el
 *    hint `hd` que se le pidió a Google al armar el link de login (spec
 *    Anexo técnico; docs/arquitectura/auth-y-permisos.md).
 * 3. Si el dominio no es válido: cierra la sesión, borra la cuenta de
 *    Supabase Auth recién creada (para no dejar huella) y vuelve a Login con
 *    el mensaje de rechazo. No se crea fila en `usuario`.
 * 4. Si el dominio es válido: da de alta (o confirma) la fila en `usuario`
 *    con rol `operador` y entra al shell.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const dominioPermitido = obtenerDominioPermitido();
  const { email } = data.user;

  if (!esCorreoDelDominioPermitido(email, dominioPermitido)) {
    await supabase.auth.signOut();

    const admin = createSupabaseAdminClient();
    await admin.auth.admin.deleteUser(data.user.id);

    return NextResponse.redirect(`${origin}/login?error=dominio`);
  }

  const nombre =
    typeof data.user.user_metadata?.full_name === "string"
      ? data.user.user_metadata.full_name
      : null;

  await darDeAltaUsuarioOperador(createSupabaseAdminClient(), {
    id: data.user.id,
    email: email!,
    nombre,
  });

  return NextResponse.redirect(`${origin}/`);
}
