# M1-01 · Base de la app: Next.js + Supabase + login con Google (dominio restringido) + deploy en Vercel

**Depende de:** nada — es la primera pieza del proyecto, el código arranca de cero.

## 1. Qué queremos lograr

Que exista la aplicación: alguien del dominio de la empresa entra con su cuenta de Google, ve una
pantalla mínima ya logueado, y puede salir. Todo corriendo en una URL pública de Vercel, conectado
a una base Supabase real, sin ninguna clave escrita en el repo. Es la base sin la cual ninguna
otra pieza (catálogo, proveedores, reservas) tiene dónde vivir.

## 2. Qué tiene que hacer (y cómo comprobamos cada cosa)

| # | Qué hace | Cómo se comprueba |
|---|---|---|
| 1 | Proyecto Next.js (App Router, TypeScript) inicializado en el repo, con lint y build funcionando. | `npm run build` y el linter corren sin errores sobre el proyecto recién creado. |
| 2 | Proyecto Supabase creado y conectado a la app (Postgres + Auth). | La app arranca en local sin errores de conexión; una consulta simple a Supabase (ej. leer la sesión) responde. |
| 3 | Login "Ingresar con Google" vía Supabase Auth. | Un mail con dominio de la empresa completa el flujo de Google y vuelve a la app con sesión activa. |
| 4 | El login **rechaza** cuentas fuera del dominio configurado, aunque tengan el link. | Se prueba con una cuenta Google de otro dominio: no se crea sesión y se muestra el error "Esta cuenta no pertenece a HI Travel." (prueba de lo que NO debe pasar). |
| 5 | Alta automática de usuario: la primera vez que una cuenta válida del dominio entra, se crea su fila en `usuario` con rol único `operador`. Una segunda entrada de la misma cuenta no duplica la fila. | Se inspecciona la tabla `usuario` en Supabase tras el primer login (1 fila nueva) y tras un segundo login (sigue habiendo 1 fila, no 2). |
| 6 | Todas las rutas de la app requieren sesión; sin sesión, redirige a Login. | Se pide una ruta protegida sin sesión (navegación directa o sesión vencida) y termina en Login, no en el shell. |
| 7 | Sesión vencida: la app detecta la sesión caída y muestra el mensaje fijo, sin perder al usuario en una pantalla rota. | Se invalida/expira la sesión manualmente y se confirma el mensaje "Tu sesión venció. Volvé a ingresar." |
| 8 | Shell post-login: header con wordmark + nombre del usuario logueado + botón salir. Sin datos de catálogo todavía (eso es M1-02 a M1-06). | Tras loguearse, el header muestra el mail o nombre de la cuenta y un botón "Salir" que termina la sesión y vuelve a Login. |
| 9 | `.env.example` en el repo con los nombres de las variables de entorno que usa esta pieza (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`), sin valores reales. | El archivo existe en el repo, sus valores están vacíos, y ningún otro archivo del repo contiene una clave real (`grep` de las claves reales sobre el repo no encuentra nada). |
| 10 | Las variables de entorno reales están cargadas en Vercel (y las de Supabase, en Supabase), no en el código. | Se revisa el panel de variables de entorno de Vercel: están presentes; el repo no las tiene. |
| 11 | Deploy en Vercel, publicado desde la rama principal del repo en GitHub. | La URL de producción de Vercel responde y muestra la pantalla de Login. |

## 3. Qué ve el usuario

- **Pantallas:** Login (pantalla única) y el shell post-login (header con wordmark "HI Travel ·
  Reservas de Catálogo" + nombre de usuario + "Salir"; el área de contenido queda vacía, a la
  espera del catálogo de las piezas siguientes).
- **El recorrido:**
  1. La persona entra a la URL de la app y ve el botón "Ingresar con Google".
  2. Toca el botón, completa el flujo de Google.
  3. Si el mail es del dominio de la empresa: vuelve a la app, ve el shell con su nombre en el
     header.
  4. Si el mail es de otro dominio: vuelve a Login con el mensaje de rechazo, sin sesión creada.
  5. Desde el shell, toca "Salir": termina la sesión y vuelve a Login.
- **Los tres estados:**
  - **Carga:** al tocar "Ingresar con Google", el botón queda deshabilitado mostrando "Ingresando…"
    hasta que Google responde.
  - **Error:** cuenta fuera de dominio → "Esta cuenta no pertenece a HI Travel."; falla el flujo de
    Google u otro error de autenticación → "No pudimos ingresar. Probá de nuevo."; sesión vencida
    en cualquier pantalla protegida → "Tu sesión venció. Volvé a ingresar."
  - **Recién logueado:** el shell aparece con el header ya completo (nombre de usuario visible) y
    el área de contenido vacía — no es un estado de "vacío" de datos (eso lo define cada pantalla
    de catálogo/proveedores en su propia spec), es simplemente el punto de partida antes de que
    existan esas pantallas.

## 4. Qué queda afuera

- Cualquier pantalla de catálogo, proveedores o reservas (M1-02 a M1-06 en adelante).
- Roles distintos de "operador" o permisos finos (no hay en el MVP, ver `auth-y-permisos.md`).
- Recupero de contraseña o registro manual (no aplica: la identidad la maneja Google).
- Ingesta de mail, importadores, IA (piezas posteriores).
- Entorno de prueba/staging en Vercel (se agrega si hace falta más adelante; alcanza con producción
  para esta pieza).

## 5. Reglas del proyecto que toca

- **#5** — terminada = las 3 verificaciones en verde (ver anexo).
- **#1** — se activa RLS en las tablas desde el inicio (empezando por `usuario`), aunque el modelo
  sea de datos compartidos por todo el equipo (defensa en profundidad, `modelo-de-datos.md`).
- **#2** — esta pieza da de alta las primeras claves del proyecto (Supabase, Google OAuth): viven
  en variables de entorno de Vercel/Supabase, nunca en el código; el repo solo tiene
  `.env.example` con los nombres.

---

## Anexo técnico (para los agentes)

- **Las 3 verificaciones, en orden (regla #5):** 1) tests unitarios + linter → 2) integración
  (login con cuenta del dominio crea la fila `usuario` correcta; login con cuenta de otro dominio
  no crea sesión ni fila) → 3) el recorrido completo de punta a punta: entrar en la URL pública de
  Vercel, loguearse con Google, ver el shell, salir. No se avanza a una capa con la anterior en
  rojo; si una falla: causa raíz → arreglo mínimo → re-correr.
- **Test primero:** el test se escribe antes de la implementación y se lo ve fallar por la razón
  correcta antes de darlo por bueno.
- **Antes de construir esta spec:** confirmar con el owner si las cuentas de Vercel / Supabase /
  Google Cloud se crean con cuenta personal o de empresa (recomendado: empresa, desde el día uno —
  ver `stack.md` "Abierto" y el plan M1 §3), y el dominio exacto a restringir (`@hitravel.com.ar`
  u otro).
- **Restricción de dominio:** Supabase Auth con proveedor Google OAuth; validar el claim `hd` de
  Google **y** repetir el chequeo de dominio en el callback del lado del servidor antes de crear
  sesión (no confiar solo en el claim del clidente OAuth) — ver `auth-y-permisos.md` Anexo técnico.
- **Alta de usuario:** trigger o chequeo en el primer login exitoso que inserta en `usuario` con
  rol `operador` si no existe ya una fila para ese mail/id.
- **Entregables:** proyecto Next.js completo en la raíz del repo; página de Login; layout/shell
  protegido; integración de Supabase Auth (cliente y servidor); tabla `usuario` con su RLS;
  `.env.example`; configuración de deploy en Vercel conectada al repo de GitHub
  (`github.com/cristiancalomarde-dot/Automatizacion`, ver `stack.md`).
- **Diseño y alcance no se deciden acá:** la paleta y tono ya están fijados en `marca.md`; el
  contenido de catálogo/proveedores va en sus propias specs (M1-02 en adelante).
