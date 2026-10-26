-- ============================================================
-- F-28 · Calendario y correo semanal (calendar_email)
--
-- QUÉ HACE (el código funciona antes y después de aplicarla; el envío real
-- además necesita RESEND_API_KEY + EMAIL_FROM + EMAIL_TOKEN_SECRET +
-- WEEKLY_EMAIL=1 en Vercel):
--   1. public.email_preferences: una fila por persona con el resumen semanal
--      (opt-in, por defecto NO), la versión del texto de consentimiento que
--      aceptó, cuándo, cuándo se dio de baja y cuándo pidió por última vez el
--      enlace de confirmación (`optin_requested_at`) y la huella de la
--      dirección que confirmó (`confirmed_email_hash`, sha256 truncado, nunca
--      la dirección). La persona solo LEE su fila (RLS del dueño); se escribe
--      únicamente con las funciones del punto 4 y desde el servidor, así
--      fecha, versión y huella no se pueden retocar.
--   2. public.email_consent_events: registro de solo-añadir de cada alta y
--      baja (acción, versión del texto, origen: confirmación por correo, ajustes,
--      página de baja, baja en 1 clic de RFC 8058 o cambio de dirección). La
--      persona lee las suyas;
--      nadie las edita. Se borran con la cuenta (cascada).
--   3. public.email_sends: un envío por persona y semana (`period` = semana
--      ISO, p. ej. 2026-W51) con UNIQUE (user_id, kind, period): si el cron se
--      repite, la fila ya existe y no se reenvía. Solo el servidor (service
--      role): RLS sin políticas. `returned_at` = volvió a la app desde el
--      correo (medición sin píxel de seguimiento). Sin direcciones de correo.
--   4. DOBLE OPT-IN: el alta NO se puede hacer con la sesión. Ajustes pide
--      un enlace firmado (propósito "optin", 7 días) que se envía a la
--      dirección de la cuenta. Cada envío de ese enlace se apunta en
--      public.email_optin_requests (solo servidor) mediante
--      public.email_optin_claim(…), que en una sola transacción aplica los
--      topes: 10 min entre enlaces, 3 al día por persona y un tope global
--      diario (lo fija el servidor; Resend Free son 100 correos/día). Darse de
--      baja NO borra nada de eso, así que alternar alta/baja no salta los topes.
--      Solo al pulsar el enlace el servidor llama a
--      public.email_confirm_weekly(p_user, p_text_version, p_email_hash,
--      p_issued_at) (solo service_role), que activa el correo, REGISTRA el
--      consentimiento y guarda la huella de la dirección; un enlace emitido
--      antes de la última baja ya no vale.
--      public.email_reconfirm_required(p_user): el envío semanal la llama si la
--      dirección actual no es la confirmada (se desactiva y se pide confirmar).
--      public.set_email_weekly(false, …): baja desde Ajustes con la sesión
--      (auth.uid(); la demo no puede); con p_enabled = true lanza 42501.
--      public.email_unsubscribe(p_user, p_source): baja sin sesión desde el
--      enlace firmado del correo (solo service_role). Las tres son
--      idempotentes: repetir la misma acción no cambia nada ni duplica el
--      registro.
--   5. Vuelve a ejecutar el bloque demo_no_* (20261008000001) para cubrir las
--      tablas nuevas.
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios.
-- Nombres verificados contra 20260502233945_remote_schema.sql (users) y
-- 20261008000001_demo_read_only.sql (is_demo_session).
--
-- CÓMO APLICARLA (Víctor): SQL Editor del proyecto de TEST → pegar entero →
-- Run; repetir en producción.
--
-- COMPROBACIÓN (SQL Editor, tras aplicarla):
--   select tablename, rowsecurity from pg_tables where schemaname = 'public'
--      and tablename in ('email_preferences', 'email_consent_events', 'email_sends',
--                        'email_optin_requests');      -- 4 filas, todas true
--   select tablename, policyname, cmd from pg_policies
--    where tablename like 'email_%' order by 1, 2;      -- *_select_own (2) + demo_no_* (12)
--   select has_table_privilege('authenticated', 'public.email_preferences', 'update'),
--          has_table_privilege('authenticated', 'public.email_consent_events', 'insert'),
--          has_table_privilege('authenticated', 'public.email_sends', 'select');
--                                                       -- f, f, f
--   select to_regprocedure('public.set_email_weekly(boolean,text,text)'),
--          to_regprocedure('public.email_confirm_weekly(uuid,text,text,timestamptz)'),
--          to_regprocedure('public.email_optin_claim(uuid,integer,integer,interval)'),
--          to_regprocedure('public.email_reconfirm_required(uuid)'),
--          to_regprocedure('public.email_unsubscribe(uuid,text)');  -- ninguna NULL
--   select has_function_privilege('authenticated', 'public.email_confirm_weekly(uuid,text,text,timestamptz)', 'execute'),
--          has_function_privilege('authenticated', 'public.email_optin_claim(uuid,integer,integer,interval)', 'execute'),
--          has_table_privilege('authenticated', 'public.email_optin_requests', 'select');
--                                                       -- f, f, f (solo el servidor)
--   select * from public.rls_audit() where not ok;      -- 0 filas
--   -- Tras unas semanas:
--   select period, status, count(*), count(returned_at) from public.email_sends
--    group by 1, 2 order by 1 desc;
-- ============================================================


