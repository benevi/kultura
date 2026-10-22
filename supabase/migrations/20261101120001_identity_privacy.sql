-- ============================================================
-- F-12 · Identidad, privacidad de cuenta y onboarding (identity_privacy)
--
-- QUÉ HACE (el código funciona antes y después de aplicarla):
--   1. users.library_visibility ('public' | 'friends' | 'private', por defecto
--      'friends' para TODOS, D-04b) y el usuario puede cambiarla con su JWT.
--      Formato del nombre de usuario (3-20, letras, números y _) y nombres
--      reservados con un DISPARADOR que solo mira el nombre cuando se crea o
--      CAMBIA (un CHECK, aunque sea NOT VALID, se evalúa en cada UPDATE de la
--      fila: un usuario antiguo "jo" no podría guardar ni su bio); índice
--      único sin distinguir mayúsculas.
--   2. public.account_state (una fila por usuario, solo la lee su dueño y solo
--      la escribe el servidor): terms_accepted_at / terms_version (SEG-7),
--      onboarded_at (CRE-6) y deletion_requested_at (ROJO-7, 7 días de
--      gracia). Las cuentas que ya existían quedan como "ya pasaron el
--      onboarding". Va aparte de `users` porque `users` la lee cualquiera con
--      sesión.
--   3. handle_new_user: el nombre público ya NO sale del email (R4/ROJO-6):
--      `u_` + 6 caracteres [a-z0-9]; color de avatar de la paleta; guarda la
--      aceptación de términos que llega en raw_user_meta_data
--      (terms_accepted = true, terms_version) y crea la fila de account_state.
--   4. username_history + disparador: al cambiar el nombre, el antiguo queda
--      apuntando al usuario, y public.username_redirect(text) devuelve el
--      actual (308 desde /u/<antiguo> y /profile/<antiguo>).
--   5. public.can_read_library(owner) y la política nueva de user_media
--      ("user_media_select_visible", sustituye a la de W1): el dueño siempre;
--      'public' cualquiera con sesión; 'friends' solo amistades aceptadas;
--      'private' nadie más. Anónimo, nunca (TO authenticated).
--   6. Borrado sin daño a terceros: list_members.added_at y las funciones
--      deletion_preview / transfer_owned_content (solo service_role): los
--      grupos pasan al miembro más antiguo y las listas con colaboradores al
--      colaborador que antes aportó; lo demás se borra en cascada como antes.
--   7. ROJO-8: la cuenta demo no puede cambiar email, contraseña ni teléfono
--      por la API de Auth (disparador en auth.users) ni dar de alta MFA (si
--      el proyecto permite el disparador en auth.mfa_factors). Solo se pueden
--      cambiar desde el SQL Editor (sentencia exacta en la sección 7).
--   8. Vuelve a ejecutar el bloque demo_no_* al final (tablas nuevas).
--
-- IDEMPOTENTE: se puede ejecutar dos veces seguidas sin error ni cambios.
-- Nombres verificados contra 20260502233945_remote_schema.sql,
-- 20261014000001_public_lists.sql, 20261023020001_harden_rls.sql y el volcado
-- de pg_policies / tables / routines de producción (W0, 2026-10-22).
--
-- CÓMO APLICARLA (Víctor): SQL Editor del proyecto de TEST → pegar entero →
-- Run; repetir en producción. Después, en Vercel: LIBRARY_VISIBILITY=1 y
-- ACCOUNT_GRACE=1, y CRON_SECRET (cualquier cadena larga aleatoria).
--
-- COMPROBACIÓN (SQL Editor, tras aplicarla):
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='users'
--      and column_name='library_visibility';                       -- 1 fila
--   select count(*) from public.users u
--     left join public.account_state a on a.user_id = u.id
--    where a.user_id is null;                                      -- 0
--   select policyname from pg_policies where tablename='user_media'
--      and cmd='SELECT';                  -- SOLO user_media_select_visible
--   select * from public.rls_audit() where not ok;                 -- 0 filas
--   -- Un usuario antiguo con nombre que hoy no valdría sigue guardando su bio:
--   begin; update public.users set bio = bio where char_length(username) < 3;
--   rollback;                                                      -- sin error
--   -- ROJO-8 (debe FALLAR con "demo_auth_locked" y no cambia nada). Se
--   -- simula el rol con el que entra la API de Auth:
--   begin;
--   set local role supabase_auth_admin;
--   update auth.users set encrypted_password = 'x'
--    where raw_app_meta_data->>'demo' = 'true';
--   rollback;
--   -- Desde el SQL Editor (postgres, sin claims) la misma prueba sin
--   -- `set local role` NO falla: es la vía para resetear la demo (sección 7).
--   -- Nombre generado (debe dar 0 filas con nombres nuevos tipo email):
--   select username from public.users
--    where created_at > now() - interval '1 day' and username !~ '^u_[a-z0-9]{6}$'
--      and id not in (select user_id from public.username_history);
-- ============================================================


