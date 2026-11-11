-- ============================================================
-- KULTURA — Saneamiento, fase 2: permisos y políticas
-- (docs/PLAN_SANEAMIENTO.md, fase 2; decisiones Q6, Q7, Q8, Q10 y Q14)
--
-- El código funciona antes y después de aplicarla. Es idempotente: se puede
-- volver a ejecutar sin errores.
--
-- QUÉ HACE:
--   1. Privilegios por defecto: las tablas, secuencias y funciones que cree
--      `postgres` (las migraciones) ya no se conceden solas a `anon`. Cada
--      migración concede lo que necesite. A `anon` y `authenticated` se les
--      quita TRUNCATE, REFERENCES y TRIGGER en todas las tablas: PostgREST no
--      los usa y TRUNCATE se salta la RLS. (Los privilegios por defecto de
--      `supabase_admin` no se pueden cambiar desde aquí.)
--   2. is_group_member / is_conversation_member solo responden sobre quien
--      pregunta. Eran SECURITY DEFINER con el usuario como parámetro:
--      cualquiera con sesión podía preguntar «¿está X en este grupo/chat?».
--      Todas las políticas ya las llaman con auth.uid().
--   3. Se elimina username_redirect (Q8): llevaba del nombre antiguo al nuevo
--      a cualquiera, incluso sin sesión, y deshacía un cambio de nombre hecho
--      para escapar de un acoso. El historial (username_history) se conserva:
--      sigue reservando los nombres antiguos.
--   4. Recomendaciones solo entre amistades aceptadas (Q7).
--   5. Para entrar en un grupo hace falta una invitación aceptada (Q10): se
--      quita la política que dejaba al dueño meter a un amigo directamente.
--      Aceptar una invitación sigue creando la fila (handle_invitation_accepted)
--      y los grupos públicos siguen admitiendo unirse uno mismo.
--   6. list_items INSERT: un miembro solo añade si la lista es colaborativa
--      (igual que en UPDATE). El dueño, siempre.
--   7. conversations: sin INSERT directo. El único camino es la RPC
--      create_conversation_with_members (exige amistad y crea los miembros).
--   8. set_updated_at e is_demo_session con search_path fijo.
--   9. messages.created_at la pone el servidor (copiado de
--      20261222340001_push_throttle.sql, que no se aplica en producción: Q14).
--  10. Borrar una cuenta ya no borra sus mensajes del chat del otro (Q6):
--      messages.sender_id pasa a ON DELETE SET NULL y el texto se vacía. El
--      chat muestra «usuario eliminado».
--  11. Funciones SECURITY DEFINER que avisa el linter: las que usan las
--      políticas necesitan EXECUTE para el rol que consulta y se quedan; se
--      revoca donde no hace falta (set_updated_at, is_demo_session a anon).
-- ============================================================


-- ── 1. Privilegios por defecto y privilegios peligrosos ──────────────────
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t.relname);
  end loop;
end
$$;


-- ── 2. Comprobaciones de pertenencia: solo sobre uno mismo ───────────────
-- Mismos nombres de parámetro (create or replace no permite cambiarlos).
create or replace function public.is_group_member(group_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(uid = auth.uid(), false) and exists (
    select 1 from public.group_members gm
     where gm.group_id = is_group_member.group_id
       and gm.user_id = is_group_member.uid
  );
$$;

create or replace function public.is_conversation_member(conv_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(uid = auth.uid(), false) and exists (
    select 1 from public.conversation_members cm
     where cm.conversation_id = conv_id
       and cm.user_id = uid
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public, anon;
revoke all on function public.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated, service_role;


-- ── 3. Sin redirección de nombres antiguos (Q8) ──────────────────────────
drop function if exists public.username_redirect(text);


-- ── 4. Recomendaciones solo entre amistades aceptadas (Q7) ───────────────
drop policy if exists "recommendations_insert_as_sender" on public.recommendations;
create policy "recommendations_insert_as_sender" on public.recommendations
  for insert to authenticated
  with check (
    auth.uid() = from_user_id
    and from_user_id <> to_user_id
    and not public.has_block_with(to_user_id)
    and exists (
      select 1 from public.friendships f
       where f.status = 'accepted'
         and (
           (f.requester_id = auth.uid() and f.receiver_id = recommendations.to_user_id)
           or (f.receiver_id = auth.uid() and f.requester_id = recommendations.to_user_id)
         )
    )
  );


-- ── 5. Entrar en un grupo: invitación aceptada (Q10) ─────────────────────
drop policy if exists "Group owners can manage members" on public.group_members;


-- ── 6. list_items: los miembros solo añaden en listas colaborativas ──────
drop policy if exists "list_items_insert_member_or_owner" on public.list_items;
create policy "list_items_insert_member_or_owner" on public.list_items
  for insert to authenticated
  with check (
    auth.uid() = added_by
    and (
      auth.uid() = (select l.owner_id from public.lists l where l.id = list_items.list_id)
      or exists (
        select 1
          from public.lists l
          join public.list_members m on m.list_id = l.id
         where l.id = list_items.list_id
           and l.is_collaborative
           and m.user_id = auth.uid()
      )
    )
  );


-- ── 7. conversations: solo por la RPC ────────────────────────────────────
drop policy if exists "Authenticated users can create conversations" on public.conversations;


-- ── 8. search_path fijo ──────────────────────────────────────────────────
alter function public.set_updated_at() set search_path = '';
alter function public.is_demo_session() set search_path = '';


-- ── 9. La fecha de un mensaje la pone el servidor (de push_throttle) ─────
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


-- ── 10. Borrado de cuenta: los mensajes quedan vacíos y sin autor (Q6) ───
alter table public.messages alter column sender_id drop not null;

alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.users(id) on delete set null;

create or replace function public.messages_clear_orphaned()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Al quedarse sin autor (cuenta borrada), el texto sale de la base.
  if new.sender_id is null and old.sender_id is not null then
    new.content := '';
  end if;
  return new;
end
$$;

revoke all on function public.messages_clear_orphaned() from public, anon, authenticated;

comment on function public.messages_clear_orphaned() is
  'Saneamiento 2.10 (Q6): al borrar la cuenta del autor (sender_id → null), el texto del mensaje se vacía.';

create or replace trigger messages_clear_orphaned
  before update of sender_id on public.messages
  for each row execute function public.messages_clear_orphaned();


-- ── 11. EXECUTE donde no hace falta ──────────────────────────────────────
-- set_updated_at es de disparador: el permiso solo se mira al crear el trigger.
revoke all on function public.set_updated_at() from public, anon, authenticated;
-- is_demo_session solo la usan políticas `to authenticated`.
revoke all on function public.is_demo_session() from public, anon;
grant execute on function public.is_demo_session() to authenticated, service_role;
