-- ============================================================
-- F-24 · Notas finas y diario (rating10_logs) — D-14 / PRO-4
--
-- QUÉ HACE (el código funciona antes y después de aplicarla):
--   1. user_media.rating10 numeric(3,1): nota de 0,5 a 10 en pasos de 0,5
--      (½★ sobre 5 o /10, según la preferencia de cada persona). La columna
--      vieja `score` (1-5 enteros, user_media_score_check) SE QUEDA: la leen
--      el match score, las recomendaciones, los perfiles y el feed. Y
--      user_media.favorite boolean (por defecto false).
--   2. Disparador user_media_sync_rating (BEFORE INSERT OR UPDATE): mantiene
--      las dos columnas de acuerdo pase lo que pase:
--        - si cambia rating10 → score = redondeo de rating10 / 2 (mín. 1);
--        - si solo cambia score (código sin la bandera RATING_SCALE_10, o
--          un cliente antiguo) → rating10 = score × 2.
--      Ejemplos: score 3 → rating10 6; rating10 9 (Letterboxd 4,5★) → score 5
--      y rating10 se queda en 9 (sin pérdida); rating10 7,5 → score 4.
--   3. Relleno: rating10 = score × 2 en las filas que ya tenían nota. Sin
--      tocar updated_at (se desactiva un momento user_media_set_updated_at:
--      si no, todas las bibliotecas saldrían como "actualizadas hoy").
--   4. public.user_media_logs: diario de visionados/lecturas/partidas
--      (fecha, revisionado, nota de ese día, reseña, spoiler, nota personal).
--      FK compuesta a user_media (user_id, media_id) ON DELETE CASCADE: quitar
--      un título de la biblioteca borra su diario (lo dice el diálogo).
--      RLS: solo su dueño lee y escribe (la reseña y la nota personal viven en
--      la misma fila; enseñar reseñas a amigos necesitará una vista sin
--      private_note). Anónimo, nunca.
--   5. Vuelve a ejecutar el bloque demo_no_* al final (cubre user_media_logs).
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios
-- (ADD COLUMN IF NOT EXISTS, constraints con comprobación previa, CREATE OR
-- REPLACE, DROP … IF EXISTS antes de cada CREATE TRIGGER / POLICY).
-- Nombres verificados contra 20260502233945_remote_schema.sql (user_media,
-- user_media_user_id_media_id_key, user_media_set_updated_at, set_updated_at),
-- 20261008000001_demo_read_only.sql (is_demo_session) y
-- 20261101120001_identity_privacy.sql (bloque demo_no_*).
--
-- CÓMO APLICARLA (Víctor): SQL Editor del proyecto de TEST → pegar entero →
-- Run; repetir en producción. Después, en Vercel: RATING_SCALE_10=1 y
-- redesplegar. Sin la bandera la app sigue escribiendo `score` como hoy y el
-- disparador rellena rating10.
--
-- COMPROBACIÓN (SQL Editor, tras aplicarla):
--   select column_name, data_type, numeric_precision, numeric_scale
--     from information_schema.columns
--    where table_schema='public' and table_name='user_media'
--      and column_name in ('rating10','favorite');                -- 2 filas
--   select count(*) from public.user_media
--    where score is not null and rating10 is distinct from score * 2;  -- 0
--   select * from public.rls_audit() where not ok;                -- 0 filas
--   select policyname from pg_policies where tablename='user_media_logs'
--    order by 1;   -- demo_no_delete/insert/update + 4 user_media_logs_*_own
--   -- Disparador (no deja nada: rollback):
--   begin;
--   update public.user_media set score = 3
--    where id = (select id from public.user_media limit 1)
--   returning score, rating10;                                    -- 3 | 6.0
--   update public.user_media set rating10 = 9
--    where id = (select id from public.user_media limit 1)
--   returning score, rating10;                                    -- 5 | 9.0
--   rollback;
-- ============================================================


