-- ============================================================
-- F-27 · Progreso por formato (PRO-5)
--
-- QUÉ HACE (el código funciona antes y después de aplicarla):
--   1. Columnas de progreso en public.user_media, una por unidad, con CHECK
--      de rangos (NULL = sin dato):
--        progress_season   smallint      0-999     temporada (series; 0 = especiales)
--        progress_episode  integer       1-99999   episodio (series y anime)
--        progress_chapter  numeric(6,1)  0-99999.9 capítulo (manga y cómic; 10.5 existe)
--        progress_volume   integer       0-9999    volumen / tomo (manga y cómic)
--        progress_page     integer       0-100000  página (libros)
--        progress_percent  smallint      0-100     % leído (libros)
--        progress_hours    numeric(6,1)  0-99999.9 horas jugadas (juegos)
--        progress_total    integer       1-100000  total de la unidad principal,
--                                                 copiado del proveedor (episodios
--                                                 de la temporada, capítulos,
--                                                 páginas, horas medias de RAWG)
--        progress_updated_at timestamptz         último cambio de progreso
--      La RLS es la de user_media (son columnas de la misma fila): no hace
--      falta ninguna política nueva; las demo_no_* de user_media siguen
--      cubriéndolas (se vuelve a ejecutar el bloque al final por coherencia).
--   2. La columna vieja `episode_progress` (jsonb {season?, episode}) SE
--      QUEDA como espejo: la leen Inicio, la importación/exportación y los
--      clientes antiguos. Disparador user_media_sync_progress (BEFORE INSERT
--      OR UPDATE) que mantiene las dos formas de acuerdo:
--        - si cambian las columnas → episode_progress = espejo de las
--          columnas (solo las que tienen valor; NULL si no hay progreso);
--        - si solo cambia episode_progress (código sin la bandera
--          PROGRESS_V2, un import, un cliente antiguo) → temporada y
--          episodio salen del jsonb (lo que no es número o se sale del rango
--          queda en NULL); capítulo, volumen, página, %, horas y total se
--          conservan si el jsonb no trae la clave (un escritor antiguo no
--          borra páginas ni horas); si cambia la temporada sin total en el
--          jsonb, progress_total pasa a NULL (era el de otra temporada).
--      Ejemplo: escribir {"season":2,"episode":5} → progress_season 2,
--      progress_episode 5; escribir progress_page = 120 con total 350 →
--      episode_progress = {"page":120,"total":350}.
--   3. Relleno: el progreso de episodios que ya existe pasa a las columnas
--      (sin tocar updated_at ni el propio jsonb).
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios
-- (ADD COLUMN IF NOT EXISTS, constraints con comprobación previa, CREATE OR
-- REPLACE, DROP TRIGGER IF EXISTS, el relleno solo toca filas sin migrar).
-- Nombres verificados contra 20260502233945_remote_schema.sql (user_media,
-- episode_progress jsonb, user_media_set_updated_at),
-- 20261208240001_rating10_logs.sql (patrón del disparador de sincronía) y
-- 20261101120001_identity_privacy.sql (bloque demo_no_*).
--
-- CÓMO APLICARLA (Víctor): SQL Editor del proyecto de TEST → pegar entero →
-- Run; repetir en producción. Después, en Vercel: PROGRESS_V2=1 y
-- redesplegar. Sin la bandera la app sigue guardando el progreso de
-- episodios en episode_progress como hoy (el disparador rellena las
-- columnas); con la bandera y sin la migración, se detecta y se vuelve a lo
-- de antes en vez de dar un 500.
--
-- COMPROBACIÓN (SQL Editor, tras aplicarla):
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='user_media'
--      and column_name like 'progress%' order by 1;           -- 9 filas
--   select count(*) from public.user_media
--    where episode_progress ? 'episode' and progress_episode is null
--      and jsonb_typeof(episode_progress->'episode') = 'number';  -- 0
--   select conname from pg_constraint
--    where conrelid='public.user_media'::regclass
--      and conname like 'user_media_progress%' order by 1;     -- 8 filas
--   select * from public.rls_audit() where not ok;             -- 0 filas
--   -- Disparador (no deja nada: rollback):
--   begin;
--   update public.user_media set episode_progress = '{"season":2,"episode":5}'
--    where id = (select id from public.user_media limit 1)
--   returning progress_season, progress_episode;               -- 2 | 5
--   update public.user_media set progress_episode = 6
--    where id = (select id from public.user_media limit 1)
--   returning episode_progress;                                -- {"season": 2, "episode": 6}
--   rollback;
-- ============================================================


