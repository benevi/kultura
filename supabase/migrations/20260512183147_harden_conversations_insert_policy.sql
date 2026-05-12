-- B3.5g-AUDIT-RLS-2: harden conversations INSERT policy.
-- Previous policy had WITH CHECK: true, which allowed any caller to pass the check
-- (anon was already blocked by the {authenticated} role grant, but explicit defense-in-depth
-- is preferable). The Route Handler in app/api/chat/route.ts still validates the full payload
-- (recipient existence, dedup of conversations, etc.). A stricter policy that requires the
-- creator to be a member would need a schema change (created_by column + AFTER INSERT trigger
-- to add the creator to conversation_members); tracked as E36 in BACKLOG.

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
