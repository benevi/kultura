-- E23: deduplicate users UPDATE policies
-- The policy "users can update own profile" is redundant with "users_update_own"
-- (identical predicate auth.uid() = id). Retain the snake_case version (project convention).
DROP POLICY IF EXISTS "users can update own profile" ON public.users;
