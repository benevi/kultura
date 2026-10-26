-- Casos de F-24 (notas finas y diario) contra la migración aplicada en un
-- Postgres local (sin Supabase). Cada caso imprime "OK <caso>" o aborta con
-- "FALLO <caso>". Uso, en una base vacía (mismo arnés que moderation):
--   psql -d f24 -f tests/integration/moderation/local-pg-stub.sql
--   for f in supabase/migrations/*.sql; do
--     sed '/supabase_vault\|pg_graphql\|pg_stat_statements/d' "$f" | psql -d f24 -v ON_ERROR_STOP=1 -f -
--   done
--   psql -d f24 -f tests/integration/diary/local-pg-cases.sql
-- El relleno (paso 3 de la migración) se prueba aparte con
-- local-pg-backfill.sql (antes y después de aplicar la de F-24).
\set ON_ERROR_STOP 1

create or replace function t_as(uid uuid, demo boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated',
                      'app_metadata', json_build_object('demo', demo))::text, false);
  execute 'set role authenticated';
end $$;
create or replace function t_reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;
grant execute on function t_as(uuid, boolean), t_reset() to authenticated, anon;

create or replace function t_fails(uid uuid, stmt text, demo boolean default false) returns boolean language plpgsql as $$
begin
  perform t_as(uid, demo);
  begin
    execute stmt;
  exception when others then
    perform t_reset();
    return true;
  end;
  perform t_reset();
  return false;
end $$;
create or replace function t_rows(uid uuid, stmt text, demo boolean default false) returns int language plpgsql as $$
declare n int;
begin
  perform t_as(uid, demo);
  execute 'with x as (' || stmt || ') select count(*) from x' into n;
  perform t_reset();
  return n;
exception when others then
  perform t_reset();
  raise;
end $$;
create or replace function t_check(name text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALLO %', name; end if;
  raise notice 'OK %', name;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000024a1', 'f24a@t.es'),
  ('00000000-0000-4000-8000-0000000024b2', 'f24b@t.es'),
  ('00000000-0000-4000-8000-0000000024d3', 'f24demo@t.es')
on conflict do nothing;

\set ana '''00000000-0000-4000-8000-0000000024a1'''
\set bea '''00000000-0000-4000-8000-0000000024b2'''
\set demo '''00000000-0000-4000-8000-0000000024d3'''

insert into public.media (id, external_id, type, title) values
  ('movie_f24_1', 'f24_1', 'movie', 'F24 uno'),
  ('movie_f24_2', 'f24_2', 'movie', 'F24 dos'),
  ('movie_f24_3', 'f24_3', 'movie', 'F24 tres')
on conflict do nothing;

-- ── Sincronía score ↔ rating10 (escrito con el JWT del usuario) ─────────
select t_check('el usuario inserta con score (código sin bandera)', not t_fails(:ana,
  $$insert into public.user_media (user_id, media_id, status, score)
    values ('00000000-0000-4000-8000-0000000024a1', 'movie_f24_1', 'completed', 3)$$));
select t_check('score 3 → rating10 6',
  (select rating10 = 6 and score = 3 from public.user_media where media_id = 'movie_f24_1' and user_id = :ana));

update public.user_media set rating10 = 9 where media_id = 'movie_f24_1' and user_id = :ana;
select t_check('rating10 9 (Letterboxd 4,5★) → score 5 y rating10 sigue en 9, sin pérdida',
  (select rating10 = 9 and score = 5 from public.user_media where media_id = 'movie_f24_1' and user_id = :ana));

-- El código sin bandera reenvía la misma `score` al cambiar solo el estado.
update public.user_media set score = 5, status = 'completed' where media_id = 'movie_f24_1' and user_id = :ana;
select t_check('reescribir la misma score no pisa la nota fina (9 se queda en 9)',
  (select rating10 = 9 from public.user_media where media_id = 'movie_f24_1' and user_id = :ana));

update public.user_media set score = 2 where media_id = 'movie_f24_1' and user_id = :ana;
select t_check('cambiar score (sin bandera) → rating10 = score × 2',
  (select rating10 = 4 and score = 2 from public.user_media where media_id = 'movie_f24_1' and user_id = :ana));

update public.user_media set rating10 = 7.5, score = 4 where media_id = 'movie_f24_1' and user_id = :ana;
select t_check('rating10 7,5 → score 4',
  (select rating10 = 7.5 and score = 4 from public.user_media where media_id = 'movie_f24_1' and user_id = :ana));

update public.user_media set rating10 = 0.5 where media_id = 'movie_f24_1' and user_id = :ana;
select t_check('rating10 0,5 → score 1 (nunca 0: user_media_score_check)',
  (select rating10 = 0.5 and score = 1 from public.user_media where media_id = 'movie_f24_1' and user_id = :ana));

update public.user_media set rating10 = null where media_id = 'movie_f24_1' and user_id = :ana;
select t_check('quitar la nota fina quita también score',
  (select rating10 is null and score is null from public.user_media where media_id = 'movie_f24_1' and user_id = :ana));

update public.user_media set score = 4 where media_id = 'movie_f24_1' and user_id = :ana;
update public.user_media set score = null where media_id = 'movie_f24_1' and user_id = :ana;
select t_check('quitar score (sin bandera) quita también rating10',
  (select rating10 is null and score is null from public.user_media where media_id = 'movie_f24_1' and user_id = :ana));

-- (Cada escritura en su propio t_check: Postgres no garantiza el orden de los AND.)
select t_check('insert con rating10 (con bandera)',
  not t_fails(:ana, $$insert into public.user_media (user_id, media_id, status, rating10, score, favorite)
    values ('00000000-0000-4000-8000-0000000024a1', 'movie_f24_2', 'completed', 8.5, 4, true)$$));
select t_check('… y score derivado (8,5 → 4) con favorito',
  (select rating10 = 8.5 and score = 4 and favorite from public.user_media where media_id = 'movie_f24_2' and user_id = :ana));

select t_check('rating10 fuera de pasos de 0,5 → CHECK', t_fails(:ana,
  $$update public.user_media set rating10 = 7.3 where media_id = 'movie_f24_2'$$));
select t_check('rating10 > 10 → CHECK', t_fails(:ana,
  $$update public.user_media set rating10 = 10.5 where media_id = 'movie_f24_2'$$));
select t_check('favorite por defecto false',
  (select favorite = false from public.user_media where media_id = 'movie_f24_1' and user_id = :ana));

-- ── Diario ───────────────────────────────────────────────────────────────
select t_check('el dueño registra un revisionado con fecha y reseña', not t_fails(:ana,
  $$insert into public.user_media_logs (user_id, media_id, watched_on, rewatch, rating10, review, spoiler, private_note)
    values ('00000000-0000-4000-8000-0000000024a1', 'movie_f24_2', '2026-10-20', true, 9, 'Mejor la segunda vez', true, 'Con Bea')$$));
select t_check('el dueño lee su diario', t_rows(:ana, 'select * from public.user_media_logs') = 1);
select t_check('otro usuario con sesión no lee el diario ajeno', t_rows(:bea, 'select * from public.user_media_logs') = 0);
select t_check('nadie escribe en el diario de otro', t_fails(:bea,
  $$insert into public.user_media_logs (user_id, media_id) values ('00000000-0000-4000-8000-0000000024a1', 'movie_f24_2')$$));
select t_check('un registro sin entrada de biblioteca → FK', t_fails(:ana,
  $$insert into public.user_media_logs (user_id, media_id) values ('00000000-0000-4000-8000-0000000024a1', 'movie_f24_3')$$));
select t_check('otro usuario no cambia ni borra el diario ajeno',
  t_rows(:bea, $$update public.user_media_logs set review = 'x' returning 1$$) = 0
  and t_rows(:bea, $$delete from public.user_media_logs returning 1$$) = 0);
select t_check('reseña de más de 5.000 caracteres → CHECK', t_fails(:ana,
  $$insert into public.user_media_logs (user_id, media_id, review) values ('00000000-0000-4000-8000-0000000024a1', 'movie_f24_2', repeat('a', 5001))$$));
select t_check('registro mínimo (solo el título)', not t_fails(:ana,
  $$insert into public.user_media_logs (user_id, media_id) values ('00000000-0000-4000-8000-0000000024a1', 'movie_f24_2')$$));
select t_check('fecha por defecto: hoy; revisionado y spoiler por defecto false',
  (select watched_on = current_date and not rewatch and not spoiler from public.user_media_logs
        where user_id = :ana and review is null));

do $$ begin
  set local role anon;
  begin
    perform 1 from public.user_media_logs;
    raise exception 'FALLO anónimo lee user_media_logs';
  exception when insufficient_privilege then
    raise notice 'OK anónimo no puede leer user_media_logs';
  end;
  reset role;
end $$;

-- Demo de solo lectura (demo_no_*)
insert into public.user_media (user_id, media_id, status) values (:demo, 'movie_f24_1', 'completed');
select t_check('la demo no escribe en el diario', t_fails(:demo,
  $$insert into public.user_media_logs (user_id, media_id) values ('00000000-0000-4000-8000-0000000024d3', 'movie_f24_1')$$, true));
select t_check('la demo no cambia su nota fina', t_rows(:demo,
  $$update public.user_media set rating10 = 6 where user_id = '00000000-0000-4000-8000-0000000024d3' returning 1$$, true) = 0);
select t_check('rls_audit: todas las tablas ok (user_media_logs incluida)',
  not exists (select 1 from public.rls_audit() where not ok)
  and exists (select 1 from public.rls_audit() where tabla = 'user_media_logs' and escritura_authenticated and demo_insert));

-- Quitar de la biblioteca borra su diario (lo dice el diálogo de quitar).
select t_check('el dueño quita el título de su biblioteca', not t_fails(:ana,
  $$delete from public.user_media where media_id = 'movie_f24_2' and user_id = '00000000-0000-4000-8000-0000000024a1'$$));
select t_check('… y se borran sus registros del diario',
  (select count(*) = 0 from public.user_media_logs where user_id = :ana));
