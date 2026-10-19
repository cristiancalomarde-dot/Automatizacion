-- 0020 — Confirmar el producto de una reserva "para revisión" (spec M3-05).
--
-- Solo agrega: un tipo de evento del historial, dos columnas de trazabilidad
-- en `codigo_externo` y la función que confirma todo en una sola transacción.
-- No borra nada.
--
-- - Historial: `producto_confirmado` ("<persona> confirmó el producto OD031
--   (sugerido por la IA)" o "<persona> eligió OD031"). El cambio de estado lo
--   sigue agregando el trigger de `reserva` (0010) con el autor de la sesión.
-- - `codigo_externo.origen`: `importado` (los CSV y los importadores, lo que
--   había) o `aprendido` (lo que guardó una persona al confirmar). Los
--   importadores no borran filas de Kilroy ni de TourRadar, así que volver a
--   correrlos no se lleva lo aprendido (fila 6). `aprendido_por` y
--   `aprendido_de_reserva_id`: quién y desde qué reserva.
-- - `confirmar_producto_reserva(...)`: con la sesión de quien confirma
--   (security invoker: RLS de 0002/0010, #1). En una transacción: verifica que
--   la reserva siga como la vio la pantalla (para revisión, sin producto, con
--   los mismos motivos y sin partes), le pone el producto, los motivos que
--   quedan y el estado (recibida si no queda ninguno), crea las partes del
--   tour, guarda la equivalencia (nunca desde una reserva de prueba, fila 8;
--   una equivalencia que dice otro producto solo se cambia si la persona dijo
--   que sí: `reemplazar` = filas que pasan al producto nuevo; `quitar_nombre`
--   = códigos de la agencia que tenían ese nombre para otro producto y se
--   quedan con su código, sin el nombre) y agrega el evento.
--   La lógica de qué queda (motivos, partes, vuelos) la decide la app
--   (`src/lib/reservas/confirmar/`); acá solo se guarda.
--
-- Errores propios: HT409 = la reserva cambió mientras tanto; HT410 = la
-- equivalencia dice otro producto y no se pidió cambiarla.
--
-- RLS (regla #1): no hay tablas nuevas; las tocadas ya tienen RLS activa con
-- las policies del equipo. La función se puede llamar solo con sesión.
--
-- Cómo aplicar: `supabase db push --db-url <base>`. Primero en la base de
-- pruebas; en la real, con OK del owner y ANTES de publicar este código.

-- === Historial ==============================================================================

alter type public.tipo_evento_reserva add value if not exists 'producto_confirmado';

-- === codigo_externo: lo aprendido ===========================================================

alter table public.codigo_externo
  add column if not exists origen text not null default 'importado',
  add column if not exists aprendido_por uuid references public.usuario (id),
  add column if not exists aprendido_de_reserva_id uuid references public.reserva (id);
alter table public.codigo_externo drop constraint if exists codigo_externo_origen_check;
alter table public.codigo_externo
  add constraint codigo_externo_origen_check check (origen in ('importado', 'aprendido'));

comment on column public.codigo_externo.origen is
  'M3-05: importado (CSV / importadores) | aprendido (una persona confirmó el producto de una reserva).';
comment on column public.codigo_externo.aprendido_por is
  'M3-05: quién confirmó el producto del que salió esta equivalencia.';
comment on column public.codigo_externo.aprendido_de_reserva_id is
  'M3-05: la reserva desde la que se aprendió (nunca una de prueba).';

-- === Confirmar el producto ==================================================================

create or replace function public.confirmar_producto_reserva(
  p_reserva uuid,
  p_motivos_antes text[],
  p_producto uuid,
  p_origen text,
  p_confianza numeric,
  p_motivos text[],
  p_componentes jsonb,
  p_aprender jsonb,
  p_evento jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.reserva%rowtype;
  v_estado public.estado_reserva;
  v_aprendio boolean := false;
  v_actual uuid;
begin
  if jsonb_typeof(coalesce(p_componentes, '[]'::jsonb)) <> 'array' then
    raise exception 'Las partes van como lista.' using errcode = 'invalid_parameter_value';
  end if;

  select * into r from public.reserva where id = p_reserva for update;
  if not found then
    raise exception 'No existe la reserva.' using errcode = 'no_data_found';
  end if;
  if r.estado <> 'para_revision'
     or r.producto_id is not null
     or r.motivos_revision is distinct from coalesce(p_motivos_antes, '{}')
     or exists (select 1 from public.reserva_componente c where c.reserva_id = p_reserva) then
    raise exception 'La reserva cambió mientras tanto.' using errcode = 'HT409';
  end if;

  v_estado := case when cardinality(coalesce(p_motivos, '{}')) > 0 then 'para_revision' else 'recibida' end;

  update public.reserva
     set producto_id = p_producto,
         origen_emparejado = p_origen,
         confianza_emparejado = p_confianza,
         sugerencia_producto_id = null,
         motivos_revision = coalesce(p_motivos, '{}'),
         estado = v_estado,
         updated_at = now()
   where id = p_reserva;

  insert into public.reserva_componente (
    reserva_id, orden, tipo, producto_id, producto_componente_id, descripcion_ruta,
    fecha_inicio, fecha_fin, es_tarea, producto_servicio_id, proveedor_id
  )
  select p_reserva, x.orden, x.tipo, x.producto_id, x.producto_componente_id, x.descripcion_ruta,
         x.fecha_inicio, x.fecha_fin, coalesce(x.es_tarea, false), x.producto_servicio_id, x.proveedor_id
    from jsonb_to_recordset(coalesce(p_componentes, '[]'::jsonb)) as x(
      orden integer, tipo text, producto_id uuid, producto_componente_id uuid, descripcion_ruta text,
      fecha_inicio date, fecha_fin date, es_tarea boolean, producto_servicio_id uuid, proveedor_id uuid
    );

  -- Lo aprendido: nunca desde una reserva de prueba (fila 8), siempre de la agencia de la reserva.
  if p_aprender is not null and not r.de_prueba then
    update public.codigo_externo e
       set producto_id = p_producto,
           origen = 'aprendido',
           aprendido_por = auth.uid(),
           aprendido_de_reserva_id = p_reserva,
           updated_at = now()
     where e.agencia = r.agencia
       and e.id in (select (jsonb_array_elements_text(coalesce(p_aprender -> 'reemplazar', '[]'::jsonb)))::uuid);

    -- Un código de la agencia que tenía ese nombre para otro producto conserva su código: solo pierde el nombre.
    update public.codigo_externo e
       set nombre_externo = null,
           updated_at = now()
     where e.agencia = r.agencia
       and e.id in (select (jsonb_array_elements_text(coalesce(p_aprender -> 'quitar_nombre', '[]'::jsonb)))::uuid);

    insert into public.codigo_externo (producto_id, agencia, codigo, nombre_externo, origen, aprendido_por, aprendido_de_reserva_id)
    values (p_producto, r.agencia, p_aprender ->> 'codigo', p_aprender ->> 'nombre_externo', 'aprendido', auth.uid(), p_reserva)
    on conflict (agencia, codigo) do nothing;

    select e.producto_id into v_actual from public.codigo_externo e where e.agencia = r.agencia and e.codigo = p_aprender ->> 'codigo';
    if v_actual is distinct from p_producto then
      raise exception 'La equivalencia dice otro producto.' using errcode = 'HT410';
    end if;
    v_aprendio := true;
  end if;

  insert into public.evento_reserva (reserva_id, tipo, detalle)
  values (p_reserva, 'producto_confirmado', coalesce(p_evento, '{}'::jsonb) || jsonb_build_object('aprendio', v_aprendio));

  return jsonb_build_object('estado', v_estado, 'aprendio', v_aprendio);
end;
$$;

revoke execute on function public.confirmar_producto_reserva(uuid, text[], uuid, text, numeric, text[], jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.confirmar_producto_reserva(uuid, text[], uuid, text, numeric, text[], jsonb, jsonb, jsonb) to authenticated;