-- ── 1. users: visibilidad de la biblioteca y nombre de usuario ───────────
alter table public.users
  add column if not exists library_visibility text not null default 'friends';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'users_library_visibility_check' and conrelid = 'public.users'::regclass) then
    alter table public.users add constraint users_library_visibility_check
      check (library_visibility in ('public', 'friends', 'private'));
  end if;
end $$;

-- Una versión anterior de esta migración los creaba como CHECK NOT VALID, que
-- se evalúa en CADA update de la fila: fuera (no hacen nada si no existen).
alter table public.users drop constraint if exists users_username_format;
alter table public.users drop constraint if exists users_username_not_reserved;

-- Solo al crear el usuario o al CAMBIAR el nombre: un nombre antiguo que hoy
-- no valdría ("jo", "admin") no impide guardar la bio ni la visibilidad.
-- Misma lista que RESERVED_USERNAMES en src/app/api/settings/identity.ts (lo
-- comprueba tests/unit/identity/reserved.test.ts). Error 23514 (check_violation),
-- el mismo que daría un CHECK, para que la API lo traduzca igual.
create or replace function public.validate_username()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then
    return new;
  end if;
  if new.username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'username_invalid' using errcode = '23514';
  end if;
  if lower(new.username) = any (array[
        'admin','administrator','administrador','root','kultura','kulturaapp','support','soporte',
        'help','ayuda','moderator','moderador','mod','staff','team','equipo','official','oficial',
        'api','login','logout','settings','ajustes','welcome','home','system','sistema','null',
        'undefined','anonymous','anonimo','me','demo','security','seguridad','privacy','terms',
        'legal','report','u','profile','www'
      ]) then
    raise exception 'username_reserved' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_username() from public, anon, authenticated;

drop trigger if exists validate_username on public.users;
create trigger validate_username
  before insert or update of username on public.users
  for each row execute function public.validate_username();

-- Único sin distinguir mayúsculas (/u/Pepe y /u/pepe no pueden ser dos
-- personas). Si ya hay duplicados, se avisa y no se crea.
do $$
begin
  if not exists (select 1 from pg_indexes
                  where schemaname = 'public' and indexname = 'users_username_lower_key') then
    if exists (select 1 from public.users group by lower(username) having count(*) > 1) then
      raise notice 'F-12: hay nombres de usuario que solo difieren en mayúsculas; no se crea users_username_lower_key';
    else
      create unique index users_username_lower_key on public.users (lower(username));
    end if;
  end if;
end $$;

-- El usuario cambia su visibilidad con su JWT (pasa por RLS y demo_no_update).
grant update (library_visibility) on public.users to authenticated;


-- ── 2. account_state: datos de cuenta que solo ve su dueño ───────────────
create table if not exists public.account_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  terms_accepted_at timestamptz,
  terms_version text,
  onboarded_at timestamptz,
  deletion_requested_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint account_state_terms_version_length check (terms_version is null or char_length(terms_version) <= 20)
);
alter table public.account_state enable row level security;

drop policy if exists "account_state_select_own" on public.account_state;
create policy "account_state_select_own" on public.account_state
  for select to authenticated
  using (user_id = auth.uid());

-- Solo el servidor escribe (cliente admin, service_role). anon nada;
-- authenticated solo SELECT (y la política lo limita a su fila).
revoke all on public.account_state from anon, authenticated;
grant select on public.account_state to authenticated;

create index if not exists account_state_deletion_idx
  on public.account_state (deletion_requested_at)
  where deletion_requested_at is not null;

-- Las cuentas que ya existían: con fila y sin onboarding pendiente.
insert into public.account_state (user_id, onboarded_at)
select u.id, coalesce(u.created_at, now())
  from public.users u
 where not exists (select 1 from public.account_state a where a.user_id = u.id);


-- ── 3. username_history: el nombre antiguo redirige al actual ────────────
create table if not exists public.username_history (
  old_username text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  changed_at timestamptz not null default now()
);
alter table public.username_history enable row level security;
-- Sin políticas: nadie la lee directamente (solo username_redirect y el
-- servidor). Así no se puede listar quién se llamaba cómo.
revoke all on public.username_history from anon, authenticated;
create index if not exists username_history_user_idx on public.username_history (user_id);

