-- ============================================================
-- KULTURA — E45-c-1: visibilidad de grupos (is_public + RLS)
--
-- Añade groups.is_public. Grupos privados:
--   - invisibles a no-miembros (SELECT)
--   - membresía invisible a no-miembros (SELECT group_members)
--   - NO auto-unibles (self-join INSERT bloqueado)
--
-- Recursión evitada con función SECURITY DEFINER is_group_member,
-- que salta RLS dentro de la función (mismo patrón que
-- is_conversation_member, migración 20260506000002).
-- Ejecutado en prod (app movies) el 2026-06-01. Archivo doc post-hoc.
-- ============================================================

ALTER TABLE public.groups
  ADD COLUMN is_public boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.is_group_member(
  group_id uuid,
  uid uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members
    WHERE group_members.group_id = is_group_member.group_id
      AND group_members.user_id = is_group_member.uid
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view groups" ON public.groups;
CREATE POLICY "Authenticated users can view groups" ON public.groups
  FOR SELECT TO authenticated
  USING ( is_public OR public.is_group_member(id, auth.uid()) );

DROP POLICY IF EXISTS "Members can view group membership" ON public.group_members;
CREATE POLICY "Members can view group membership" ON public.group_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.is_public)
  );

DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join groups" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.is_public)
  );

NOTIFY pgrst, 'reload schema';
