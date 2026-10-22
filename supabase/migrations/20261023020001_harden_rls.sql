-- ============================================================
-- F-02 · RLS y permisos (harden_rls)
--
-- QUÉ HACE (solo restringe lo que la app no usa; el código funciona antes y
-- después de aplicarla):
--   1. friendships: INSERT solo 'pending', nunca consigo mismo (también CHECK
--      de tabla); UPDATE solo del receptor, solo pending → accepted y solo la
--      columna `status`.
--   2. group_invitations: INSERT solo del dueño, a un AMIGO, 'pending' y no a
--      sí mismo; UPDATE solo del invitado, pending → accepted y solo `status`;
--      el disparador rechaza cambios de group_id/inviter_id/invitee_id y el
--      paso accepted → pending (re-entrar tras salir del grupo).
--   3. conversation_members: fuera "Users can join conversations" (las altas
--      van por la RPC create_conversation_with_members); el UPDATE propio solo
--      toca `last_read_at` (antes se podía mover la fila a otra conversación).
--   4. users: UPDATE con el JWT solo de bio, avatar_icon, avatar_color y
--      preferred_locale (el nombre de usuario lo cambia /api/settings con el
--      cliente admin); anon solo lee las columnas públicas que usa /u.
--   5. user_media: la lee quien tiene sesión, nunca anon.
--   6. El dueño solo puede añadir a su lista o a su grupo a AMIGOS, y en el
--      grupo solo como 'member'.
--   7. recommendations: el receptor solo marca `read_at`; notifications: solo
--      `read_at` y política DELETE propia (rechazar invitación la borraba sin
--      efecto).
--   8. WITH CHECK explícito en todas las políticas UPDATE.
--   9. CHECK de longitud: users.bio ≤ 300, group_posts.content ≤ 2000,
--      messages.content ≤ 2000, groups.name ≤ 100, groups.description ≤ 500,
--      recommendations.message ≤ 1000, suggestions.subject ≤ 200,
--      suggestions.description ≤ 5000; formato de avatar_color y avatar_icon.
--      Se crean NOT VALID (no fallan por filas viejas) y se validan si se puede.
--  10. Funciones SECURITY DEFINER con `search_path = public, pg_temp`; anon ya
--      no ejecuta is_group_owner / is_group_member / is_conversation_member /
--      create_conversation_with_members ni las funciones de disparador; las
--      funciones nuevas ya no reciben el GRANT explícito a anon.
--  11. public.rls_audit(): informe por tabla (solo service_role) que usa la
--      suite de integración.
--  12. Vuelve a ejecutar el bloque demo_no_* de 20261008000001 al final.
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios.
--
-- ANTES DE APLICAR (Víctor, SQL Editor, primero en el proyecto de TEST):
--   1. Copia y ejecuta la COMPROBACIÓN PREVIA de abajo (solo lo que hay entre
--      /* y */). Debe devolver 0 filas. Las filas `dato_a_revisar` son solo
--      informativas; cualquier otra (`politica_desconocida`,
--      `politica_que_falta`, `columna_que_falta`, `funcion_que_falta`): para y
--      pásaselas al frente F-02.
--   2. Pega ESTE archivo entero y pulsa Run. Si en producción hay políticas
--      que no salen en las migraciones del repo, el bloque de guarda aborta
--      TODO (no se aplica nada) y dice cuáles son.
--
-- DESPUÉS DE APLICAR, comprobación:
--   select policyname from pg_policies where schemaname='public'
--     and cmd in ('INSERT','UPDATE') and with_check is null;      -- 0 filas
--   select * from public.rls_audit() where not ok;                 -- 0 filas
--   curl "https://<ref>.supabase.co/rest/v1/user_media?select=user_id&limit=1" \
--     -H "apikey: <clave anónima>"                                 -- []
-- ============================================================

