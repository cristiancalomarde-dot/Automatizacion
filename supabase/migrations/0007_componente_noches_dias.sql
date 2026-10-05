-- M1-05 — tours compuestos: noches, día de inicio y bus nocturno por componente.
--
-- `producto_componente` (0002) guarda la secuencia de un tour, pero no cuántas
-- noches tiene cada paquete dentro del tour ni en qué día empieza. Con eso,
-- cuando llegue una reserva con su fecha de inicio (M2), se calculan las
-- fechas de cada pedido (M3). Las tres columnas salen del itinerario del Word
-- de catálogo, cruzado con los códigos de RutasenBus (spec M1-05 §3 #3):
--
-- - `noches`: noches de ese componente en este tour (puede diferir del
--   paquete vendido solo: "OD016 (mas 1 noche)"). Null en `tramo_bus`. En un
--   tour dentro de otro (5C01 → CHB31) son las noches del tour anidado.
-- - `dia_desde`: día del tour en que empieza el componente (1 = primer día).
--   Para un `tramo_bus`, el día en que sale el bus.
-- - `nocturno`: solo `tramo_bus`; true = sale de noche y llega al día
--   siguiente (esa noche se pasa en el bus). Null en `paquete`.
--
-- Quedan nullables: las filas cargadas antes (y las de los tests de M1-02)
-- no los traen. Los checks solo impiden valores del tipo equivocado.
--
-- Los buses que reserva un proveedor (ej. Uyuni – La Paz con Imperio Inca)
-- no son `tramo_bus`: van como `producto_servicio` del compuesto. No hace
-- falta cambiar nada para eso: `producto_servicio.producto_id` ya puede
-- apuntar a un producto compuesto.
--
-- RLS (regla #1): no hay tablas nuevas; `producto_componente` ya tiene RLS
-- activa con las policies de 0002.
--
-- Cómo aplicar: `supabase db push` por el pooler (igual que 0003-0006).

alter table public.producto_componente
  add column noches integer,
  add column dia_desde integer,
  add column nocturno boolean,
  add constraint producto_componente_noches_check check (
    noches is null or (tipo = 'paquete' and noches >= 0)
  ),
  add constraint producto_componente_dia_desde_check check (dia_desde is null or dia_desde >= 1),
  add constraint producto_componente_nocturno_check check (nocturno is null or tipo = 'tramo_bus');

comment on column public.producto_componente.noches is
  'Noches del componente en este tour (del itinerario del Word; M1-05). Null en tramo_bus.';
comment on column public.producto_componente.dia_desde is
  'Día del tour en que empieza el componente (1 = primer día); en tramo_bus, el día en que sale el bus.';
comment on column public.producto_componente.nocturno is
  'Solo tramo_bus: true = bus nocturno (sale un día y llega al siguiente). Null en paquete.';
