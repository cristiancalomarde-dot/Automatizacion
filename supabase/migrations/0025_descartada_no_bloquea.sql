-- M3-53: una reserva descartada no cuenta para "el mismo intercambio". Al
-- releer un mail (reprocesar:mail) la reserva vieja pasa a "descartada" y
-- entra una nueva con el mismo booking_id y el mismo producto; el índice
-- único de 0012 la frenaba (caso real Journaway 66925083976, 2026-11-10).
-- Solo cambia la condición del índice; las columnas son las mismas.
drop index if exists public.reserva_mismo_intercambio_key;

create unique index reserva_mismo_intercambio_key
  on public.reserva (agencia, booking_id, clave_producto, de_prueba)
  where booking_id is not null and clave_producto is not null and estado <> 'descartada';
