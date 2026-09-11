-- M1-01 — tabla `usuario` + RLS (regla #1: RLS activada desde el inicio,
-- aunque el modelo sea de datos compartidos por todo el equipo).
--
-- Cómo aplicar esta migración cuando exista el proyecto Supabase real:
--   supabase db push          (con el CLI de Supabase conectado al proyecto), o
--   pegar este archivo en el SQL Editor del panel de Supabase y ejecutarlo.
--
-- Alta de fila: la hace el servidor con la Service Role Key en el callback de
-- login (src/lib/usuarios/alta.ts), no un trigger de base de datos — así el
-- chequeo de dominio (que decide si la fila se crea o no) vive en un solo
-- lugar, en código, testeable. Por eso `authenticated` no tiene policy de
-- insert/update acá: nadie inserta su propia fila desde el cliente.

create table if not exists public.usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  nombre text,
  rol text not null default 'operador' check (rol = 'operador'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.usuario is
  'Alta de Supabase Auth: rol único "operador" en el MVP (docs/arquitectura/auth-y-permisos.md).';

alter table public.usuario enable row level security;

-- Cualquier usuario autenticado del equipo puede ver el listado de usuarios
-- (dato compartido, no privado — docs/arquitectura/modelo-de-datos.md).
create policy "usuario_select_authenticated"
  on public.usuario
  for select
  to authenticated
  using (true);

-- Sin sesión, nada (RLS deniega por default sin una policy que habilite).
-- Sin policy de insert/update/delete para `authenticated`: la alta y el
-- mantenimiento de esta tabla los hace el servidor con la Service Role Key,
-- que salta RLS.
