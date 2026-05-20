-- ============================================================
-- B3.5f-FIX — RPC transaccional para crear conversaciones (cierra E36)
--
-- Problema: INSERT batch [caller, target] en conversation_members
-- fallaba con 42501 porque la policy WITH CHECK usa is_conversation_member()
-- que lee la tabla; dentro del mismo statement atómico, la fila del caller
-- aún no es visible → chicken-and-egg.
--
-- Solución: función SECURITY DEFINER que opera por encima de RLS.
-- Las policies existentes siguen protegiendo el acceso directo a la tabla.
-- El Route Handler deja de hacer INSERTs directos y llama a esta RPC.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_conversation_with_members(
  target_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid;
  v_conversation  uuid;
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_target_user_id' USING ERRCODE = 'P0002';
  END IF;

  IF v_caller = target_user_id THEN
    RAISE EXCEPTION 'cannot_message_yourself' USING ERRCODE = 'P0003';
  END IF;

  -- Validate target user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'target_user_not_found' USING ERRCODE = 'P0004';
  END IF;

  -- Dedupe: return existing conversation between these two users
  SELECT cm1.conversation_id INTO v_conversation
  FROM conversation_members cm1
  INNER JOIN conversation_members cm2
    ON cm1.conversation_id = cm2.conversation_id
   AND cm2.user_id = target_user_id
  WHERE cm1.user_id = v_caller
  LIMIT 1;

  IF v_conversation IS NOT NULL THEN
    RETURN v_conversation;
  END IF;

  -- Create conversation and add both members atomically
  INSERT INTO conversations DEFAULT VALUES
  RETURNING id INTO v_conversation;

  INSERT INTO conversation_members (conversation_id, user_id)
  VALUES
    (v_conversation, v_caller),
    (v_conversation, target_user_id);

  RETURN v_conversation;
END;
$$;

REVOKE ALL ON FUNCTION public.create_conversation_with_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_conversation_with_members(uuid) TO authenticated;
