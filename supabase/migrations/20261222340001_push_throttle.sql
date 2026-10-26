-- ============================================================
-- F-33 (remate) · Notificaciones push: un aviso por ráfaga y antigüedad de
-- las amistades aceptadas
--
-- REQUISITO: 20261222330001_push.sql aplicada antes (si no, este archivo se
-- para con un error que lo dice y no cambia nada).
--
-- QUÉ HACE (el código funciona antes y después de aplicarla):
--   1. messages.created_at la pone el servidor. Un INSERT hecho con la API de
--      Supabase (rol authenticated) podía traer su propia fecha: mensajes con
--      fecha antigua o futura en el chat y, sobre todo, una forma de saltarse
--      el límite de avisos del punto 3. Ahora un trigger BEFORE INSERT la fija
--      en la hora del servidor (clock_timestamp) para anon y authenticated
--      (el service role, p. ej. la semilla de la demo, puede seguir poniéndola).
--      Índice nuevo (conversation_id, sender_id, created_at): lo usa el
--      límite de avisos y el último mensaje de cada chat.
--   2. friendships.accepted_at (nuevo, nulo hasta aceptar): cuándo se aceptó.
--      La tabla no tiene updated_at y created_at es la fecha de la SOLICITUD
--      (puede tener semanas). Lo rellena un trigger BEFORE: al pasar a
--      'accepted', now(); si vuelve a otro estado, null. Nadie puede ponerlo a
--      mano: authenticated solo tiene UPDATE en `status` (20261023020001) y en
--      un INSERT el trigger lo pisa. También created_at de una solicitud nueva
--      lo pone el servidor. /api/push/dispatch solo avisa de una amistad
--      aceptada si accepted_at es de los últimos 10 minutos (las aceptadas
--      antes de esta migración quedan en null: no se avisan).
--   3. push_on_event(): igual que en 20261222330001 y, para los mensajes, un
--      aviso por ráfaga: si el MISMO remitente ya escribió en esa conversación
--      dentro del mismo tramo de 30 s (tramos fijos: :00-:29, :30-:59), no se
--      encola otra llamada a /api/push/dispatch. Así quien escribe mensajes en
--      bucle directamente contra la API como mucho provoca un aviso cada 30 s
--      por conversación, y una conversación con dos personas que se contestan
--      sigue avisando a cada una. En un INSERT de varias filas a la vez solo
--      avisa la primera (por id). /api/push/dispatch aplica la misma regla
--      (src/lib/push/dispatch.ts, PUSH_MESSAGE_BURST_SECONDS) por si la base
--      aún tiene la función anterior.
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios.
-- Nombres verificados contra 20260502233945_remote_schema.sql (messages,
-- friendships y sus columnas), 20261023020001_harden_rls.sql (grant update
-- (status) en friendships) y 20261222330001_push.sql (push_on_event,
-- push_subscriptions, secretos de Vault).
--
-- CÓMO APLICARLA (Víctor): SQL Editor del proyecto de TEST → pegar entero →
-- Run; repetir en producción. Siempre DESPUÉS de 20261222330001.
--
-- COMPROBACIÓN (SQL Editor, tras aplicarla):
--   select tgname from pg_trigger
--    where tgname in ('messages_server_time', 'friendships_track_accepted_at') order by 1;  -- 2 filas
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'friendships' and column_name = 'accepted_at';  -- 1 fila
--   select indexname from pg_indexes where indexname = 'messages_conversation_sender_created_idx';  -- 1 fila
--   select position('PUSH_MESSAGE_BURST' in prosrc) > 0 from pg_proc where proname = 'push_on_event';  -- t
--   select * from public.rls_audit() where not ok;                                         -- 0 filas
--   -- Tres mensajes seguidos a alguien con push: en net._http_response aparece 1 llamada, no 3.
-- ============================================================

do $$
begin
  if to_regclass('public.push_subscriptions') is null
     or to_regprocedure('public.push_on_event()') is null then
    raise exception 'Aplica antes 20261222330001_push.sql (falta push_subscriptions o push_on_event)';
  end if;
end
$$;


-- ── 1. La fecha de un mensaje la pone el servidor ────────────────────────
create or replace function public.messages_server_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    -- clock_timestamp() y no now(): dos mensajes de la misma transacción (o de
    -- un INSERT de varias filas) no comparten fecha y el orden del chat es el real.
    new.created_at := clock_timestamp();
  end if;
  return new;
end
$$;

revoke all on function public.messages_server_time() from public, anon, authenticated;

comment on function public.messages_server_time() is
  'F-33: messages.created_at = clock_timestamp() en los INSERT de anon/authenticated (nadie fecha sus mensajes ni se salta el límite de avisos push).';

create or replace trigger messages_server_time
  before insert on public.messages
  for each row execute function public.messages_server_time();

create index if not exists messages_conversation_sender_created_idx
  on public.messages (conversation_id, sender_id, created_at);


-- ── 2. Cuándo se aceptó una amistad ──────────────────────────────────────
alter table public.friendships add column if not exists accepted_at timestamptz;

comment on column public.friendships.accepted_at is
  'F-33: cuándo pasó a accepted (lo pone el trigger friendships_track_accepted_at; null en las aceptadas antes de 20261222340001).';

create or replace function public.friendships_track_accepted_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client boolean := current_user in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    if v_client then
      new.created_at := now();
    end if;
    if new.status = 'accepted' then
      new.accepted_at := case when v_client then now() else coalesce(new.accepted_at, now()) end;
    else
      new.accepted_at := null;
    end if;
  elsif new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  elsif new.status is distinct from 'accepted' then
    new.accepted_at := null;
  end if;
  return new;
end
$$;

revoke all on function public.friendships_track_accepted_at() from public, anon, authenticated;

comment on function public.friendships_track_accepted_at() is
  'F-33: friendships.accepted_at = now() al aceptar, null si no está aceptada; created_at de una solicitud nueva = now().';

create or replace trigger friendships_track_accepted_at
  before insert or update of status on public.friendships
  for each row execute function public.friendships_track_accepted_at();


-- ── 3. Aviso al servidor, con un aviso por ráfaga en los mensajes ────────
-- Copia de 20261222330001 salvo el bloque marcado PUSH_MESSAGE_BURST.
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
    -- PUSH_MESSAGE_BURST (30 s, igual que src/lib/push/dispatch.ts): si el
    -- mismo remitente ya escribió en esta conversación en este tramo de 30 s,
    -- ese mensaje ya avisó. Empate de fecha (INSERT de varias filas): avisa el
    -- de id menor.
    if exists (
      select 1
        from public.messages p
       where p.conversation_id = new.conversation_id
         and p.sender_id = new.sender_id
         and p.id <> new.id
         and p.created_at >= to_timestamp(floor(extract(epoch from new.created_at) / 30) * 30)
         and (p.created_at < new.created_at or (p.created_at = new.created_at and p.id < new.id))
    ) then
      return null;
    end if;
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

revoke all on function public.push_on_event() from public, anon, authenticated;

comment on function public.push_on_event() is
  'F-33: encola (pg_net, tras el commit) un POST a /api/push/dispatch con {kind, id} si algún destinatario tiene push; en mensajes, uno por remitente, conversación y tramo de 30 s. URL y secreto en Vault: push_dispatch_url, push_dispatch_secret.';

notify pgrst, 'reload schema';