/* ── COMPROBACIÓN PREVIA (copiar desde aquí) ──────────────────────────────
with conocidas(t, p, previa) as (values
  ('conversation_members','Users can join conversations',true),
  ('conversation_members','Users can update their own read status',true),
  ('conversation_members','Users can view conversation members they belong to',true),
  ('friendships','friendships_delete_own',true),
  ('friendships','friendships_insert_as_requester',true),
  ('friendships','friendships_select_own',true),
  ('friendships','friendships_update_as_receiver',true),
  ('group_invitations','group_invitations_delete_own',true),
  ('group_invitations','group_invitations_insert_as_owner',true),
  ('group_invitations','group_invitations_select_own',true),
  ('group_invitations','group_invitations_update_as_invitee',true),
  ('group_members','Group owners can manage members',true),
  ('group_members','Members can view group membership',true),
  ('group_members','Users can join groups',true),
  ('group_members','Users can leave groups',true),
  ('groups','Authenticated users can view groups',true),
  ('groups','Owners can delete groups',true),
  ('groups','Owners can update groups',true),
  ('groups','Users can create groups',true),
  ('list_members','list_members_delete_owner_or_self',true),
  ('list_members','list_members_insert_owner',true),
  ('list_members','list_members_select_readable',true),
  ('lists','lists_delete_own',true),
  ('lists','lists_insert_own',true),
  ('lists','lists_select_readable',true),
  ('lists','lists_update_own',true),
  ('notifications','notifications_select_own',true),
  ('notifications','notifications_update_own',true),
  ('notifications','notifications_delete_own',false),
  ('recommendations','recommendations_insert_as_sender',true),
  ('recommendations','recommendations_select_own',true),
  ('recommendations','recommendations_update_as_receiver',true),
  ('user_media','user_media_delete_own',true),
  ('user_media','user_media_insert_own',true),
  ('user_media','user_media_select_public',true),
  ('user_media','user_media_select_authenticated',false),
  ('user_media','user_media_update_own',true),
  ('users','users_select_public',true),
  ('users','users_update_own',true),
  ('users','users can update own profile',false)
), tablas as (select distinct t from conocidas),
reales as (
  select tablename::text t, policyname::text p, cmd, permissive
  from pg_policies where schemaname = 'public' and tablename in (select t from tablas)
), columnas(t, c) as (values
  ('users','id'),('users','username'),('users','avatar_color'),('users','avatar_initials'),
  ('users','avatar_icon'),('users','bio'),('users','preferred_locale'),('users','created_at'),
  ('friendships','requester_id'),('friendships','receiver_id'),('friendships','status'),
  ('group_invitations','group_id'),('group_invitations','inviter_id'),
  ('group_invitations','invitee_id'),('group_invitations','status'),
  ('conversation_members','last_read_at'),('notifications','read_at'),
  ('recommendations','read_at'),('recommendations','message'),
  ('group_posts','content'),('messages','content'),
  ('groups','name'),('groups','description'),('groups','owner_id'),('groups','is_public'),
  ('suggestions','subject'),('suggestions','description'),
  ('lists','owner_id'),('lists','is_public'),('list_members','user_id'),('group_members','role')
), funciones(f) as (values
  ('public.is_group_owner(uuid,uuid)'),('public.is_group_member(uuid,uuid)'),
  ('public.is_conversation_member(uuid,uuid)'),('public.is_demo_session()'),
  ('public.can_read_list(uuid)'),('public.create_conversation_with_members(uuid)'),
  ('public.handle_invitation_accepted()'),('public.handle_new_group()'),
  ('public.handle_new_message()')
)
select 'politica_desconocida' as tipo,
       r.t || '.' || r.p || ' (' || r.cmd || ', ' || r.permissive || ')' as detalle
  from reales r
 where r.p not in ('demo_no_insert','demo_no_update','demo_no_delete')
   and not exists (select 1 from conocidas k where k.t = r.t and k.p = r.p)
union all
select 'politica_que_falta', k.t || '.' || k.p
  from conocidas k
 where k.previa and not exists (select 1 from reales r where r.t = k.t and r.p = k.p)
union all
select 'columna_que_falta', c.t || '.' || c.c
  from columnas c
 where not exists (select 1 from information_schema.columns ic
                    where ic.table_schema = 'public' and ic.table_name = c.t and ic.column_name = c.c)
union all
select 'funcion_que_falta', f.f from funciones f where to_regprocedure(f.f) is null
union all
select 'dato_a_revisar', 'amistades consigo mismo: ' || count(*)
  from public.friendships where requester_id = receiver_id having count(*) > 0
union all
select 'dato_a_revisar', 'auto-invitaciones a grupos: ' || count(*)
  from public.group_invitations where inviter_id = invitee_id having count(*) > 0
union all
select 'dato_a_revisar', 'bios de más de 300 caracteres: ' || count(*)
  from public.users where char_length(bio) > 300 having count(*) > 0
union all
select 'dato_a_revisar', 'avatar_color con formato raro: ' || count(*)
  from public.users where avatar_color !~ '^[#A-Za-z0-9_-]{1,32}$' having count(*) > 0
union all
select 'dato_a_revisar', 'posts de grupo de más de 2000: ' || count(*)
  from public.group_posts where char_length(content) > 2000 having count(*) > 0
union all
select 'dato_a_revisar', 'mensajes de más de 2000: ' || count(*)
  from public.messages where char_length(content) > 2000 having count(*) > 0
order by 1, 2;
── COMPROBACIÓN PREVIA (hasta aquí) ─────────────────────────────────────── */


