-- M1-03 — contador de gasto de IA (regla #3).
--
-- Diseño fijado en docs/arquitectura/integraciones-ia.md (Anexo técnico):
-- "Contador de gasto: tabla `uso_ia` (mes, tokens_in, tokens_out,
-- costo_estimado). Middleware que suma y frena antes de cada llamada."
-- M1-03 es la primera pieza que llama a la IA (respaldo del importador de
-- proveedores), por eso la crea. El chequeo "antes de gastar" vive en
-- src/lib/ia/techo-gasto.ts; esta migración solo guarda el acumulado.
--
-- Cómo aplicar: `supabase db push` (mismo mecanismo que 0002).

create table public.uso_ia (
  id uuid primary key default gen_random_uuid(),
  mes text not null,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  costo_estimado numeric(12, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uso_ia_mes_key unique (mes),
  constraint uso_ia_mes_formato check (mes ~ '^\d{4}-\d{2}$')
);

comment on table public.uso_ia is
  'Gasto acumulado de IA por mes (AAAA-MM, UTC). Se chequea ANTES de cada '
  'llamada contra el techo de US$ 20/mes (regla #3, '
  'docs/arquitectura/integraciones-ia.md).';

-- Suma atómica del uso de una llamada al mes (insert o update en un solo
-- statement, sin carrera entre dos procesos que llaman a la vez).
create function public.sumar_uso_ia(
  p_mes text,
  p_tokens_in bigint,
  p_tokens_out bigint,
  p_costo numeric
) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.uso_ia (mes, tokens_in, tokens_out, costo_estimado)
  values (p_mes, p_tokens_in, p_tokens_out, p_costo)
  on conflict (mes) do update set
    tokens_in = public.uso_ia.tokens_in + excluded.tokens_in,
    tokens_out = public.uso_ia.tokens_out + excluded.tokens_out,
    costo_estimado = public.uso_ia.costo_estimado + excluded.costo_estimado,
    updated_at = now();
$$;

-- Solo el servidor (service role) suma gasto; nadie desde el navegador.
revoke execute on function public.sumar_uso_ia(text, bigint, bigint, numeric) from public, anon, authenticated;
grant execute on function public.sumar_uso_ia(text, bigint, bigint, numeric) to service_role;

-- RLS (defensa en profundidad, igual criterio que 0002): el equipo autenticado
-- puede leer el gasto; escribir, solo la service role (que saltea RLS).
alter table public.uso_ia enable row level security;

create policy "uso_ia_select_authenticated" on public.uso_ia for select to authenticated using (true);
