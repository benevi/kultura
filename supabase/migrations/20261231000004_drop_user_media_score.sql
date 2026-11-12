-- ============================================================
-- Saneamiento 6.6 (3/3) · Una sola nota: fuera user_media.score
--
-- QUÉ HACE:
--   1. Borra el disparador user_media_sync_rating y su función (migración
--      20261208240001): mantenía score ↔ rating10 de acuerdo y ya no hace
--      falta.
--   2. Borra la columna user_media.score (1-5 enteros); con ella se va su
--      CHECK user_media_score_check. La nota vive solo en rating10 (0,5-10).
--
-- ORDEN (obligatorio): solo DESPUÉS de que producción ejecute el código de
-- los PR 1 y 2 de 6.6 (#135 lee solo rating10, #136 ya no escribe score).
-- Antes, un INSERT con score fallaría con "column does not exist".
--
-- Comprobado antes (prod, 12-11-2026): 69 notas, 0 filas con
-- rating10 distinto de score × 2 (o al revés con el redondeo); nada más en la
-- base usa score (ni funciones, vistas, políticas ni índices).
--
-- IDEMPOTENTE: IF EXISTS en todo.
--
-- VUELTA ATRÁS (si hiciera falta): volver a crear la columna y rellenarla
-- desde rating10 con el mismo redondeo:
--   alter table public.user_media add column score smallint
--     check (score between 1 and 5);
--   update public.user_media
--      set score = greatest(1, least(5, round(rating10 / 2)))::smallint
--    where rating10 is not null;
-- (sin tocar updated_at: desactivar antes user_media_set_updated_at).
--
-- COMPROBACIÓN:
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'user_media'
--      and column_name = 'score';                                  -- 0
--   select count(*) from pg_trigger
--    where tgname = 'user_media_sync_rating';                       -- 0
-- ============================================================

drop trigger if exists user_media_sync_rating on public.user_media;
drop function if exists public.user_media_sync_rating();

alter table public.user_media drop column if exists score;