-- ── 0. Guarda: si producción no se parece al repo, no se aplica nada ──────
-- Para aplicarla a sabiendas de la deriva (solo si el frente lo indica):
--   set kultura.f02_allow_drift = 'on';   antes de pegar el archivo.
do $guard$
declare
  missing text[] := '{}';
  unknown text[] := '{}';
  known constant text[] := array[
    'conversation_members.Users can join conversations',
    'conversation_members.Users can update their own read status',
    'conversation_members.Users can view conversation members they belong to',
    'friendships.friendships_delete_own',
    'friendships.friendships_insert_as_requester',
    'friendships.friendships_select_own',
    'friendships.friendships_update_as_receiver',
    'group_invitations.group_invitations_delete_own',
    'group_invitations.group_invitations_insert_as_owner',
    'group_invitations.group_invitations_select_own',
    'group_invitations.group_invitations_update_as_invitee',
    'group_members.Group owners can manage members',
    'group_members.Members can view group membership',
    'group_members.Users can join groups',
    'group_members.Users can leave groups',
    'groups.Authenticated users can view groups',
    'groups.Owners can delete groups',
    'groups.Owners can update groups',
    'groups.Users can create groups',
    'list_members.list_members_delete_owner_or_self',
    'list_members.list_members_insert_owner',
    'list_members.list_members_select_readable',
    'lists.lists_delete_own',
    'lists.lists_insert_own',
    'lists.lists_select_readable',
    'lists.lists_update_own',
    'notifications.notifications_select_own',
    'notifications.notifications_update_own',
    'notifications.notifications_delete_own',
    'recommendations.recommendations_insert_as_sender',
    'recommendations.recommendations_select_own',
    'recommendations.recommendations_update_as_receiver',
    'user_media.user_media_delete_own',
    'user_media.user_media_insert_own',
    'user_media.user_media_select_public',
    'user_media.user_media_select_authenticated',
    'user_media.user_media_update_own',
    'users.users_select_public',
    'users.users_update_own',
    'users.users can update own profile'
  ];
  tbl text;
  r record;
