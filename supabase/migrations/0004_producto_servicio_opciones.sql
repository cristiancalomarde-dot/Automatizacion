-- M1-04 — lo que el importador de productos simples necesita guardar y que
-- 0002 no tenía columna para.
--
-- No rediseña el modelo de docs/arquitectura/modelo-de-datos.md: las
-- alternativas "/" siguen siendo varias filas de `producto_servicio` con
-- distinta `prioridad` (como fijó 0002). Solo agrega:
--
-- 1. `orden`: la posición del servicio dentro del bloque del Excel. Agrupa las
--    opciones "/" de UN mismo servicio (mismo `orden`, prioridad 1..N). Hace
--    falta porque un producto puede tener varios servicios del mismo tipo que
--    NO son alternativas entre sí (ej. OD010A: alojamiento hostel, 3* y 4*),
--    así que `producto_id + tipo_servicio` no alcanza para agruparlas.
-- 2. `descripcion`: la línea del Excel tal cual (tipo, noches, "Includes: …").
-- 3. `service_provider_nombre` / `booking_supplier_nombre`: el nombre del
--    proveedor tal como lo escribe el Excel, para poder resolverlo a mano.
-- 4. `proveedor_sin_resolver`: flag para revisión manual (spec M1-04 §3 #7):
--    el Service Provider o el Booking Supplier del Excel no matcheó ningún
--    `proveedor` cargado — nunca se crea uno nuevo ni se inventa un mail.
-- 5. `codigo_externo.nombre_externo`: el nombre del producto en el partner
--    (ej. "Iguazu Falls on a Shoestring (3N)" en TourRadar). Los PDF de
--    reserva de TourRadar traen ese nombre y no el código, así que M2 empareja
--    por él.
--
-- Cómo aplicar: `supabase db push` (mismo mecanismo que 0002/0003).

alter table public.producto_servicio
  add column orden integer,
  add column descripcion text,
  add column service_provider_nombre text,
  add column booking_supplier_nombre text,
  add column proveedor_sin_resolver boolean not null default false,
  add constraint producto_servicio_orden_prioridad_key unique (producto_id, orden, prioridad);

comment on column public.producto_servicio.orden is
  'Posición del servicio en el bloque del Excel. Las opciones "/" de un mismo '
  'servicio comparten `orden` y se piden en orden de `prioridad` (1 primero).';
comment on column public.producto_servicio.proveedor_sin_resolver is
  'true = el Service Provider o el Booking Supplier del Excel no matcheó ningún '
  'proveedor cargado (queda null): revisión manual. Nunca se crea un proveedor.';

alter table public.codigo_externo
  add column nombre_externo text;

comment on column public.codigo_externo.nombre_externo is
  'Nombre del producto en el partner, tal cual (ej. el "Nombre en Tourradar"). '
  'Los PDF de reserva de TourRadar traen el nombre y no el código.';
