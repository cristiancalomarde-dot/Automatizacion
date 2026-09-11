import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { decidirRedireccion } from "@/lib/auth/proteccion-rutas";
import { obtenerAnonKeySupabase, obtenerUrlSupabase } from "@/lib/supabase/env";

/**
 * Protege todas las rutas (spec M1-01 #6): sin sesión, redirige a Login.
 * También refresca la cookie de sesión de Supabase en cada navegación
 * (patrón recomendado de `@supabase/ssr` para App Router).
 *
 * Convención de Next.js 16: reemplaza al antiguo `middleware.ts`, que quedó
 * deprecado en favor de `proxy.ts` (mismo comportamiento, nuevo nombre).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(obtenerUrlSupabase(), obtenerAnonKeySupabase(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = decidirRedireccion({
    pathname: request.nextUrl.pathname,
    haySesion: user !== null,
  });

  if (decision.tipo === "redirigir") {
    const destino = request.nextUrl.clone();
    const [pathname, search] = decision.destino.split("?");
    destino.pathname = pathname;
    destino.search = search ?? "";
    return NextResponse.redirect(destino);
  }

  return response;
}

export const config = {
  matcher: [
    // Todo menos los assets estáticos de Next y los archivos públicos.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
