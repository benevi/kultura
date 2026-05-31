-- ============================================================
-- KULTURA — fix group_members self-join (E45 Fase 2)
-- Documenta la policy aplicada manualmente en producción.
-- Permite a un usuario autenticado unirse a un grupo como 'member'
-- insertando su propia fila en group_members.
-- ============================================================

CREATE POLICY "Users can join groups"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'member');
