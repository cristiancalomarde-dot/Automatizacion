-- M1-08 — los traslados de cada paquete según cómo se llega en el tour.
--
-- 1. `producto_servicio.sentido` (solo traslados): de llegada, de salida, de
--    ida y vuelta o `sin_sentido` (el texto del Excel no lo dice; se reporta,
--    no se inventa). Lo calcula el importador de paquetes del texto
--    ("SCL - accommodation" → llegada; "El Calafate Accommodation - FTE
--    Airport" → salida; "Round Trip" → ida y vuelta). Null en lo que no es
--    traslado.
-- 2. `producto_servicio.a_pedido` / `a_pedido_nota`: un servicio del paquete
--    vendido solo que no se pide siempre: `a_pedido` (lo pide el pax o el
--    vendedor, ej. el traslado de salida de OD016) o `segun_reserva` (depende
--    de la variante que se venda, ej. Remis Mendoza de OD019 solo si el
--    paquete es CON traslados). No se borra: se muestra con la marca. Origen:
--    `data/servicios-a-pedido.csv`, lo carga `npm run importar:paquetes`.
-- 3. `tour_servicio_ajuste`: cómo queda cada servicio de un paquete DENTRO de
--    un tour (lo que no figura acá se pide tal cual):
--    - `anular`: no se pide en ese tour (ej. "llega en bus desde Iguazú");
--    - `solo_llegada` / `solo_salida`: de un ida y vuelta, solo ese lado;
--    - `reemplazar`: se pide con otro texto (ej. el 105 Premium con transfer
--      in desde la Rodoviaria de Foz);
--    - `invertir`: cambia de sentido (ej. el Transvip de OD030 en BOCHI04R
--      pasa a ser de salida).
--    `origen`: `regla` (la regla general: a un paquete al que se llega en bus
--    no se le pide la llegada, etc.) o `excepcion` (`data/traslados-tour.csv`,
--    pisa la regla). Se engancha al servicio por (paquete, `orden`), como
--    `producto_servicio_noches` (0008): `orden` agrupa las opciones "/" y es
--    estable entre recargas. Se identifica por (tour, paquete, orden) y no por
--    el componente: un paquete puede estar dentro de un tour anidado (OD030 en
--    CHB31 dentro de 5C01) y ahí vale el ajuste del tour de afuera. M3 lee
--    esta tabla igual que la pantalla. Lo escribe `npm run importar:tours`.
--
-- RLS (regla #1): activa, con la misma policy única de las tablas del
-- catálogo (0002): `authenticated` puede select/insert/update; sin delete
-- (lo hace el importador con la service role).
--
-- Cómo aplicar: `supabase db push` por el pooler (igual que 0003-0008).

alter table public.producto_servicio
  add column sentido text,
  add column a_pedido text,
  add column a_pedido_nota text,
  add constraint producto_servicio_sentido_check check (
    sentido is null or sentido in ('llegada', 'salida', 'ida_y_vuelta', 'sin_sentido')
  ),
  add constraint producto_servicio_a_pedido_check check (
    a_pedido is null or a_pedido in ('a_pedido', 'segun_reserva')
  );

comment on column public.producto_servicio.sentido is
  'Solo traslados (M1-08): llegada | salida | ida_y_vuelta | sin_sentido (el texto del Excel no lo dice).';
comment on column public.producto_servicio.a_pedido is
  'M1-08: a_pedido (lo pide el pax o el vendedor) | segun_reserva (depende de la variante vendida). Null = se pide siempre.';
comment on column public.producto_servicio.a_pedido_nota is
  'Por qué el servicio es a pedido o según la reserva (data/servicios-a-pedido.csv).';

create table public.tour_servicio_ajuste (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.producto (id),
  paquete_id uuid not null references public.producto (id),
  orden integer not null,
  accion text not null,
  texto text,
  motivo text not null,
  origen text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tour_servicio_ajuste_key unique (tour_id, paquete_id, orden),
  constraint tour_servicio_ajuste_accion_check check (
    accion in ('anular', 'solo_llegada', 'solo_salida', 'reemplazar', 'invertir')
  ),
  constraint tour_servicio_ajuste_origen_check check (origen in ('regla', 'excepcion')),
  constraint tour_servicio_ajuste_texto_check check (accion <> 'reemplazar' or texto is not null)
);

create index tour_servicio_ajuste_tour_id_idx on public.tour_servicio_ajuste (tour_id);
create index tour_servicio_ajuste_paquete_id_idx on public.tour_servicio_ajuste (paquete_id);

comment on table public.tour_servicio_ajuste is
  'Cómo queda cada servicio de un paquete dentro de un tour (M1-08): anulado, de un solo lado, '
  'reemplazado o invertido. Lo que no figura se pide tal cual. Se engancha a producto_servicio por (paquete_id, orden).';

alter table public.tour_servicio_ajuste enable row level security;

create policy "tour_servicio_ajuste_select_authenticated" on public.tour_servicio_ajuste
  for select to authenticated using (true);
create policy "tour_servicio_ajuste_insert_authenticated" on public.tour_servicio_ajuste
  for insert to authenticated with check (true);
create policy "tour_servicio_ajuste_update_authenticated" on public.tour_servicio_ajuste
  for update to authenticated using (true) with check (true);
