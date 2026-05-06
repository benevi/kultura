-- Fix: allow conversation creator to add other members
-- The original policy only allows inserting rows where user_id = auth.uid()
-- which prevents the Route Handler from adding the target user as a member.
-- New policy: a user can insert a row if either:
--   (a) they are the member being added (original behavior), OR
--   (b) they are already a member of that conversation (creator adding someone else)

DROP POLICY IF EXISTS "Users can join conversations" ON "public"."conversation_members";

CREATE POLICY "Users can join conversations" ON "public"."conversation_members"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "user_id" = "auth"."uid"()
    OR EXISTS (
      SELECT 1 FROM "public"."conversation_members" cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = "auth"."uid"()
    )
  );
