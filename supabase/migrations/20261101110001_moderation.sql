-- ============================================================
-- F-11 · Moderación y seguridad social (D-13, ROJO-3, R5)
--
-- QUÉ HACE (se aplica DESPUÉS de 20261023020001_harden_rls.sql y
-- 20261023030001_media_server_only.sql; usa sus nombres literales):
--   1. blocks(blocker_id, blocked_id): bloquear a alguien. CHECK
--      blocker_id <> blocked_id. Al bloquear, un disparador borra la amistad
--      (cualquier estado) y las invitaciones a grupo pendientes entre los dos.
--      Solo quien bloquea ve su fila; el bloqueado no sabe quién le bloquea.
--   2. messages: INSERT solo si el remitente es miembro, hay al menos otro
--      miembro y con TODOS los demás hay amistad aceptada y ningún bloqueo en
--      ningún sentido (public.can_send_message). DELETE de lo propio.
--   3. conversation_members: DELETE propio (salir del chat). Cuando sale el
--      último miembro, la conversación y sus mensajes se borran.
--   4. friendships: el INSERT (solicitud) se rechaza si hay bloqueo en
--      cualquier sentido. recommendations: igual.
--   5. create_conversation_with_members: no abre conversación nueva si hay
--      bloqueo (mismo error 'not_friends', para no revelar el bloqueo).
--   6. Grupos: el dueño borra posts ajenos y expulsa miembros (nunca a sí
--      mismo ni a un 'owner'). group_bans: un expulsado no vuelve a entrar
--      por su cuenta en un grupo público (el dueño puede volver a invitarlo).
--   7. reports: target_type user|media|message|group_post|group|list,
--      reporter_id NULL permitido (formulario público, lo inserta el servidor
--      con el service role), contact_email, resolved_at y resolution. Con
--      sesión: INSERT propio sin resolver y SELECT de las propias. anon no lee
--      ni escribe nada.
--   8. Funciones SECURITY DEFINER con search_path fijo, sin EXECUTE para
--      PUBLIC/anon. Solo responden sobre el usuario que pregunta (auth.uid()),
--      así que no sirven para averiguar bloqueos entre terceros.
--   9. Vuelve a ejecutar el bloque demo_no_* al final (blocks y group_bans).
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios.
-- El código desplegado funciona antes y después; tras aplicarla, activar
-- MODERATION_V2=1 en Vercel (sin la bandera la UI oculta bloquear, salir,
-- expulsar y los tipos nuevos de denuncia).
--
-- ANTES DE APLICAR (SQL Editor, primero en el proyecto de TEST):
--   Tienen que estar aplicadas las de W1. El bloque de guarda lo comprueba y
--   aborta TODO si falta algo o si hay políticas que no están en el repo.
--
-- DESPUÉS DE APLICAR, comprobación (todas deben dar lo indicado):
--   select * from public.rls_audit() where not ok;                      -- 0 filas
--   select policyname from pg_policies where schemaname = 'public'
--     and cmd in ('INSERT','UPDATE') and with_check is null;           -- 0 filas
--   select count(*) from pg_policies where schemaname = 'public'
--     and tablename in ('blocks','group_bans')
--     and policyname like 'demo_no_%';                                  -- 6
--   select pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'reports_target_type_check';                      -- incluye 'list'
--   curl "https://<ref>.supabase.co/rest/v1/reports?select=id&limit=1" \
--     -H "apikey: <clave anónima>"                                      -- 401/permiso denegado o []
-- ============================================================


-- ── 0. Guarda: W1 aplicada y sin políticas desconocidas ──────────────────
-- Para aplicarla a sabiendas de la deriva (solo si el frente lo indica):
--   set kultura.f11_allow_drift = 'on';   antes de pegar el archivo.
do $guard$
declare
  missing text[] := '{}';
  unknown text[] := '{}';
  known constant text[] := array[
    'messages.Members can send messages',
    'messages.Members can view messages',
    'messages.Senders can delete own messages',
    'conversation_members.Users can update their own read status',
    'conversation_members.Users can view conversation members they belong to',
    'conversation_members.Users can leave conversations',
    'group_posts.Group members can post',
    'group_posts.Group members can view posts',
    'group_posts.Post authors can delete their posts',
    'group_posts.Group owners can delete posts',
    'group_members.Group owners can manage members',
    'group_members.Members can view group membership',
    'group_members.Users can join groups',
    'group_members.Users can leave groups',
    'group_members.Group owners can remove members',
    'friendships.friendships_delete_own',
    'friendships.friendships_insert_as_requester',
    'friendships.friendships_select_own',
    'friendships.friendships_update_as_receiver',
    'recommendations.recommendations_insert_as_sender',
    'recommendations.recommendations_select_own',
    'recommendations.recommendations_update_as_receiver',
    'reports.reports_insert_auth',
    'reports.reports_select_own'
  ];
  tbl text;
  r record;
