-- 0018 — Borradores de pedido a proveedores y tareas de la reserva (spec M3-01).
--
-- Solo agrega: dos tablas nuevas y una función. No cambia ni borra nada de lo
-- que ya existe (ninguna tabla, columna, fila ni función anterior se toca).
--
-- - `reserva_pedido`: un borrador de mail por casilla de proveedor y por
--   reserva (fila 1). Destinatario(s), proveedor(es), las partes que cubre,
--   asunto, cuerpo y la firma con el lugar del nombre de quien envía (fila 6:
--   la base rechaza una firma sin `{{nombre_de_quien_envia}}`). Un proveedor
--   sin mail da un borrador sin destinatario con el motivo (fila 9). Estado
--   `borrador` (el envío y sus estados los agrega M3-03). `editado` lo marca
--   la pantalla de M3-02 cuando una persona cambia el texto: el rearmado no lo
--   pisa (fila 11).
-- - `reserva_tarea`: lo que no va por mail (fila 8): emitir un boleto de bus,
--   reservar a mano (Kupos, Plataforma10, Transvip), contactar por WhatsApp o
--   revisar a mano algo que el catálogo no resuelve.
-- - `guardar_pedidos_armados(reserva, pedidos, tareas)`: guarda lo que armó el
--   código en una sola transacción. Solo con la reserva en `recibida`.
--   Reemplaza los borradores que nadie editó, conserva los editados (y no
--   agrega otro para la misma casilla) y reemplaza las tareas. Dos corridas a
--   la vez sobre la misma reserva se esperan (candado por reserva) y el índice
--   único (reserva, casilla) impide duplicar.
--
-- `de_prueba` se copia de la reserva al insertar (como 0014). Las filas cuelgan
-- de la reserva con `on delete cascade`: solo se van cuando se borra una
-- reserva de prueba (una reserva real no se borra, 0010), así los borrados de
-- prueba (0013/0014) no cambian.
--
-- RLS (regla #1): la policy del equipo (authenticated select/insert/update).
-- Borrar: solo borradores sin editar y tareas (lo hace el rearmado). Sin
-- sesión, nada.
--
-- Cómo aplicar: `supabase db push` por el pooler. Primero en la base de
-- pruebas; en la real, con OK del owner.

-- === reserva_pedido =========================================================================

create table public.reserva_pedido (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reserva (id) on delete cascade,
  -- La casilla del pedido: los mails normalizados (minúscula, ordenados, con
  -- coma), o "sin-mail:<proveedor_id>" si el proveedor no tiene mail.
  casilla text not null,
  destinatarios text[] not null default '{}',
  proveedor_ids uuid[] not null default '{}',
  proveedores text[] not null default '{}',
  -- Las partes de la reserva que cubre: [{parte_id, producto_servicio_id, producto, fecha}].
  partes jsonb not null default '[]'::jsonb,
  asunto text not null,
  cuerpo text not null,
  firma text not null,
  sin_destinatario text,
  avisos text[] not null default '{}',
  estado text not null default 'borrador',
  editado boolean not null default false,
  editado_por uuid references public.usuario (id),
  editado_en timestamptz,
  de_prueba boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reserva_pedido_casilla_key unique (reserva_id, casilla),
  constraint reserva_pedido_estado_check check (estado in ('borrador')),
  constraint reserva_pedido_firma_con_nombre check (position('{{nombre_de_quien_envia}}' in firma) > 0),
  -- Sin destinatario siempre lleva el motivo, y con destinatario no.
  constraint reserva_pedido_destinatario_coherente check (
    (cardinality(destinatarios) = 0) = (sin_destinatario is not null)
  ),
  constraint reserva_pedido_partes_lista check (jsonb_typeof(partes) = 'array')
);

comment on table public.reserva_pedido is
  'M3-01: borrador de mail de pedido a un proveedor, uno por casilla y por reserva. '
  'El texto lo arma el código con data/plantillas/pedido-proveedor.md (sin IA).';
comment on column public.reserva_pedido.firma is
  'La firma con {{nombre_de_quien_envia}}: el nombre lo completa M3-03 con quien aprueba el envío.';
comment on column public.reserva_pedido.editado is
  'Una persona cambió el borrador (M3-02): el rearmado no lo pisa.';

create index reserva_pedido_reserva_idx on public.reserva_pedido (reserva_id);

-- === reserva_tarea ==========================================================================

create table public.reserva_tarea (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reserva (id) on delete cascade,
  tipo text not null,
  texto text not null,
  detalle jsonb not null default '{}'::jsonb,
  orden integer not null default 0,
  de_prueba boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reserva_tarea_tipo_check check (tipo in ('emitir_boleto', 'reservar_a_mano', 'whatsapp', 'revisar')),
  constraint reserva_tarea_texto_check check (length(btrim(texto)) > 0)
);

comment on table public.reserva_tarea is
  'M3-01: lo que no va por mail: emitir boleto, reservar a mano, contactar por WhatsApp o revisar a mano.';

create index reserva_tarea_reserva_idx on public.reserva_tarea (reserva_id);

-- === de_prueba desde la reserva (la función de 0014) =========================================

create trigger reserva_pedido_de_prueba
  before insert on public.reserva_pedido
  for each row execute function public.de_prueba_desde_reserva();

create trigger reserva_tarea_de_prueba
  before insert on public.reserva_tarea
  for each row execute function public.de_prueba_desde_reserva();

-- La reserva de un pedido o una tarea no cambia; updated_at al día.
create function public.pedido_o_tarea_guardas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reserva_id <> old.reserva_id then
    raise exception 'Un pedido o una tarea no se pasa a otra reserva.' using errcode = 'check_violation';
  end if;
  new.de_prueba := old.de_prueba;
  new.updated_at := now();
  return new;
end;
$$;

create trigger reserva_pedido_guardas
  before update on public.reserva_pedido
  for each row execute function public.pedido_o_tarea_guardas();

create trigger reserva_tarea_guardas
  before update on public.reserva_tarea
  for each row execute function public.pedido_o_tarea_guardas();

revoke execute on function public.pedido_o_tarea_guardas() from public, anon, authenticated;

-- === RLS ====================================================================================

alter table public.reserva_pedido enable row level security;
alter table public.reserva_tarea enable row level security;

create policy "reserva_pedido_select_authenticated" on public.reserva_pedido
  for select to authenticated using (true);
create policy "reserva_pedido_insert_authenticated" on public.reserva_pedido
  for insert to authenticated with check (true);
create policy "reserva_pedido_update_authenticated" on public.reserva_pedido
  for update to authenticated using (true) with check (true);
create policy "reserva_pedido_delete_borrador_sin_editar" on public.reserva_pedido
  for delete to authenticated using (estado = 'borrador' and not editado);

create policy "reserva_tarea_select_authenticated" on public.reserva_tarea
  for select to authenticated using (true);
create policy "reserva_tarea_insert_authenticated" on public.reserva_tarea
  for insert to authenticated with check (true);
create policy "reserva_tarea_update_authenticated" on public.reserva_tarea
  for update to authenticated using (true) with check (true);
create policy "reserva_tarea_delete_authenticated" on public.reserva_tarea
  for delete to authenticated using (true);

-- === Guardar lo armado ======================================================================

create function public.guardar_pedidos_armados(p_reserva uuid, p_pedidos jsonb, p_tareas jsonb)
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
  if v_estado <> 'recibida' then
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
  'M3-01: guarda los borradores y las tareas armados para una reserva recibida. No pisa los editados.';

revoke execute on function public.guardar_pedidos_armados(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_pedidos_armados(uuid, jsonb, jsonb) to authenticated, service_role;