-- ── 1. Columnas de progreso ───────────────────────────────────────────────
alter table public.user_media add column if not exists progress_season smallint;
alter table public.user_media add column if not exists progress_episode integer;
alter table public.user_media add column if not exists progress_chapter numeric(6,1);
alter table public.user_media add column if not exists progress_volume integer;
alter table public.user_media add column if not exists progress_page integer;
alter table public.user_media add column if not exists progress_percent smallint;
alter table public.user_media add column if not exists progress_hours numeric(6,1);
alter table public.user_media add column if not exists progress_total integer;
alter table public.user_media add column if not exists progress_updated_at timestamptz;

do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('user_media_progress_season_check',  'progress_season is null or progress_season between 0 and 999'),
      ('user_media_progress_episode_check', 'progress_episode is null or progress_episode between 1 and 99999'),
      ('user_media_progress_chapter_check', 'progress_chapter is null or progress_chapter between 0 and 99999.9'),
      ('user_media_progress_volume_check',  'progress_volume is null or progress_volume between 0 and 9999'),
      ('user_media_progress_page_check',    'progress_page is null or progress_page between 0 and 100000'),
      ('user_media_progress_percent_check', 'progress_percent is null or progress_percent between 0 and 100'),
      ('user_media_progress_hours_check',   'progress_hours is null or progress_hours between 0 and 99999.9'),
      ('user_media_progress_total_check',   'progress_total is null or progress_total between 1 and 100000')
    ) as v(name, expr)
  loop
    if not exists (
      select 1 from pg_constraint
       where conname = c.name and conrelid = 'public.user_media'::regclass
    ) then
      execute format('alter table public.user_media add constraint %I check (%s)', c.name, c.expr);
    end if;
  end loop;
end $$;


-- ── 2. Sincronía columnas ↔ episode_progress ─────────────────────────────
-- Un valor del jsonb vale si es un número dentro del rango (y entero cuando
-- la columna lo es); si no, NULL. Nunca lanza: un jsonb raro de un cliente
-- antiguo no puede tumbar la escritura.
create or replace function public.user_media_sync_progress()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  j jsonb;
  cols_changed boolean;
  json_changed boolean;
  has_progress boolean;
  v numeric;