begin
  foreach tbl in array array['users','friendships','group_invitations','group_members','groups',
                             'group_posts','conversations','conversation_members','messages',
                             'recommendations','reports'] loop
    if to_regclass('public.' || tbl) is null then missing := missing || ('tabla ' || tbl); end if;
  end loop;

  foreach tbl in array array['public.is_group_owner(uuid,uuid)','public.is_conversation_member(uuid,uuid)',
                             'public.is_demo_session()','public.create_conversation_with_members(uuid)',
                             'public.rls_audit()'] loop
    if to_regprocedure(tbl) is null then missing := missing || ('función ' || tbl); end if;
  end loop;

  -- La de F-02 quita esta política; si sigue, W1 no está aplicada.
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename = 'conversation_members' and policyname = 'Users can join conversations') then
    missing := missing || 'migración 20261023020001_harden_rls.sql';
  end if;

  if array_length(missing, 1) > 0 then
    raise exception 'F-11 moderation: falta aplicar antes: %', array_to_string(missing, ', ');
  end if;

  for r in
    select tablename || '.' || policyname as k, cmd, permissive
      from pg_policies
     where schemaname = 'public'
       and tablename in ('messages','conversation_members','group_posts','group_members',
                         'friendships','recommendations','reports')
       and policyname not in ('demo_no_insert','demo_no_update','demo_no_delete')
  loop
    if not (r.k = any(known)) then
      unknown := unknown || (r.k || ' (' || r.cmd || ', ' || r.permissive || ')');
    end if;
  end loop;

  if array_length(unknown, 1) > 0 then
    if coalesce(current_setting('kultura.f11_allow_drift', true), '') = 'on' then
      raise notice 'F-11 moderation: políticas fuera del repo (se dejan tal cual): %', array_to_string(unknown, ', ');
    else
      raise exception 'F-11 moderation: hay políticas en la base que no están en las migraciones del repo: %. No se ha aplicado nada; pásaselas al frente F-11.',
        array_to_string(unknown, ', ');
    end if;
  end if;
end
$guard$;


-- ── 1. blocks ────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'blocks_not_self' and conrelid = 'public.blocks'::regclass) then
    alter table public.blocks add constraint blocks_not_self check (blocker_id <> blocked_id);
  end if;
end $$;

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

revoke all on public.blocks from anon;
revoke update, truncate on public.blocks from authenticated;
grant select, insert, delete on public.blocks to authenticated;

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own" on public.blocks
  for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks
  for insert to authenticated
  with check (blocker_id = auth.uid() and blocker_id <> blocked_id);

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own" on public.blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

-- ¿Hay un bloqueo entre quien pregunta y p_other, en cualquier sentido?
-- Solo sobre auth.uid(): no sirve para mirar bloqueos entre terceros.
create or replace function public.has_block_with(p_other uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.blocks b
     where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
        or (b.blocker_id = p_other and b.blocked_id = auth.uid())
  );
$$;
revoke all on function public.has_block_with(uuid) from public, anon;
grant execute on function public.has_block_with(uuid) to authenticated, service_role;

-- Bloquear corta la amistad y las invitaciones pendientes entre los dos.
create or replace function public.handle_new_block()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.friendships
   where (requester_id = new.blocker_id and receiver_id = new.blocked_id)
      or (requester_id = new.blocked_id and receiver_id = new.blocker_id);
  delete from public.group_invitations
   where status = 'pending'
     and ((inviter_id = new.blocker_id and invitee_id = new.blocked_id)
       or (inviter_id = new.blocked_id and invitee_id = new.blocker_id));
  return new;
end;
$$;
alter function public.handle_new_block() owner to postgres;
revoke all on function public.handle_new_block() from public, anon, authenticated;
create or replace trigger on_block_created
  after insert on public.blocks
  for each row execute function public.handle_new_block();