-- ── 1. Preferencias de correo (solo lectura para su dueño) ────────────────
create table if not exists public.email_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  weekly_digest boolean not null default false,
  consent_version text,
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  optin_requested_at timestamptz,
  confirmed_email_hash text,
  updated_at timestamptz not null default now(),
  constraint email_preferences_consent_version_check
    check (consent_version is null or consent_version ~ '^[a-z0-9][a-z0-9.-]{0,31}$'),
  constraint email_preferences_consent_check
    check (not weekly_digest or (consent_version is not null and consented_at is not null))
);

-- Por si una versión anterior de este archivo creó la tabla sin ella.
alter table public.email_preferences add column if not exists optin_requested_at timestamptz;
alter table public.email_preferences add column if not exists confirmed_email_hash text;

create index if not exists email_preferences_weekly_idx
  on public.email_preferences (user_id) where weekly_digest;

alter table public.email_preferences enable row level security;

drop policy if exists "email_preferences_select_own" on public.email_preferences;
create policy "email_preferences_select_own" on public.email_preferences
  for select to authenticated using (user_id = auth.uid());

revoke all on public.email_preferences from public, anon, authenticated;
grant select on public.email_preferences to authenticated;
grant all on public.email_preferences to service_role;

comment on table public.email_preferences is
  'F-28: resumen semanal por correo (opt-in). La persona solo la lee; se escribe con set_email_weekly() y email_unsubscribe().';


-- ── 2. Registro de consentimientos (solo añadir) ─────────────────────────
create table if not exists public.email_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  action text not null,
  text_version text not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint email_consent_events_action_check check (action in ('opt_in', 'opt_out')),
  constraint email_consent_events_source_check
    check (source in ('email_confirm', 'email_changed', 'settings', 'unsubscribe_page', 'one_click')),
  constraint email_consent_events_version_check check (text_version ~ '^[a-z0-9][a-z0-9.-]{0,31}$')
);

-- Reconstruido para que una versión anterior de este archivo converja.
alter table public.email_consent_events drop constraint if exists email_consent_events_source_check;
alter table public.email_consent_events add constraint email_consent_events_source_check
  check (source in ('email_confirm', 'email_changed', 'settings', 'unsubscribe_page', 'one_click'));

create index if not exists email_consent_events_user_idx
  on public.email_consent_events (user_id, created_at desc);

alter table public.email_consent_events enable row level security;

drop policy if exists "email_consent_events_select_own" on public.email_consent_events;
create policy "email_consent_events_select_own" on public.email_consent_events
  for select to authenticated using (user_id = auth.uid());

revoke all on public.email_consent_events from public, anon, authenticated;
grant select on public.email_consent_events to authenticated;
grant all on public.email_consent_events to service_role;

comment on table public.email_consent_events is
  'F-28: cada alta y baja del correo semanal (versión del texto aceptado y origen). Solo se añade.';


-- ── 3. Envíos (solo servidor) ────────────────────────────────────────────
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null default 'weekly',
  period text not null,
  status text not null default 'sending',
  attempts smallint not null default 1,
  items smallint not null default 0,
  provider_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  returned_at timestamptz,
  constraint email_sends_kind_check check (kind in ('weekly')),
  constraint email_sends_period_check check (period ~ '^\d{4}-W\d{2}$'),
  constraint email_sends_status_check check (status in ('sending', 'sent', 'failed', 'skipped')),
  constraint email_sends_error_check check (error is null or error ~ '^[a-z0-9_]{1,40}$'),
  constraint email_sends_once unique (user_id, kind, period)
);

create index if not exists email_sends_period_idx on public.email_sends (kind, period, status);

alter table public.email_sends enable row level security;
-- Sin políticas a propósito: nadie con JWT de usuario lee ni escribe.
revoke all on public.email_sends from public, anon, authenticated;
grant select, insert, update, delete on public.email_sends to service_role;

comment on table public.email_sends is
  'F-28: un correo semanal por persona y semana ISO (UNIQUE: el cron repetido no reenvía). Sin direcciones ni contenido.';