begin
  foreach tbl in array array['users','friendships','group_invitations','group_members','groups',
                             'conversation_members','notifications','recommendations','user_media',
                             'lists','list_members','group_posts','messages','suggestions'] loop
    if to_regclass('public.' || tbl) is null then missing := missing || ('tabla ' || tbl); end if;
  end loop;

  for r in
    select * from (values
      ('users','bio'),('users','avatar_icon'),('users','avatar_color'),('users','preferred_locale'),
      ('users','username'),('users','avatar_initials'),
      ('friendships','status'),('group_invitations','status'),('group_invitations','inviter_id'),
      ('conversation_members','last_read_at'),('notifications','read_at'),
      ('recommendations','read_at'),('recommendations','message'),('groups','is_public'),
      ('groups','description'),('suggestions','subject'),('suggestions','description'),
      ('group_posts','content'),('messages','content')
    ) as c(t, c)
    where not exists (select 1 from information_schema.columns ic
                       where ic.table_schema = 'public' and ic.table_name = c.t and ic.column_name = c.c)
  loop
    missing := missing || ('columna ' || r.t || '.' || r.c);
  end loop;

  foreach tbl in array array['public.is_group_owner(uuid,uuid)','public.is_group_member(uuid,uuid)',
                             'public.is_conversation_member(uuid,uuid)','public.is_demo_session()',
                             'public.create_conversation_with_members(uuid)',
                             'public.handle_invitation_accepted()','public.handle_new_group()',
                             'public.handle_new_message()'] loop
    if to_regprocedure(tbl) is null then missing := missing || ('función ' || tbl); end if;
  end loop;

  if array_length(missing, 1) > 0 then
    raise exception 'F-02 harden_rls: faltan objetos que da por supuestos: %', array_to_string(missing, ', ');
  end if;

  for r in
    select tablename || '.' || policyname as k, cmd, permissive
      from pg_policies
     where schemaname = 'public'
       and tablename in ('users','friendships','group_invitations','group_members','groups',
                         'conversation_members','notifications','recommendations','user_media',
                         'lists','list_members')
       and policyname not in ('demo_no_insert','demo_no_update','demo_no_delete')
  loop
    if not (r.k = any(known)) then
      unknown := unknown || (r.k || ' (' || r.cmd || ', ' || r.permissive || ')');
    end if;
  end loop;

  if array_length(unknown, 1) > 0 then
    if coalesce(current_setting('kultura.f02_allow_drift', true), '') = 'on' then
      raise notice 'F-02 harden_rls: políticas fuera del repo (se dejan tal cual): %', array_to_string(unknown, ', ');
    else
      raise exception 'F-02 harden_rls: hay políticas en la base que no están en las migraciones del repo: %. No se ha aplicado nada; pásaselas al frente F-02.',
        array_to_string(unknown, ', ');
    end if;
  end if;
end
$guard$;


-- ── 1. friendships ───────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'friendships_not_self' and conrelid = 'public.friendships'::regclass) then
    alter table public.friendships
      add constraint friendships_not_self check (requester_id <> receiver_id) not valid;
  end if;
end $$;

drop policy if exists "friendships_insert_as_requester" on public.friendships;
create policy "friendships_insert_as_requester" on public.friendships
  for insert to authenticated
  with check (auth.uid() = requester_id and status = 'pending' and requester_id <> receiver_id);

drop policy if exists "friendships_update_as_receiver" on public.friendships;
create policy "friendships_update_as_receiver" on public.friendships
  for update to authenticated
  using (auth.uid() = receiver_id and status = 'pending')
  with check (auth.uid() = receiver_id and status = 'accepted');

revoke update on public.friendships from anon, authenticated;
grant update (status) on public.friendships to authenticated;


-- ── 2. group_invitations ─────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'group_invitations_not_self' and conrelid = 'public.group_invitations'::regclass) then
    alter table public.group_invitations
      add constraint group_invitations_not_self check (inviter_id <> invitee_id) not valid;
  end if;
end $$;

create or replace function public.is_group_owner(p_group_id uuid, p_uid uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.group_members
    where group_id = p_group_id and user_id = p_uid and role = 'owner');
$$;
revoke all on function public.is_group_owner(uuid, uuid) from public, anon;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated, service_role;

