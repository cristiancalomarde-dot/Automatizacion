-- M1-04d — equivalencias por destino + servicios opcionales y manuales.
--
-- 1. `proveedor_alias` (0005) pasa a depender del destino del paquete
--    (`data/equivalencias-proveedores.csv`, formato nuevo):
--    - `destino`: el alias solo aplica a los paquetes de ese destino (ej.
--      "Nacional Inn" es el de Foz en IGR y el de Copacabana en RIO). Los 15
--      alias ya cargados son todos de Iguazú: quedan con destino 'IGR'.
--    - `modo`: 'alias' (el nombre es ese proveedor) | 'por_service_provider'
--      (grupo sin central, ej. Tremun: el proveedor sale del nombre del hotel,
--      con los alias del mismo destino) | 'manual' (no se le escribe, ej.
--      Kupos.cl). Los dos últimos no llevan proveedor.
--    - La unicidad pasa a ser (destino, alias_normalizado).
-- 2. En `producto_servicio`:
--    - `opcional`: "Optional Excursion: …" / "Optional: …": solo se pide si la
--      reserva lo incluye (M2/M3).
--    - `reserva_manual`: el servicio se gestiona a mano, fuera de la app (ej.
--      pasajes en Kupos.cl): sin proveedor y sin revisión pendiente.
--
-- RLS (regla #1): no hay tablas nuevas; `proveedor_alias` y
-- `producto_servicio` ya tienen RLS activa con las policies de 0002/0005.
--
-- Cómo aplicar: `supabase db push` por el pooler (igual que 0003-0005).

alter table public.proveedor_alias
  add column destino text,
  add column modo text not null default 'alias';

update public.proveedor_alias set destino = 'IGR' where destino is null;

alter table public.proveedor_alias
  alter column destino set not null,
  drop constraint proveedor_alias_alias_normalizado_key,
  add constraint proveedor_alias_destino_alias_key unique (destino, alias_normalizado),
  add constraint proveedor_alias_modo_check check (modo in ('alias', 'por_service_provider', 'manual')),
  drop constraint proveedor_alias_confirmado_con_proveedor,
  add constraint proveedor_alias_confirmado_con_proveedor check (modo <> 'alias' or estado <> 'confirmado' or proveedor_id is not null),
  add constraint proveedor_alias_modo_sin_proveedor check (modo = 'alias' or proveedor_id is null);

comment on column public.proveedor_alias.destino is
  'Destino del paquete (data/paquetes-piloto.csv) en el que vale el alias (M1-04d).';
comment on column public.proveedor_alias.modo is
  'alias: el nombre es ese proveedor. por_service_provider: grupo sin central (Tremun, '
  'Dazzler), el proveedor sale del nombre del hotel con los alias del mismo destino. '
  'manual: no se le escribe a nadie (Kupos.cl), el servicio queda reserva_manual.';

alter table public.producto_servicio
  add column opcional boolean not null default false,
  add column reserva_manual boolean not null default false;

comment on column public.producto_servicio.opcional is
  'true = excursión/servicio opcional ("Optional …" en el Excel): solo se pide si la reserva lo incluye.';
comment on column public.producto_servicio.reserva_manual is
  'true = se gestiona a mano fuera de la app (ej. Kupos.cl): sin proveedor y sin revisión pendiente.';
