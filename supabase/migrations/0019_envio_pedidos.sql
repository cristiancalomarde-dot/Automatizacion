-- 0019 — Envío de los pedidos a proveedores por operations@ (spec M3-03).
--
-- Solo agrega y amplía: columnas nuevas en `reserva_pedido`, dos valores
-- nuevos en el tipo de evento del historial, una regla de transiciones del
-- estado del pedido y `guardar_pedidos_armados` que ahora también rearma una
-- reserva ya pedida (para completar lo que quedó sin enviar). No borra nada.
--
-- - Estado del pedido: `borrador` → `enviando` → `enviado` | `fallo`. Tomar el
--   pedido es un UPDATE condicional (`estado` en borrador/fallo → enviando):
--   dos envíos a la vez del mismo pedido no pueden tomarlo los dos, así que
--   sale un solo mail (fila 6). Mandar de nuevo uno `enviado` exige "Reenviar"
--   y suma `reenvios`. En modo prueba el pedido vuelve al estado que tenía y
--   queda la marca del envío de prueba.
-- - Enviado: fecha, quién (usuario y nombre de la firma) y el Message-ID. La
--   base rechaza un `enviado` sin fecha, sin quién o sin Message-ID.
-- - `copia_en_enviados`: si la copia por IMAP en Enviados de operations@ quedó
--   guardada (null = todavía no / modo prueba).
-- - "pedido incompleto" no se guarda: lo calcula la app (reserva en
--   `pedido_a_proveedor` con algún pedido que no está `enviado`).
-- - Historial: `pedidos_enviados` ("<persona> envió N pedidos a: …", también
--   los reenvíos) y `envio_de_prueba` (modo prueba: la reserva no cambia de estado).
--
-- Cómo aplicar: `supabase db push` por el pooler. Primero en la base de
-- pruebas; en la real, con OK del owner.

-- === Historial ==============================================================================

alter type public.tipo_evento_reserva add value if not exists 'pedidos_enviados';
alter type public.tipo_evento_reserva add value if not exists 'envio_de_prueba';

-- === reserva_pedido: estado y datos del envío ================================================

alter table public.reserva_pedido drop constraint reserva_pedido_estado_check;
alter table public.reserva_pedido
  add constraint reserva_pedido_estado_check check (estado in ('borrador', 'enviando', 'enviado', 'fallo'));

alter table public.reserva_pedido
  add column enviando_desde timestamptz,
  add column enviado_en timestamptz,
  add column enviado_por uuid references public.usuario (id),
  add column enviado_por_nombre text,
  add column message_id text,
  add column motivo_fallo text,
  add column reenvios integer not null default 0,
  add column copia_en_enviados boolean,
  add column envio_prueba_en timestamptz,
  add column envio_prueba_por_nombre text;

alter table public.reserva_pedido
  add constraint reserva_pedido_enviado_completo check (
    estado <> 'enviado' or (enviado_en is not null and enviado_por_nombre is not null and message_id is not null)
  ),
  add constraint reserva_pedido_fallo_con_motivo check (estado <> 'fallo' or motivo_fallo is not null),
  add constraint reserva_pedido_enviando_desde check (estado <> 'enviando' or enviando_desde is not null),
  add constraint reserva_pedido_reenvios_positivo check (reenvios >= 0);

comment on column public.reserva_pedido.estado is
  'M3-03: borrador → enviando (tomado para mandar) → enviado | fallo. Reenviar uno enviado pasa por enviando y suma reenvios.';
comment on column public.reserva_pedido.message_id is
  'M3-03: el Message-ID del último mail enviado (para cruzar las respuestas en M4).';

create unique index reserva_pedido_message_id_key on public.reserva_pedido (message_id) where message_id is not null;

-- Las transiciones válidas del estado (además de quedarse igual).
create function public.reserva_pedido_transicion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado = old.estado then
    return new;
  end if;
  if new.estado = 'enviando' and old.estado in ('borrador', 'fallo', 'enviado') then
    return new;
  end if;
  if old.estado = 'enviando' then
    return new;
  end if;
  raise exception 'Un pedido no pasa de % a % (se envía pasando por "enviando").', old.estado, new.estado
    using errcode = 'check_violation';
end;
$$;

create trigger reserva_pedido_transicion
  before update of estado on public.reserva_pedido
  for each row execute function public.reserva_pedido_transicion();

revoke execute on function public.reserva_pedido_transicion() from public, anon, authenticated;

-- === Rearmar también una reserva ya pedida ===================================================
-- Igual que 0018, salvo el estado: también `pedido_a_proveedor`, para completar
-- lo que quedó sin enviar (un proveedor al que se le cargó el mail). Los
-- pedidos que no son borrador (enviados, con fallo, enviándose) y los editados
-- se conservan, y el índice (reserva, casilla) impide duplicarlos.

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
   where p.reserva_id = p_reserva and p.estado = 'borrador' and not p.editado;
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
  'M3-01/M3-03: guarda los borradores y las tareas armados para una reserva recibida o ya pedida. No pisa los editados ni los enviados.';
