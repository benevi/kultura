-- ============================================================
-- F-17 · Perfil público, invitación y medición (analytics, D-12)
--
-- QUÉ HACE (el código funciona antes y después de aplicarla):
--   1. public.analytics_events: eventos de producto de usuarios REGISTRADOS
--      (signup_completed, library_add, rating_set, list_made_public,
--      invite_accepted, share). Los escribe solo el servidor con el service
--      role (`src/lib/analytics/track.ts`): RLS activada y NINGUNA política
--      para anon/authenticated, que tampoco tienen privilegios sobre la tabla.
--      `dedupe_key` única para los eventos que cuentan una vez (el alta, el
--      primer guardado de cada título…). Se borran en cascada con la cuenta.
--      Antes de aplicarla, `track()` ignora el error (42P01 / PGRST205).
--      RETENCIÓN: 13 meses (un año completo de cohortes y su D7). La purga es
--      public.purge_old_analytics_events() (solo service_role), que llama el
--      cron diario /api/cron/daily; hasta que lo haga, a mano en el SQL Editor:
--        select public.purge_old_analytics_events();
--   2. public.funnel_weekly: vista (security_invoker) con el embudo semanal
--      por cohorte de alta: registro → 1.ª acción (7 días) → 3 títulos
--      (7 días) → D7 (alguna acción entre el día 7 y el 14), por canal
--      (utm / ref / direct) e invitaciones aceptadas. Solo service_role (y el
--      SQL Editor). Las VISITAS anónimas no están aquí: salen de Vercel Web
--      Analytics (páginas vistas sin cookies), como manda D-12.
--   3. notifications_type_check admite 'invite_accepted' (aviso a quien
--      invita). Se reconstruye a partir de los tipos que ya admite, así que no
--      quita ninguno aunque producción tenga alguno más que el repositorio. La
--      app solo lo inserta con INVITE_NOTIFY=1 (cuando la lista de avisos sepa
--      pintarlo).
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios.
-- Nombres verificados contra 20260502233945_remote_schema.sql (users,
-- notifications, notifications_type_check) y 20260601000002_group_invitations.sql
-- (último cambio del CHECK: recommendation, list_invite, group_invite).
--
-- CÓMO APLICARLA (Víctor): SQL Editor del proyecto de TEST → pegar entero →
-- Run; repetir en producción. No hay banderas que activar para medir.
--
-- COMPROBACIÓN (SQL Editor, tras aplicarla):
--   select relrowsecurity from pg_class where oid = 'public.analytics_events'::regclass;  -- true
--   select count(*) from pg_policies where tablename = 'analytics_events';                -- 0
--   select has_table_privilege('authenticated', 'public.analytics_events', 'select'),
--          has_table_privilege('anon', 'public.analytics_events', 'insert'),
--          has_table_privilege('authenticated', 'public.funnel_weekly', 'select');        -- f, f, f
--   select * from public.rls_audit() where not ok;                                        -- 0 filas
--   select public.purge_old_analytics_events();          -- nº de filas de más de 13 meses (0 al principio)
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'notifications_type_check';                       -- incluye 'invite_accepted'
--   -- Tras unas altas reales:
--   select * from public.funnel_weekly limit 8;
--   select name, count(*) from public.analytics_events group by 1 order by 2 desc;
--   -- 100 % de las cuentas nuevas con canal (utm / ref / direct):
--   select coalesce(raw_user_meta_data -> 'attribution' ->> 'channel', '(sin canal)') as canal,
--          count(*)
--     from auth.users where created_at > '2026-11-15' group by 1 order by 2 desc;
-- ============================================================


-- ── 1. analytics_events ──────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'analytics_events_name_check'
                    and conrelid = 'public.analytics_events'::regclass) then
    alter table public.analytics_events add constraint analytics_events_name_check
      check (name ~ '^[a-z][a-z0-9_]{1,47}$');
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'analytics_events_props_check'
                    and conrelid = 'public.analytics_events'::regclass) then
    alter table public.analytics_events add constraint analytics_events_props_check
      check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 4096);
  end if;
end $$;

-- Única (los NULL no chocan entre sí): base del ON CONFLICT de `track()`.
create unique index if not exists analytics_events_dedupe_key_key
  on public.analytics_events (dedupe_key);
create index if not exists analytics_events_name_created_idx
  on public.analytics_events (name, created_at desc);
create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at);

alter table public.analytics_events enable row level security;
-- Sin políticas a propósito: nadie con JWT de usuario lee ni escribe.
revoke all on public.analytics_events from public, anon, authenticated;
grant select, insert, update, delete on public.analytics_events to service_role;

