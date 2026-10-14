-- M2-04 — mismo intercambio, no reserva nueva: lo que hace falta para
-- reconocer que un mail es de una reserva que ya existe y dejarlo en su
-- historial.
--
-- Diseño: spec M2-04 (Anexo técnico) y docs/arquitectura/modelo-de-datos.md,
-- anexo "Detección de duplicados". Esta migración lo traduce a SQL.
--
-- `reserva`:
-- - `booking_id` ya guarda el número normalizado (M2-02/M2-03, `booking-id.ts`):
--   es el que se compara. `booking_id_original` guarda el que vino, para
--   mostrarlo (`DK1594100/maga`, "Booking Statement 1377598 - 25388222").
-- - `producto_clave_agencia`: el código de la agencia normalizado (minúsculas,
--   sin espacios dobles ni sufijo `-677`) o, sin código, el nombre. Sirve para
--   "mismo producto" cuando alguno no emparejó con el catálogo.
-- - `clave_producto` (calculada): el producto del catálogo si emparejó; si no,
--   `producto_clave_agencia`.
-- - Índice único parcial (agencia, booking_id, clave_producto, de_prueba): dos
--   corridas al mismo tiempo no pueden crear dos reservas del mismo booking_id
--   + producto (fila 11). Las de prueba y las reales no chocan (fila 10).
-- - `posible_duplicada` y `duplicada_de_id` ya existen (0010).
--
-- `mail_recibido`: además de `huella` (0010), únicos el Message-ID y el id
-- IMAP (carpeta + UIDVALIDITY + UID), para que un mail no se procese dos
-- veces (fila 1).
--
-- `evento_reserva`: tres tipos nuevos (datos completados, datos distintos y
-- misma referencia de la agencia). Los mails de una reserva son el de
-- `reserva.mail_recibido_id` (del que nació) más los de sus eventos
-- `mail_agregado` (`evento_reserva.mail_recibido_id`): un mail de "varias"
-- toca 3 reservas, muchos a muchos sin tabla nueva.
--
-- RLS (regla #1): no hay tablas nuevas; las tocadas ya tienen RLS activa con
-- las policies de 0010.
--
-- Cómo aplicar: `supabase db push` por el pooler (igual que 0003-0011).

-- === Tipos de evento ===================================================================

alter type public.tipo_evento_reserva add value if not exists 'datos_completados';
alter type public.tipo_evento_reserva add value if not exists 'datos_distintos';
alter type public.tipo_evento_reserva add value if not exists 'misma_referencia';

-- === reserva ==========================================================================

alter table public.reserva
  add column booking_id_original text,
  add column producto_clave_agencia text,
  add column clave_producto text generated always as (coalesce(producto_id::text, producto_clave_agencia)) stored;

comment on column public.reserva.booking_id is
  'El booking_id normalizado de la agencia (M2-04, booking-id.ts): el que se compara, siempre dentro de la misma agencia.';
comment on column public.reserva.booking_id_original is
  'M2-04: el booking_id tal como lo mandó la agencia, para mostrarlo.';
comment on column public.reserva.producto_clave_agencia is
  'M2-04: código de la agencia normalizado (sin sufijo -677) o, sin código, el nombre. Para "mismo producto" sin catálogo.';
comment on column public.reserva.clave_producto is
  'M2-04: producto del catálogo si emparejó; si no, producto_clave_agencia. Parte de la clave única del intercambio.';

create unique index reserva_mismo_intercambio_key
  on public.reserva (agencia, booking_id, clave_producto, de_prueba)
  where booking_id is not null and clave_producto is not null;

-- La marca blanda (fila 8): misma agencia, fecha de inicio y pax en los últimos 60 días.
create index reserva_marca_blanda_idx on public.reserva (agencia, de_prueba, fecha_inicio, pax);

-- === mail_recibido ====================================================================

create unique index mail_recibido_message_id_key
  on public.mail_recibido (message_id)
  where message_id is not null;

create unique index mail_recibido_imap_key
  on public.mail_recibido (carpeta, imap_uidvalidity, imap_uid)
  where imap_uid is not null;

-- === evento_reserva =====================================================================

create index evento_reserva_mail_recibido_id_idx on public.evento_reserva (mail_recibido_id);

