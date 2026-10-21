-- 0023 — Agregar un pedido a mano (spec M3-09).
--
-- Solo agrega y amplía: una columna en `reserva_pedido`, una regla sobre su
-- casilla, una policy de borrado, dos tipos de evento del historial, dos
-- funciones y `guardar_pedidos_armados` que ahora tampoco borra los pedidos a
-- mano. No borra datos.
--
-- - `reserva_pedido.a_mano`: el pedido lo escribió una persona del equipo (lo
--   que el armado no cubre: una noche extra, un servicio que la agencia pidió
--   aparte, una consulta). Su casilla es "a-mano:<uuid>": no choca con el
--   índice (reserva, casilla), así que dos pedidos a mano al mismo proveedor,
--   o uno a mano y uno armado al mismo mail, conviven (fila 4). La base exige
--   que la marca y la casilla digan lo mismo.
-- - Se manda por el mismo camino que los armados (M3-03): tiene destinatarios,
--   asunto, cuerpo y firma con `{{nombre_de_quien_envia}}` como cualquier otro.
--   "Pedido incompleto" lo calcula la app y no cuenta los a mano (fila 7).
-- - `guardar_pedidos_armados`: igual que 0019, pero el rearmado no borra los
--   pedidos a mano (fila 5).
-- - `agregar_pedido_a_mano(reserva, proveedor, destinatarios, asunto, cuerpo,
--   firma)`: con la sesión (security invoker, RLS de 0018). Solo con la
--   reserva recibida o pedida a proveedor; el proveedor, si viene, tiene que
--   estar en el directorio (su nombre lo pone la base); si no viene, el pedido
--   se nombra por sus mails. Mails válidos, asunto y texto no vacíos. Toma el
--   mismo candado que el rearmado: no se cruzan. Historial
--   `pedido_a_mano_agregado` ("<persona> agregó un pedido a mano a <a quién>").
-- - `sacar_pedido_a_mano(pedido)`: solo un pedido a mano en `borrador` o
--   `fallo` (uno enviado o enviándose no se saca, fila 8). Lo bloquea antes de
--   mirar el estado: no se cruza con un envío que lo está tomando. Historial
--   `pedido_a_mano_sacado`. La policy de 0018 solo deja borrar borradores sin
--   editar; la nueva deja borrar un pedido a mano en borrador o fallo.
-- - El historial no lleva datos de pasajeros (#1): quién, a quién (proveedor o
--   mail) y el id del pedido. El autor lo pone el trigger de 0010.
--
-- Errores propios: HT401 = sin sesión; HT403 = quien está en la sesión no es
-- del equipo; HT404 = el proveedor o el pedido no existen; HT409 = el pedido ya
-- se envió o se está enviando; HT423 = la reserva no está para agregar pedidos.
--
-- Cómo aplicar: `supabase db push --db-url <base>`. Primero en la base de
-- pruebas; en la real, con OK del owner y ANTES de publicar este código.

-- === Historial ==============================================================================

alter type public.tipo_evento_reserva add value if not exists 'pedido_a_mano_agregado';
alter type public.tipo_evento_reserva add value if not exists 'pedido_a_mano_sacado';

-- === reserva_pedido: la marca ===============================================================

alter table public.reserva_pedido add column if not exists a_mano boolean not null default false;

alter table public.reserva_pedido drop constraint if exists reserva_pedido_a_mano_casilla;
alter table public.reserva_pedido
  add constraint reserva_pedido_a_mano_casilla check (a_mano = (casilla like 'a-mano:%'));

comment on column public.reserva_pedido.a_mano is
  'M3-09: lo escribió una persona del equipo (casilla "a-mano:<uuid>"). El rearmado no lo toca y no cuenta para "pedido incompleto".';

drop policy if exists "reserva_pedido_delete_a_mano" on public.reserva_pedido;
create policy "reserva_pedido_delete_a_mano" on public.reserva_pedido
  for delete to authenticated using (a_mano and estado in ('borrador', 'fallo'));

-- === Rearmar sin tocar los pedidos a mano ====================================================
-- Igual que 0019 salvo el `delete`: tampoco borra los a mano (fila 5).

