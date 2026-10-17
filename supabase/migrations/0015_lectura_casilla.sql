-- 0015 — Lectura automática de sales@ (spec M2-07).
--
-- - `lectura_casilla`: una fila por corrida (#18): inicio, fin, origen (cron o
--   manual), estado, carpetas leídas, cuántos mails miró, cuántos eran de
--   agencias, cuántos procesó, reservas nuevas y actualizadas, pendientes,
--   "no se pudo leer", avisos y errores en llano (sin claves ni cuerpos).
--   Una sola corrida "en_curso" a la vez (índice único parcial, #8): la
--   segunda queda "salteada". La que quedó colgada más de 15 minutos la da
--   por fallida la corrida siguiente (desde el código).
-- - `mail_recibido` (0010 ya trae carpeta, imap_uidvalidity, imap_uid,
--   message_id y la huella única = Message-ID normalizado): suma `intentos` y
--   `estado_lectura` para los reintentos (#13). Un mail que falló queda
--   "pendiente" y se reintenta; a los 3 intentos, "no_se_pudo_leer". Y un
--   índice único por carpeta + uidvalidity + UID para lo que entró por IMAP.
--
-- RLS (regla #1): `lectura_casilla` la lee el equipo logueado; nadie con
-- sesión la escribe (solo el servidor, con la service role). Sin sesión, nada.
--
-- Cómo aplicar: `supabase db push` por el pooler. Desde 2026-10-16, primero a
-- la base de pruebas; a la real, con el OK del owner.

-- === lectura_casilla ====================================================================

create table public.lectura_casilla (
  id uuid primary key default gen_random_uuid(),
  origen text not null,
  estado text not null,
  inicio timestamptz not null default now(),
  fin timestamptz,
  carpetas text[] not null default '{}',
  miro integer not null default 0,
  de_agencias integer not null default 0,
  procesados integer not null default 0,
  reservas_nuevas integer not null default 0,
  reservas_actualizadas integer not null default 0,
  pendientes integer not null default 0,
  no_se_pudo_leer integer not null default 0,
  avisos text[] not null default '{}',
  errores text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint lectura_casilla_origen_check check (origen in ('cron', 'manual')),
  constraint lectura_casilla_estado_check check (
    estado in ('en_curso', 'anduvo_bien', 'con_aviso', 'fallo', 'salteada', 'apagada')
  )
);

comment on table public.lectura_casilla is
  'Una fila por corrida de la lectura de sales@ (spec M2-07 #18). Solo números y '
  'textos en llano: nunca remitentes, asuntos, cuerpos ni claves.';

-- #8: una sola corrida en curso a la vez.
create unique index lectura_casilla_una_en_curso on public.lectura_casilla ((true)) where estado = 'en_curso';
create index lectura_casilla_inicio on public.lectura_casilla (inicio desc);

alter table public.lectura_casilla enable row level security;

create policy "lectura_casilla_select_authenticated" on public.lectura_casilla
  for select to authenticated using (true);

-- === mail_recibido: reintentos de la lectura =============================================

alter table public.mail_recibido add column intentos integer not null default 0;
alter table public.mail_recibido add column estado_lectura text;
alter table public.mail_recibido add constraint mail_recibido_estado_lectura_check check (
  estado_lectura is null or estado_lectura in ('pendiente', 'procesado', 'registrado', 'no_se_pudo_leer')
);

comment on column public.mail_recibido.estado_lectura is
  'M2-07: pendiente (falló o lo cortó el techo; se reintenta), procesado, registrado '
  '(sin IA: Jysk, cotizaciones, TourRadar que no es statement) o no_se_pudo_leer (3 intentos).';
comment on column public.mail_recibido.intentos is
  'M2-07: intentos fallidos de procesar el mail (a los 3 queda no_se_pudo_leer).';

create unique index mail_recibido_imap_uid on public.mail_recibido (carpeta, imap_uidvalidity, imap_uid)
  where origen = 'imap' and imap_uid is not null;
