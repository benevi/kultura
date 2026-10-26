-- Casos de F-25 (plataformas privadas y listas mixtas) contra la migración
-- 20261208250001 aplicada en un PostgreSQL 16 local (sin Supabase). Cada caso
-- imprime "OK <caso>" o aborta con "FALLO <caso>". Uso, en una base vacía
-- (mismo arnés que moderation y diary):
--   psql -d f25 -f tests/integration/moderation/local-pg-stub.sql
--   for f in supabase/migrations/*.sql; do
--     sed '/supabase_vault\|pg_graphql\|pg_stat_statements/d' "$f" | psql -d f25 -v ON_ERROR_STOP=1 -f -
--   done
--   psql -d f25 -f tests/integration/plataformas/local-pg-cases.sql
\set ON_ERROR_STOP 1

create or replace function t_as(uid uuid, demo boolean default false) returns void language plpgsql as $$
begin
  if uid is null then
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
    execute 'set role anon';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', uid, 'role', 'authenticated',
                        'app_metadata', json_build_object('demo', demo))::text, false);
    execute 'set role authenticated';
  end if;
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
  ('00000000-0000-4000-8000-0000000025a1', 'f25a@t.es'),
  ('00000000-0000-4000-8000-0000000025b2', 'f25b@t.es'),
  ('00000000-0000-4000-8000-0000000025d3', 'f25demo@t.es')
on conflict do nothing;
-- Por si el arnés no tiene el disparador que crea la fila de `users`.
insert into public.users (id, username, avatar_initials) values
  ('00000000-0000-4000-8000-0000000025a1', 'u_f25aaa', 'AA'),
  ('00000000-0000-4000-8000-0000000025b2', 'u_f25bbb', 'BB'),
  ('00000000-0000-4000-8000-0000000025d3', 'u_f25ddd', 'DD')
on conflict do nothing;

\set ana '''00000000-0000-4000-8000-0000000025a1'''
\set bea '''00000000-0000-4000-8000-0000000025b2'''
\set demo '''00000000-0000-4000-8000-0000000025d3'''

-- ── Mis plataformas: privadas ────────────────────────────────────────────
select t_check('ana guarda sus plataformas (upsert con su JWT)', not t_fails(:ana,
  $$insert into public.user_streaming_services (user_id, services, region)
    values ('00000000-0000-4000-8000-0000000025a1', array[8, 63], 'ES')
    on conflict (user_id) do update set services = excluded.services, region = excluded.region$$));
select t_check('ana lee las suyas', t_rows(:ana,
  $$select 1 from public.user_streaming_services where user_id = '00000000-0000-4000-8000-0000000025a1'$$) = 1);
select t_check('bea (otra cuenta con sesión) no lee NADA de la tabla', t_rows(:bea,
  $$select 1 from public.user_streaming_services$$) = 0);
select t_check('anon no puede ni consultarla', t_fails(null,
  $$select 1 from public.user_streaming_services$$));
select t_check('bea no escribe las de ana', t_fails(:bea,
  $$insert into public.user_streaming_services (user_id, services) values ('00000000-0000-4000-8000-0000000025a1', array[8])$$));
select t_check('bea no cambia las de ana (0 filas)', t_rows(:bea,
  $$update public.user_streaming_services set services = array[337] returning 1$$) = 0);
select t_check('bea no borra las de ana (0 filas)', t_rows(:bea,
  $$delete from public.user_streaming_services returning 1$$) = 0);
select t_check('users ya no tiene columnas de plataformas',
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'users' and column_name like 'streaming%'));
select t_check('demo no guarda plataformas', t_fails(:demo,
  $$insert into public.user_streaming_services (user_id, services) values ('00000000-0000-4000-8000-0000000025d3', array[8])$$, true));
select t_check('CHECK: ids no positivos', t_fails(:ana,
  $$update public.user_streaming_services set services = array[0] where user_id = '00000000-0000-4000-8000-0000000025a1'$$));
select t_check('CHECK: región que no es ISO de 2 letras', t_fails(:ana,
  $$update public.user_streaming_services set region = 'es' where user_id = '00000000-0000-4000-8000-0000000025a1'$$));

-- ── Listas: crear con RETURNING, mixtas, orden y notas ───────────────────
select t_check('ana crea una lista privada con RETURNING (lo que fallaba)', t_rows(:ana,
  $$insert into public.lists (id, owner_id, name, media_type, template, description)
    values ('00000000-0000-4000-8000-00000000251f', '00000000-0000-4000-8000-0000000025a1', 'Dune', 'mixed', 'franchise', 'De los libros al juego')
    returning id$$) = 1);
insert into public.media (id, external_id, type, title) values
  ('book_f25', 'f25', 'book', 'Dune'), ('movie_f25', 'f25', 'movie', 'Dune (2021)'), ('game_f25', 'f25', 'game', 'Dune: Awakening')
on conflict do nothing;
select t_check('libro + película + juego en la misma lista', not t_fails(:ana,
  $$insert into public.list_items (list_id, media_id, added_by) values
    ('00000000-0000-4000-8000-00000000251f', 'book_f25', '00000000-0000-4000-8000-0000000025a1'),
    ('00000000-0000-4000-8000-00000000251f', 'movie_f25', '00000000-0000-4000-8000-0000000025a1'),
    ('00000000-0000-4000-8000-00000000251f', 'game_f25', '00000000-0000-4000-8000-0000000025a1')$$));
select t_check('posiciones 0, 1, 2 por orden de alta',
  (select array_agg(position order by position) = array[0, 1, 2]
     from public.list_items where list_id = '00000000-0000-4000-8000-00000000251f'));
select t_check('bea no lee la lista privada de ana', t_rows(:bea,
  $$select 1 from public.list_items where list_id = '00000000-0000-4000-8000-00000000251f'$$) = 0);
select t_check('bea no reordena (0 filas)', t_rows(:bea,
  $$select public.reorder_list_items('00000000-0000-4000-8000-00000000251f',
      array(select id from public.list_items where list_id = '00000000-0000-4000-8000-00000000251f')) as n$$) = 1
  and (select array_agg(media_id order by position) = array['book_f25', 'movie_f25', 'game_f25']
         from public.list_items where list_id = '00000000-0000-4000-8000-00000000251f'));
do $$
declare ids uuid[];
begin
  select array_agg(id order by position desc) into ids from public.list_items
   where list_id = '00000000-0000-4000-8000-00000000251f';
  perform t_as('00000000-0000-4000-8000-0000000025a1');
  perform public.reorder_list_items('00000000-0000-4000-8000-00000000251f', ids);
  perform t_reset();
end $$;
select t_check('ana reordena: juego, película, libro (persiste)',
  (select array_agg(media_id order by position) = array['game_f25', 'movie_f25', 'book_f25']
     from public.list_items where list_id = '00000000-0000-4000-8000-00000000251f'));
select t_check('ana anota un título', not t_fails(:ana,
  $$update public.list_items set note = 'Empieza aquí' where media_id = 'book_f25'$$));
select t_check('un UPDATE no puede mover un título de lista', t_fails(:ana,
  $$update public.list_items set list_id = list_id where media_id = 'book_f25'$$));

select t_reset();
