-- ============================================================
-- KULTURA — Miembros de una lista: solo los leen su dueño y sus miembros
--
-- Riesgo R1 de la auditoría de Listas. La política de lectura
-- `list_members_select_readable` dejaba leer los miembros de cualquier lista
-- LEGIBLE (`private.can_read_list`: pública, propia o de la que eres miembro),
-- así que quién colabora en una lista colaborativa PÚBLICA se podía leer por
-- la API, incluso sin sesión (la política era para `public`).
--
-- Ahora, solo con sesión:
--   - tu propia fila (sigues viendo de qué listas eres miembro);
--   - todas las filas de una lista de la que eres dueño o miembro.
-- Sin sesión, ninguna.
--
-- Solo endurece: el código ya no dependía de leer los miembros ajenos
-- (comprobado el 27-11-2026):
--   - `getUserLists` y `getListAccess` leen solo las filas del propio usuario;
--   - `getListDetail` los lee para la ficha `/lists/[id]`, que desde el PR de
--     la pantalla solo los enseña a dueño y miembros (a los demás les llegará
--     la lista vacía, como ya hace la página);
--   - invitar (upsert del dueño) y quitar (dueño o el propio miembro) ven las
--     filas que tocan;
--   - las políticas de `list_items` que miran `list_members` solo buscan la
--     fila del propio usuario; `private.can_read_list`, `deletion_preview` y
--     `transfer_owned_content` son SECURITY DEFINER (no les afecta la RLS);
--     ninguna vista usa `list_members`.
--
-- La función auxiliar va en `private` (la API no la expone, saneamiento
-- 12.2) y es SECURITY DEFINER para no consultar `list_members` desde su
-- propia política (recursión).
--
-- Deshacer:
--   drop policy if exists "list_members_select_members" on public.list_members;
--   create policy "list_members_select_readable" on public.list_members
--     for select using ((user_id = auth.uid()) or private.can_read_list(list_id));
--   drop function if exists private.can_see_list_members(uuid);
-- ============================================================

create or replace function private.can_see_list_members(target_list uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.lists l
     where l.id = target_list
       and (
         l.owner_id = auth.uid()
         or exists (
           select 1 from public.list_members m
            where m.list_id = l.id and m.user_id = auth.uid()
         )
       )
  );
$$;

revoke all on function private.can_see_list_members(uuid) from public, anon;
grant execute on function private.can_see_list_members(uuid) to authenticated, service_role;

drop policy if exists "list_members_select_readable" on public.list_members;
drop policy if exists "list_members_select_members" on public.list_members;
create policy "list_members_select_members" on public.list_members
  for select to authenticated
  using ((user_id = (select auth.uid())) or private.can_see_list_members(list_id));
