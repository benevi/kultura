-- Relleno de rating10 (paso 3 de 20261208240001_rating10_logs.sql) en un
-- Postgres local. Uso:
--   1. aplicar todas las migraciones MENOS la de F-24 (ver local-pg-cases.sql);
--   2. psql -d f24 -v after=0 -f tests/integration/diary/local-pg-backfill.sql
--   3. aplicar 20261208240001_rating10_logs.sql (dos veces: idempotente);
--   4. psql -d f24 -v after=1 -f tests/integration/diary/local-pg-backfill.sql
\set ON_ERROR_STOP 1
\if :after
do $$ begin
  if exists (select 1 from public.user_media
              where media_id like 'movie_f24bf_%' and score is not null
                and rating10 is distinct from score * 2) then
    raise exception 'FALLO relleno: alguna nota sin rating10 = score × 2';
  end if;
  raise notice 'OK relleno: rating10 = score × 2 en todas las filas con nota';
  if exists (select 1 from public.user_media
              where media_id = 'movie_f24bf_3' and (score is not null or rating10 is not null)) then
    raise exception 'FALLO relleno: una fila sin nota ha recibido nota';
  end if;
  raise notice 'OK relleno: las filas sin nota siguen sin nota';
  if exists (select 1 from public.user_media
              where media_id like 'movie_f24bf_%' and updated_at <> timestamptz '2025-01-01 00:00:00+00') then
    raise exception 'FALLO relleno: ha cambiado updated_at';
  end if;
  raise notice 'OK relleno: updated_at intacto (las bibliotecas no salen como actualizadas hoy)';
  if not exists (select 1 from pg_trigger where tgname = 'user_media_set_updated_at' and tgenabled = 'O') then
    raise exception 'FALLO relleno: user_media_set_updated_at quedó desactivado';
  end if;
  raise notice 'OK relleno: user_media_set_updated_at vuelve a estar activo';
end $$;
\else
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000024bf', 'f24bf@t.es')
on conflict do nothing;
insert into public.media (id, external_id, type, title) values
  ('movie_f24bf_1', 'f24bf_1', 'movie', 'BF1'),
  ('movie_f24bf_2', 'f24bf_2', 'movie', 'BF2'),
  ('movie_f24bf_3', 'f24bf_3', 'movie', 'BF3')
on conflict do nothing;
insert into public.user_media (user_id, media_id, status, score) values
  ('00000000-0000-4000-8000-0000000024bf', 'movie_f24bf_1', 'completed', 3),
  ('00000000-0000-4000-8000-0000000024bf', 'movie_f24bf_2', 'completed', 5),
  ('00000000-0000-4000-8000-0000000024bf', 'movie_f24bf_3', 'pending', null);
alter table public.user_media disable trigger user_media_set_updated_at;
update public.user_media set updated_at = timestamptz '2025-01-01 00:00:00+00'
 where media_id like 'movie_f24bf_%';
alter table public.user_media enable trigger user_media_set_updated_at;
\echo 'sembrado: aplica ahora 20261208240001_rating10_logs.sql y repite con -v after=1'
\endif
