-- ============================================================
-- KULTURA — discover_groups: «Descubrir» paginado en SQL (saneamiento 6.4)
--
-- Antes, /api/groups/discover traía TODOS los grupos públicos con todos sus
-- miembros y filtraba, ordenaba y paginaba en JS. Esta función hace el
-- recuento, los filtros (q, scope, size), el orden y la página en la base.
--
-- SECURITY INVOKER: corre con la RLS del que llama. Ya puede ver los grupos
-- públicos y sus miembros ("Authenticated users can view groups" y
-- "Members can view group membership"), así que no expone nada nuevo.
-- El RPC antiguo (get_discoverable_groups, SECURITY DEFINER) se borró en
-- 20260531201838; este no lo resucita.
--
-- q se busca como subcadena literal (strpos), sin comodines: «%» y «_» se
-- buscan tal cual (saneamiento 4.5) sin escapar nada.
--
-- Orden: más miembros primero; empate, el más reciente. El id desempata para
-- que las páginas sean estables.
--
-- Verificación (como authenticated):
--   select * from public.discover_groups(null, 'all', 'all', 5, 0);
--
-- Rollback:
--   drop function if exists public.discover_groups(text, text, text, integer, integer);
-- ============================================================

create or replace function public.discover_groups(
  p_q      text    default null,
  p_scope  text    default 'all',
  p_size   text    default 'all',
  p_limit  integer default 50,
  p_offset integer default 0
) returns table (
  id           uuid,
  owner_id     uuid,
  name         text,
  description  text,
  cover_color  text,
  icon         text,
  created_at   timestamptz,
  member_count bigint,
  is_member    boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with counted as (
    select
      g.id,
      g.owner_id,
      g.name,
      g.description,
      g.cover_color,
      g.icon,
      g.created_at,
      count(gm.user_id) as member_count,
      coalesce(bool_or(gm.user_id = auth.uid()), false) as is_member
    from public.groups g
    left join public.group_members gm on gm.group_id = g.id
    where g.is_public
      and (coalesce(p_q, '') = '' or strpos(lower(g.name), lower(p_q)) > 0)
    group by g.id
  )
  select *
  from counted c
  where (
      p_scope = 'all'
      or (p_scope = 'joined' and c.is_member)
      or (p_scope = 'unjoined' and not c.is_member)
    )
    and (
      p_size = 'all'
      or (p_size = 'small' and c.member_count between 1 and 10)
      or (p_size = 'medium' and c.member_count between 11 and 50)
      or (p_size = 'large' and c.member_count > 50)
    )
  order by c.member_count desc, c.created_at desc, c.id
  limit least(greatest(coalesce(p_limit, 50), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.discover_groups(text, text, text, integer, integer) from public, anon;
grant execute on function public.discover_groups(text, text, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
