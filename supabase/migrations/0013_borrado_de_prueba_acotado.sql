-- 0013 — Borrado de prueba acotado: cada test borra solo lo suyo.
--
-- `borrar_datos_de_prueba()` (0010) borra TODO lo marcado "de prueba". En
-- M2-06 el modo prueba guarda reservas de mails reales marcadas "de prueba"
-- que el owner revisa, y los tests no pueden borrarlas. Esta función borra
-- solo lo que cuelga de los mails que se le pasan (y las llamadas a la IA que
-- se le pasan): el mail, sus reservas, sus partes, su historial y sus llamadas.
--
-- - Solo filas con la marca "de prueba": un mail o una llamada real que venga
--   en la lista se ignora (y una reserva real no se puede borrar: 0010).
-- - Toda reserva cuelga de un mail (`reserva.mail_recibido_id not null`), así
--   que los mails alcanzan para encontrar todo lo creado.
-- - Si algo ajeno apunta a lo que se borra (una entrada de historial de otra
--   reserva que cita uno de estos mails), el borrado falla entero y no deja
--   nada a medias.
-- - `borrar_datos_de_prueba()` sigue igual: es el `--borrar` de M2-06.
--
-- Devuelve las rutas de Storage de los PDF de esos mails, que borra el
-- servidor (src/lib/reservas/guardar.ts). Solo la service role.

create function public.borrar_datos_de_prueba_de(p_mails uuid[], p_llamadas uuid[] default '{}')
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

comment on function public.borrar_datos_de_prueba_de(uuid[], uuid[]) is
  'Borra solo lo "de prueba" que cuelga de esos mails (reservas, partes, historial, '
  'llamadas a la IA) y esas llamadas. Lo usan los tests: no tocan las reservas de '
  'prueba del modo prueba (M2-06) ni las reales. Devuelve las rutas de los PDF.';

revoke execute on function public.borrar_datos_de_prueba_de(uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.borrar_datos_de_prueba_de(uuid[], uuid[]) to service_role;
