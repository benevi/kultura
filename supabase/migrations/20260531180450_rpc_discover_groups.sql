-- DEPRECATED: sustituido por queries directas (PostgREST schema cache no
-- recargaba la función en Supabase Cloud). Mantenido como referencia.
-- ============================================================
-- KULTURA — RPC get_discoverable_groups (E45 Fase 2)
--
-- Devuelve grupos para la pestaña "Descubrir" de /groups con:
--   - member_count agregado (COUNT sobre group_members)
--   - is_member: ¿el caller ya pertenece al grupo?
--   - filtros server-side: búsqueda (q), scope, size (rango de miembros)
--   - paginación server-side (limit/offset)
--
-- SECURITY DEFINER: la agregación de member_count se hace por encima de
-- RLS para no depender de la visibilidad fila-a-fila de group_members.
-- Las policies de groups (SELECT USING true) ya permiten ver todos los
-- grupos, así que esto no expone nada nuevo: solo nombre, descripción,
-- color, owner y nº de miembros (todo ya público para authenticated).
--
-- scope:
--   'all'      → todos los grupos
--   'joined'   → solo grupos donde el caller es miembro
--   'unjoined' → solo grupos donde el caller NO es miembro
--
-- size (rango por member_count):
--   'all'    → sin filtro
--   'small'  → 1..10
--   'medium' → 11..50
--   'large'  → 50+
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_discoverable_groups(
  p_q       text    DEFAULT NULL,
  p_scope   text    DEFAULT 'all',
  p_size    text    DEFAULT 'all',
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0
) RETURNS TABLE (
  id           uuid,
  owner_id     uuid,
  name         text,
  description  text,
  cover_color  text,
  created_at   timestamptz,
  member_count bigint,
  is_member    boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
  v_limit  integer;
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Clamp del límite a [1, 50] para evitar barridos masivos.
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);

  RETURN QUERY
  SELECT
    g.id,
    g.owner_id,
    g.name,
    g.description,
    g.cover_color,
    g.created_at,
    COUNT(gm.user_id) AS member_count,
    bool_or(gm.user_id = v_caller) AS is_member
  FROM groups g
  LEFT JOIN group_members gm ON gm.group_id = g.id
  WHERE
    (p_q IS NULL OR p_q = '' OR g.name ILIKE '%' || p_q || '%')
  GROUP BY g.id, g.owner_id, g.name, g.description, g.cover_color, g.created_at
  HAVING
    -- scope
    (
      p_scope = 'all'
      OR (p_scope = 'joined'   AND bool_or(gm.user_id = v_caller))
      OR (p_scope = 'unjoined' AND NOT COALESCE(bool_or(gm.user_id = v_caller), false))
    )
    -- size (rango por nº de miembros)
    AND (
      p_size = 'all'
      OR (p_size = 'small'  AND COUNT(gm.user_id) BETWEEN 1 AND 10)
      OR (p_size = 'medium' AND COUNT(gm.user_id) BETWEEN 11 AND 50)
      OR (p_size = 'large'  AND COUNT(gm.user_id) > 50)
    )
  ORDER BY COUNT(gm.user_id) DESC, g.created_at DESC
  LIMIT v_limit
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_discoverable_groups(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discoverable_groups(text, text, text, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