drop policy if exists "group_invitations_insert_as_owner" on public.group_invitations;
create policy "group_invitations_insert_as_owner" on public.group_invitations
  for insert to authenticated
  with check (
    auth.uid() = inviter_id
    and inviter_id <> invitee_id
    and status = 'pending'
    and public.is_group_owner(group_id, auth.uid())
    and exists (
      select 1 from public.friendships f
       where f.status = 'accepted'
         and ((f.requester_id = auth.uid() and f.receiver_id = group_invitations.invitee_id)
           or (f.receiver_id = auth.uid() and f.requester_id = group_invitations.invitee_id))
    )
  );

drop policy if exists "group_invitations_update_as_invitee" on public.group_invitations;
create policy "group_invitations_update_as_invitee" on public.group_invitations
  for update to authenticated
  using (auth.uid() = invitee_id and status = 'pending')
  with check (auth.uid() = invitee_id and status = 'accepted');

revoke update on public.group_invitations from anon, authenticated;
grant update (status) on public.group_invitations to authenticated;

-- El disparador ya no se fía de la fila nueva: grupo, invitador e invitado son
-- inmutables, y una invitación aceptada no vuelve a 'pending' (ni siquiera con
-- el cliente admin), así que salir del grupo es definitivo.
create or replace function public.handle_invitation_accepted()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.group_id is distinct from old.group_id
     or new.inviter_id is distinct from old.inviter_id
     or new.invitee_id is distinct from old.invitee_id then
    raise exception 'group_invitation_immutable' using errcode = '42501';
  end if;
  if old.status = 'accepted' and new.status is distinct from 'accepted' then
    raise exception 'group_invitation_already_accepted' using errcode = '42501';
  end if;
  if new.status = 'accepted' and old.status = 'pending' then
    insert into public.group_members (group_id, user_id, role)
    values (new.group_id, new.invitee_id, 'member')
    on conflict (group_id, user_id) do nothing;
  end if;
  return new;
end;
$$;
alter function public.handle_invitation_accepted() owner to postgres;
create or replace trigger on_invitation_accepted
  after update on public.group_invitations
  for each row execute function public.handle_invitation_accepted();


-- ── 3. conversation_members (SEG-H6) ─────────────────────────────────────
drop policy if exists "Users can join conversations" on public.conversation_members;

drop policy if exists "Users can update their own read status" on public.conversation_members;
create policy "Users can update their own read status" on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke update on public.conversation_members from anon, authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;


-- ── 4. users ─────────────────────────────────────────────────────────────
drop policy if exists "users can update own profile" on public.users;
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.users from anon, authenticated;
grant update (bio, avatar_icon, avatar_color, preferred_locale) on public.users to authenticated;

-- anon: solo lo que pintan /u/[username] y su imagen OG (public-collection.ts).
revoke select on public.users from anon;
grant select (id, username, avatar_color, avatar_initials, avatar_icon, bio) on public.users to anon;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_bio_length' and conrelid = 'public.users'::regclass) then
    alter table public.users add constraint users_bio_length
      check (bio is null or char_length(bio) <= 300) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_avatar_color_format' and conrelid = 'public.users'::regclass) then
    alter table public.users add constraint users_avatar_color_format
      check (avatar_color ~ '^[#A-Za-z0-9_-]{1,32}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_avatar_icon_format' and conrelid = 'public.users'::regclass) then
    alter table public.users add constraint users_avatar_icon_format
      check (avatar_icon is null or avatar_icon ~ '^[A-Za-z0-9_-]{1,40}$') not valid;
  end if;
end $$;


-- ── 5. user_media (SEG-3a): sin sesión no se lee ninguna biblioteca ──────
drop policy if exists "user_media_select_public" on public.user_media;
drop policy if exists "user_media_select_authenticated" on public.user_media;
create policy "user_media_select_authenticated" on public.user_media
  for select to authenticated
  using (true);

drop policy if exists "user_media_update_own" on public.user_media;
create policy "user_media_update_own" on public.user_media
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 6. Listas y grupos: el dueño solo añade a amigos ─────────────────────
drop policy if exists "list_members_insert_owner" on public.list_members;
create policy "list_members_insert_owner" on public.list_members
  for insert to authenticated
  with check (
    auth.uid() = (select l.owner_id from public.lists l where l.id = list_members.list_id)
    and exists (
      select 1 from public.friendships f
       where f.status = 'accepted'
         and ((f.requester_id = auth.uid() and f.receiver_id = list_members.user_id)
           or (f.receiver_id = auth.uid() and f.requester_id = list_members.user_id))
    )
  );

