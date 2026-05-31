-- ============================================================
-- KULTURA — DROP RPC get_discoverable_groups (E70)
--
-- La RPC get_discoverable_groups quedó muerta tras el hotfix de E45-b:
-- el código pasó a queries directas (src/lib/social/groups.ts) porque el
-- schema cache de PostgREST en Supabase Cloud no recargaba la función.
--
-- Esta migración deja constancia versionada del drop. La migración
-- 20260531180450_rpc_discover_groups.sql se mantiene como histórico
-- (marcada DEPRECATED en su cabecera).
-- ============================================================

DROP FUNCTION IF EXISTS public.get_discoverable_groups(text, text, text, integer, integer);

NOTIFY pgrst, 'reload schema';
