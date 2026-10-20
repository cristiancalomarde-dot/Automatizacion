-- 0022 — Corregir vuelos y datos dudosos desde el detalle de la reserva (spec M3-07).
--
-- Solo agrega: tres tipos de evento del historial y una función. No cambia
-- tablas ni borra nada.
--
-- - Historial: `vuelos_corregidos` ("<persona> corrigió los vuelos: salida
--   H2253 de CJC 18/03/2027 08:44"), `dato_revisado` ("<persona> marcó como
--   revisado: cantidad de pasajeros") y `dato_corregido` ("<persona> corrigió:
--   fechas"). Sin datos de pasajeros (#1): solo los vuelos, el dato y, si un
--   pedido ya enviado llevaba otro vuelo, a qué proveedor hay que avisarle. El
--   nombre de quien corrige lo pone la base (`nombre_de_usuario`, 0021). El
--   cambio de estado lo sigue agregando el trigger de `reserva` (0010).
-- - `corregir_reserva(reserva, antes, cambios, motivos, evento)`: con la sesión
--   de quien corrige (security invoker: RLS de 0010, #1). En una transacción:
--   verifica que la reserva siga como la leyó la app (`antes`: estado,
--   motivos, vuelos, fechas, pax y notas; si no, HT409 y no pisa nada), que no
--   esté cerrada ni descartada, y guarda lo que cambió (`cambios`: vuelos,
--   fecha_inicio + fecha_fin, pax y/o una nota que se agrega a `notas`). Si la
--   reserva está para revisión, le pone los motivos que decidió la app y el
--   estado (recibida si no queda ninguno); en otro estado, el estado y los
--   motivos no cambian. Agrega el evento.
--   Owner 2026-10-20 (tour con partes): si cambian las dos fechas y se
--   mueven la misma cantidad de días, las partes de `reserva_componente`
--   (inicio y fin) se corren esos días, en la misma transacción, y el evento
--   lleva `dias_corridos`. Si cambia la duración (noches extra), las partes
--   no se tocan: la app avisa que hay que revisarlas.
--   La lógica de qué motivos quedan la decide la app
--   (`src/lib/reservas/corregir/`); acá solo se guarda.
--
-- Errores propios: HT401 = sin sesión; HT403 = quien está en la sesión no es
-- del equipo; HT409 = la reserva cambió mientras tanto; HT423 = la reserva
-- está cerrada o descartada.
--
-- RLS (regla #1): no hay tablas nuevas; `reserva` y `evento_reserva` ya tienen
-- RLS activa con las policies del equipo. La función se puede llamar solo con
-- sesión.
--
-- Cómo aplicar: `supabase db push --db-url <base>`. Primero en la base de
-- pruebas; en la real, con OK del owner y ANTES de publicar este código.

-- === Historial ==============================================================================

alter type public.tipo_evento_reserva add value if not exists 'vuelos_corregidos';
alter type public.tipo_evento_reserva add value if not exists 'dato_revisado';
alter type public.tipo_evento_reserva add value if not exists 'dato_corregido';

-- === Corregir ===============================================================================

create or replace function public.corregir_reserva(
  p_reserva uuid,
  p_antes jsonb,
  p_cambios jsonb,
  p_motivos text[],
  p_evento jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_yo uuid := auth.uid();
  r public.reserva%rowtype;
  v_tipo text := p_evento ->> 'tipo';
  v_cambios jsonb := coalesce(p_cambios, '{}'::jsonb);
  v_nota text := nullif(btrim(coalesce(v_cambios ->> 'nota', '')), '');
  v_motivos text[];
  v_estado public.estado_reserva;
  v_dias integer := 0;
  v_partes integer := 0;
begin
  if v_yo is null then
    raise exception 'Sin sesión.' using errcode = 'HT401';
  end if;
  if not exists (select 1 from public.usuario u where u.id = v_yo) then
    raise exception 'Quien está en la sesión no es del equipo.' using errcode = 'HT403';
  end if;
  if v_tipo is null or v_tipo not in ('vuelos_corregidos', 'dato_revisado', 'dato_corregido') then
    raise exception 'El evento no es de una corrección.' using errcode = 'invalid_parameter_value';
  end if;
  if v_cambios ? 'vuelos' and jsonb_typeof(v_cambios -> 'vuelos') <> 'array' then
    raise exception 'Los vuelos van como lista.' using errcode = 'invalid_parameter_value';
  end if;
  if v_nota is not null and char_length(v_nota) > 200 then
    raise exception 'La nota es demasiado larga.' using errcode = 'invalid_parameter_value';
  end if;

  select * into r from public.reserva where id = p_reserva for update;
  if not found then
    raise exception 'No existe la reserva.' using errcode = 'no_data_found';
  end if;
  if r.estado::text is distinct from (p_antes ->> 'estado')
     or r.motivos_revision is distinct from coalesce(array(select jsonb_array_elements_text(coalesce(p_antes -> 'motivos', '[]'::jsonb))), '{}')
     or r.vuelos is distinct from coalesce(p_antes -> 'vuelos', '[]'::jsonb)
     or r.fecha_inicio is distinct from (p_antes ->> 'fecha_inicio')::date
     or r.fecha_fin is distinct from (p_antes ->> 'fecha_fin')::date
     or r.pax is distinct from (p_antes ->> 'pax')::integer
     or r.notas is distinct from coalesce(array(select jsonb_array_elements_text(coalesce(p_antes -> 'notas', '[]'::jsonb))), '{}') then
    raise exception 'La reserva cambió mientras tanto.' using errcode = 'HT409';
  end if;
  if r.estado in ('cerrada', 'descartada') then
    raise exception 'La reserva no se corrige en este estado.' using errcode = 'HT423';
  end if;

  if r.estado = 'para_revision' then
    v_motivos := coalesce(p_motivos, '{}');
    v_estado := case when cardinality(v_motivos) > 0 then 'para_revision' else 'recibida' end;
  else
    v_motivos := r.motivos_revision;
    v_estado := r.estado;
  end if;

  update public.reserva
     set vuelos = case when v_cambios ? 'vuelos' then v_cambios -> 'vuelos' else vuelos end,
         fecha_inicio = case when v_cambios ? 'fecha_inicio' then (v_cambios ->> 'fecha_inicio')::date else fecha_inicio end,
         fecha_fin = case when v_cambios ? 'fecha_fin' then (v_cambios ->> 'fecha_fin')::date else fecha_fin end,
         pax = case when v_cambios ? 'pax' then (v_cambios ->> 'pax')::integer else pax end,
         notas = case when v_nota is not null then notas || array[v_nota] else notas end,
         motivos_revision = v_motivos,
         estado = v_estado,
         updated_at = now()
   where id = p_reserva;

  -- Tour con partes: si inicio y fin se mueven lo mismo, las partes se corren con ellas.
  if v_cambios ? 'fecha_inicio' and v_cambios ? 'fecha_fin' and r.fecha_inicio is not null and r.fecha_fin is not null then
    v_dias := (v_cambios ->> 'fecha_inicio')::date - r.fecha_inicio;
    if v_dias <> 0 and v_dias = (v_cambios ->> 'fecha_fin')::date - r.fecha_fin then
      update public.reserva_componente
         set fecha_inicio = fecha_inicio + v_dias,
             fecha_fin = fecha_fin + v_dias,
             updated_at = now()
       where reserva_id = p_reserva;
      get diagnostics v_partes = row_count;
    end if;
  end if;

  insert into public.evento_reserva (reserva_id, tipo, detalle)
  values (
    p_reserva,
    v_tipo::public.tipo_evento_reserva,
    coalesce(p_evento -> 'detalle', '{}'::jsonb)
      || jsonb_build_object('persona', public.nombre_de_usuario(v_yo), 'nota', v_nota is not null)
      || case when v_partes > 0 then jsonb_build_object('dias_corridos', v_dias) else '{}'::jsonb end
  );

  return jsonb_build_object('estado', v_estado, 'motivos', to_jsonb(v_motivos), 'dias_corridos', case when v_partes > 0 then v_dias else 0 end);
end;
$$;

revoke execute on function public.corregir_reserva(uuid, jsonb, jsonb, text[], jsonb) from public, anon;
grant execute on function public.corregir_reserva(uuid, jsonb, jsonb, text[], jsonb) to authenticated;