create or replace function public.track_username_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.username is distinct from old.username then
    insert into public.username_history (old_username, user_id, changed_at)
    values (old.username, old.id, now())
    on conflict (old_username) do update
      set user_id = excluded.user_id, changed_at = excluded.changed_at;
    -- El nombre nuevo vuelve a estar vivo: fuera su redirección vieja.
    delete from public.username_history where old_username = new.username;
  end if;
  return new;
end;
$$;
revoke all on function public.track_username_change() from public, anon, authenticated;

drop trigger if exists on_username_change on public.users;
create trigger on_username_change
  after update of username on public.users
  for each row execute function public.track_username_change();

create or replace function public.username_redirect(p_username text)
returns text language sql security definer stable
set search_path = public, pg_temp
as $$
  select u.username
    from public.username_history h
    join public.users u on u.id = h.user_id
   where h.old_username = p_username
     and u.username <> p_username
   limit 1;
$$;
revoke all on function public.username_redirect(text) from public, anon;
grant execute on function public.username_redirect(text) to anon, authenticated, service_role;


-- ── 4. handle_new_user: nombre aleatorio, términos y account_state ───────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  palette constant text[] := array['slate','red','orange','amber','green','teal','blue','purple'];
  code text;
  candidate text;
  attempts int := 0;
  accepted boolean;
  version text;
begin
  -- 1. `u_` + 6 caracteres [a-z0-9]: nada del email (R4). 16^6 combinaciones;
  --    se reintenta si choca con un usuario o con un nombre antiguo.
  loop
    code := substr(md5(random()::text || clock_timestamp()::text || new.id::text), 1, 6);
    candidate := 'u_' || code;
    exit when not exists (select 1 from public.users where lower(username) = candidate)
          and not exists (select 1 from public.username_history where old_username = candidate);
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'handle_new_user: no hay nombre libre tras 20 intentos';
    end if;
  end loop;

  -- 2. Aceptación de términos del alta por email (SEG-7). Google no la trae:
  --    se pide en el paso 1 de /welcome y la guarda el servidor.
  accepted := coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') = 'true';
  version := left(nullif(new.raw_user_meta_data ->> 'terms_version', ''), 20);

  begin
    insert into public.users (id, username, avatar_initials, avatar_color)
    values (
      new.id,
      candidate,
      upper(left(code, 2)),
      palette[1 + (abs(hashtext(new.id::text)::bigint) % array_length(palette, 1))::int]
    );
    insert into public.account_state (user_id, terms_accepted_at, terms_version)
    values (
      new.id,
      case when accepted then now() end,
      case when accepted then version end
    )
    on conflict (user_id) do nothing;
  exception when others then
    raise exception 'handle_new_user failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;