create or replace function public.guardar_pedidos_armados(p_reserva uuid, p_pedidos jsonb, p_tareas jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_estado text;
  v_borrados integer;
  v_conservados integer;
  v_insertados integer;
  v_tareas integer;
begin
  if jsonb_typeof(coalesce(p_pedidos, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_tareas, '[]'::jsonb)) <> 'array' then
    raise exception 'Los pedidos y las tareas van como listas.' using errcode = 'invalid_parameter_value';
  end if;

  -- Una corrida por reserva a la vez.
  perform pg_advisory_xact_lock(hashtextextended('reserva_pedido:' || p_reserva::text, 0));

  select r.estado::text into v_estado from public.reserva r where r.id = p_reserva;
  if v_estado is null then
    raise exception 'No existe la reserva.' using errcode = 'no_data_found';
  end if;
  if v_estado = 'para_revision' then
    raise exception 'Resolvé primero lo que está para revisión.' using errcode = 'check_violation';
  end if;
  if v_estado not in ('recibida', 'pedido_a_proveedor') then
    raise exception 'Solo se arman pedidos de reservas recibidas.' using errcode = 'check_violation';
  end if;

  delete from public.reserva_pedido p
   where p.reserva_id = p_reserva and p.estado = 'borrador' and not p.editado and not p.a_mano;
  get diagnostics v_borrados = row_count;

  select count(*) into v_conservados from public.reserva_pedido p where p.reserva_id = p_reserva;

  insert into public.reserva_pedido
    (reserva_id, casilla, destinatarios, proveedor_ids, proveedores, partes, asunto, cuerpo, firma, sin_destinatario, avisos)
  select p_reserva,
         x ->> 'casilla',
         coalesce(array(select jsonb_array_elements_text(x -> 'destinatarios')), '{}'),
         coalesce(array(select (jsonb_array_elements_text(x -> 'proveedor_ids'))::uuid), '{}'),
         coalesce(array(select jsonb_array_elements_text(x -> 'proveedores')), '{}'),
         coalesce(x -> 'partes', '[]'::jsonb),
         x ->> 'asunto',
         x ->> 'cuerpo',
         x ->> 'firma',
         x ->> 'sin_destinatario',
         coalesce(array(select jsonb_array_elements_text(x -> 'avisos')), '{}')
    from jsonb_array_elements(coalesce(p_pedidos, '[]'::jsonb)) x
  -- Un borrador editado (o ya no borrador) conserva su casilla: no se agrega otro.
  on conflict (reserva_id, casilla) do nothing;
  get diagnostics v_insertados = row_count;

  delete from public.reserva_tarea t where t.reserva_id = p_reserva;
  insert into public.reserva_tarea (reserva_id, tipo, texto, detalle, orden)
  select p_reserva, x ->> 'tipo', x ->> 'texto', coalesce(x -> 'detalle', '{}'::jsonb), (o - 1)::integer
    from jsonb_array_elements(coalesce(p_tareas, '[]'::jsonb)) with ordinality as t(x, o);
  get diagnostics v_tareas = row_count;

  return jsonb_build_object(
    'insertados', v_insertados,
    'conservados', v_conservados,
    'reemplazados', v_borrados,
    'tareas', v_tareas
  );
end;
$$;

comment on function public.guardar_pedidos_armados(uuid, jsonb, jsonb) is
  'M3-01/M3-03/M3-09: guarda los borradores y las tareas armados para una reserva recibida o ya pedida. No pisa los editados, los enviados ni los a mano.';

-- === Agregar un pedido a mano ================================================================

create or replace function public.agregar_pedido_a_mano(
  p_reserva uuid,
  p_proveedor uuid,
  p_destinatarios text[],
  p_asunto text,
  p_cuerpo text,
  p_firma text
)
returns public.reserva_pedido
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_yo uuid := auth.uid();
  v_estado public.estado_reserva;
  v_nombre text;
  v_mails text[];
  v_proveedores text[];
  v_pedido public.reserva_pedido%rowtype;
begin
  if v_yo is null then
    raise exception 'Sin sesión.' using errcode = 'HT401';
  end if;
  if not exists (select 1 from public.usuario u where u.id = v_yo) then
    raise exception 'Quien está en la sesión no es del equipo.' using errcode = 'HT403';
  end if;

  v_mails := coalesce(array(
    select distinct on (lower(btrim(m))) lower(btrim(m))
      from unnest(coalesce(p_destinatarios, '{}')) with ordinality as d(m, o)
     where btrim(m) <> ''
     order by lower(btrim(m)), o
  ), '{}');
  if cardinality(v_mails) = 0 then
    raise exception 'Falta a quién se le escribe.' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from unnest(v_mails) m where m !~ '^[^[:space:]@,;]+@[^[:space:]@,;.]+(\.[^[:space:]@,;.]+)+$') then
    raise exception 'Un mail no es válido.' using errcode = 'invalid_parameter_value';
  end if;
  if length(btrim(coalesce(p_asunto, ''))) = 0 or length(btrim(coalesce(p_cuerpo, ''))) = 0 then
    raise exception 'Falta el asunto o el texto.' using errcode = 'invalid_parameter_value';
  end if;

  -- El mismo candado que el rearmado: un pedido a mano no se cruza con un "Volver a armar".
  perform pg_advisory_xact_lock(hashtextextended('reserva_pedido:' || p_reserva::text, 0));

  select r.estado into v_estado from public.reserva r where r.id = p_reserva for share;
  if not found then
    raise exception 'No existe la reserva.' using errcode = 'no_data_found';
  end if;
  if v_estado not in ('recibida', 'pedido_a_proveedor') then
    raise exception 'En esta reserva no se agregan pedidos a mano.' using errcode = 'HT423';
  end if;

  if p_proveedor is not null then
    select p.nombre into v_nombre from public.proveedor p where p.id = p_proveedor;
    if v_nombre is null then
      raise exception 'Ese proveedor no está en el directorio.' using errcode = 'HT404';
    end if;
    v_proveedores := array[v_nombre];
  else
    -- Sin proveedor del directorio, el pedido se nombra por sus mails (como lo escribió la persona).
    v_proveedores := array[array_to_string(v_mails, ', ')];
  end if;

  insert into public.reserva_pedido
    (reserva_id, casilla, destinatarios, proveedor_ids, proveedores, partes, asunto, cuerpo, firma, a_mano)
  values (
    p_reserva,
    'a-mano:' || gen_random_uuid()::text,
    v_mails,
    case when p_proveedor is null then '{}'::uuid[] else array[p_proveedor] end,
    v_proveedores,
    '[]'::jsonb,
    btrim(p_asunto),
    p_cuerpo,
    p_firma,
    true
  )
  returning * into v_pedido;

  insert into public.evento_reserva (reserva_id, tipo, detalle)
  values (
    p_reserva,
    'pedido_a_mano_agregado',
    jsonb_build_object('persona', public.nombre_de_usuario(v_yo), 'a', array_to_string(v_proveedores, ' y '), 'pedido_id', v_pedido.id)
  );

  return v_pedido;
