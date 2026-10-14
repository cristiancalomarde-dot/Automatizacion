-- M2-03 — reconocer el producto: cómo se emparejó cada reserva y qué es cada
-- parte del tour (pedido a un proveedor o tarea de HI Travel).
--
-- Diseño: spec M2-03 (Anexo técnico, "Migraciones") e integraciones-ia.md
-- (umbral de la propuesta de la IA). Esta migración lo traduce a SQL.
--
-- `reserva`:
-- - `origen_emparejado`: cómo se reconoció el producto: `codigo` (paso 1, el
--   código exacto de la agencia), `nombre` (paso 2, el nombre que usa la
--   agencia) o `ia` (paso 3, propuesta de la IA con confianza). Null si no se
--   reconoció. Solo con producto.
-- - `confianza_emparejado`: 1 en código y nombre; la de la IA en `ia`.
-- - `sugerencia_producto_id`: lo que propuso la IA cuando NO se aceptó
--   (confianza baja, noches que no coinciden). Queda a la vista para quien
--   revisa; nunca es el producto de la reserva.
--
-- `reserva_componente`:
-- - `tipo` pasa de enum a texto y suma `servicio`: un servicio del tour mismo
--   (el bus Uyuni – La Paz que reserva Imperio Inca, o el transfer al
--   aeropuerto de Puerto Natales del final de ARCH31/ARCH33). El enum
--   `tipo_componente_producto` es del catálogo y no se toca.
-- - `es_tarea`: un bus que emite HI Travel a mano (Kupos, Plataforma10): tarea
--   "emitir boleto", sin proveedor. Nunca genera un pedido.
-- - `producto_servicio_id`: el servicio del catálogo del que sale la parte
--   (buses del tour y el final de ARCH31/ARCH33).
-- - `proveedor_id`: a quién se le pide la parte `servicio`.
--
-- RLS (regla #1): no hay tablas nuevas; `reserva` y `reserva_componente` ya
-- tienen RLS activa con las policies de 0010.
--
-- Cómo aplicar: `supabase db push` por el pooler (igual que 0003-0010).

alter table public.reserva
  add column origen_emparejado text,
  add column confianza_emparejado numeric(4, 3),
  add column sugerencia_producto_id uuid references public.producto (id),
  add constraint reserva_origen_emparejado_check check (
    origen_emparejado is null or origen_emparejado in ('codigo', 'nombre', 'ia')
  ),
  add constraint reserva_origen_con_producto check (origen_emparejado is null or producto_id is not null),
  add constraint reserva_confianza_emparejado_check check (
    confianza_emparejado is null or (confianza_emparejado >= 0 and confianza_emparejado <= 1)
  );

comment on column public.reserva.origen_emparejado is
  'M2-03: cómo se reconoció el producto: codigo | nombre | ia. Null = no se reconoció.';
comment on column public.reserva.confianza_emparejado is
  'M2-03: 1 en código y nombre; la confianza de la IA en ia.';
comment on column public.reserva.sugerencia_producto_id is
  'M2-03: lo que propuso la IA cuando no se aceptó (para quien revisa). Nunca es el producto de la reserva.';

alter table public.reserva_componente
  drop constraint reserva_componente_tramo_sin_producto;

alter table public.reserva_componente
  alter column tipo type text using tipo::text,
  add column es_tarea boolean not null default false,
  add column producto_servicio_id uuid references public.producto_servicio (id),
  add column proveedor_id uuid references public.proveedor (id),
  add constraint reserva_componente_tipo_check check (tipo in ('paquete', 'tramo_bus', 'servicio')),
  add constraint reserva_componente_tramo_sin_producto check (tipo = 'paquete' or producto_id is null),
  add constraint reserva_componente_tarea_sin_proveedor check (not es_tarea or proveedor_id is null),
  add constraint reserva_componente_paquete_no_es_tarea check (tipo <> 'paquete' or not es_tarea);

comment on column public.reserva_componente.tipo is
  'paquete (un producto del catálogo) | tramo_bus (bus público) | servicio (un servicio del tour mismo, M2-03).';
comment on column public.reserva_componente.es_tarea is
  'M2-03: bus que emite HI Travel a mano (Kupos, Plataforma10): tarea "emitir boleto", sin proveedor.';
comment on column public.reserva_componente.producto_servicio_id is
  'M2-03: el servicio del catálogo del que sale la parte (buses del tour, final de ARCH31/ARCH33).';
comment on column public.reserva_componente.proveedor_id is
  'M2-03: a quién se le pide una parte de tipo servicio. Null en las tareas.';
