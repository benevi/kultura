-- ============================================================
-- KULTURA — IA con coste acotado (D-06 / ROJO-4 / SEG-5)
--
-- Qué hace:
--   1. `ai_recs`: las recomendaciones de "Para ti" de cada usuario y día (una
--      fila; `locale` guarda el idioma en que se generaron). La app genera
--      como mucho una por usuario y día y la reutiliza el resto del día en
--      cualquier idioma (`src/lib/claude/daily-recs.ts`). Solo se guarda la del
--      día: al escribir la nueva se borran las anteriores.
--   2. `ai_usage`: contador de llamadas al modelo por día (hora de Madrid) y
--      tipo (`recs`, `translate`).
--   3. `increment_ai_usage(kind, cap)`: reserva UNA llamada si el total del día
--      (sumando los dos tipos) no ha llegado a `cap` (`AI_DAILY_CALL_CAP`, 100
--      por defecto). Devuelve true/false. Serializada con un advisory lock por
--      día, así que dos instancias a la vez no se pasan del tope.
--
-- Seguridad: las dos tablas tienen RLS activa y NINGUNA política permisiva;
-- anon y authenticated no tienen privilegios sobre ellas ni pueden ejecutar la
-- función. Solo el servidor (service_role) lee y escribe. Se añaden también
-- las políticas RESTRICTIVE `demo_no_*` de `20261008000001_demo_read_only.sql`
-- para que la regla "toda tabla pública con RLS las tiene" siga siendo cierta.
--
-- Antes y después: el código funciona sin esta migración (caché y contador en
-- memoria por instancia, más laxos) y la usa en cuanto existe. Idempotente:
-- se puede ejecutar varias veces.
--
-- Cómo comprobarlo después de aplicarla (SQL Editor):
--   select relname, relrowsecurity from pg_class
--     where relname in ('ai_recs', 'ai_usage');                 -- 2 filas, true
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_name in ('ai_recs', 'ai_usage')
--       and grantee in ('anon', 'authenticated');               -- 0 filas
--   select has_function_privilege('authenticated',
--     'public.increment_ai_usage(text, integer)', 'execute');   -- false
--   select public.increment_ai_usage('recs', 100);              -- true
--   select * from public.ai_usage;                              -- calls = 1
--   delete from public.ai_usage;                                -- limpiar la prueba
-- ============================================================

-- ── ai_usage ────────────────────────────────────────────────────────────────

create table if not exists public.ai_usage (
  day        date        not null,
  kind       text        not null,
  calls      integer     not null default 0,
  updated_at timestamptz not null default now(),
  constraint ai_usage_pkey primary key (day, kind),
  constraint ai_usage_kind_check check (kind in ('recs', 'translate')),
  constraint ai_usage_calls_check check (calls >= 0)
);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;
grant select, insert, update, delete on table public.ai_usage to service_role;

-- ── ai_recs ─────────────────────────────────────────────────────────────────

create table if not exists public.ai_recs (
  user_id    uuid        not null references public.users (id) on delete cascade,
  day        date        not null,
  locale     text        not null,
  payload    jsonb       not null,
  created_at timestamptz not null default now(),
  constraint ai_recs_pkey primary key (user_id, day),
  constraint ai_recs_locale_check check (char_length(locale) between 2 and 10)
);

alter table public.ai_recs enable row level security;
revoke all on table public.ai_recs from anon, authenticated;
grant select, insert, update, delete on table public.ai_recs to service_role;

-- ── demo_no_* (mismo bloque que 20261008000001_demo_read_only.sql) ─────────

do $$
declare
  t text;
begin
  foreach t in array array['ai_usage', 'ai_recs']
  loop
    execute format('drop policy if exists demo_no_insert on public.%I', t);
    execute format('drop policy if exists demo_no_update on public.%I', t);
    execute format('drop policy if exists demo_no_delete on public.%I', t);

    execute format(
      'create policy demo_no_insert on public.%I as restrictive for insert to authenticated
         with check (not public.is_demo_session())', t);
    execute format(
      'create policy demo_no_update on public.%I as restrictive for update to authenticated
         using (not public.is_demo_session()) with check (not public.is_demo_session())', t);
    execute format(
      'create policy demo_no_delete on public.%I as restrictive for delete to authenticated
         using (not public.is_demo_session())', t);
  end loop;
end
$$;

-- ── increment_ai_usage ──────────────────────────────────────────────────────

create or replace function public.increment_ai_usage(p_kind text, p_cap integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_day   date := (now() at time zone 'Europe/Madrid')::date;
  v_total integer;
begin
  if p_kind is null or p_kind not in ('recs', 'translate') then
    raise exception 'increment_ai_usage: tipo no válido (%)', p_kind
      using errcode = '22023';
  end if;

  if p_cap is null or p_cap <= 0 then
    return false;
  end if;

  -- Un candado por día: las reservas concurrentes se ponen en fila y la suma
  -- de abajo nunca lee un total viejo. Se suelta al acabar la transacción.
  perform pg_advisory_xact_lock(hashtext('ai_usage'), v_day - date '2000-01-01');

  select coalesce(sum(calls), 0)::integer
    into v_total
    from public.ai_usage
   where day = v_day;

  if v_total >= p_cap then
    return false;
  end if;

  insert into public.ai_usage as u (day, kind, calls)
  values (v_day, p_kind, 1)
  on conflict (day, kind)
  do update set calls = u.calls + 1, updated_at = now();

  return true;
end;
$$;

revoke all on function public.increment_ai_usage(text, integer) from public, anon, authenticated;
grant execute on function public.increment_ai_usage(text, integer) to service_role;

-- Que PostgREST vea la función nueva sin esperar a su recarga periódica.
notify pgrst, 'reload schema';
