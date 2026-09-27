-- M1-04b — equivalencias de proveedores + marca de revisión por alias.
--
-- 1. `proveedor_alias`: los nombres con que el Excel de paquetes escribe a un
--    proveedor ("Cuenca del Plana", "Taroba", "Beer"…) → el `proveedor` del
--    directorio (M1-03). La lista la decide el owner
--    (`data/equivalencias-proveedores.csv`) y la carga
--    `npm run importar:equivalencias`; el sistema no empareja por parecido.
--    - `alias_normalizado`: misma normalización que
--      `proveedor.nombre_normalizado` (espacios colapsados, minúsculas). Es la
--      identidad: cargar la lista dos veces no duplica filas.
--    - `proveedor_id` null = el owner todavía no sabe quién es (ej. Tetris).
--    - `estado`: 'confirmado' | 'para_revisar'. Un confirmado siempre trae
--      proveedor.
-- 2. En `producto_servicio`:
--    - `proveedor_para_revisar`: el proveedor salió de un alias que el owner
--      todavía tiene que confirmar (se asigna igual si el alias trae
--      proveedor, pero queda marcado).
--    - `proveedor_nota`: la nota de ese alias (qué falta confirmar).
--    Además, desde M1-04b `proveedor_sin_resolver` mira solo el Booking
--    Supplier (a quien se le pide la reserva); ver el comentario nuevo.
--
-- RLS (regla #1): mismo criterio que las tablas del catálogo en 0002 — datos
-- compartidos por el equipo; `authenticated` puede select/insert/update, sin
-- policy de delete ni de `anon`.
--
-- Cómo aplicar: `supabase db push` por el pooler (igual que 0003/0004).

create table public.proveedor_alias (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  alias_normalizado text not null,
  proveedor_id uuid references public.proveedor (id),
  estado text not null,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proveedor_alias_alias_normalizado_key unique (alias_normalizado),
  constraint proveedor_alias_estado_check check (estado in ('confirmado', 'para_revisar')),
  constraint proveedor_alias_confirmado_con_proveedor check (estado <> 'confirmado' or proveedor_id is not null)
);

create index proveedor_alias_proveedor_id_idx on public.proveedor_alias (proveedor_id);

comment on table public.proveedor_alias is
  'Equivalencias revisadas por el owner entre el nombre de proveedor que escribe '
  'el Excel de paquetes y el proveedor del directorio (spec M1-04b). El importador '
  'de productos busca primero el nombre exacto y después acá.';
comment on column public.proveedor_alias.proveedor_id is
  'Null = el owner todavía no identificó al proveedor (el servicio queda sin resolver).';
comment on column public.proveedor_alias.estado is
  'confirmado: resuelve el proveedor. para_revisar: lo asigna si lo trae, pero '
  'el servicio queda con proveedor_para_revisar y la nota.';

alter table public.proveedor_alias enable row level security;

create policy "proveedor_alias_select_authenticated" on public.proveedor_alias for select to authenticated using (true);
create policy "proveedor_alias_insert_authenticated" on public.proveedor_alias for insert to authenticated with check (true);
create policy "proveedor_alias_update_authenticated" on public.proveedor_alias for update to authenticated using (true) with check (true);

alter table public.producto_servicio
  add column proveedor_para_revisar boolean not null default false,
  add column proveedor_nota text;

comment on column public.producto_servicio.proveedor_para_revisar is
  'true = el Service Provider o el Booking Supplier salió de un alias para_revisar '
  '(proveedor_alias): puede estar asignado, pero el owner lo tiene que confirmar.';
comment on column public.producto_servicio.proveedor_nota is
  'Nota del alias para revisar (qué falta confirmar), visible para quien revisa.';
comment on column public.producto_servicio.proveedor_sin_resolver is
  'true = el Booking Supplier (a quien se le pide la reserva) no quedó emparejado '
  'con un proveedor (ni exacto ni por alias). Un Service Provider sin emparejar '
  'se queda con su nombre de texto y no marca revisión (M1-04b). Nunca se crea '
  'un proveedor.';
