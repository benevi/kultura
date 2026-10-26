-- ============================================================
-- F-33 · Notificaciones push (MOV-10)
--
-- QUÉ HACE (el código funciona antes y después de aplicarla; el envío real
-- además necesita en Vercel PUSH_ENABLED=1, VAPID_PUBLIC_KEY,
-- VAPID_PRIVATE_KEY, VAPID_SUBJECT y PUSH_DISPATCH_SECRET, y en esta base los
-- dos secretos de Vault del punto 3):
--   1. public.push_subscriptions: una fila por navegador suscrito (endpoint
--      ÚNICO del servicio push, claves p256dh/auth del navegador, idioma de
--      los avisos y caducidad `expires_at` si el navegador la da). RLS: cada
--      persona ve, crea, cambia y borra SOLO las suyas; la demo, nada
--      (demo_no_*). CHECK en la propia tabla: el endpoint tiene que ser https
--      de un servicio push conocido (FCM, Mozilla, Apple, Windows), así nadie
--      puede apuntar el servidor a otra URL (SSRF) ni escribiendo directamente
--      con la API de Supabase. Se borran con la cuenta (cascada).
--   2. public.push_on_event(): trigger AFTER en messages (mensaje nuevo),
--      notifications (recomendación e invitaciones) y friendships (solicitud
--      nueva y solicitud aceptada). Si alguno de los destinatarios tiene una
--      suscripción, encola con pg_net una llamada a /api/push/dispatch con
--      {kind, id} (nunca el contenido). pg_net la manda DESPUÉS del commit y
--      en segundo plano: la petición que crea el mensaje no espera ni puede
--      fallar por esto (cualquier error se queda en un WARNING).
--      Sin pg_net, sin los secretos o sin suscripciones, no hace nada.
--   3. Configuración (la pone Víctor, NO va en el repo):
--        select vault.create_secret('https://kulturaapp.vercel.app/api/push/dispatch',
--                                   'push_dispatch_url', 'F-33 push');
--        select vault.create_secret('<el mismo valor que PUSH_DISPATCH_SECRET>',
--                                   'push_dispatch_secret', 'F-33 push');
--      Para cambiarlos: select vault.update_secret(id, '<nuevo>') from
--      vault.secrets where name = 'push_dispatch_secret';
--   4. Vuelve a ejecutar el bloque demo_no_* (20261008000001) para cubrir la
--      tabla nueva.
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios.
-- Nombres verificados contra 20260502233945_remote_schema.sql (users,
-- messages, conversation_members, notifications, friendships,
-- set_updated_at) y 20261008000001_demo_read_only.sql (is_demo_session).
--
-- CÓMO APLICARLA (Víctor): SQL Editor del proyecto de TEST → pegar entero →
-- Run; repetir en producción. Después, los dos `vault.create_secret` del
-- punto 3 (en producción con la URL de producción).
--
-- COMPROBACIÓN (SQL Editor, tras aplicarla):
--   select extname from pg_extension where extname = 'pg_net';   -- 1 fila
--   select rowsecurity from pg_tables
--    where schemaname = 'public' and tablename = 'push_subscriptions';  -- true
--   select policyname, cmd, permissive from pg_policies
--    where tablename = 'push_subscriptions' order by 1;
--     -- 4 push_subscriptions_*_own (PERMISSIVE) + 3 demo_no_* (RESTRICTIVE)
--   select tgname from pg_trigger where tgname like 'push_on_%' order by 1;
--     -- push_on_friendship, push_on_message, push_on_notification
--   select has_function_privilege('authenticated', 'public.push_on_event()', 'execute');  -- f
--   select name from vault.secrets where name like 'push_dispatch_%';  -- 2 filas
--   select * from public.rls_audit() where not ok;                     -- 0 filas
--   -- Tras mandar un mensaje a alguien con push activado (respuesta de /dispatch):
--   select status_code, content::text from net._http_response order by created desc limit 5;
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ── 1. Suscripciones (una por navegador) ─────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  locale text not null default 'es',
  expires_at timestamptz,
  failures smallint not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Restricciones reconstruidas siempre: una versión anterior de este archivo
