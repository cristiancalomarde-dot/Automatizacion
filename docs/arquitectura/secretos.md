# Secretos — qué claves usa el proyecto y cómo se manejan

> **Dueño de:** la **regla #2**. Qué credenciales necesita la app, de dónde salen y por qué nunca
> tocan el código ni el repo.

## Regla #2 — las claves salen de variables de entorno, nunca del código

Ninguna clave, contraseña, token ni cadena de conexión se escribe en el código ni se sube a
GitHub. Todas se cargan como **variables de entorno** en el panel de Vercel (y las de base de
datos, en Supabase). El código las lee de ahí en tiempo de ejecución.

En el repo hay un archivo `.env.example` con los **nombres** de las variables y valores vacíos,
para saber qué hay que configurar. El `.gitignore` ya bloquea los `.env` con valores reales.

## Qué claves necesita el proyecto

| Clave | Para qué | Dónde se configura |
|---|---|---|
| `ANTHROPIC_API_KEY` | Llamar a Claude para interpretar los mails | Vercel |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Acceso a la casilla de Gmail (leer y enviar) | Vercel |
| `GMAIL_REFRESH_TOKEN` | Token de larga duración de la cuenta de mail dedicada | Vercel |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Conexión de la app a la base y al login | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones de servidor (ingesta, importador) que saltan RLS | Vercel (solo servidor) |
| `CRON_SECRET` | Que solo Vercel Cron pueda disparar la ingesta y el importador | Vercel |
| Credenciales de Postgres | Las administra Supabase | Supabase |

## Reglas de manejo

- Si una clave se filtra (se pega en un chat, en un commit, en un log), se **revoca y se
  regenera**. No alcanza con borrar el mensaje.
- Los `console.log` / logs **no imprimen** claves ni el mail completo del cliente.
- Las claves de producción las conoce la menor cantidad de gente posible; idealmente viven solo en
  Vercel/Supabase y nadie las tiene en su máquina.
- Acceso a las cuentas (Vercel, Supabase, Anthropic, la casilla de Gmail): con la cuenta de la
  empresa y 2FA.

## Anexo técnico

- `NEXT_PUBLIC_*` solo para lo que es seguro exponer al navegador (`SUPABASE_URL`,
  `SUPABASE_ANON_KEY`). Todo lo demás sin ese prefijo → solo servidor.
- `SUPABASE_SERVICE_ROLE_KEY` y `GMAIL_REFRESH_TOKEN` nunca se importan en componentes de cliente;
  solo en Route Handlers / Server Actions.
- La ingesta y el importador validan `Authorization: Bearer $CRON_SECRET` antes de correr.
- Rotación del `GMAIL_REFRESH_TOKEN`: documentar el procedimiento de re-consentimiento por si
  expira.
