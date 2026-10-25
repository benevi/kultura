-- ============================================================
-- F-25 · Mis plataformas y listas mixtas (platforms_mixed_lists)
--
-- QUÉ HACE (el código funciona antes y después de aplicarla; lo nuevo se
-- enciende con la bandera MIXED_LISTS=1 en Vercel DESPUÉS de aplicarla):
--   1. users.streaming_services integer[] (ids de proveedor de TMDB, máx. 30)
--      y users.streaming_region text (país ISO de 2 letras; NULL = el del
--      idioma). El usuario los cambia con su JWT (GRANT de columna, como
--      library_visibility), pasa por RLS y por demo_no_update.
--   2. lists: el CHECK `lists_media_type_check` admite 'mixed' (lista con
--      varios formatos), y dos columnas: `description` (≤ 500) y `template`
--      ('franchise' | 'ranking' | NULL).
--   3. lists_select_readable: el dueño lee su fila nueva SIN pasar por
--      can_read_list. Antes, `insert … returning` (supabase `.insert().select()`)
--      fallaba SIEMPRE con "new row violates row-level security policy":
--      can_read_list es STABLE y consulta `lists`, así que no ve la fila que
--      está insertando la misma sentencia (comprobado en PostgreSQL 16 con las
--      migraciones del repo). El código ya no depende de esto (inserta sin
--      RETURNING y lee después), pero la importación y cualquier cliente que
--      use RETURNING vuelven a funcionar.
--   4. list_items.position (orden manual, 0 = primero) y list_items.note
--      (≤ 500). Las filas que ya existen se numeran en el orden en que se
--      ven hoy (más reciente primero); las nuevas van al final (disparador).
--   5. Política UPDATE en list_items (no había ninguna): dueño de la lista o
--      miembro de una colaborativa, y solo las columnas position y note.
--   6. public.reorder_list_items(p_list, p_items): guarda un orden completo en
--      una sola sentencia. SECURITY INVOKER: la RLS del punto 5 decide; quien
--      no puede editar actualiza 0 filas.
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios.
-- No crea tablas: las políticas demo_no_* de users, lists y list_items ya
-- existen (20261101120001) y cubren las columnas nuevas.
--
-- CÓMO COMPROBARLO (SQL Editor, después de aplicarla):
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public'
--      and (table_name, column_name) in (('users','streaming_services'),
--          ('users','streaming_region'), ('lists','description'),
--          ('lists','template'), ('list_items','position'), ('list_items','note'));
--                                                              -- 6 filas
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'lists_media_type_check';                 -- incluye 'mixed'
--   select policyname, cmd from pg_policies
--    where tablename = 'list_items' and policyname = 'list_items_update_editor';
--                                                              -- 1 fila, UPDATE
--   select count(*) from public.list_items where position is null;  -- 0
--   select to_regprocedure('public.reorder_list_items(uuid,uuid[])'); -- no NULL
-- Después: MIXED_LISTS=1 en Vercel (Production) y redeploy.
-- ============================================================


-- ── 1. Mis plataformas ────────────────────────────────────────────────────
alter table public.users
  add column if not exists streaming_services integer[] not null default '{}';
alter table public.users
  add column if not exists streaming_region text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'users_streaming_services_check' and conrelid = 'public.users'::regclass) then
    alter table public.users
      add constraint users_streaming_services_check check (
        cardinality(streaming_services) <= 30
        and array_position(streaming_services, null) is null
        and 0 < all (streaming_services)
      );
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'users_streaming_region_check' and conrelid = 'public.users'::regclass) then
    alter table public.users
      add constraint users_streaming_region_check check (
        streaming_region is null or streaming_region ~ '^[A-Z]{2}$'
      );
  end if;
end $$;

-- Como library_visibility (20261101120001): el dueño las cambia con su JWT.
-- anon NO recibe SELECT de estas columnas (solo las seis públicas de F-02).
grant update (streaming_services, streaming_region) on public.users to authenticated;


-- ── 2. Listas mixtas, descripción y plantilla ─────────────────────────────
alter table public.lists drop constraint if exists lists_media_type_check;
alter table public.lists
  add constraint lists_media_type_check check (
    media_type = any (array['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game', 'mixed'])
  );