-- converge a esta.
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key unique (endpoint);

-- Misma lista que src/lib/push/endpoint.ts (PUSH_SERVICE_HOSTS).
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_check;
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_check
  check (
    char_length(endpoint) <= 1024
    and endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)/[!-~]+$'
  );

-- Clave pública P-256 sin comprimir (65 bytes) y secreto de 16 bytes, en base64url sin relleno.
alter table public.push_subscriptions drop constraint if exists push_subscriptions_keys_check;
alter table public.push_subscriptions add constraint push_subscriptions_keys_check
  check (p256dh ~ '^B[A-Za-z0-9_-]{86}$' and auth ~ '^[A-Za-z0-9_-]{22}$');

alter table public.push_subscriptions drop constraint if exists push_subscriptions_locale_check;
alter table public.push_subscriptions add constraint push_subscriptions_locale_check
  check (locale in ('es', 'en'));

alter table public.push_subscriptions drop constraint if exists push_subscriptions_failures_check;
alter table public.push_subscriptions add constraint push_subscriptions_failures_check
  check (failures >= 0);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id, updated_at desc);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

comment on table public.push_subscriptions is
  'F-33: suscripciones Web Push (una por navegador). Las escribe /api/push/subscribe; las caducadas (404/410 del servicio push o expires_at vencido) las borra /api/push/dispatch.';


-- ── 2. Aviso al servidor cuando hay algo que notificar ──────────────────
create or replace function public.push_on_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_recipients uuid[];
  v_url text;
  v_secret text;
begin
  if tg_table_name = 'messages' then
    v_kind := 'message';
    select array_agg(cm.user_id) into v_recipients
      from public.conversation_members cm
     where cm.conversation_id = new.conversation_id
       and cm.user_id <> new.sender_id;
  elsif tg_table_name = 'notifications' then
    v_kind := 'notification';
    v_recipients := array[new.user_id];
  elsif tg_table_name = 'friendships' then
    if tg_op = 'INSERT' and new.status = 'pending' then
      v_kind := 'friend_request';
      v_recipients := array[new.receiver_id];
    elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
      v_kind := 'friend_accepted';
      v_recipients := array[new.requester_id];
    else
      return null;
    end if;
  else
    return null;
  end if;

  -- Nadie a quien avisar con push: ni una llamada.
  if v_recipients is null or not exists (
    select 1 from public.push_subscriptions s where s.user_id = any (v_recipients)
  ) then
    return null;
  end if;

  -- Sin pg_net o sin Vault (p. ej. una base local) no hay envío.
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
     or to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;

  select ds.decrypted_secret into v_url
    from vault.decrypted_secrets ds where ds.name = 'push_dispatch_url' limit 1;
  select ds.decrypted_secret into v_secret
    from vault.decrypted_secrets ds where ds.name = 'push_dispatch_secret' limit 1;
  if v_url is null or v_url !~ '^https://[^/]+/api/push/dispatch$'
     or v_secret is null or char_length(v_secret) < 32 then
    return null;
  end if;

  -- Solo el tipo y el id: el servidor vuelve a leer la fila y decide.
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('kind', v_kind, 'id', new.id),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  -- Nunca bloquea el mensaje, la notificación ni la amistad.
  raise warning 'push_on_event(%): %', tg_table_name, sqlerrm;
  return null;
end
$$;

-- Los triggers no necesitan EXECUTE; nadie la puede llamar por la API.
revoke all on function public.push_on_event() from public, anon, authenticated;

comment on function public.push_on_event() is
  'F-33: encola (pg_net, tras el commit) un POST a /api/push/dispatch con {kind, id} si algún destinatario tiene push. URL y secreto en Vault: push_dispatch_url, push_dispatch_secret.';

create or replace trigger push_on_message
  after insert on public.messages
  for each row execute function public.push_on_event();

create or replace trigger push_on_notification
  after insert on public.notifications
  for each row execute function public.push_on_event();

create or replace trigger push_on_friendship
  after insert or update of status on public.friendships
  for each row execute function public.push_on_event();


-- ── 3. Demo de solo lectura también en la tabla nueva (copia de 20261008000001) ─
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