drop policy if exists "Group owners can manage members" on public.group_members;
create policy "Group owners can manage members" on public.group_members
  for insert to authenticated
  with check (
    role = 'member'
    and exists (select 1 from public.groups g
                 where g.id = group_members.group_id and g.owner_id = auth.uid())
    and exists (
      select 1 from public.friendships f
       where f.status = 'accepted'
         and ((f.requester_id = auth.uid() and f.receiver_id = group_members.user_id)
           or (f.receiver_id = auth.uid() and f.requester_id = group_members.user_id))
    )
  );

drop policy if exists "Owners can update groups" on public.groups;
create policy "Owners can update groups" on public.groups
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "lists_update_own" on public.lists;
create policy "lists_update_own" on public.lists
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);


-- ── 7. recommendations y notifications ───────────────────────────────────
drop policy if exists "recommendations_update_as_receiver" on public.recommendations;
create policy "recommendations_update_as_receiver" on public.recommendations
  for update to authenticated
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

revoke update on public.recommendations from anon, authenticated;
grant update (read_at) on public.recommendations to authenticated;

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- COD-H5: rechazar una invitación borraba la notificación sin efecto.
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (auth.uid() = user_id);


-- ── 8. media: WITH CHECK explícito mientras exista la política ───────────
-- La quita F-03 (20261023030001_media_server_only.sql). Solo se toca si sigue
-- existiendo, así que aplicar esta migración después de la de F-03 no la
-- resucita.
do $$
begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'media' and policyname = 'media_update_auth') then
    drop policy "media_update_auth" on public.media;
    create policy "media_update_auth" on public.media
      for update to authenticated
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;


