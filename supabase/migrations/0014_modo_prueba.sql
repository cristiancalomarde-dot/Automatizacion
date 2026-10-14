-- 0014 — Modo prueba (spec M2-06): la marca "de prueba" en todas las filas de
-- una reserva y la revisión del owner.
--
-- - `de_prueba` en `reserva_componente` y `evento_reserva` (fila 4). `reserva`,
--   `mail_recibido` e `ia_llamada` ya la traen (0010). En las partes y el
--   historial la copia la base desde su reserva al insertar: nunca disiente de
--   la reserva y el código no tiene que acordarse de ponerla.
-- - `revision_prueba` (filas 13 y 14): la marca del owner sobre una reserva de
--   prueba, "bien" o "mal" con qué estaba mal y una nota. Una por reserva; se
--   puede cambiar. El autor es siempre quien está en la sesión (#1) y la base
--   rechaza marcar una reserva real.
-- - `borrar_datos_de_prueba()` y `borrar_datos_de_prueba_de()` borran también
--   las revisiones de las reservas que borran (fila 8). El gasto en `uso_ia`
--   no se toca.
--
-- RLS (regla #1): `revision_prueba` con la policy del equipo (authenticated
-- select/insert/update, sin delete). Sin sesión, nada.
--
-- Cómo aplicar: `supabase db push` por el pooler (igual que 0003-0013).

-- === de_prueba en las partes y el historial ==============================================

alter table public.reserva_componente add column de_prueba boolean not null default false;
alter table public.evento_reserva add column de_prueba boolean not null default false;

comment on column public.reserva_componente.de_prueba is
  'M2-06: copia de reserva.de_prueba, la pone la base al insertar.';
comment on column public.evento_reserva.de_prueba is
  'M2-06: copia de reserva.de_prueba, la pone la base al insertar.';

create function public.de_prueba_desde_reserva()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select r.de_prueba into new.de_prueba from public.reserva r where r.id = new.reserva_id;
  new.de_prueba := coalesce(new.de_prueba, false);
  return new;
end;
$$;

create trigger reserva_componente_de_prueba
  before insert on public.reserva_componente
  for each row execute function public.de_prueba_desde_reserva();

create trigger evento_reserva_de_prueba
  before insert on public.evento_reserva
  for each row execute function public.de_prueba_desde_reserva();

revoke execute on function public.de_prueba_desde_reserva() from public, anon, authenticated;

-- Las filas que ya estaban. El historial no se edita (0010): se suspende su
-- guarda solo para esta copia de la marca.
update public.reserva_componente c set de_prueba = true
  from public.reserva r where r.id = c.reserva_id and r.de_prueba;
alter table public.evento_reserva disable trigger evento_reserva_inmutable;
update public.evento_reserva e set de_prueba = true
  from public.reserva r where r.id = e.reserva_id and r.de_prueba;
alter table public.evento_reserva enable trigger evento_reserva_inmutable;

-- === revision_prueba =======================================================================

create table public.revision_prueba (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reserva (id),
  resultado text not null,
  que_mal text[] not null default '{}',
  nota text,
  autor_id uuid references public.usuario (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revision_prueba_reserva_key unique (reserva_id),
  constraint revision_prueba_resultado_check check (resultado in ('bien', 'mal')),
  constraint revision_prueba_que_mal_check check (
    que_mal <@ array['producto', 'fechas', 'pasajeros', 'vuelos', 'estado_motivo', 'otro']::text[]
  ),
  -- "Bien" no lleva qué estaba mal; "mal" lleva al menos una cosa.
  constraint revision_prueba_coherente check (
    (resultado = 'bien' and cardinality(que_mal) = 0) or (resultado = 'mal' and cardinality(que_mal) > 0)
  )
);

comment on table public.revision_prueba is
  'M2-06: la marca del owner sobre una reserva de prueba (bien / mal, qué y una nota). '
  'Una por reserva, se puede cambiar. Solo reservas de prueba; el autor lo pone la base.';

-- Solo reservas de prueba; el autor es quien está en la sesión (nadie firma por
-- otro); la reserva de una marca no cambia.
create function public.revision_prueba_guardas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.reserva_id <> old.reserva_id then
    raise exception 'La marca no se pasa a otra reserva.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.reserva r where r.id = new.reserva_id and r.de_prueba) then
    raise exception 'Solo se marcan las reservas de prueba.' using errcode = 'check_violation';
  end if;
  new.autor_id := auth.uid();
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger revision_prueba_guardas
  before insert or update on public.revision_prueba
  for each row execute function public.revision_prueba_guardas();

revoke execute on function public.revision_prueba_guardas() from public, anon, authenticated;

alter table public.revision_prueba enable row level security;

create policy "revision_prueba_select_authenticated" on public.revision_prueba
  for select to authenticated using (true);
create policy "revision_prueba_insert_authenticated" on public.revision_prueba
  for insert to authenticated with check (true);
create policy "revision_prueba_update_authenticated" on public.revision_prueba
  for update to authenticated using (true) with check (true);

-- === Borrado de prueba, con las revisiones ===================================================

create or replace function public.borrar_datos_de_prueba()
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
  delete from public.revision_prueba v
   where v.reserva_id in (select r.id from public.reserva r where r.de_prueba);
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

create or replace function public.borrar_datos_de_prueba_de(p_mails uuid[], p_llamadas uuid[] default '{}')
returns setof text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mails uuid[];
  v_reservas uuid[];
  rutas text[];
begin
  select coalesce(array_agg(m.id), '{}')
    into v_mails
    from public.mail_recibido m
   where m.id = any(coalesce(p_mails, '{}')) and m.de_prueba;

  select coalesce(array_agg(r.id), '{}')
    into v_reservas
    from public.reserva r
   where r.mail_recibido_id = any(v_mails) and r.de_prueba;

  perform set_config('app.borrado_de_prueba', 'on', true);

  select coalesce(array_agg(a ->> 'ruta'), '{}')
    into rutas
    from public.mail_recibido m, jsonb_array_elements(m.adjuntos) a
   where m.id = any(v_mails) and a ->> 'ruta' is not null;

  delete from public.ia_llamada l
   where (l.id = any(coalesce(p_llamadas, '{}')) and l.de_prueba)
      or l.mail_recibido_id = any(v_mails)
      or l.reserva_id = any(v_reservas);
  delete from public.revision_prueba v
   where v.reserva_id = any(v_reservas);
  delete from public.reserva_componente c
   where c.reserva_id = any(v_reservas);
  delete from public.evento_reserva e
   where e.reserva_id = any(v_reservas);
  update public.reserva r set duplicada_de_id = null
   where r.de_prueba and r.duplicada_de_id = any(v_reservas);
  delete from public.reserva r where r.id = any(v_reservas);
  delete from public.mail_recibido m where m.id = any(v_mails);

  perform set_config('app.borrado_de_prueba', 'off', true);
  return query select unnest(rutas);
end;
$$;
