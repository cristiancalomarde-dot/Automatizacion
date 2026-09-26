-- M1-02 — esquema del catálogo: proveedor, producto, producto_servicio,
-- codigo_externo, producto_componente, importacion + RLS.
--
-- Diseño fijado en docs/arquitectura/modelo-de-datos.md; esta migración lo
-- traduce a SQL, no lo rediseña. Cómo aplicar (mecanismo estándar, regla de
-- la spec M1-02): `supabase db push` con el CLI de Supabase conectado al
-- proyecto (`supabase link --project-ref <ref>`). Nada se crea a mano desde
-- el panel de Supabase.
--
-- RLS (regla #1 — no aplica en sentido estricto, datos compartidos por todo
-- el equipo, pero se deja como defensa en profundidad): una policy única por
-- tabla — `authenticated` puede select/insert/update; sin policy de delete
-- (los borrados no existen en este modelo).

-- `gen_random_uuid()` para las claves primarias (Anexo técnico de la spec).
-- Supabase suele traer `pgcrypto` habilitada de fábrica; se deja explícito e
-- idempotente para que la migración no dependa de eso.
create extension if not exists pgcrypto with schema extensions;

-- === Enums ===================================================================

create type public.canal_proveedor as enum ('mail', 'whatsapp');

comment on type public.canal_proveedor is
  'Canal de contacto del proveedor. El MVP solo automatiza "mail" — un proveedor '
  '"whatsapp" nunca recibe un pedido automático (docs/arquitectura/modelo-de-datos.md).';

create type public.tipo_servicio_producto as enum (
  'alojamiento',
  'excursion',
  'traslado',
  'bus',
  'crucero',
  'otro'
);

create type public.tipo_componente_producto as enum ('paquete', 'tramo_bus');

comment on type public.tipo_componente_producto is
  '"paquete": otro producto de catálogo dentro de un tour compuesto. '
  '"tramo_bus": un tramo de bus público externo (ruta + fecha), sin proveedor, '
  'que HI Travel emite en su propio sistema — nunca genera un pedido a proveedor.';

-- === proveedor ================================================================

