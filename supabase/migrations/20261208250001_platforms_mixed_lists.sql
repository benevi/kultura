-- ============================================================
-- F-25 · Mis plataformas y listas mixtas (platforms_mixed_lists)
--
-- QUÉ HACE (el código funciona antes y después de aplicarla; lo nuevo se
-- enciende con la bandera MIXED_LISTS=1 en Vercel DESPUÉS de aplicarla):
--   1. Tabla `user_streaming_services` (una fila por usuario): `services`
--      integer[] (ids de proveedor de TMDB, máx. 30) y `region` (país ISO de 2
--      letras; NULL = el del idioma). Es un dato privado: la RLS solo deja
--      leerla y escribirla a su DUEÑO (no va en `users`, que cualquiera con
--      sesión lee entera). Demo: solo lectura (demo_no_*). Si una versión
--      anterior de este archivo creó `users.streaming_services/_region`, se
--      copian a la tabla y se borran esas columnas.
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
-- Al final se vuelve a ejecutar el bloque demo_no_* (20261008000001) para
-- cubrir la tabla nueva; lists y list_items ya lo tenían.
--
-- CÓMO COMPROBARLO (SQL Editor, después de aplicarla):
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public'
--      and (table_name, column_name) in (('user_streaming_services','services'),
--          ('user_streaming_services','region'), ('lists','description'),
--          ('lists','template'), ('list_items','position'), ('list_items','note'));
--                                                              -- 6 filas
--   select policyname, cmd, roles from pg_policies
--    where tablename = 'user_streaming_services' order by 1;   -- 4 *_own (authenticated)
--                                                              -- + 3 demo_no_*
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'lists_media_type_check';                 -- incluye 'mixed'
--   select policyname, cmd from pg_policies
--    where tablename = 'list_items' and policyname = 'list_items_update_editor';
--                                                              -- 1 fila, UPDATE
--   select count(*) from public.list_items where position is null;  -- 0
--   select to_regprocedure('public.reorder_list_items(uuid,uuid[])'); -- no NULL
-- Después: MIXED_LISTS=1 en Vercel (Production) y redeploy.
-- ============================================================


-- ── 1. Mis plataformas (privado: solo el dueño) ──────────────────────────
create table if not exists public.user_streaming_services (
  user_id uuid primary key references public.users(id) on delete cascade,
  services integer[] not null default '{}',
  region text,
  updated_at timestamptz not null default now(),
  constraint user_streaming_services_services_check check (
    cardinality(services) <= 30
    and array_position(services, null) is null
    and 0 < all (services)
  ),
  constraint user_streaming_services_region_check check (region is null or region ~ '^[A-Z]{2}$')
);
alter table public.user_streaming_services enable row level security;

drop policy if exists "user_streaming_services_select_own" on public.user_streaming_services;
create policy "user_streaming_services_select_own" on public.user_streaming_services
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "user_streaming_services_insert_own" on public.user_streaming_services;
create policy "user_streaming_services_insert_own" on public.user_streaming_services
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "user_streaming_services_update_own" on public.user_streaming_services;
create policy "user_streaming_services_update_own" on public.user_streaming_services
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "user_streaming_services_delete_own" on public.user_streaming_services;
create policy "user_streaming_services_delete_own" on public.user_streaming_services
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.user_streaming_services from public, anon;
grant select, insert, update, delete on public.user_streaming_services to authenticated;
grant all on public.user_streaming_services to service_role;

-- Una versión anterior de este archivo guardaba esto en `users` (legible por
-- cualquiera con sesión): se traslada y se borra.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'users' and column_name = 'streaming_services') then
    execute $q$
      insert into public.user_streaming_services (user_id, services, region)
      select id, streaming_services, streaming_region from public.users
       where cardinality(streaming_services) > 0 or streaming_region is not null
      on conflict (user_id) do nothing
    $q$;
    alter table public.users drop column if exists streaming_services;
    alter table public.users drop column if exists streaming_region;
  end if;
end $$;


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


-- ── 7. Demo de solo lectura también en la tabla nueva (copia de 20261008000001) ─
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
