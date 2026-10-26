-- ============================================================
-- F-29 · Caché de adaptaciones de Wikidata (media_adaptations) — PRO-11
--
-- QUÉ HACE (el código funciona antes y después de aplicarla):
--   1. public.media_adaptations: por cada título de KULTURA ("movie_438631"),
--      sus adaptaciones y obras relacionadas según Wikidata (P144 "basado en"
--      y sus inversas, otras adaptaciones de la misma obra y su franquicia),
--      ya traducidas a ids de KULTURA (`links`, JSON). La ficha la lee para
--      pintar "También existe como…" sin preguntar a Wikidata en cada visita.
--      - `status`: 'ok' (con o sin vínculos), 'not_found' (Wikidata no conoce
--        el título: caché negativa más corta) o 'partial' (faltó resolver algo,
--        p. ej. un juego en RAWG: se reintenta antes).
--      - `expires_at`: TTL que pone el servidor (30 días con vínculos, 7 sin
--        ellos o sin el título, 1 día si es parcial). Una fila caducada se
--        sigue sirviendo si Wikidata no responde (mejor viejo que nada).
--   2. Lectura para cualquiera (anon y authenticated: son datos públicos de
--      Wikidata, CC0) y escritura SOLO del servidor con el service role (que
--      ignora la RLS): sin políticas de escritura y sin privilegios de
--      INSERT/UPDATE/DELETE para anon ni authenticated.
--   3. Vuelve a ejecutar el bloque demo_no_* al final (como las anteriores).
--
-- ANTES de aplicarla, el código detecta la tabla ausente (42P01 / PGRST205) y
-- guarda la respuesta de Wikidata en la caché de datos de Next (misma TTL).
-- No hay banderas que activar.
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios.
-- Nombres verificados contra 20260502233945_remote_schema.sql (media.id es
-- text "{type}_{externalId}", CHECK media_type_check con los 7 tipos) y el
-- bloque demo de 20261208250001_platforms_mixed_lists.sql.
--
-- CÓMO APLICARLA (Víctor): SQL Editor del proyecto de TEST → pegar entero →
-- Run; repetir en producción.
--
-- COMPROBACIÓN (SQL Editor, tras aplicarla):
--   select relrowsecurity from pg_class
--    where oid = 'public.media_adaptations'::regclass;                    -- true
--   select policyname, cmd, roles from pg_policies
--    where tablename = 'media_adaptations' and permissive = 'PERMISSIVE'; -- 1 fila: select, {anon,authenticated}
--   select has_table_privilege('anon', 'public.media_adaptations', 'select'),
--          has_table_privilege('authenticated', 'public.media_adaptations', 'insert'),
--          has_table_privilege('anon', 'public.media_adaptations', 'update'); -- t, f, f
--   select * from public.rls_audit() where not ok;                          -- 0 filas
--   -- Tras abrir la ficha de Dune (https://kulturaapp.vercel.app/es/media/movie/438631):
--   select media_id, subject_qid, status, jsonb_array_length(links), expires_at
--     from public.media_adaptations order by fetched_at desc limit 5;   -- movie_438631 | Q…
-- ============================================================


-- ── 1. media_adaptations ─────────────────────────────────────────────────
create table if not exists public.media_adaptations (
  media_id text primary key,
  subject_qid text,
  links jsonb not null default '[]'::jsonb,
  status text not null default 'ok',
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'media_adaptations_media_id_check'
                    and conrelid = 'public.media_adaptations'::regclass) then
    alter table public.media_adaptations add constraint media_adaptations_media_id_check
      check (media_id ~ '^(movie|tv|anime|manga|book|comic|game)_[A-Za-z0-9_-]{1,80}$');
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'media_adaptations_subject_qid_check'
                    and conrelid = 'public.media_adaptations'::regclass) then
    alter table public.media_adaptations add constraint media_adaptations_subject_qid_check
      check (subject_qid is null or subject_qid ~ '^Q[0-9]{1,12}$');
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'media_adaptations_links_check'
                    and conrelid = 'public.media_adaptations'::regclass) then
    alter table public.media_adaptations add constraint media_adaptations_links_check
      check (jsonb_typeof(links) = 'array' and pg_column_size(links) <= 65536);
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'media_adaptations_status_check'
                    and conrelid = 'public.media_adaptations'::regclass) then
    alter table public.media_adaptations add constraint media_adaptations_status_check
      check (status in ('ok', 'not_found', 'partial'));
  end if;
end $$;

create index if not exists media_adaptations_expires_at_idx on public.media_adaptations (expires_at);


-- ── 2. RLS: lectura pública, escritura solo del service role ─────────────
alter table public.media_adaptations enable row level security;

revoke all on public.media_adaptations from public, anon, authenticated;
grant select on public.media_adaptations to anon, authenticated;
grant select, insert, update, delete on public.media_adaptations to service_role;

drop policy if exists "media_adaptations_select_all" on public.media_adaptations;
create policy "media_adaptations_select_all" on public.media_adaptations
  for select to anon, authenticated
  using (true);


-- ── 3. Demo de solo lectura también en la tabla nueva (copia de 20261008000001) ─
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists demo_no_insert on public.%I', t.relname);
    execute format('drop policy if exists demo_no_update on public.%I', t.relname);
    execute format('drop policy if exists demo_no_delete on public.%I', t.relname);

    execute format(
      'create policy demo_no_insert on public.%I as restrictive for insert to authenticated
         with check (not public.is_demo_session())', t.relname);
    execute format(
      'create policy demo_no_update on public.%I as restrictive for update to authenticated
         using (not public.is_demo_session()) with check (not public.is_demo_session())', t.relname);
    execute format(
      'create policy demo_no_delete on public.%I as restrictive for delete to authenticated
         using (not public.is_demo_session())', t.relname);
  end loop;
end
$$;
