-- 0021 — Nombre para la firma y responsable de la reserva (spec M3-06).
--
-- Solo agrega: una columna en `usuario`, una en `reserva`, tres tipos de
-- evento del historial, una función para tomar o pasar la reserva y dos
-- triggers. No borra nada.
--
-- - `usuario.nombre_firma`: cómo firma cada uno los pedidos ("Damián Pérez",
--   "Damián · Operaciones"). Null = el nombre de la cuenta de Google (como en
--   M3-03). Cada uno edita SOLO el suyo (RLS: policy de update sobre su propia
--   fila + permiso de update solo sobre esa columna; el resto de `usuario` lo
--   sigue manteniendo el servidor con la Service Role Key, 0001).
-- - `reserva.responsable_id` → `usuario`: quién lleva la reserva. Null = sin
--   responsable. Si se borra la persona, la reserva queda sin responsable.
--   Con sesión, el responsable cambia solo por `asignar_responsable` (tomar o
--   pasar) o por el envío de los primeros pedidos: así cada cambio queda en el
--   historial (trigger `reserva_responsable_guardia`). Nadie puede poner a
--   alguien que no está en `usuario` (la FK y la función).
-- - `asignar_responsable(reserva, responsable, esperado)`: con la sesión
--   (security invoker, RLS de 0010). Si el responsable ya no es el que vio la
--   pantalla (`esperado`), no cambia nada (HT409: otro la tomó o la pasó
--   mientras tanto). Historial: `reserva_tomada` ("<persona> tomó la reserva")
--   si queda quien está en la sesión; `reserva_pasada` ("<persona> se la pasó
--   a <otra>") si queda otro.
-- - Envío (M3-03): cuando un pedido queda enviado (envío real) o con la marca
--   del envío de prueba, si la reserva no tiene responsable queda quien lo
--   envió, en el mismo UPDATE del pedido; historial `responsable_por_envio`
--   ("Responsable: <persona> (envió los primeros pedidos)"). Si ya tenía, no
--   cambia. Un envío nunca falla por esto: sin sesión o sin fila en `usuario`,
--   no se asigna.
-- - Los nombres del historial se guardan al momento (nombre para la firma, si
--   no el nombre, si no lo previo a la @), como `persona` en 0019/0020.
--
-- Errores propios: HT401 = sin sesión; HT403 = quien está en la sesión no es
-- del equipo (no está en `usuario`); HT404 = la persona elegida no es del
-- equipo; HT409 = el responsable cambió mientras tanto.
--
-- Cómo aplicar: `supabase db push --db-url <base>`. Primero en la base de
-- pruebas; en la real, con OK del owner y ANTES de publicar este código.

-- === Historial ==============================================================================

alter type public.tipo_evento_reserva add value if not exists 'reserva_tomada';
alter type public.tipo_evento_reserva add value if not exists 'reserva_pasada';
alter type public.tipo_evento_reserva add value if not exists 'responsable_por_envio';

-- === usuario: el nombre para la firma ========================================================

alter table public.usuario add column if not exists nombre_firma text;
alter table public.usuario drop constraint if exists usuario_nombre_firma_check;
alter table public.usuario
  add constraint usuario_nombre_firma_check check (
    nombre_firma is null or (nombre_firma = btrim(nombre_firma) and char_length(nombre_firma) between 1 and 80)
  );

comment on column public.usuario.nombre_firma is
  'M3-06: cómo firma la persona los pedidos a proveedores. Null = el nombre de su cuenta de Google. Lo edita solo ella.';

-- Cada uno edita solo su propia fila, y de ella solo el nombre para la firma.
create policy "usuario_update_propia_firma"
  on public.usuario
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.usuario from anon, authenticated;
grant update (nombre_firma) on public.usuario to authenticated;

-- El nombre con que se muestra una persona: el de la firma, si no el nombre, si no lo previo a la @.
create or replace function public.nombre_de_usuario(p_usuario uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(nullif(btrim(u.nombre_firma), ''), nullif(btrim(u.nombre), ''), split_part(u.email, '@', 1))
    from public.usuario u
   where u.id = p_usuario
$$;

revoke execute on function public.nombre_de_usuario(uuid) from public, anon;
grant execute on function public.nombre_de_usuario(uuid) to authenticated;

-- === reserva: el responsable =================================================================

alter table public.reserva
  add column if not exists responsable_id uuid references public.usuario (id) on delete set null;

comment on column public.reserva.responsable_id is
  'M3-06: quién lleva la reserva (null = sin responsable). Se toma, se pasa o queda al enviar los primeros pedidos; cada cambio va al historial.';

create index if not exists reserva_responsable_id_idx on public.reserva (responsable_id);

-- Con sesión, el responsable no se cambia con un UPDATE suelto: siempre por la
-- función o el envío, que dejan el historial. El servidor (service role, sin
-- sesión) y el borrado de una persona (on delete set null) no pasan por acá.
create function public.reserva_responsable_guardia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.responsable_id is distinct from old.responsable_id
     and auth.uid() is not null
     and coalesce(current_setting('app.asignando_responsable', true), '') <> 'on' then
    raise exception 'El responsable se cambia con "Tomar esta reserva" o "Pasarla a otro".'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger reserva_responsable_guardia
  before update of responsable_id on public.reserva
  for each row execute function public.reserva_responsable_guardia();

revoke execute on function public.reserva_responsable_guardia() from public, anon, authenticated;

-- === Tomar o pasar la reserva ================================================================

create or replace function public.asignar_responsable(p_reserva uuid, p_responsable uuid, p_esperado uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_yo uuid := auth.uid();
  v_actual uuid;
  v_tipo public.tipo_evento_reserva;
begin
  if v_yo is null then
    raise exception 'Sin sesión.' using errcode = 'HT401';
  end if;
  if not exists (select 1 from public.usuario u where u.id = v_yo) then
    raise exception 'Quien está en la sesión no es del equipo.' using errcode = 'HT403';
  end if;
  if p_responsable is null or not exists (select 1 from public.usuario u where u.id = p_responsable) then
    raise exception 'Esa persona no es del equipo.' using errcode = 'HT404';
  end if;

  select r.responsable_id into v_actual from public.reserva r where r.id = p_reserva for update;
  if not found then
    raise exception 'No existe la reserva.' using errcode = 'no_data_found';
  end if;
  if v_actual is distinct from p_esperado then
    raise exception 'El responsable cambió mientras tanto.' using errcode = 'HT409';
  end if;
  if v_actual = p_responsable then
    return jsonb_build_object('cambio', false, 'responsable_id', p_responsable, 'responsable', public.nombre_de_usuario(p_responsable));
  end if;

  perform set_config('app.asignando_responsable', 'on', true);
  update public.reserva set responsable_id = p_responsable, updated_at = now() where id = p_reserva;
  perform set_config('app.asignando_responsable', 'off', true);

  v_tipo := case when p_responsable = v_yo then 'reserva_tomada' else 'reserva_pasada' end;
  insert into public.evento_reserva (reserva_id, tipo, detalle)
  values (
    p_reserva,
    v_tipo,
    jsonb_build_object(
      'persona', public.nombre_de_usuario(v_yo),
      'responsable', public.nombre_de_usuario(p_responsable),
      'responsable_id', p_responsable,
      'anterior', public.nombre_de_usuario(v_actual),
      'anterior_id', v_actual
    )
  );

  return jsonb_build_object('cambio', true, 'responsable_id', p_responsable, 'responsable', public.nombre_de_usuario(p_responsable));
end;
$$;

revoke execute on function public.asignar_responsable(uuid, uuid, uuid) from public, anon;
grant execute on function public.asignar_responsable(uuid, uuid, uuid) to authenticated;

-- === Al enviar los primeros pedidos ===========================================================
-- En el mismo UPDATE que deja el pedido enviado (o con la marca de prueba).
-- `security definer` como el historial de 0010: el responsable queda aunque
-- cambien las policies; el autor sigue siendo `auth.uid()`.
create function public.reserva_pedido_responsable_por_envio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quien uuid := auth.uid();
  v_asignada uuid;
begin
  if not (
    (new.estado = 'enviado' and old.estado is distinct from 'enviado')
    or (new.envio_prueba_en is not null and new.envio_prueba_en is distinct from old.envio_prueba_en)
  ) then
    return null;
  end if;
  if v_quien is null or not exists (select 1 from public.usuario u where u.id = v_quien) then
    return null;
  end if;

  perform set_config('app.asignando_responsable', 'on', true);
  update public.reserva r
     set responsable_id = v_quien, updated_at = now()
   where r.id = new.reserva_id and r.responsable_id is null
  returning r.id into v_asignada;
  perform set_config('app.asignando_responsable', 'off', true);

  if v_asignada is not null then
    insert into public.evento_reserva (reserva_id, tipo, detalle)
    values (
      new.reserva_id,
      'responsable_por_envio',
      jsonb_build_object('persona', public.nombre_de_usuario(v_quien), 'responsable_id', v_quien, 'prueba', new.estado <> 'enviado')
    );
  end if;
  return null;
end;
$$;

create trigger reserva_pedido_responsable_por_envio
  after update on public.reserva_pedido
  for each row execute function public.reserva_pedido_responsable_por_envio();

revoke execute on function public.reserva_pedido_responsable_por_envio() from public, anon, authenticated;