create table public.proveedor (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_normalizado text not null,
  mails text[] not null default '{}',
  telefono text,
  pais text,
  ciudad text,
  aclaraciones text,
  canal public.canal_proveedor,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.proveedor is
  'Empresa que presta o factura un servicio. `mails` en plural: una celda del '
  'Excel de origen puede traer más de un mail (M1-03). `canal` nulo hasta que el '
  'importador lo determine.';

-- === producto ==================================================================

create table public.producto (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  ciudades text[] not null default '{}',
  destino text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producto_codigo_key unique (codigo)
);

comment on table public.producto is
  'Un producto de catálogo (paquete simple o tour compuesto). Sin precio, costo '
  'ni margen — ver docs/arquitectura/modelo-de-datos.md "Qué NO se guarda". '
  '`codigo` es único y es la clave que usan los importadores (M1-04/M1-05) para '
  'no duplicar en corridas repetidas; los códigos de agencias/partners externos '
  'viven en `codigo_externo`, no acá.';

-- === producto_servicio ==========================================================

create table public.producto_servicio (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.producto (id),
  tipo_servicio public.tipo_servicio_producto not null,
  service_provider_id uuid references public.proveedor (id),
  booking_supplier_id uuid references public.proveedor (id),
  prioridad integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.producto_servicio is
  'Un servicio dentro de un producto, con su Service Provider y su Booking '
  'Supplier. Varias filas con el mismo `producto_id` + `tipo_servicio` y '
  'distinta `prioridad` son las alternativas separadas por "/" del Excel '
  '(se piden en ese orden). `service_provider_id`/`booking_supplier_id` nulos: '
  'el proveedor del Excel no matcheó ninguno cargado ("sin resolver", M1-04) — '
  'no se inventa ni se crea un proveedor nuevo.';

create index producto_servicio_producto_id_idx on public.producto_servicio (producto_id);

-- === codigo_externo ==============================================================

create table public.codigo_externo (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.producto (id),
  agencia text not null,
  codigo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint codigo_externo_agencia_codigo_key unique (agencia, codigo)
);

comment on table public.codigo_externo is
  'Mapea un código de una agencia/partner (Kilroy, TourRadar, etc.) al producto '
  'interno. Un mismo producto puede tener varios códigos, de distintas agencias.';

create index codigo_externo_producto_id_idx on public.codigo_externo (producto_id);

-- === producto_componente ==========================================================

create table public.producto_componente (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.producto (id),
  orden integer not null,
  tipo public.tipo_componente_producto not null,
  componente_producto_id uuid references public.producto (id),
  descripcion_ruta text,
  transfer_in boolean not null default false,
  transfer_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producto_componente_orden_key unique (producto_id, orden),
  constraint producto_componente_tipo_check check (
    (
      tipo = 'paquete'
      and componente_producto_id is not null
      and descripcion_ruta is null
    )
    or (
      tipo = 'tramo_bus'
      and componente_producto_id is null
      and descripcion_ruta is not null
    )
  )
);

comment on table public.producto_componente is
  'Secuencia ordenada de un tour compuesto (`producto_id` = el tour). Cada fila '
  'es otro producto de catálogo (paquete) o un tramo de bus público externo '
  '(tramo_bus, sin proveedor). `transfer_in`/`transfer_out` marcan si ese '
  'componente puntual lleva el transfer de entrada/salida en este tour — regla '
  'de negocio en docs/arquitectura/modelo-de-datos.md (puntas del tour, '
  'excepción IGR/IGU).';

create index producto_componente_producto_id_idx on public.producto_componente (producto_id);
create index producto_componente_componente_producto_id_idx on public.producto_componente (componente_producto_id);

-- === importacion ===================================================================

create table public.importacion (
  id uuid primary key default gen_random_uuid(),
  archivo text not null,
  fecha timestamptz not null default now(),
  tipo_corrida text not null,
  filas_cargadas integer not null default 0,
  filas_para_revisar integer not null default 0,
  detalle jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.importacion is
  'Registro de cada corrida de un importador: qué archivo, cuándo, tipo de '
  'corrida (proveedores / productos-simples / tours-compuestos, etc.), cuántas '
  'filas se cargaron y cuántas quedaron "para revisar", y el detalle libre.';

-- === RLS: authenticated select/insert/update, sin delete (defensa en profundidad) ===

alter table public.proveedor enable row level security;
alter table public.producto enable row level security;
alter table public.producto_servicio enable row level security;
alter table public.codigo_externo enable row level security;
alter table public.producto_componente enable row level security;
alter table public.importacion enable row level security;

create policy "proveedor_select_authenticated" on public.proveedor for select to authenticated using (true);
create policy "proveedor_insert_authenticated" on public.proveedor for insert to authenticated with check (true);
create policy "proveedor_update_authenticated" on public.proveedor for update to authenticated using (true) with check (true);

create policy "producto_select_authenticated" on public.producto for select to authenticated using (true);
create policy "producto_insert_authenticated" on public.producto for insert to authenticated with check (true);
create policy "producto_update_authenticated" on public.producto for update to authenticated using (true) with check (true);

create policy "producto_servicio_select_authenticated" on public.producto_servicio for select to authenticated using (true);
create policy "producto_servicio_insert_authenticated" on public.producto_servicio for insert to authenticated with check (true);
create policy "producto_servicio_update_authenticated" on public.producto_servicio for update to authenticated using (true) with check (true);

create policy "codigo_externo_select_authenticated" on public.codigo_externo for select to authenticated using (true);
create policy "codigo_externo_insert_authenticated" on public.codigo_externo for insert to authenticated with check (true);
create policy "codigo_externo_update_authenticated" on public.codigo_externo for update to authenticated using (true) with check (true);

create policy "producto_componente_select_authenticated" on public.producto_componente for select to authenticated using (true);
create policy "producto_componente_insert_authenticated" on public.producto_componente for insert to authenticated with check (true);
create policy "producto_componente_update_authenticated" on public.producto_componente for update to authenticated using (true) with check (true);

create policy "importacion_select_authenticated" on public.importacion for select to authenticated using (true);
create policy "importacion_insert_authenticated" on public.importacion for insert to authenticated with check (true);
create policy "importacion_update_authenticated" on public.importacion for update to authenticated using (true) with check (true);

-- Sin policy de delete en ninguna de las 6 tablas: RLS deniega por default sin
-- una policy que lo habilite (los borrados no existen en el modelo — los
-- estados reemplazan al borrado, ver docs/arquitectura/modelo-de-datos.md).
-- Sin policy para `anon`: sin sesión, ninguna de las 6 tablas es legible ni
-- escribible (spec M1-02 §3 #10).
