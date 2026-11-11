-- ============================================================
-- KULTURA — Saneamiento 4.6: publicar en un grupo solo por la API
-- (docs/PLAN_SANEAMIENTO.md, fase 4, nota 4.6)
--
-- Hasta ahora la política "Group members can post" dejaba a cualquier
-- miembro insertar en group_posts directamente con el cliente de Supabase,
-- saltándose el límite de POST /api/groups/[id]/posts. La ruta ya comprueba
-- la pertenencia con la sesión del usuario e inserta con service_role, así
-- que el INSERT de authenticated sobra.
--
-- El código desplegado antes de esta migración inserta con la sesión del
-- usuario: aplicarla DESPUÉS de desplegar el código que inserta con admin.
--
-- Es idempotente. Leer y borrar siguen igual (sus políticas no se tocan) y
-- Realtime sigue avisando de los INSERT (depende del SELECT).
--
-- DESPUÉS DE APLICAR, comprobación:
--   select policyname from pg_policies where schemaname = 'public'
--     and tablename = 'group_posts' and cmd = 'INSERT';    -- solo demo_no_insert
--   select has_table_privilege('authenticated', 'public.group_posts', 'INSERT');  -- false
--   select * from public.rls_audit() where not ok;          -- 0 filas
--
-- VUELTA ATRÁS:
--   grant insert on public.group_posts to authenticated;
--   create policy "Group members can post" on public.group_posts
--     for insert to authenticated
--     with check (user_id = auth.uid() and exists (
--       select 1 from public.group_members
--        where group_members.group_id = group_posts.group_id
--          and group_members.user_id = auth.uid()));
-- ============================================================

drop policy if exists "Group members can post" on public.group_posts;

revoke insert on public.group_posts from authenticated, anon;
