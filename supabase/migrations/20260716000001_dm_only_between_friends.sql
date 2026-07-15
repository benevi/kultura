-- ============================================================
-- E93 — DMs solo entre amigos.
--
-- create_conversation_with_members ahora exige que caller y target
-- sean amigos con status='accepted' (amistad bidireccional) ANTES de
-- crear una conversación nueva.
--
-- Alcance decidido: el check va DESPUÉS del dedupe. Una conversación
-- ya existente (creada cuando eran amigos) sigue siendo devuelta aunque
-- la amistad ya no exista — solo se bloquea la CREACIÓN de conversaciones
-- nuevas entre no-amigos.
--
-- Grupos (groups / group_members) no se ven afectados: ruta separada.
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

  -- Dedupe: return existing conversation between these two users.
  -- Va antes del check de amistad a propósito: conversaciones previas
  -- entre ex-amigos siguen accesibles.
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

  -- E93: solo amigos aceptados pueden ABRIR una conversación nueva.
  -- Amistad bidireccional: cualquiera de los dos pudo enviar la solicitud.
  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = v_caller AND receiver_id = target_user_id)
        OR
        (requester_id = target_user_id AND receiver_id = v_caller)
      )
  ) THEN
    RAISE EXCEPTION 'not_friends' USING ERRCODE = 'P0005';
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

NOTIFY pgrst, 'reload schema';
