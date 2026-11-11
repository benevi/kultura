-- ============================================================
-- KULTURA — Saneamiento, fase 3: integridad e índices
-- (docs/PLAN_SANEAMIENTO.md, fase 3; decisión Q15)
--
-- El código funciona antes y después de aplicarla. Es idempotente: se puede
-- volver a ejecutar sin errores. En producción no hay duplicados (comprobado
-- el 11-11-2026), así que las restricciones únicas entran sin deduplicar.
--
-- QUÉ HACE:
--   1. Restricciones únicas:
--      · friendships: una sola fila por pareja, en cualquier sentido.
--      · list_items: un título una sola vez por lista.
--      · conversations: una sola conversación por pareja. La pareja se
--        guarda ordenada (user_low < user_high) y la RPC
--        create_conversation_with_members la rellena y la respeta aunque
--        dos peticiones lleguen a la vez.
--   2. user_media.media_id con ON DELETE CASCADE, igual que user_media_logs.
--   3. Índices para las consultas frecuentes y para cada clave foránea sin
--      índice que avisa el linter de Supabase (borrar un usuario o una ficha
--      no recorre tablas enteras).
--
-- media_translations y media_adaptations son cachés por id de proveedor: no
-- llevan clave foránea a media (Q15).
-- ============================================================


-- ── 1. Restricciones únicas ──────────────────────────────────────────────
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, receiver_id), greatest(requester_id, receiver_id));

create unique index if not exists list_items_list_media_key
  on public.list_items (list_id, media_id);

alter table public.conversations
  add column if not exists user_low uuid references public.users(id) on delete set null,
  add column if not exists user_high uuid references public.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_pair_order_check') then
    alter table public.conversations
      add constraint conversations_pair_order_check check (user_low < user_high);
  end if;
end
$$;

-- Las conversaciones que ya existen: la pareja sale de sus dos miembros.
update public.conversations c
   set user_low = p.lo, user_high = p.hi
  from (
    select conversation_id, min(user_id::text)::uuid lo, max(user_id::text)::uuid hi
      from public.conversation_members
     group by conversation_id
    having count(*) = 2
  ) p
 where c.id = p.conversation_id
   and c.user_low is null
   and c.user_high is null;

create unique index if not exists conversations_pair_key
  on public.conversations (user_low, user_high);

create or replace function public.create_conversation_with_members(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller        uuid;
  v_conversation  uuid;
  v_low           uuid;
  v_high          uuid;
begin
  v_caller := auth.uid();

  if v_caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if target_user_id is null then
    raise exception 'missing_target_user_id' using errcode = 'P0002';
  end if;

  if v_caller = target_user_id then
    raise exception 'cannot_message_yourself' using errcode = 'P0003';
  end if;

  if not exists (select 1 from users where id = target_user_id) then
    raise exception 'target_user_not_found' using errcode = 'P0004';
  end if;

  v_low  := least(v_caller, target_user_id);
  v_high := greatest(v_caller, target_user_id);

  -- Dedupe: una conversación previa entre los dos se sigue devolviendo
  -- (se puede leer); escribir en ella lo decide la política de messages.
  select id into v_conversation
    from conversations
   where user_low = v_low and user_high = v_high;

  if v_conversation is null then
    -- Anteriores a la pareja ordenada (sin rellenar).
    select cm1.conversation_id into v_conversation
      from conversation_members cm1
      join conversation_members cm2
        on cm1.conversation_id = cm2.conversation_id
       and cm2.user_id = target_user_id
     where cm1.user_id = v_caller
     limit 1;
  end if;

  if v_conversation is not null then
    return v_conversation;
  end if;

  -- Solo amigos aceptados y sin bloqueo abren una conversación nueva. El
  -- bloqueo da el mismo error que "no sois amigos" para no revelarlo.
  if not exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = v_caller and receiver_id = target_user_id)
        or (requester_id = target_user_id and receiver_id = v_caller))
  ) or exists (
    select 1 from blocks
    where (blocker_id = v_caller and blocked_id = target_user_id)
       or (blocker_id = target_user_id and blocked_id = v_caller)
  ) then
    raise exception 'not_friends' using errcode = 'P0005';
  end if;

  -- Dos peticiones a la vez: la segunda choca con conversations_pair_key y
  -- devuelve la de la primera.
  insert into conversations (user_low, user_high)
  values (v_low, v_high)
  on conflict (user_low, user_high) do nothing
  returning id into v_conversation;

  if v_conversation is null then
    select id into v_conversation
      from conversations
     where user_low = v_low and user_high = v_high;
    return v_conversation;
  end if;

  insert into conversation_members (conversation_id, user_id)
  values
    (v_conversation, v_caller),
    (v_conversation, target_user_id);

  return v_conversation;
end;
$$;

revoke all on function public.create_conversation_with_members(uuid) from public, anon;
grant execute on function public.create_conversation_with_members(uuid) to authenticated, service_role;


-- ── 2. user_media.media_id con cascada ───────────────────────────────────
alter table public.user_media drop constraint if exists user_media_media_id_fkey;
alter table public.user_media
  add constraint user_media_media_id_fkey
  foreign key (media_id) references public.media(id) on delete cascade;


-- ── 3. Índices ───────────────────────────────────────────────────────────
-- Consultas frecuentes
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists group_posts_group_created_idx on public.group_posts (group_id, created_at);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists lists_owner_idx on public.lists (owner_id);
create index if not exists media_mal_id_idx on public.media ((metadata->>'malId'));

-- Claves foráneas sin índice (linter 0001_unindexed_foreign_keys)
create index if not exists friendships_receiver_idx on public.friendships (receiver_id);
create index if not exists user_media_media_idx on public.user_media (media_id);
create index if not exists user_media_logs_media_idx on public.user_media_logs (media_id);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id);
create index if not exists group_members_user_idx on public.group_members (user_id);
create index if not exists list_members_user_idx on public.list_members (user_id);
create index if not exists recommendations_to_user_idx on public.recommendations (to_user_id);
create index if not exists recommendations_from_user_idx on public.recommendations (from_user_id);
create index if not exists recommendations_media_idx on public.recommendations (media_id);
create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists group_invitations_invitee_idx on public.group_invitations (invitee_id);
create index if not exists group_invitations_inviter_idx on public.group_invitations (inviter_id);
create index if not exists group_bans_user_idx on public.group_bans (user_id);
create index if not exists group_bans_banned_by_idx on public.group_bans (banned_by);
create index if not exists group_posts_user_idx on public.group_posts (user_id);
create index if not exists group_posts_media_idx on public.group_posts (media_id);
create index if not exists groups_owner_idx on public.groups (owner_id);
create index if not exists list_items_added_by_idx on public.list_items (added_by);
create index if not exists list_items_media_idx on public.list_items (media_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists suggestions_user_idx on public.suggestions (user_id);
create index if not exists conversations_user_high_idx on public.conversations (user_high);