-- ── 2. messages: escribir solo con amistad vigente y sin bloqueo ─────────
create or replace function public.can_send_message(p_conversation_id uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp
as $$
  select
    exists (select 1 from public.conversation_members m
             where m.conversation_id = p_conversation_id and m.user_id = auth.uid())
    and exists (select 1 from public.conversation_members o
                 where o.conversation_id = p_conversation_id and o.user_id <> auth.uid())
    and not exists (
      select 1 from public.conversation_members o
       where o.conversation_id = p_conversation_id
         and o.user_id <> auth.uid()
         and (
           not exists (
             select 1 from public.friendships f
              where f.status = 'accepted'
                and ((f.requester_id = auth.uid() and f.receiver_id = o.user_id)
                  or (f.receiver_id = auth.uid() and f.requester_id = o.user_id))
           )
           or exists (
             select 1 from public.blocks b
              where (b.blocker_id = auth.uid() and b.blocked_id = o.user_id)
                 or (b.blocker_id = o.user_id and b.blocked_id = auth.uid())
           )
         )
    );
$$;
revoke all on function public.can_send_message(uuid) from public, anon;
grant execute on function public.can_send_message(uuid) to authenticated, service_role;

drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.can_send_message(conversation_id));

drop policy if exists "Senders can delete own messages" on public.messages;
create policy "Senders can delete own messages" on public.messages
  for delete to authenticated
  using (sender_id = auth.uid());

revoke update on public.messages from anon, authenticated;


-- ── 3. conversation_members: salir del chat ──────────────────────────────
drop policy if exists "Users can leave conversations" on public.conversation_members;
create policy "Users can leave conversations" on public.conversation_members
  for delete to authenticated
  using (user_id = auth.uid());

-- Cuando ya no queda nadie, la conversación (y sus mensajes, en cascada) se borra.
create or replace function public.handle_conversation_member_left()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.conversation_members where conversation_id = old.conversation_id) then
    delete from public.conversations where id = old.conversation_id;
  end if;
  return old;
end;
$$;
alter function public.handle_conversation_member_left() owner to postgres;
revoke all on function public.handle_conversation_member_left() from public, anon, authenticated;
create or replace trigger on_conversation_member_left
  after delete on public.conversation_members
  for each row execute function public.handle_conversation_member_left();


-- ── 4. friendships y recommendations: nada con quien hay bloqueo ─────────
-- Mismo cuerpo que F-02 (20261023020001) + la comprobación de bloqueo.
drop policy if exists "friendships_insert_as_requester" on public.friendships;
create policy "friendships_insert_as_requester" on public.friendships
  for insert to authenticated
  with check (
    auth.uid() = requester_id
    and status = 'pending'
    and requester_id <> receiver_id
    and not public.has_block_with(receiver_id)
  );

drop policy if exists "recommendations_insert_as_sender" on public.recommendations;
create policy "recommendations_insert_as_sender" on public.recommendations
  for insert to authenticated
  with check (auth.uid() = from_user_id and not public.has_block_with(to_user_id));