comment on table public.analytics_events is
  'F-17 (D-12): eventos de producto de usuarios registrados. Solo los escribe el servidor (service role). Sin cookies ni identificadores de visitantes anónimos. Retención: 13 meses (purge_old_analytics_events).';

-- Retención (13 meses): borra lo más antiguo y devuelve cuántas filas quitó.
create or replace function public.purge_old_analytics_events(p_keep interval default interval '13 months')
returns integer language sql security definer
set search_path = public, pg_temp
as $$
  with gone as (
    delete from public.analytics_events
     where created_at < now() - greatest(p_keep, interval '1 month')
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.purge_old_analytics_events(interval) from public, anon, authenticated;
grant execute on function public.purge_old_analytics_events(interval) to service_role;


-- ── 2. Embudo semanal ────────────────────────────────────────────────────
create or replace view public.funnel_weekly
with (security_invoker = true) as
with signups as (
  select e.user_id,
         min(e.created_at) as signup_at,
         coalesce(min(e.props ->> 'channel'), 'direct') as channel
    from public.analytics_events e
   where e.name = 'signup_completed'
   group by e.user_id
), acts as (
  select e.user_id, e.name, e.created_at
    from public.analytics_events e
   where e.name in ('library_add', 'rating_set', 'list_made_public')
), per_user as (
  select s.user_id,
         date_trunc('week', s.signup_at)::date as week,
         s.channel,
         exists (select 1 from acts a
                  where a.user_id = s.user_id
                    and a.created_at < s.signup_at + interval '7 days') as activated,
         (select count(*) from acts a
           where a.user_id = s.user_id and a.name = 'library_add'
             and a.created_at < s.signup_at + interval '7 days') >= 3 as three_titles,
         exists (select 1 from acts a
                  where a.user_id = s.user_id
                    and a.created_at >= s.signup_at + interval '7 days'
                    and a.created_at < s.signup_at + interval '14 days') as d7,
         exists (select 1 from public.analytics_events i
                  where i.user_id = s.user_id and i.name = 'invite_accepted') as invited
    from signups s
)
select p.week                                                       as week,
       count(*)                                                           as signups,
       count(*) filter (where p.channel = 'utm')                          as signups_utm,
       count(*) filter (where p.channel = 'ref')                          as signups_ref,
       count(*) filter (where p.channel = 'direct')                       as signups_direct,
       count(*) filter (where p.invited)                                  as invites_accepted,
       count(*) filter (where p.activated)                                as first_action_7d,
       count(*) filter (where p.three_titles)                             as three_titles_7d,
       count(*) filter (where p.d7)                                       as retained_d7,
       round(100.0 * count(*) filter (where p.activated) / nullif(count(*), 0), 1)    as first_action_pct,
       round(100.0 * count(*) filter (where p.three_titles) / nullif(count(*), 0), 1) as three_titles_pct,
       round(100.0 * count(*) filter (where p.d7) / nullif(count(*), 0), 1)           as retained_d7_pct,
       -- La D7 de una cohorte solo es definitiva 14 días después de su última alta.
       (p.week + interval '21 days' <= now())                             as d7_final
  from per_user p
 group by p.week
 order by p.week desc;

revoke all on public.funnel_weekly from public, anon, authenticated;
grant select on public.funnel_weekly to service_role;

comment on view public.funnel_weekly is
  'F-17 (D-12): embudo semanal por cohorte de alta (registro → 1.ª acción → 3 títulos → D7). Las visitas, en Vercel Web Analytics.';


-- ── 3. Aviso a quien invita ──────────────────────────────────────────────
do $$
declare
  def text;
  allowed text[];
begin
  select pg_get_constraintdef(c.oid) into def
    from pg_constraint c
   where c.conname = 'notifications_type_check'
     and c.conrelid = 'public.notifications'::regclass;

  if def is not null and position('''invite_accepted''' in def) > 0 then
    return; -- ya aplicada
  end if;

  -- Los tipos que admite hoy (sean los del repositorio o alguno más).
  select coalesce(array_agg(distinct m[1]), array[]::text[]) into allowed
    from regexp_matches(coalesce(def, ''), '''([a-z_]+)''', 'g') as m;
  if cardinality(allowed) = 0 then
    allowed := array['recommendation', 'list_invite', 'group_invite'];
  end if;
  allowed := array_append(allowed, 'invite_accepted');

  alter table public.notifications drop constraint if exists notifications_type_check;
  execute format(
    'alter table public.notifications add constraint notifications_type_check check (type = any (%L::text[]))',
    allowed);
end $$;