-- ── 5. Biblioteca: quién la ve (D-04b, SEG-3b) ───────────────────────────
create or replace function public.can_read_library(p_owner uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp
as $$
  select p_owner = auth.uid()
      or exists (
        select 1 from public.users u
         where u.id = p_owner
           and (
             u.library_visibility = 'public'
             or (u.library_visibility = 'friends' and exists (
               select 1 from public.friendships f
                where f.status = 'accepted'
                  and ((f.requester_id = auth.uid() and f.receiver_id = p_owner)
                    or (f.receiver_id = auth.uid() and f.requester_id = p_owner))
             ))
           )
      );
$$;
revoke all on function public.can_read_library(uuid) from public, anon;
grant execute on function public.can_read_library(uuid) to authenticated, service_role;

-- Fuera TODA política SELECT permisiva anterior: la de W1
-- ("user_media_select_authenticated") y la original ("user_media_select_public",
-- USING true para el rol public, que sigue en producción si F-02 no se aplicó:
-- volcado W0). Si quedara alguna, por OR con la nueva, la privacidad no
-- serviría de nada. El bucle cubre también cualquier otra con otro nombre.
drop policy if exists "user_media_select_authenticated" on public.user_media;
drop policy if exists "user_media_select_public" on public.user_media;
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'user_media'
       and cmd in ('SELECT', 'ALL') and permissive = 'PERMISSIVE'
       and policyname <> 'user_media_select_visible'
  loop
    execute format('drop policy %I on public.user_media', p.policyname);
    raise notice 'F-12: quitada la política % de user_media', p.policyname;
  end loop;
end $$;
drop policy if exists "user_media_select_visible" on public.user_media;
create policy "user_media_select_visible" on public.user_media
  for select to authenticated
  using (user_id = auth.uid() or public.can_read_library(user_id));


-- ── 6. Borrado de cuenta sin daño a terceros (ROJO-7) ────────────────────
alter table public.list_members
  add column if not exists added_at timestamptz not null default now();

-- Miembro más antiguo del grupo que no sea el que se va.
create or replace function public.group_successor(p_group uuid, p_user uuid)
returns uuid language sql stable
set search_path = public, pg_temp
as $$
  select m.user_id
    from public.group_members m
   where m.group_id = p_group and m.user_id <> p_user
   order by m.joined_at asc nulls last, m.user_id
   limit 1;
$$;
revoke all on function public.group_successor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.group_successor(uuid, uuid) to service_role;

-- Colaborador que antes aportó a la lista (primer título añadido); si nadie
-- aportó, el que antes entró.
create or replace function public.list_successor(p_list uuid, p_user uuid)
returns uuid language sql stable
set search_path = public, pg_temp
as $$
  select m.user_id
    from public.list_members m
   where m.list_id = p_list and m.user_id <> p_user
   order by (select min(i.added_at) from public.list_items i
              where i.list_id = p_list and i.added_by = m.user_id) asc nulls last,
            m.added_at asc, m.user_id
   limit 1;
$$;
revoke all on function public.list_successor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_successor(uuid, uuid) to service_role;

-- Lo que el modal de borrado enumera: grupos y listas que cambian de dueño.
create or replace function public.deletion_preview(p_user uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', g.name,
               'successor', (select u.username from public.users u
                              where u.id = public.group_successor(g.id, p_user))
             ) order by g.created_at)
        from public.groups g where g.owner_id = p_user), '[]'::jsonb),
    'lists', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', l.name,
               'successor', (select u.username from public.users u
                              where u.id = public.list_successor(l.id, p_user))
             ) order by l.created_at)
        from public.lists l
       where l.owner_id = p_user
         and exists (select 1 from public.list_members m
                      where m.list_id = l.id and m.user_id <> p_user)), '[]'::jsonb)
  );
$$;
revoke all on function public.deletion_preview(uuid) from public, anon, authenticated;
grant execute on function public.deletion_preview(uuid) to service_role;