-- ── 3b. Enlaces de confirmación enviados (solo servidor; topes) ──────────
create table if not exists public.email_optin_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists email_optin_requests_user_idx on public.email_optin_requests (user_id, created_at desc);
create index if not exists email_optin_requests_created_idx on public.email_optin_requests (created_at);

alter table public.email_optin_requests enable row level security;
-- Sin políticas a propósito: nadie con JWT de usuario lee ni escribe.
revoke all on public.email_optin_requests from public, anon, authenticated;
grant select, insert, delete on public.email_optin_requests to service_role;

comment on table public.email_optin_requests is
  'F-28: cada correo de confirmación del alta enviado (para los topes por persona y global). Se purga a los 2 días.';


-- ── 4. Alta (doble opt-in) y baja ───────────────────────────────────────
-- Baja desde Ajustes, con la sesión de la persona. SECURITY DEFINER para que
-- la fecha la ponga la base (las tablas no admiten escritura de
-- `authenticated`), con las mismas reglas que una política: auth.uid() y la
-- demo fuera. El ALTA no se acepta por aquí (doble opt-in: ver
-- email_confirm_weekly); se conserva la firma para no romper llamadas.
create or replace function public.set_email_weekly(
  p_enabled boolean,
  p_text_version text,
  p_source text default 'settings'
)
returns table (weekly_digest boolean, consent_version text, consented_at timestamptz)
language plpgsql security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_current boolean;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.is_demo_session() then
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;
  if p_enabled then
    raise exception 'weekly email requires confirmation by email' using errcode = '42501';
  end if;
  if p_source is distinct from 'settings' then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  if p_text_version is null or p_text_version !~ '^[a-z0-9][a-z0-9.-]{0,31}$' then
    raise exception 'invalid text version' using errcode = '22023';
  end if;

  select p.weekly_digest into v_current
    from public.email_preferences p where p.user_id = v_user for update;

  if v_current then
    update public.email_preferences p
       set weekly_digest = false, unsubscribed_at = now(), updated_at = now()
     where p.user_id = v_user;
    insert into public.email_consent_events (user_id, action, text_version, source)
    values (v_user, 'opt_out', p_text_version, p_source);
  else
    -- Baja con una confirmación pendiente: la anula (los enlaces emitidos
    -- antes de `unsubscribed_at` ya no valen) SIN tocar optin_requested_at ni
    -- email_optin_requests, que sostienen los topes de envío.
    update public.email_preferences p set unsubscribed_at = now(), updated_at = now()
     where p.user_id = v_user and p.optin_requested_at is not null;
  end if;

  return query
    select p.weekly_digest, p.consent_version, p.consented_at
      from public.email_preferences p where p.user_id = v_user;
end
$$;
revoke all on function public.set_email_weekly(boolean, text, text) from public, anon;
grant execute on function public.set_email_weekly(boolean, text, text) to authenticated, service_role;

-- Alta confirmada (doble opt-in). La llama el servidor con el service role
-- tras verificar el enlace "optin" (firma, caducidad, dirección y versión).
-- Aquí se REGISTRA el consentimiento: fecha de ahora, versión del texto que
-- se le enseñó y huella de la dirección confirmada. Devuelve:
--   'ok'         activado (o renovado con otro texto u otra dirección);
--   'unchanged'  ya estaba activo con esa versión y esa dirección (pulsar dos
--                veces no duplica el registro);
--   'superseded' el enlace se emitió antes de la última baja: no vale.
-- La versión anterior de este archivo tenía otra firma: se retira.
drop function if exists public.email_confirm_weekly(uuid, text);
create or replace function public.email_confirm_weekly(
  p_user uuid,
  p_text_version text,
  p_email_hash text,
  p_issued_at timestamptz
)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.email_preferences%rowtype;
begin
  if p_text_version is null or p_text_version !~ '^[a-z0-9][a-z0-9.-]{0,31}$' then
    raise exception 'invalid text version' using errcode = '22023';
  end if;
  if p_email_hash is null or p_email_hash !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception 'invalid email hash' using errcode = '22023';
  end if;
  select * into v_row from public.email_preferences p where p.user_id = p_user for update;
  if found and v_row.unsubscribed_at is not null and v_row.unsubscribed_at > p_issued_at then
    return 'superseded';
  end if;
  if found and v_row.weekly_digest and v_row.consent_version = p_text_version
     and v_row.confirmed_email_hash = p_email_hash then
    return 'unchanged';
  end if;
  insert into public.email_preferences as p
         (user_id, weekly_digest, consent_version, consented_at, unsubscribed_at, confirmed_email_hash, updated_at)
  values (p_user, true, p_text_version, now(), null, p_email_hash, now())
  on conflict (user_id) do update
    set weekly_digest = true, consent_version = excluded.consent_version, consented_at = excluded.consented_at,
        unsubscribed_at = null, confirmed_email_hash = excluded.confirmed_email_hash, updated_at = now();
  insert into public.email_consent_events (user_id, action, text_version, source)
  values (p_user, 'opt_in', p_text_version, 'email_confirm');
  return 'ok';
