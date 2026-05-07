-- ============================================================
-- B3.5c-3-FIX2 — Fix recursión infinita en policy conversation_members
--
-- La migration anterior (20260506000001) introdujo recursión:
-- el WITH CHECK consultaba conversation_members, lo que disparaba
-- la policy otra vez → error 42P17 "infinite recursion detected".
--
-- Solución: usar una SECURITY DEFINER function que comprueba
-- pertenencia bypassando RLS. La función solo devuelve boolean,
-- no expone datos.
-- ============================================================

-- Helper function: comprueba si un usuario es miembro de una conversación.
-- SECURITY DEFINER permite bypassar RLS dentro de la función,
-- evitando la recursión en la policy.
CREATE OR REPLACE FUNCTION public.is_conversation_member(
  conv_id uuid,
  uid uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = conv_id
      AND user_id = uid
  );
$$;

-- Permisos mínimos: solo authenticated puede llamar a la función.
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;

-- Reemplazar la policy con versión sin recursión.
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_members;

CREATE POLICY "Users can join conversations" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id, auth.uid())
  );
