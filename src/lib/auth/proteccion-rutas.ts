/**
 * Decisión de "¿esta ruta necesita sesión?" — lógica pura que usa el
 * middleware (src/middleware.ts). Separada del middleware para poder
 * testearla sin simular un `NextRequest` completo.
 *
 * Regla (spec M1-01 #6 y #7): todas las rutas requieren sesión; sin sesión,
 * redirige a Login con el mensaje de sesión vencida. Con sesión, `/login` no
 * se muestra (se vuelve al shell).
 */

/** Rutas que no requieren sesión: la pantalla de login y el callback de OAuth. */
const RUTAS_PUBLICAS = ["/login", "/auth/callback"] as const;

export function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

export type DecisionRuta =
  | { tipo: "seguir" }
  | { tipo: "redirigir"; destino: string };

export function decidirRedireccion(params: {
  pathname: string;
  haySesion: boolean;
}): DecisionRuta {
  const { pathname, haySesion } = params;
  const esPublica = esRutaPublica(pathname);

  if (!haySesion && !esPublica) {
    return { tipo: "redirigir", destino: "/login?error=sesion_vencida" };
  }

  if (haySesion && pathname === "/login") {
    return { tipo: "redirigir", destino: "/" };
  }

  return { tipo: "seguir" };
}