end
$$;
revoke all on function public.email_confirm_weekly(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.email_confirm_weekly(uuid, text, text, timestamptz) to service_role;

-- Reserva el envío de un enlace de confirmación aplicando los topes en una
-- sola transacción (bloqueo consultivo: dos peticiones a la vez no se cuelan).
-- Devuelve 'ok' (apuntado: se puede enviar), 'cooldown' (otro hace menos de
-- p_cooldown), 'user_cap' (p_user_daily en 24 h) o 'global_cap'
-- (p_global_daily en 24 h para toda la app). Purga lo de más de 2 días.
create or replace function public.email_optin_claim(
  p_user uuid,
  p_user_daily integer,
  p_global_daily integer,
  p_cooldown interval
)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext('kultura.email_optin_claim'));
  delete from public.email_optin_requests r where r.created_at < now() - interval '2 days';
  if exists (select 1 from public.email_optin_requests r
              where r.user_id = p_user and r.created_at > now() - p_cooldown) then
    return 'cooldown';
  end if;
  if (select count(*) from public.email_optin_requests r
       where r.user_id = p_user and r.created_at > now() - interval '1 day') >= greatest(p_user_daily, 0) then
    return 'user_cap';
  end if;
  if (select count(*) from public.email_optin_requests r
       where r.created_at > now() - interval '1 day') >= greatest(p_global_daily, 0) then
    return 'global_cap';
  end if;
  insert into public.email_optin_requests (user_id) values (p_user);
  insert into public.email_preferences as p (user_id, optin_requested_at, updated_at)
  values (p_user, now(), now())
  on conflict (user_id) do update set optin_requested_at = now(), updated_at = now();
  return 'ok';
end
$$;
revoke all on function public.email_optin_claim(uuid, integer, integer, interval) from public, anon, authenticated;
grant execute on function public.email_optin_claim(uuid, integer, integer, interval) to service_role;

-- La dirección de la cuenta ya no es la que se confirmó: se desactiva (los
-- enlaces viejos dejan de valer) y queda registrado. Devuelve true si estaba
-- activo. El servidor envía después un enlace nuevo a la dirección actual.
create or replace function public.email_reconfirm_required(p_user uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_version text;
begin
  update public.email_preferences p
     set weekly_digest = false, unsubscribed_at = now(), updated_at = now()
   where p.user_id = p_user and p.weekly_digest
  returning p.consent_version into v_version;
  if not found then
    return false;
  end if;
  insert into public.email_consent_events (user_id, action, text_version, source)
  values (p_user, 'opt_out', coalesce(v_version, 'unknown'), 'email_changed');
  return true;
end
$$;
revoke all on function public.email_reconfirm_required(uuid) from public, anon, authenticated;
grant execute on function public.email_reconfirm_required(uuid) to service_role;

-- Baja sin sesión (enlace firmado del correo o List-Unsubscribe-Post). La
-- llama el servidor con el service role tras verificar la firma. Devuelve
-- true si estaba dado de alta (false: ya estaba de baja o no existe).
create or replace function public.email_unsubscribe(p_user uuid, p_source text)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_version text;
begin
  if p_source not in ('unsubscribe_page', 'one_click') then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  update public.email_preferences p
     set weekly_digest = false, unsubscribed_at = now(), updated_at = now()
   where p.user_id = p_user and p.weekly_digest
  returning p.consent_version into v_version;
  if not found then
    return false;
  end if;
  insert into public.email_consent_events (user_id, action, text_version, source)
  values (p_user, 'opt_out', coalesce(v_version, 'unknown'), p_source);
  return true;
end
$$;
revoke all on function public.email_unsubscribe(uuid, text) from public, anon, authenticated;
grant execute on function public.email_unsubscribe(uuid, text) to service_role;


-- ── 5. Demo de solo lectura también en las tablas nuevas (copia de 20261008000001) ─
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists demo_no_insert on public.%I', t.relname);
    execute format('drop policy if exists demo_no_update on public.%I', t.relname);
    execute format('drop policy if exists demo_no_delete on public.%I', t.relname);

    execute format(
      'create policy demo_no_insert on public.%I as restrictive for insert to authenticated
         with check (not public.is_demo_session())', t.relname);
    execute format(
      'create policy demo_no_update on public.%I as restrictive for update to authenticated
         using (not public.is_demo_session()) with check (not public.is_demo_session())', t.relname);
    execute format(
      'create policy demo_no_delete on public.%I as restrictive for delete to authenticated
         using (not public.is_demo_session())', t.relname);
  end loop;
end
$$;

notify pgrst, 'reload schema';
