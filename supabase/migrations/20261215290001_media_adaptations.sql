-- ============================================================
-- F-29 · Caché de adaptaciones de Wikidata (media_adaptations)
--
-- QUÉ HACE (el código funciona antes y después de aplicarla):
--   public.media_adaptations: una fila por título de KULTURA (`movie_438631`)
--   con lo que Wikidata dice de él: entidad (`Q…`), obras en que se basa
--   (P144), sus adaptaciones, otras adaptaciones de la misma obra y su
--   franquicia (P8345/P179), ya traducidas a ids de KULTURA (`payload`, jsonb,
--   con etiquetas es/en). Así la ficha no pregunta a Wikidata en cada visita:
--   30 días si había datos, 7 si no (lo decide la app con `fetched_at`).
--
--   SOLO SERVIDOR: la lee y escribe la app con el service role (que ignora la
--   RLS). RLS activada y NINGUNA política: anon y authenticated no ven ni
--   tocan nada (además se les revoca todo). No guarda nada de ningún usuario.
--   Sin políticas de escritura para authenticated, `rls_audit()` la da por
--   buena sin bloque demo_no_* (no hay escritura que bloquear).
--
-- IDEMPOTENTE: CREATE TABLE / INDEX IF NOT EXISTS; ENABLE RLS y REVOKE se
-- pueden repetir sin error ni cambios.
--
-- CÓMO APLICARLA (Víctor): SQL Editor del proyecto de TEST → pegar entero →
-- Run; repetir en producción. Después, en Vercel: ADAPTATIONS_CACHE=1 y
-- redesplegar. Sin la bandera la app no usa la tabla (solo la caché de datos
-- de Next, 24 h); con la bandera y sin la tabla (42P01) sigue igual.
--
-- CÓMO COMPROBARLO (SQL Editor, tras aplicarla):
--   select relrowsecurity from pg_class
--    where oid = 'public.media_adaptations'::regclass;              -- true
--   select count(*) from pg_policies
--    where schemaname = 'public' and tablename = 'media_adaptations'; -- 0
--   select has_table_privilege('anon', 'public.media_adaptations', 'select'),
--          has_table_privilege('authenticated', 'public.media_adaptations', 'select');
--                                                                    -- false | false
--   select * from public.rls_audit() where not ok;                   -- 0 filas
--   -- Tras abrir la ficha de Dune (2021) con la bandera puesta:
--   select media_id, wikidata_id, jsonb_array_length(payload->'works'), fetched_at
--     from public.media_adaptations where media_id = 'movie_438631'; -- 1 fila, Q…
--   -- Desde fuera, con la clave anónima (debe fallar o salir vacío):
--   curl "https://<ref>.supabase.co/rest/v1/media_adaptations?select=media_id&limit=1" \
--     -H "apikey: <clave anónima>"                                   -- 401/permission denied
-- ============================================================

create table if not exists public.media_adaptations (
  media_id    text primary key,
  wikidata_id text,
  payload     jsonb not null default '{}'::jsonb,
  fetched_at  timestamptz not null default now(),
  constraint media_adaptations_media_id_check check (char_length(media_id) between 3 and 80),
  constraint media_adaptations_wikidata_id_check check (wikidata_id is null or wikidata_id ~ '^Q[0-9]+$')
);

create index if not exists media_adaptations_fetched_at_idx on public.media_adaptations (fetched_at);

alter table public.media_adaptations enable row level security;

revoke all on table public.media_adaptations from anon, authenticated;
grant all on table public.media_adaptations to service_role;

comment on table public.media_adaptations is
  'F-29: caché de Wikidata (P144, adaptaciones, franquicia) por título. Solo service role; sin políticas.';

notify pgrst, 'reload schema';