begin
  if tg_op = 'INSERT' then
    cols_changed := num_nonnulls(new.progress_season, new.progress_episode, new.progress_chapter,
      new.progress_volume, new.progress_page, new.progress_percent, new.progress_hours) > 0;
    json_changed := new.episode_progress is not null;
  else
    cols_changed := (new.progress_season, new.progress_episode, new.progress_chapter, new.progress_volume,
                     new.progress_page, new.progress_percent, new.progress_hours, new.progress_total)
         is distinct from
                    (old.progress_season, old.progress_episode, old.progress_chapter, old.progress_volume,
                     old.progress_page, old.progress_percent, old.progress_hours, old.progress_total);
    json_changed := new.episode_progress is distinct from old.episode_progress;
  end if;

  -- Escritor antiguo: solo ha cambiado el jsonb. Ese código solo conoce
  -- temporada y episodio ({season?, episode}): esas dos salen del jsonb y el
  -- resto (capítulo, volumen, página, %, horas, total) se conserva salvo que
  -- el jsonb traiga la clave. Así guardar un libro o un juego con el código
  -- de antes (o un import) no borra sus páginas u horas. Si cambia la
  -- temporada, el total (episodios de ESA temporada) deja de valer → NULL.
  if not cols_changed and json_changed then
    j := case when jsonb_typeof(new.episode_progress) = 'object' then new.episode_progress else '{}'::jsonb end;
    v := case when jsonb_typeof(j->'season') = 'number' then (j->>'season')::numeric end;
    new.progress_season := case when v between 0 and 999 and v = trunc(v) then v::smallint end;
    v := case when jsonb_typeof(j->'episode') = 'number' then (j->>'episode')::numeric end;
    new.progress_episode := case when v between 1 and 99999 and v = trunc(v) then v::integer end;
    if j ? 'chapter' then
      v := case when jsonb_typeof(j->'chapter') = 'number' then (j->>'chapter')::numeric end;
      new.progress_chapter := case when v between 0 and 99999.9 then round(v, 1) end;
    end if;
    if j ? 'volume' then
      v := case when jsonb_typeof(j->'volume') = 'number' then (j->>'volume')::numeric end;
      new.progress_volume := case when v between 0 and 9999 and v = trunc(v) then v::integer end;
    end if;
    if j ? 'page' then
      v := case when jsonb_typeof(j->'page') = 'number' then (j->>'page')::numeric end;
      new.progress_page := case when v between 0 and 100000 and v = trunc(v) then v::integer end;
    end if;
    if j ? 'percent' then
      v := case when jsonb_typeof(j->'percent') = 'number' then (j->>'percent')::numeric end;
      new.progress_percent := case when v between 0 and 100 then round(v)::smallint end;
    end if;
    if j ? 'hours' then
      v := case when jsonb_typeof(j->'hours') = 'number' then (j->>'hours')::numeric end;
      new.progress_hours := case when v between 0 and 99999.9 then round(v, 1) end;
    end if;
    if j ? 'total' then
      v := case when jsonb_typeof(j->'total') = 'number' then (j->>'total')::numeric end;
      new.progress_total := coalesce(
        case when v between 1 and 100000 and v = trunc(v) then v::integer end,
        new.progress_total);
    elsif tg_op = 'UPDATE' and new.progress_season is distinct from old.progress_season then
      new.progress_total := null;
    end if;
    cols_changed := true;
  end if;

  if cols_changed then
    has_progress := num_nonnulls(new.progress_season, new.progress_episode, new.progress_chapter,
      new.progress_volume, new.progress_page, new.progress_percent, new.progress_hours) > 0;
    new.episode_progress := case
      when has_progress then jsonb_strip_nulls(jsonb_build_object(
        'season',  new.progress_season,
        'episode', new.progress_episode,
        'chapter', new.progress_chapter,
        'volume',  new.progress_volume,
        'page',    new.progress_page,
        'percent', new.progress_percent,
        'hours',   new.progress_hours,
        'total',   new.progress_total))
      end;
    new.progress_updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists user_media_sync_progress on public.user_media;
create trigger user_media_sync_progress
  before insert or update on public.user_media
  for each row execute function public.user_media_sync_progress();


-- ── 3. Relleno del progreso de episodios que ya existe ────────────────────
-- Sin tocar updated_at (si no, todas las bibliotecas saldrían como
-- "actualizadas hoy" y cambiaría el orden de «Continúa») ni el jsonb (se
-- apaga un momento el disparador de sincronía: así un valor raro del jsonb
-- no se pierde). Solo filas sin migrar: repetirlo no cambia nada.
alter table public.user_media disable trigger user_media_set_updated_at;
alter table public.user_media disable trigger user_media_sync_progress;

update public.user_media u
   set progress_season = case when x.season between 0 and 999 and x.season = trunc(x.season)
                              then x.season::smallint end,
       progress_episode = case when x.episode between 1 and 99999 and x.episode = trunc(x.episode)
                               then x.episode::integer end,
       progress_updated_at = coalesce(u.progress_updated_at, u.updated_at)
  from (
    select id,
           case when jsonb_typeof(episode_progress->'season') = 'number'
                then (episode_progress->>'season')::numeric end as season,
           case when jsonb_typeof(episode_progress->'episode') = 'number'
                then (episode_progress->>'episode')::numeric end as episode
      from public.user_media
     where jsonb_typeof(episode_progress) = 'object'
       and progress_episode is null
       and progress_season is null
  ) x
 where u.id = x.id
   and x.episode is not null;

alter table public.user_media enable trigger user_media_sync_progress;
alter table public.user_media enable trigger user_media_set_updated_at;


-- ── 4. Demo de solo lectura en todas las tablas (copia de 20261008000001) ─
-- user_media ya está cubierta; se repite el bloque, como cada migración que
-- toca tablas con escritura, para que el orden de aplicación no importe.
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