-- ── 1. user_media.rating10 y favorite ─────────────────────────────────────
alter table public.user_media add column if not exists rating10 numeric(3,1);
alter table public.user_media add column if not exists favorite boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'user_media_rating10_check'
       and conrelid = 'public.user_media'::regclass
  ) then
    alter table public.user_media add constraint user_media_rating10_check
      check (rating10 is null or (rating10 between 0.5 and 10 and rating10 * 2 = trunc(rating10 * 2)));
  end if;
end $$;


-- ── 2. Sincronía score ↔ rating10 ─────────────────────────────────────────
create or replace function public.user_media_sync_rating()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.rating10 is not null then
      new.score := greatest(1, least(5, round(new.rating10 / 2)))::smallint;
    elsif new.score is not null then
      new.rating10 := (new.score * 2)::numeric(3,1);
    end if;
  else
    if new.rating10 is distinct from old.rating10 then
      new.score := case
        when new.rating10 is null then null
        else greatest(1, least(5, round(new.rating10 / 2)))::smallint
      end;
    elsif new.score is distinct from old.score then
      new.rating10 := case
        when new.score is null then null
        else (new.score * 2)::numeric(3,1)
      end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_media_sync_rating on public.user_media;
create trigger user_media_sync_rating
  before insert or update on public.user_media
  for each row execute function public.user_media_sync_rating();


-- ── 3. Relleno de las notas que ya existían (sin tocar updated_at) ────────
alter table public.user_media disable trigger user_media_set_updated_at;
update public.user_media
   set rating10 = (score * 2)::numeric(3,1)
 where score is not null and rating10 is null;
alter table public.user_media enable trigger user_media_set_updated_at;


-- ── 4. Diario: user_media_logs ────────────────────────────────────────────
create table if not exists public.user_media_logs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null,
  media_id     text        not null,
  watched_on   date        not null default current_date,
  rewatch      boolean     not null default false,
  rating10     numeric(3,1),
  review       text,
  spoiler      boolean     not null default false,
  private_note text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint user_media_logs_entry_fkey foreign key (user_id, media_id)
    references public.user_media (user_id, media_id) on delete cascade,
  constraint user_media_logs_rating10_check
    check (rating10 is null or (rating10 between 0.5 and 10 and rating10 * 2 = trunc(rating10 * 2))),
  constraint user_media_logs_review_check
    check (review is null or char_length(review) <= 5000),
  constraint user_media_logs_private_note_check
    check (private_note is null or char_length(private_note) <= 2000),
  constraint user_media_logs_watched_on_check
    check (watched_on >= date '1900-01-01')
);

create index if not exists user_media_logs_user_watched_idx
  on public.user_media_logs (user_id, watched_on desc, created_at desc);
create index if not exists user_media_logs_entry_idx
  on public.user_media_logs (user_id, media_id);

drop trigger if exists user_media_logs_set_updated_at on public.user_media_logs;
create trigger user_media_logs_set_updated_at
  before update on public.user_media_logs
  for each row execute function public.set_updated_at();

alter table public.user_media_logs enable row level security;
revoke all on table public.user_media_logs from anon;
grant select, insert, update, delete on table public.user_media_logs to authenticated;
grant all on table public.user_media_logs to service_role;

drop policy if exists "user_media_logs_select_own" on public.user_media_logs;
create policy "user_media_logs_select_own" on public.user_media_logs
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_media_logs_insert_own" on public.user_media_logs;
create policy "user_media_logs_insert_own" on public.user_media_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_media_logs_update_own" on public.user_media_logs;
create policy "user_media_logs_update_own" on public.user_media_logs
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_media_logs_delete_own" on public.user_media_logs;
create policy "user_media_logs_delete_own" on public.user_media_logs
  for delete to authenticated
  using (auth.uid() = user_id);


-- ── 5. Demo de solo lectura en todas las tablas (copia de 20261008000001) ─
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
