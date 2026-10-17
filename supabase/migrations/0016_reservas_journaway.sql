-- M2-09 — Reservas de Journaway: lo que el mail trae además de los tours.
--
-- Diseño: spec M2-09 (§4 y Anexo técnico) y docs/arquitectura/modelo-de-datos.md.
--
-- `reserva` (todo opcional; en Kilroy y TourRadar queda vacío):
-- - `trip_number`: el "Trip Number" del cuerpo de los "Program Booking"
--   (62992). Es una referencia secundaria: el booking_id de Journaway es el
--   "ID" de 11 dígitos del asunto (owner, 2026-10-13). Sin Trip Number, el
--   detalle dice "Journaway no mandó número de viaje".
-- - `hoteles_agencia`: lo que reserva Journaway ("All Hotels are booked by
--   us", "Accomodations booked by us"): nombre, desde y hasta. Solo
--   información: nunca es una parte ni un pedido.
-- - `contacto_cliente`: el "Client reference" (nombre, mail, teléfono del
--   pasajero principal). Nunca una dirección de HI Travel.
-- - `notas`: avisos que no mandan a revisión ("Journaway lo llama half-day; es
--   el full day", "Trae adjuntos: pasaportes (no se leen)").
-- - `sin_traslado_de`: el lado del traslado del paquete que lleva otra reserva
--   del mismo pedido (SPAP01 seguido de SPAP03: la salida va con SPAP03). Ese
--   lado no pide vuelo en esta reserva.
--
-- `reserva_componente`:
-- - `pick_up`: el "Pick up / Drop off" de cada tour, tal como lo manda
--   Journaway. Vacío si el mail no lo trae: no se inventa.
--
-- RLS (regla #1): no hay tablas nuevas; `reserva` y `reserva_componente` ya
-- tienen RLS activa con las policies de 0010. Cada reserva deja su evento
-- "creada" en `evento_reserva` (trigger de 0010).
--
-- Cómo aplicar: `supabase db push` por el pooler. Primero a la base de
-- pruebas; a la real, con el OK del owner y ANTES de publicar el código de
-- M2-09 (las pantallas leen estas columnas).

alter table public.reserva
  add column trip_number text,
  add column hoteles_agencia jsonb not null default '[]',
  add column contacto_cliente jsonb,
  add column notas text[] not null default '{}',
  add column sin_traslado_de text,
  add constraint reserva_hoteles_agencia_lista check (jsonb_typeof(hoteles_agencia) = 'array'),
  add constraint reserva_contacto_cliente_objeto check (contacto_cliente is null or jsonb_typeof(contacto_cliente) = 'object'),
  add constraint reserva_sin_traslado_de_check check (sin_traslado_de is null or sin_traslado_de in ('llegada', 'salida'));

comment on column public.reserva.trip_number is
  'M2-09: el Trip Number de Journaway (referencia secundaria; el booking_id es el ID del asunto).';
comment on column public.reserva.hoteles_agencia is
  'M2-09: lo que reserva la agencia ("booked by us"): [{nombre, desde, hasta}]. Solo información, no se pide.';
comment on column public.reserva.contacto_cliente is
  'M2-09: el contacto del pasajero principal ({nombre, email, telefono}). Nunca HI Travel.';
comment on column public.reserva.notas is
  'M2-09: avisos que no mandan a revisión (half-day, pasaportes, todos los hoteles de la agencia).';
comment on column public.reserva.sin_traslado_de is
  'M2-09: el lado del traslado que lleva otra reserva del mismo pedido (llegada | salida). No pide vuelo acá.';

alter table public.reserva_componente
  add column pick_up text;

comment on column public.reserva_componente.pick_up is
  'M2-09: el Pick up / Drop off del tour, tal como lo manda la agencia. Vacío si no lo trae.';