-- ── 9. CHECK de longitud del contenido que se escribe desde el navegador ─
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'group_posts_content_length' and conrelid = 'public.group_posts'::regclass) then
    alter table public.group_posts add constraint group_posts_content_length
      check (char_length(content) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_content_length' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_content_length
      check (char_length(content) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_name_length' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_name_length
      check (char_length(name) <= 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_description_length' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_description_length
      check (description is null or char_length(description) <= 500) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recommendations_message_length' and conrelid = 'public.recommendations'::regclass) then
    alter table public.recommendations add constraint recommendations_message_length
      check (message is null or char_length(message) <= 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suggestions_subject_length' and conrelid = 'public.suggestions'::regclass) then
    alter table public.suggestions add constraint suggestions_subject_length
      check (char_length(subject) <= 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suggestions_description_length' and conrelid = 'public.suggestions'::regclass) then
    alter table public.suggestions add constraint suggestions_description_length
      check (char_length(description) <= 5000) not valid;
  end if;
end $$;

-- Validar las restricciones nuevas; si una fila vieja no cumple, se queda
-- NOT VALID (sigue aplicándose a toda escritura nueva) y se avisa.
do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
      from pg_constraint
     where not convalidated
       and conname in ('friendships_not_self','group_invitations_not_self','users_bio_length',
                       'users_avatar_color_format','users_avatar_icon_format',
                       'group_posts_content_length','messages_content_length','groups_name_length',
                       'groups_description_length','recommendations_message_length',
                       'suggestions_subject_length','suggestions_description_length')
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tbl, c.conname);
    exception when check_violation then
      raise notice 'F-02: % se queda NOT VALID: hay filas antiguas que no la cumplen', c.conname;
    end;
  end loop;
end $$;


-- ── 10. Funciones: search_path fijo y sin EXECUTE para anon ──────────────
alter function public.handle_new_group() set search_path = public, pg_temp;
alter function public.handle_new_message() set search_path = public, pg_temp;
alter function public.is_group_member(uuid, uuid) set search_path = public, pg_temp;
alter function public.is_conversation_member(uuid, uuid) set search_path = public, pg_temp;
alter function public.create_conversation_with_members(uuid) set search_path = public, pg_temp;
do $$
begin
  if to_regprocedure('public.can_read_list(uuid)') is not null then
    alter function public.can_read_list(uuid) set search_path = public, pg_temp;
  end if;
end $$;

-- Oráculos de pertenencia y RPC: solo con sesión.
revoke all on function public.is_group_member(uuid, uuid) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated, service_role;
revoke all on function public.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated, service_role;
revoke all on function public.create_conversation_with_members(uuid) from public, anon;
grant execute on function public.create_conversation_with_members(uuid) to authenticated, service_role;

-- Funciones de disparador: no se llaman nunca a mano (un disparador se
-- ejecuta aunque quien inserta no tenga EXECUTE).
revoke all on function public.handle_new_group() from public, anon, authenticated;
revoke all on function public.handle_new_message() from public, anon, authenticated;
revoke all on function public.handle_invitation_accepted() from public, anon, authenticated;

-- Las funciones que se creen a partir de ahora ya no reciben el GRANT explícito
-- a anon que dejaba remote_schema.sql. OJO: el EXECUTE para PUBLIC es un
-- privilegio por defecto GLOBAL de Postgres y no se puede quitar por esquema
-- (quitarlo para todo el servidor afectaría a las extensiones), así que toda
-- función SECURITY DEFINER nueva tiene que hacer su propio
-- `revoke all on function … from public, anon` (lo exige
-- tests/unit/rls/migrations-lint.test.ts).
alter default privileges for role postgres in schema public revoke execute on functions from anon;


-- ── 11. Informe de RLS por tabla (solo service_role) ─────────────────────
-- `escritura_authenticated`: la tabla tiene alguna política permisiva de
-- escritura que aplica a authenticated y el rol tiene privilegio de escribir.
-- `ok` exige RLS activa, demo_no_* si hay escritura y 0 políticas
-- INSERT/UPDATE/ALL permisivas sin WITH CHECK.
create or replace function public.rls_audit()
returns table (
  tabla text,
  rls boolean,
  escritura_authenticated boolean,
  demo_insert boolean,
  demo_update boolean,
  demo_delete boolean,
  politicas_sin_check integer,
  ok boolean
)
language sql stable
set search_path = pg_catalog, public
as $$
  with t as (
    select c.oid, c.relname::text as relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
  ), p as (
    select tablename::text as tablename, policyname::text as policyname, cmd, permissive, roles, with_check
      from pg_policies where schemaname = 'public'
  ), x as (
    select t.relname,
           t.relrowsecurity,
           exists (select 1 from p
                    where p.tablename = t.relname and p.permissive = 'PERMISSIVE'
                      and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                      and p.roles && array['authenticated', 'public']::name[])
             and (has_table_privilege('authenticated', t.oid, 'INSERT')
               or has_table_privilege('authenticated', t.oid, 'DELETE')
               or has_any_column_privilege('authenticated', t.oid, 'UPDATE')) as w,
           exists (select 1 from p where p.tablename = t.relname and p.policyname = 'demo_no_insert') as di,
           exists (select 1 from p where p.tablename = t.relname and p.policyname = 'demo_no_update') as du,
           exists (select 1 from p where p.tablename = t.relname and p.policyname = 'demo_no_delete') as dd,
           (select count(*) from p
             where p.tablename = t.relname and p.permissive = 'PERMISSIVE'
               and p.cmd in ('INSERT', 'UPDATE', 'ALL') and p.with_check is null)::integer as nc
      from t
  )
  select relname, relrowsecurity, w, di, du, dd, nc,
         relrowsecurity and (not w or (di and du and dd)) and nc = 0
    from x
   order by relname;
$$;
revoke all on function public.rls_audit() from public, anon, authenticated;
grant execute on function public.rls_audit() to service_role;


-- ── 12. Demo de solo lectura en todas las tablas (copia de 20261008000001) ─
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
