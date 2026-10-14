-- ============================================================
-- Colecciones públicas (E-COLECCION-PUBLICA)
--
-- Hasta ahora `lists`, `list_items` y `list_members` se leían con
-- `USING (true)`: cualquiera con la clave anónima podía leer todas las listas.
-- "Privado" solo existía en la interfaz.
--
-- A partir de aquí una lista la leen su dueño, sus miembros y, si está
-- marcada como pública, cualquiera (también sin sesión). Las listas nuevas y
-- las que ya existen quedan PRIVADAS hasta que el dueño las publique.
--
-- La comprobación vive en una función SECURITY DEFINER para que las políticas
-- de `lists` y `list_members` no se consulten entre sí: esa recursión ya tumbó
-- `conversation_members` (migraciones 20260506*).
--
-- Orden de despliegue: aplicar ESTA migración antes de desplegar el código,
-- que ya pide la columna `is_public`.
-- ============================================================

alter table public.lists
  add column if not exists is_public boolean not null default false;

create index if not exists lists_owner_public_idx
  on public.lists (owner_id)
  where is_public;

create or replace function public.can_read_list(target_list uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lists l
    where l.id = target_list
      and (
        l.is_public
        or l.owner_id = auth.uid()
        or exists (
          select 1 from public.list_members m
          where m.list_id = l.id and m.user_id = auth.uid()
        )
      )
  )
$$;

revoke all on function public.can_read_list(uuid) from public;
grant execute on function public.can_read_list(uuid) to anon, authenticated;

-- lists
drop policy if exists "lists_select_public" on public.lists;
drop policy if exists "lists_select_readable" on public.lists;
create policy "lists_select_readable" on public.lists
  for select using (public.can_read_list(id));

-- list_items
drop policy if exists "list_items_select_public" on public.list_items;
drop policy if exists "list_items_select_readable" on public.list_items;
create policy "list_items_select_readable" on public.list_items
  for select using (public.can_read_list(list_id));

-- list_members: cada usuario ve sus propias membresías (las usa "Mis listas")
-- y las de las listas que puede leer.
drop policy if exists "list_members_select_public" on public.list_members;
drop policy if exists "list_members_select_readable" on public.list_members;
create policy "list_members_select_readable" on public.list_members
  for select using (user_id = auth.uid() or public.can_read_list(list_id));
