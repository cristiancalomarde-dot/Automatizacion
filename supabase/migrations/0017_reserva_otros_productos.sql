-- M2-09 (ajuste del owner, 2026-10-17): un pedido de Journaway es UNA reserva.
--
-- Un mismo mail puede traer dos paquetes ("All San Pedro 8 Days" = SPAP01 +
-- SPAP03), y Journaway puede mandar después otro mail con otro tour para el
-- mismo pasajero y el mismo ID ("ID 65643802533"). Todo eso es una sola
-- reserva: `producto_id` es el primero (el del primer tour) y los demás van en
-- `otros_productos`, en orden. Las partes de todos están en
-- `reserva_componente`, ordenadas por fecha.
--
-- `reserva`:
-- - `otros_productos`: los demás productos del catálogo de la misma reserva
--   (SPAP03 en SPAP01 + SPAP03; IGRE02 si después llegó con el mismo ID). Vacío
--   en Kilroy y TourRadar. Sin FK (es una lista); los ids salen de `producto`.
--
-- RLS (regla #1): no hay tablas nuevas; `reserva` ya tiene RLS activa (0010).
--
-- Cómo aplicar: `supabase db push` por el pooler. Primero a la base de
-- pruebas; a la real, con el OK del owner y ANTES de publicar este código (la
-- lista y el detalle leen la columna).

alter table public.reserva
  add column otros_productos uuid[] not null default '{}';

comment on column public.reserva.otros_productos is
  'M2-09: los demás productos de la misma reserva (Journaway: SPAP01 + SPAP03, o un tour sumado con el mismo ID), en orden.';