alter table public.lists add column if not exists description text;
alter table public.lists add column if not exists template text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'lists_description_length' and conrelid = 'public.lists'::regclass) then
    alter table public.lists
      add constraint lists_description_length check (description is null or char_length(description) <= 500);
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'lists_template_check' and conrelid = 'public.lists'::regclass) then
    alter table public.lists
      add constraint lists_template_check check (template is null or template = any (array['franchise', 'ranking']));
  end if;
end $$;


-- ── 3. El dueño lee la fila que acaba de crear (INSERT … RETURNING) ──────
-- Misma política que 20261014000001 (anon y authenticated leen lo que
-- can_read_list permite) con un primer caso que no consulta la tabla.
drop policy if exists "lists_select_readable" on public.lists;
create policy "lists_select_readable" on public.lists
  for select to anon, authenticated
  using (owner_id = auth.uid() or public.can_read_list(id));


-- ── 4. Orden y nota de cada título ────────────────────────────────────────
alter table public.list_items add column if not exists position integer;
alter table public.list_items add column if not exists note text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'list_items_note_length' and conrelid = 'public.list_items'::regclass) then
    alter table public.list_items
      add constraint list_items_note_length check (note is null or char_length(note) <= 500);
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'list_items_position_check' and conrelid = 'public.list_items'::regclass) then
    alter table public.list_items
      add constraint list_items_position_check check (position is null or position >= 0);
  end if;
end $$;

-- Numeración inicial: el orden que se ve hoy (más reciente primero), detrás
-- de los que ya tuvieran posición. En la segunda ejecución no hay NULL: nada.
with pending as (
  select i.id,
         coalesce((select max(x.position) from public.list_items x where x.list_id = i.list_id), -1)
           + row_number() over (partition by i.list_id order by i.added_at desc nulls last, i.id) as pos
    from public.list_items i
   where i.position is null
)
update public.list_items li
   set position = pending.pos
  from pending
 where li.id = pending.id;

create index if not exists list_items_list_position_idx
  on public.list_items (list_id, position);

-- Un título nuevo va al final de su lista. SECURITY DEFINER para ver el
-- máximo aunque la RLS de quien inserta no le dejara leer alguna fila.
create or replace function public.list_items_set_position()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.position is null then
    select coalesce(max(position), -1) + 1 into new.position
      from public.list_items
     where list_id = new.list_id;
  end if;
  return new;
end;
$$;
revoke all on function public.list_items_set_position() from public, anon, authenticated;

drop trigger if exists list_items_set_position on public.list_items;
create trigger list_items_set_position
  before insert on public.list_items
  for each row execute function public.list_items_set_position();


-- ── 5. Editar orden y nota: dueño o miembro de una colaborativa ──────────
drop policy if exists "list_items_update_editor" on public.list_items;
create policy "list_items_update_editor" on public.list_items
  for update to authenticated
  using (
    auth.uid() = (select l.owner_id from public.lists l where l.id = list_items.list_id)
    or exists (
      select 1
        from public.lists l
        join public.list_members m on m.list_id = l.id
       where l.id = list_items.list_id
         and l.is_collaborative
         and m.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = (select l.owner_id from public.lists l where l.id = list_items.list_id)
    or exists (
      select 1
        from public.lists l
        join public.list_members m on m.list_id = l.id
       where l.id = list_items.list_id
         and l.is_collaborative
         and m.user_id = auth.uid()
    )
  );

-- Solo position y note: un título no se puede mover a otra lista ni cambiar
-- de autor con un UPDATE.
revoke update on public.list_items from anon, authenticated;
grant update (position, note) on public.list_items to authenticated;


-- ── 6. Guardar un orden completo en una sentencia ─────────────────────────
create or replace function public.reorder_list_items(p_list uuid, p_items uuid[])
returns integer
language sql
security invoker
set search_path = public, pg_temp
as $$
  with wanted as (
    select t.id, (t.ord - 1)::integer as pos
      from unnest(p_items) with ordinality as t(id, ord)
  ),
  moved as (
    update public.list_items li
       set position = wanted.pos
      from wanted
     where li.id = wanted.id
       and li.list_id = p_list
    returning 1
  )
  select count(*)::integer from moved
$$;
revoke all on function public.reorder_list_items(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_list_items(uuid, uuid[]) to authenticated;