-- ── 5. RPC de conversación: sin conversación nueva si hay bloqueo ────────
create or replace function public.create_conversation_with_members(
  target_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller        uuid;
  v_conversation  uuid;
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

  -- Dedupe: una conversación previa entre los dos se sigue devolviendo
  -- (se puede leer); escribir en ella lo decide la política de messages.
  select cm1.conversation_id into v_conversation
  from conversation_members cm1
  inner join conversation_members cm2
    on cm1.conversation_id = cm2.conversation_id
   and cm2.user_id = target_user_id
  where cm1.user_id = v_caller
  limit 1;

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

  insert into conversations default values
  returning id into v_conversation;

  insert into conversation_members (conversation_id, user_id)
  values
    (v_conversation, v_caller),
    (v_conversation, target_user_id);

  return v_conversation;
end;
$$;
revoke all on function public.create_conversation_with_members(uuid) from public, anon;
grant execute on function public.create_conversation_with_members(uuid) to authenticated, service_role;


-- ── 6. Grupos: moderación del dueño ──────────────────────────────────────
drop policy if exists "Group owners can delete posts" on public.group_posts;
create policy "Group owners can delete posts" on public.group_posts
  for delete to authenticated
  using (public.is_group_owner(group_id, auth.uid()));

drop policy if exists "Group owners can remove members" on public.group_members;
create policy "Group owners can remove members" on public.group_members
  for delete to authenticated
  using (
    public.is_group_owner(group_id, auth.uid())
    and user_id <> auth.uid()
    and role <> 'owner'
  );

create table if not exists public.group_bans (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  banned_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_bans enable row level security;

revoke all on public.group_bans from anon;
revoke update, truncate on public.group_bans from authenticated;
grant select, insert, delete on public.group_bans to authenticated;

drop policy if exists "group_bans_select_owner" on public.group_bans;
create policy "group_bans_select_owner" on public.group_bans
  for select to authenticated
  using (public.is_group_owner(group_id, auth.uid()));

drop policy if exists "group_bans_insert_owner" on public.group_bans;
create policy "group_bans_insert_owner" on public.group_bans
  for insert to authenticated
  with check (
    banned_by = auth.uid()
    and user_id <> auth.uid()
    and public.is_group_owner(group_id, auth.uid())
    and not public.is_group_owner(group_id, user_id)
  );

drop policy if exists "group_bans_delete_owner" on public.group_bans;
create policy "group_bans_delete_owner" on public.group_bans
  for delete to authenticated
  using (public.is_group_owner(group_id, auth.uid()));

-- ¿Quien pregunta está vetado en el grupo? (solo sobre auth.uid())
create or replace function public.is_banned_from_group(p_group_id uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.group_bans b
                  where b.group_id = p_group_id and b.user_id = auth.uid());
$$;
revoke all on function public.is_banned_from_group(uuid) from public, anon;
grant execute on function public.is_banned_from_group(uuid) to authenticated, service_role;

-- Vetar expulsa (si era miembro) y retira sus invitaciones pendientes.
create or replace function public.handle_new_group_ban()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.group_members
   where group_id = new.group_id and user_id = new.user_id and role <> 'owner';
  delete from public.group_invitations
   where group_id = new.group_id and invitee_id = new.user_id and status = 'pending';
  return new;
end;
$$;
alter function public.handle_new_group_ban() owner to postgres;
revoke all on function public.handle_new_group_ban() from public, anon, authenticated;
create or replace trigger on_group_ban_created
  after insert on public.group_bans
  for each row execute function public.handle_new_group_ban();

-- Mismo cuerpo que 20260601000001_add_group_visibility + el veto.
drop policy if exists "Users can join groups" on public.group_members;
create policy "Users can join groups" on public.group_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (select 1 from public.groups g where g.id = group_members.group_id and g.is_public)
    and not public.is_banned_from_group(group_id)
  );


-- ── 7. reports ───────────────────────────────────────────────────────────
alter table public.reports alter column reporter_id drop not null;
alter table public.reports add column if not exists contact_email text;
alter table public.reports add column if not exists resolved_at timestamptz;
alter table public.reports add column if not exists resolution text;

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type = any (array['user', 'media', 'message', 'group_post', 'group', 'list']));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reports_reporter_or_contact' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_reporter_or_contact
      check (reporter_id is not null or contact_email is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_reason_length' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_reason_length
      check (reason is null or char_length(reason) <= 2100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_target_id_length' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_target_id_length
      check (char_length(target_id) <= 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_contact_email_format' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_contact_email_format
      check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_resolution_length' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_resolution_length
      check (resolution is null or char_length(resolution) <= 2000) not valid;
  end if;
end $$;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.reports'::regclass and not convalidated
       and conname in ('reports_reporter_or_contact','reports_reason_length','reports_target_id_length',
                       'reports_contact_email_format','reports_resolution_length')
  loop
    begin
      execute format('alter table public.reports validate constraint %I', c.conname);
    exception when check_violation then
      raise notice 'F-11: % se queda NOT VALID: hay filas antiguas que no la cumplen', c.conname;
    end;
  end loop;
end $$;

create index if not exists reports_open_idx on public.reports (created_at) where resolved_at is null;

-- anon no toca la tabla (el formulario público inserta con el service role).
revoke all on public.reports from anon;
revoke update, delete, truncate on public.reports from authenticated;
grant select, insert on public.reports to authenticated;

drop policy if exists "reports_insert_auth" on public.reports;
create policy "reports_insert_auth" on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and resolved_at is null and resolution is null);

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports
  for select to authenticated
  using (reporter_id = auth.uid());


-- ── 8. Demo de solo lectura en todas las tablas (copia de 20261008000001) ─
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
