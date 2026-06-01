-- E45-d: invitaciones a grupos (solo amigos, accept vía notificación)

-- 1. helper owner SECURITY DEFINER (anti-recursión, gemela de is_group_member)
create or replace function public.is_group_owner(p_group_id uuid, p_uid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.group_members
    where group_id = p_group_id and user_id = p_uid and role = 'owner');
$$;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;

-- 2. tabla (molde friendships)
create table if not exists public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  inviter_id uuid not null references public.users(id) on delete cascade,
  invitee_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  unique (group_id, invitee_id)
);
alter table public.group_invitations enable row level security;

-- 3. RLS (molde friendships)
create policy "group_invitations_select_own" on public.group_invitations
  for select using (auth.uid() = inviter_id or auth.uid() = invitee_id);
create policy "group_invitations_insert_as_owner" on public.group_invitations
  for insert with check (auth.uid() = inviter_id and public.is_group_owner(group_id, auth.uid()));
create policy "group_invitations_update_as_invitee" on public.group_invitations
  for update using (auth.uid() = invitee_id);
create policy "group_invitations_delete_own" on public.group_invitations
  for delete using (auth.uid() = inviter_id or auth.uid() = invitee_id);

-- 4. trigger accept -> alta miembro (SECURITY DEFINER salta RLS self-join privado)
create or replace function public.handle_invitation_accepted()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into group_members (group_id, user_id, role)
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

-- 5. enum notifications += group_invite
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['recommendation'::text,'list_invite'::text,'group_invite'::text]));
