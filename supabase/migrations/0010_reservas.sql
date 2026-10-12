-- M2-01 — reservas en la base: el mail original, la reserva con su estado
-- inicial, sus componentes, el historial que no se toca y el registro de cada
-- llamada a la IA. Más el bucket privado de los PDF adjuntos y el borrado de
-- los datos de prueba.
--
-- Diseño: docs/arquitectura/modelo-de-datos.md (reserva, evento_reserva,
-- estados, duplicados por booking_id + producto) e integraciones-ia.md
-- (ia_llamada). Esta migración lo traduce a SQL, no lo rediseña.
--
-- - `mail_recibido`: el mail tal cual llegó, una sola vez por `huella`
--   (Message-ID normalizado o sha256, ver src/lib/reservas/huella.ts). Así
--   M2-07 sabe qué ya procesó sin marcar nada en la casilla (#4).
-- - `reserva`: nace solo en `recibida` o `para_revision` (trigger), y
--   `para_revision` ⇔ al menos un motivo (check). `mail_recibido_id` no es
--   único: un mail de Kilroy puede traer varias reservas.
-- - `reserva_componente`: las partes de un tour compuesto, o la lista de tours
--   sueltos de Journaway, en orden. El estado de cada una lo agrega M3.
-- - `evento_reserva`: append-only. "creada" y "estado_cambiado" los escribe
--   la base (triggers), con el autor de la sesión (`auth.uid()`) o null = el
--   sistema. Ni el servidor puede editar o borrar una entrada, salvo el
--   borrado de prueba y solo para reservas de prueba.
-- - `ia_llamada`: tarea, modelo, versión de instrucciones, tokens, costo y
--   resultado. Sin el contenido del mail (ya está en `mail_recibido`).
--
-- RLS (regla #1): las cinco tablas con la policy del equipo, como 0002:
-- `authenticated` select/insert/update, sin delete. `evento_reserva` e
-- `ia_llamada`: solo select/insert. Sin sesión (anon), nada.
--
-- Cómo aplicar: `supabase db push` por el pooler (igual que 0003-0009).

-- === Enums ======================================================================

create type public.estado_reserva as enum (
  'recibida',
  'para_revision',
  'pedido_a_proveedor',
  'confirmada',
  'con_cambios',
  'rechazada',
  'cerrada',
  'descartada'
);

-- M4 suma sus tipos con `alter type ... add value` en su propia migración.
create type public.tipo_evento_reserva as enum (
  'creada',
  'estado_cambiado',
  'mail_agregado',
  'posible_duplicada'
);

-- === mail_recibido ================================================================

create table public.mail_recibido (
  id uuid primary key default gen_random_uuid(),
  origen text not null,
  carpeta text,
  archivo_origen text,
  imap_uidvalidity bigint,
  imap_uid bigint,
  message_id text,
  huella text not null,
  remitente text not null,
  remitente_nombre text,
  destinatarios text[] not null default '{}',
  asunto text,
  fecha_mail timestamptz,
  cuerpo_texto text,
  cuerpo_html text,
  adjuntos jsonb not null default '[]',
  agencia text,
  de_prueba boolean not null default false,
  procesado_en timestamptz,
  error_proceso text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mail_recibido_huella_key unique (huella),
  constraint mail_recibido_origen_check check (origen in ('imap', 'archivo')),
  constraint mail_recibido_carpeta_check check (
    (origen = 'imap' and carpeta in ('inbox', 'spam'))
    or (origen = 'archivo' and carpeta is null)
  ),
  constraint mail_recibido_remitente_minuscula check (remitente = lower(remitente)),
  constraint mail_recibido_adjuntos_arreglo check (jsonb_typeof(adjuntos) = 'array')
);

comment on table public.mail_recibido is
  'El mail original de una reserva, tal cual llegó (spec M2-01). Una sola fila '
  'por `huella` (Message-ID normalizado o sha256 de remitente+fecha+asunto+cuerpo): '
  'el mismo mail visto en Inbox y en Spam queda una vez. `adjuntos`: '
  '[{nombre, tipo, tamano, ruta}]; `ruta` en el bucket `mail-adjuntos` solo para '
  'los PDF. `agencia` null si el remitente no se reconoció.';

-- === reserva ======================================================================

create table public.reserva (
  id uuid primary key default gen_random_uuid(),
  agencia text not null,
  mail_recibido_id uuid not null references public.mail_recibido (id),
  booking_id text,
  producto_id uuid references public.producto (id),
  producto_texto_agencia text,
  fecha_inicio date,
  fecha_fin date,
  pax integer,
  pasajeros jsonb not null default '[]',
  vuelos jsonb not null default '[]',
  habitacion text,
  pedidos_especiales text,
  estado public.estado_reserva not null default 'recibida',
  motivos_revision text[] not null default '{}',
  posible_duplicada boolean not null default false,
  duplicada_de_id uuid references public.reserva (id),
  datos_extraidos jsonb,
  de_prueba boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reserva_para_revision_con_motivo check (
    (estado = 'para_revision') = (cardinality(motivos_revision) > 0)
  ),
  constraint reserva_pax_positivo check (pax is null or pax > 0)
);

comment on table public.reserva is
  'Una reserva recibida por mail (docs/arquitectura/modelo-de-datos.md). Nace '
  'en `recibida` o `para_revision`; `para_revision` siempre con uno o más '
  '`motivos_revision` escritos para el operativo. `datos_extraidos`: la salida '
  'de la IA con su confianza por campo (M2-02). `de_prueba`: modo prueba (M2-06), '
  'se borra con `borrar_datos_de_prueba()`; las reales no se borran.';

create index reserva_agencia_booking_id_idx on public.reserva (agencia, booking_id);
create index reserva_mail_recibido_id_idx on public.reserva (mail_recibido_id);

-- === reserva_componente ================================================================

create table public.reserva_componente (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reserva (id),
  orden integer not null,
  tipo public.tipo_componente_producto not null,
  producto_id uuid references public.producto (id),
  producto_componente_id uuid references public.producto_componente (id),
  descripcion_ruta text,
  texto_agencia text,
  fecha_inicio date,
  fecha_fin date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reserva_componente_orden_key unique (reserva_id, orden),
  constraint reserva_componente_tramo_sin_producto check (tipo = 'paquete' or producto_id is null)
);

comment on table public.reserva_componente is
  'Las partes de una reserva, en orden: los componentes de un tour compuesto o '
  'la lista de tours sueltos de Journaway. Cada una es un paquete (con '
  '`producto_id` si se reconoció) o un tramo de bus, con sus fechas y el texto '
  'tal como lo mandó la agencia. El estado de cada parte lo agrega M3.';

-- === evento_reserva ===================================================================

create table public.evento_reserva (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reserva (id),
  tipo public.tipo_evento_reserva not null,
  estado_anterior public.estado_reserva,
  estado_nuevo public.estado_reserva,
  mail_recibido_id uuid references public.mail_recibido (id),
  detalle jsonb not null default '{}',
  autor_id uuid references public.usuario (id),
  created_at timestamptz not null default clock_timestamp()
);

comment on table public.evento_reserva is
  'Historial de cada reserva, append-only: no se edita ni se borra (ni desde el '
  'servidor). `autor_id` null = el sistema. "creada" y "estado_cambiado" los '
  'agregan los triggers de `reserva`.';

create index evento_reserva_reserva_id_idx on public.evento_reserva (reserva_id, created_at);

-- === ia_llamada =======================================================================

create table public.ia_llamada (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tarea text not null,
  modelo text not null,
  version_instrucciones text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  costo_usd numeric(12, 6) not null default 0,
  resultado text not null,
  mail_recibido_id uuid references public.mail_recibido (id),
  reserva_id uuid references public.reserva (id),
  de_prueba boolean not null default false,
  constraint ia_llamada_resultado_check check (
    resultado in ('ok', 'cortada', 'invalida', 'error', 'sin_presupuesto')
  )
);

comment on table public.ia_llamada is
  'Cada llamada a la IA (docs/arquitectura/integraciones-ia.md): tarea, modelo, '
  'versión de instrucciones, tokens, costo y resultado. NO guarda el contenido del '
  'mail. `uso_ia` sigue sumando el gasto del mes para el techo (#3). La escribe el '
  'servidor (M2-02).';

create index ia_llamada_mail_recibido_id_idx on public.ia_llamada (mail_recibido_id);
create index ia_llamada_reserva_id_idx on public.ia_llamada (reserva_id);

-- === Reglas de la reserva (triggers) =========================================================

-- Una reserva solo nace en `recibida` o `para_revision`.
create function public.reserva_estado_inicial()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado not in ('recibida', 'para_revision') then
    raise exception 'Una reserva nueva solo puede estar recibida o para revisión (vino %).', new.estado
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger reserva_estado_inicial
  before insert on public.reserva
  for each row execute function public.reserva_estado_inicial();

-- El historial lo escribe la base: "creada" al nacer y "estado_cambiado" en
-- cada cambio. `security definer` para que la entrada se escriba aunque quien
-- cambia el estado no tenga permiso de insertar en el historial; el autor es
-- `auth.uid()` (null = el sistema / la service role).
create function public.reserva_registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.evento_reserva (reserva_id, tipo, estado_nuevo, detalle, autor_id)
    values (new.id, 'creada', new.estado, jsonb_build_object('motivos', to_jsonb(new.motivos_revision)), auth.uid());
  elsif new.estado is distinct from old.estado then
    insert into public.evento_reserva (reserva_id, tipo, estado_anterior, estado_nuevo, detalle, autor_id)
    values (
      new.id,
      'estado_cambiado',
      old.estado,
      new.estado,
      jsonb_build_object('motivos', to_jsonb(new.motivos_revision)),
      auth.uid()
    );
  end if;
  return null;
end;
$$;

create trigger reserva_evento_creada
  after insert on public.reserva
  for each row execute function public.reserva_registrar_evento();

create trigger reserva_evento_estado_cambiado
  after update of estado on public.reserva
  for each row execute function public.reserva_registrar_evento();

-- El historial no se edita ni se borra, ni siquiera desde el servidor. La
-- única salida es `borrar_datos_de_prueba()` (marca la transacción con
-- `app.borrado_de_prueba`) y solo para entradas de reservas de prueba.
create function public.evento_reserva_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('app.borrado_de_prueba', true) = 'on'
     and exists (select 1 from public.reserva r where r.id = old.reserva_id and r.de_prueba) then
    return old;
  end if;
  raise exception 'El historial de una reserva no se edita ni se borra.'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger evento_reserva_inmutable
  before update or delete on public.evento_reserva
  for each row execute function public.evento_reserva_inmutable();

-- El autor de cada entrada es siempre quien está en la sesión (null = el
-- sistema): nadie firma una entrada a nombre de otro.
create function public.evento_reserva_autor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.autor_id := auth.uid();
  return new;
end;
$$;

create trigger evento_reserva_autor
  before insert on public.evento_reserva
  for each row execute function public.evento_reserva_autor();

-- Una reserva real no se borra (los estados `cerrada`/`descartada` reemplazan
-- el borrado). Solo el borrado de prueba, y solo las de prueba.
create function public.reserva_sin_borrado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.borrado_de_prueba', true) = 'on' and old.de_prueba then
    return old;
  end if;
  raise exception 'Una reserva no se borra (se cierra o se descarta).'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger reserva_sin_borrado
  before delete on public.reserva
  for each row execute function public.reserva_sin_borrado();

-- === Borrado de prueba =================================================================

-- Borra todo lo marcado "de prueba" (llamadas a la IA, componentes, historial,
-- reservas y mails) y devuelve las rutas de Storage de sus PDF, que borra el
-- servidor (src/lib/reservas/guardar.ts). Solo la service role.
create function public.borrar_datos_de_prueba()
returns setof text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rutas text[];
begin
  perform set_config('app.borrado_de_prueba', 'on', true);

  select coalesce(array_agg(a ->> 'ruta'), '{}')
    into rutas
    from public.mail_recibido m, jsonb_array_elements(m.adjuntos) a
   where m.de_prueba and a ->> 'ruta' is not null;

  delete from public.ia_llamada l
   where l.de_prueba
      or l.reserva_id in (select r.id from public.reserva r where r.de_prueba)
      or l.mail_recibido_id in (select m.id from public.mail_recibido m where m.de_prueba);
  delete from public.reserva_componente c
   where c.reserva_id in (select r.id from public.reserva r where r.de_prueba);
  delete from public.evento_reserva e
   where e.reserva_id in (select r.id from public.reserva r where r.de_prueba);
  update public.reserva r set duplicada_de_id = null
   where r.de_prueba and r.duplicada_de_id is not null;
  delete from public.reserva r where r.de_prueba;
  delete from public.mail_recibido m where m.de_prueba;

  perform set_config('app.borrado_de_prueba', 'off', true);
  return query select unnest(rutas);
end;
$$;

revoke execute on function public.borrar_datos_de_prueba() from public, anon, authenticated;
grant execute on function public.borrar_datos_de_prueba() to service_role;

-- Las funciones de los triggers no se llaman sueltas.
revoke execute on function public.reserva_estado_inicial() from public, anon, authenticated;
revoke execute on function public.reserva_registrar_evento() from public, anon, authenticated;
revoke execute on function public.evento_reserva_inmutable() from public, anon, authenticated;
revoke execute on function public.reserva_sin_borrado() from public, anon, authenticated;
revoke execute on function public.evento_reserva_autor() from public, anon, authenticated;

-- === RLS ==============================================================================

alter table public.mail_recibido enable row level security;
alter table public.reserva enable row level security;
alter table public.reserva_componente enable row level security;
alter table public.evento_reserva enable row level security;
alter table public.ia_llamada enable row level security;

create policy "mail_recibido_select_authenticated" on public.mail_recibido
  for select to authenticated using (true);
create policy "mail_recibido_insert_authenticated" on public.mail_recibido
  for insert to authenticated with check (true);
create policy "mail_recibido_update_authenticated" on public.mail_recibido
  for update to authenticated using (true) with check (true);

create policy "reserva_select_authenticated" on public.reserva
  for select to authenticated using (true);
create policy "reserva_insert_authenticated" on public.reserva
  for insert to authenticated with check (true);
create policy "reserva_update_authenticated" on public.reserva
  for update to authenticated using (true) with check (true);

create policy "reserva_componente_select_authenticated" on public.reserva_componente
  for select to authenticated using (true);
create policy "reserva_componente_insert_authenticated" on public.reserva_componente
  for insert to authenticated with check (true);
create policy "reserva_componente_update_authenticated" on public.reserva_componente
  for update to authenticated using (true) with check (true);

create policy "evento_reserva_select_authenticated" on public.evento_reserva
  for select to authenticated using (true);
create policy "evento_reserva_insert_authenticated" on public.evento_reserva
  for insert to authenticated with check (true);

create policy "ia_llamada_select_authenticated" on public.ia_llamada
  for select to authenticated using (true);
create policy "ia_llamada_insert_authenticated" on public.ia_llamada
  for insert to authenticated with check (true);

-- === Storage: PDF adjuntos ===============================================================

-- Bucket privado. Ruta `<mail_recibido_id>/<nombre>`. Lee el equipo; escribe
-- solo el servidor (service role, que salta RLS). Solo PDF.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('mail-adjuntos', 'mail-adjuntos', false, array['application/pdf'])
on conflict (id) do nothing;

create policy "mail_adjuntos_select_authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'mail-adjuntos');
