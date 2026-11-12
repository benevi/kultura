-- ============================================================
-- Saneamiento 6.6 (3/3) · Una sola fuente del progreso: fuera
-- user_media.episode_progress
--
-- QUÉ HACE:
--   1. Borra el disparador user_media_sync_progress y su función (migración
--      20261215270001): mantenía el jsonb episode_progress como espejo de
--      las columnas progress_* y ya no hace falta.
--   2. Borra la columna user_media.episode_progress (jsonb {season?,
--      episode}). El progreso vive solo en las columnas progress_*.
--   3. Borra la columna user_media.progress_updated_at: solo la rellenaba
--      ese disparador y nada la lee (ni la app, ni funciones, vistas o
--      índices).
--
-- ORDEN (obligatorio): solo DESPUÉS de que producción ejecute el código de
-- los PR 1 y 2 de 6.6 (#138 lee solo las columnas, #139 ya no escribe el
-- jsonb). Antes, una escritura de episode_progress fallaría con "column
-- does not exist".
--
-- Comprobado antes (prod y test, 12-11-2026): 0 filas con episode_progress o
-- progress_updated_at; lo único en la base que usa esas columnas es la
-- función del disparador.
--
-- IDEMPOTENTE: IF EXISTS en todo.
--
-- VUELTA ATRÁS (si hiciera falta): volver a crear las columnas y aplicar de
-- nuevo la sección 2 de 20261215270001_progress.sql (función y disparador):
--   alter table public.user_media add column episode_progress jsonb;
--   alter table public.user_media add column progress_updated_at timestamptz;
-- y rellenar el jsonb desde las columnas con un UPDATE que las toque.
--
-- COMPROBACIÓN:
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'user_media'
--      and column_name in ('episode_progress', 'progress_updated_at'); -- 0
--   select count(*) from pg_trigger
--    where tgname = 'user_media_sync_progress';                         -- 0
-- ============================================================

drop trigger if exists user_media_sync_progress on public.user_media;
drop function if exists public.user_media_sync_progress();

alter table public.user_media drop column if exists episode_progress;
alter table public.user_media drop column if exists progress_updated_at;
