-- ============================================================
-- B3.5c-3-FIX3 — Fix recursión en policy SELECT de conversation_members
--
-- La policy "Users can view conversation members they belong to"
-- consulta conversation_members en su qual, lo que causa recursión
-- cuando Postgres hace SELECT implícito tras INSERT (Supabase
-- ejecuta `.insert(...).select()` por defecto).
--
-- B3.5c-3-FIX2 arregló la policy de INSERT con SECURITY DEFINER function.
-- Aquí se aplica el mismo patrón a la policy de SELECT, reutilizando
-- la función helper public.is_conversation_member ya creada.
-- ============================================================

DROP POLICY IF EXISTS "Users can view conversation members they belong to"
  ON public.conversation_members;

CREATE POLICY "Users can view conversation members they belong to"
  ON public.conversation_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id, auth.uid())
  );