-- Se llama justo antes de auth.admin.deleteUser (api/account y el cron).
create or replace function public.transfer_owned_content(p_user uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  heir uuid;
  moved_groups int := 0;
  moved_lists int := 0;
begin
  for r in select id from public.groups where owner_id = p_user loop
    heir := public.group_successor(r.id, p_user);
    if heir is not null then
      update public.groups set owner_id = heir where id = r.id;
      update public.group_members set role = 'owner' where group_id = r.id and user_id = heir;
      update public.group_members set role = 'member' where group_id = r.id and user_id = p_user;
      moved_groups := moved_groups + 1;
    end if;
  end loop;

  for r in select id from public.lists where owner_id = p_user loop
    heir := public.list_successor(r.id, p_user);
    if heir is not null then
      update public.lists set owner_id = heir where id = r.id;
      -- El dueño nuevo deja de ser "miembro" de su propia lista.
      delete from public.list_members where list_id = r.id and user_id = heir;
      moved_lists := moved_lists + 1;
    end if;
  end loop;

  return jsonb_build_object('groups', moved_groups, 'lists', moved_lists);
end;
$$;
revoke all on function public.transfer_owned_content(uuid) from public, anon, authenticated;
grant execute on function public.transfer_owned_content(uuid) to service_role;


-- ── 7. ROJO-8: la demo no cambia credenciales por la API de Auth ─────────
-- La API de Auth (GoTrue) entra en la base SIEMPRE con su rol
-- `supabase_auth_admin`, tanto si llama un visitante de la demo (`updateUser`)
-- como el service role (`auth.admin.updateUserById`), y no publica quién llama.
-- Lo único fiable es QUIÉN CONECTA, así que solo se deja pasar:
--   · una conexión directa por SQL como `postgres` o `service_role` SIN claims
--     de JWT (`request.jwt.claims` vacío o sin poner): el SQL Editor;
--   · un claim `role = service_role` (si alguna vía lo publica).
-- Todo lo demás se bloquea, incluido `auth.admin.updateUserById` sobre la
-- demo: la API de Auth no permite distinguirlo de un visitante. Nada de la
-- fila (p. ej. app_metadata) cuenta como permiso: lo que viaja en la fila no
-- dice quién llama.
-- La función es SECURITY INVOKER a propósito: `current_user` es el rol real
-- que escribe (en una SECURITY DEFINER sería siempre el dueño).
--
-- RESETEAR LA DEMO (solo así, en el SQL Editor; DEMO_USER_EMAIL de Vercel):
--   update auth.users
--      set encrypted_password = extensions.crypt('<contraseña nueva>', extensions.gen_salt('bf'))
--    where email = '<DEMO_USER_EMAIL>' and raw_app_meta_data->>'demo' = 'true';
--   -- y si alguien hubiera dejado un cambio de email a medias:
--   update auth.users set email_change = '', email_change_token_new = '',
--          email_change_token_current = '', email_change_confirm_status = 0
--    where email = '<DEMO_USER_EMAIL>' and raw_app_meta_data->>'demo' = 'true';
-- (La demo entra por enlace mágico desde /api/auth/demo: no necesita contraseña.)
--
-- CÓMO COMPROBARLO (SQL Editor; cada bloque se deshace con rollback):
--   -- 1) Visitante de la demo vía API de Auth → ERROR demo_auth_locked
--   begin; set local role supabase_auth_admin;
--   select set_config('request.jwt.claims',
--     '{"role":"authenticated","sub":"<id de la demo>"}', true);
--   update auth.users set encrypted_password = 'x' where raw_app_meta_data->>'demo' = 'true';
--   rollback;
--   -- 2) Lo mismo sin claims (como entra GoTrue) → ERROR demo_auth_locked
--   begin; set local role supabase_auth_admin;
--   update auth.users set encrypted_password = 'x' where raw_app_meta_data->>'demo' = 'true';
--   rollback;
--   -- 3) SQL Editor (postgres, sin claims) → sin error
--   begin; update auth.users set encrypted_password = 'x'
--    where raw_app_meta_data->>'demo' = 'true'; rollback;
-- En la app: `updateUser({ password })` con la sesión de la demo responde con
-- error (GoTrue devuelve "Database error updating user").
create or replace function public.guard_demo_auth_identity()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  raw_claims text;
  claims_role text;
begin
  if coalesce(old.raw_app_meta_data ->> 'demo', '') <> 'true' then
    return new;
  end if;
  if coalesce(new.email, '') is not distinct from coalesce(old.email, '')
     and coalesce(new.encrypted_password, '') is not distinct from coalesce(old.encrypted_password, '')
     and coalesce(new.email_change, '') is not distinct from coalesce(old.email_change, '')
     and coalesce(new.phone, '') is not distinct from coalesce(old.phone, '')
     and coalesce(new.phone_change, '') is not distinct from coalesce(old.phone_change, '') then
    return new;  -- inicio de sesión, metadatos… nada de credenciales
  end if;

  raw_claims := nullif(current_setting('request.jwt.claims', true), '');
  begin
    claims_role := raw_claims::jsonb ->> 'role';
  exception when others then
    claims_role := null;
  end;

  -- Claim explícito de service role.
  if claims_role = 'service_role' then
    return new;
  end if;
  -- Conexión directa por SQL (SQL Editor), sin ningún JWT de por medio.
  if raw_claims is null and current_user in ('postgres', 'service_role') then
    return new;
  end if;

  raise exception 'demo_auth_locked' using errcode = '42501';
end;
$$;
revoke all on function public.guard_demo_auth_identity() from public, anon, authenticated;

drop trigger if exists guard_demo_auth_identity on auth.users;
create trigger guard_demo_auth_identity
  before update on auth.users
  for each row execute function public.guard_demo_auth_identity();

create or replace function public.guard_demo_mfa()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from auth.users u
              where u.id = new.user_id and coalesce(u.raw_app_meta_data ->> 'demo', '') = 'true') then
    raise exception 'demo_auth_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_demo_mfa() from public, anon, authenticated;

do $$
begin
  if to_regclass('auth.mfa_factors') is not null then
    execute 'drop trigger if exists guard_demo_mfa on auth.mfa_factors';
    execute 'create trigger guard_demo_mfa before insert on auth.mfa_factors
               for each row execute function public.guard_demo_mfa()';
  end if;
exception when insufficient_privilege then
  raise notice 'F-12: sin permiso para el disparador de auth.mfa_factors; la demo podría dar de alta MFA (riesgo bajo)';
end $$;


-- ── 8. Demo de solo lectura en todas las tablas (copia de 20261008000001) ─
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
