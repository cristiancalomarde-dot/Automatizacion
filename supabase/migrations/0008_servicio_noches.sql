-- M1-07 — en qué noches del paquete va cada servicio.
--
-- Un paquete como CH10 (W Trek + Puerto Natales, 6 noches) no se reserva como
-- un bloque: noche 1 alojamiento en Puerto Natales, noches 2 a 5 el W Trek en
-- refugios (Las Torres) y noche 6 otra vez alojamiento en Puerto Natales. Los
-- dos alojamientos se piden por separado (fechas distintas) con las mismas
-- opciones de hotel del Excel. Con esto, M3 calcula la fecha de cada pedido.
--
-- Tabla aparte (y no columnas en `producto_servicio`) porque un mismo
-- servicio puede ir en más de un tramo de noches (el alojamiento de CH10 va
-- en la noche 1 y en la 6). Se engancha al servicio por (producto, `orden`):
-- `orden` agrupa las opciones "/" de un servicio (0004) y es estable entre
-- recargas del Excel; todas las opciones (prioridades) van en las mismas
-- noches.
--
-- - `noche_desde`: noche del paquete en que empieza (1 = la primera).
-- - `noches`: cuántas noches seguidas.
-- - `lugar`: dónde se duerme, para mostrarlo ("Puerto Natales", "refugios").
--
-- Un paquete sin filas acá se muestra como siempre (no se rompe nada).
-- Origen: `data/noches-servicio.csv`, lo carga `npm run importar:paquetes`.
--
-- RLS (regla #1): activa, con la misma policy única de las tablas del
-- catálogo (0002): `authenticated` puede select/insert/update; sin delete
-- (lo hace el importador con la service role).
--
-- Cómo aplicar: `supabase db push` por el pooler (igual que 0003-0007).

create table public.producto_servicio_noches (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.producto (id),
  orden integer not null,
  noche_desde integer not null check (noche_desde >= 1),
  noches integer not null check (noches >= 1),
  lugar text,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producto_servicio_noches_key unique (producto_id, orden, noche_desde)
);

create index producto_servicio_noches_producto_id_idx on public.producto_servicio_noches (producto_id);

comment on table public.producto_servicio_noches is
  'En qué noches del paquete va cada servicio (M1-07). Se engancha a producto_servicio '
  'por (producto_id, orden). Un servicio puede tener más de un tramo (alojamiento de CH10: noche 1 y noche 6).';

alter table public.producto_servicio_noches enable row level security;

create policy "producto_servicio_noches_select_authenticated" on public.producto_servicio_noches
  for select to authenticated using (true);
create policy "producto_servicio_noches_insert_authenticated" on public.producto_servicio_noches
  for insert to authenticated with check (true);
create policy "producto_servicio_noches_update_authenticated" on public.producto_servicio_noches
  for update to authenticated using (true) with check (true);