end;
$$;

revoke execute on function public.agregar_pedido_a_mano(uuid, uuid, text[], text, text, text) from public, anon;
grant execute on function public.agregar_pedido_a_mano(uuid, uuid, text[], text, text, text) to authenticated;

-- === Sacar un pedido a mano ==================================================================

create or replace function public.sacar_pedido_a_mano(p_pedido uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_yo uuid := auth.uid();
  p public.reserva_pedido%rowtype;
begin
  if v_yo is null then
    raise exception 'Sin sesión.' using errcode = 'HT401';
  end if;
  if not exists (select 1 from public.usuario u where u.id = v_yo) then
    raise exception 'Quien está en la sesión no es del equipo.' using errcode = 'HT403';
  end if;

  -- Bloqueado antes de mirar el estado: un envío que lo está tomando espera (o ya lo tomó).
  select * into p from public.reserva_pedido x where x.id = p_pedido for update;
  if not found then
    raise exception 'Ese pedido ya no está.' using errcode = 'HT404';
  end if;
  if not p.a_mano then
    raise exception 'Solo se sacan los pedidos a mano.' using errcode = 'check_violation';
  end if;
  if p.estado not in ('borrador', 'fallo') then
    raise exception 'Ese pedido ya se envió (o se está enviando): no se puede sacar.' using errcode = 'HT409';
  end if;

  delete from public.reserva_pedido x where x.id = p_pedido;
  if not found then
    raise exception 'No se pudo sacar el pedido.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.evento_reserva (reserva_id, tipo, detalle)
  values (
    p.reserva_id,
    'pedido_a_mano_sacado',
    jsonb_build_object('persona', public.nombre_de_usuario(v_yo), 'a', array_to_string(p.proveedores, ' y '), 'pedido_id', p.id)
  );

  return jsonb_build_object('reserva_id', p.reserva_id, 'pedido_id', p.id);
end;
$$;

revoke execute on function public.sacar_pedido_a_mano(uuid) from public, anon;
grant execute on function public.sacar_pedido_a_mano(uuid) to authenticated;
