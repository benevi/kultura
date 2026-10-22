-- ============================================================
-- KULTURA — El catálogo `media` solo lo escribe el servidor (SEG-2)
--
-- Qué hace:
--   `media` es compartido: una fila (`movie_550`) la ven todas las bibliotecas,
--   listas públicas y recomendaciones. Las políticas `media_insert_auth` y
--   `media_update_auth` (baseline `20260502233945_remote_schema.sql`) dejaban
--   a CUALQUIER usuario con sesión insertar o reescribir cualquier fila por
--   PostgREST, y `GRANT ALL ... TO anon, authenticated` le daba además DELETE
--   y TRUNCATE a nivel de privilegio.
--   Desde F-03 la app escribe `media` solo con el service role (que ignora RLS
--   y no depende de estos grants), con la ficha pedida al proveedor. Aquí se
--   retiran los permisos de escritura a `anon` y `authenticated`; la LECTURA
--   pública (`media_select_all`) se mantiene: la usan las páginas sin sesión.
--
-- Idempotente: se puede ejecutar varias veces. El código desplegado funciona
-- antes y después de aplicarla.
--
-- Cómo comprobarlo (SQL Editor, tras aplicar):
--   1) Sin políticas de escritura permisivas en media (esperado: 0 filas):
--        select policyname, cmd from pg_policies
--        where schemaname = 'public' and tablename = 'media'
--          and permissive = 'PERMISSIVE' and cmd <> 'SELECT';
--   2) Sin privilegios de escritura para anon/authenticated (esperado: 0 filas):
--        select grantee, privilege_type from information_schema.role_table_grants
--        where table_schema = 'public' and table_name = 'media'
--          and grantee in ('anon', 'authenticated')
--          and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
--   3) La lectura sigue abierta (esperado: 1 fila, SELECT):
--        select policyname, cmd from pg_policies
--        where schemaname = 'public' and tablename = 'media' and cmd = 'SELECT';
--   4) Desde la app con sesión, `PATCH /rest/v1/media?id=eq.movie_550` con el
--      JWT de un usuario → 401/403 (permission denied for table media).
-- ============================================================

-- 1. Políticas de escritura conocidas (nombres literales de la baseline).
DROP POLICY IF EXISTS "media_insert_auth" ON "public"."media";
DROP POLICY IF EXISTS "media_update_auth" ON "public"."media";

-- 2. Cualquier otra política PERMISIVA de escritura que se haya creado a mano
--    en el panel (deriva respecto a las migraciones). Las RESTRICTIVE
--    `demo_no_*` se dejan: no conceden nada y el bloque de
--    `20261008000001_demo_read_only.sql` las recrea en todas las tablas.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media'
      AND permissive = 'PERMISSIVE'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.media', p.policyname);
  END LOOP;
END
$$;

-- 3. La lectura pública se garantiza (por si la política de arriba era ALL).
DROP POLICY IF EXISTS "media_select_all" ON "public"."media";
CREATE POLICY "media_select_all" ON "public"."media"
  FOR SELECT TO "anon", "authenticated" USING (true);

-- 4. Privilegios: sin escritura para los roles de PostgREST. SELECT se queda.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "public"."media" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."media" TO "anon", "authenticated";
GRANT ALL ON TABLE "public"."media" TO "service_role";

-- RLS sigue activado (ya lo estaba; se reafirma).
ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;
