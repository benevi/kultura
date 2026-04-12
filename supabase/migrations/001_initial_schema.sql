-- ============================================================
-- KULTURA — Migration 001: Initial Schema
-- ============================================================
-- Aplicar en orden. Todos los objetos se crean desde cero.
-- ============================================================


-- ============================================================
-- TABLAS
-- ============================================================

-- Usuarios (complementa auth.users de Supabase)
create table users (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_color text not null default '#E82020',
  avatar_initials text not null,
  created_at timestamptz default now()
);

-- Caché de media (evita llamadas repetidas a APIs externas)
-- id = "{type}_{external_id}" ej: "movie_550"
create table media (
  id text primary key,
  external_id text not null,
  type text not null check (type in ('movie','tv','anime','book','comic','manga','game')),
  title text not null,
  poster text,
  backdrop text,
  year int,
  metadata jsonb,
  updated_at timestamptz default now()
);

-- Biblioteca personal del usuario
create table user_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  media_id text references media(id) not null,
  status text not null check (status in ('completed','in_progress','pending','abandoned')),
  score smallint check (score between 1 and 5),
  watched_at date,
  episode_progress jsonb, -- { "season": 2, "episode": 5 }
  created_at timestamptz default now(),
  unique(user_id, media_id)
);

-- Amistades
create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references users(id) on delete cascade not null,
  receiver_id uuid references users(id) on delete cascade not null,
  status text not null check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  unique(requester_id, receiver_id)
);

-- Recomendaciones directas entre usuarios
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references users(id) on delete cascade not null,
  to_user_id uuid references users(id) on delete cascade not null,
  media_id text references media(id) not null,
  message text,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Listas (un solo tipo de contenido por lista — DEC-008)
create table lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade not null,
  name text not null,
  media_type text not null check (media_type in ('movie','tv','anime','book','comic','manga','game')),
  is_collaborative boolean default false,
  created_at timestamptz default now()
);

create table list_members (
  list_id uuid references lists(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  primary key(list_id, user_id)
);

create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references lists(id) on delete cascade not null,
  media_id text references media(id) not null,
  added_by uuid references users(id) on delete set null,
  added_at timestamptz default now()
);

-- Notificaciones in-app
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  type text not null check (type in ('recommendation','list_invite')),
  payload jsonb not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Reportes
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete cascade not null,
  target_type text not null check (target_type in ('user','media')),
  target_id text not null,
  reason text,
  created_at timestamptz default now()
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table users enable row level security;
alter table media enable row level security;
alter table user_media enable row level security;
alter table friendships enable row level security;
alter table recommendations enable row level security;
alter table lists enable row level security;
alter table list_members enable row level security;
alter table list_items enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;


-- users
-- Perfiles públicos (DEC-006), pero solo el propio usuario puede editarse
create policy "users_select_public"
  on users for select using (true);

create policy "users_update_own"
  on users for update using (auth.uid() = id);


-- media
-- Caché pública de títulos; cualquier usuario autenticado puede insertar/actualizar
create policy "media_select_all"
  on media for select using (true);

create policy "media_insert_auth"
  on media for insert with check (auth.role() = 'authenticated');

create policy "media_update_auth"
  on media for update using (auth.role() = 'authenticated');


-- user_media
-- Biblioteca pública (DEC-006), pero solo el dueño puede escribir
create policy "user_media_select_public"
  on user_media for select using (true);

create policy "user_media_insert_own"
  on user_media for insert with check (auth.uid() = user_id);

create policy "user_media_update_own"
  on user_media for update using (auth.uid() = user_id);

create policy "user_media_delete_own"
  on user_media for delete using (auth.uid() = user_id);


-- friendships
create policy "friendships_select_own"
  on friendships for select
  using (auth.uid() = requester_id or auth.uid() = receiver_id);

create policy "friendships_insert_as_requester"
  on friendships for insert
  with check (auth.uid() = requester_id);

create policy "friendships_update_as_receiver"
  on friendships for update
  using (auth.uid() = receiver_id);

create policy "friendships_delete_own"
  on friendships for delete
  using (auth.uid() = requester_id or auth.uid() = receiver_id);


-- recommendations
create policy "recommendations_select_own"
  on recommendations for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy "recommendations_insert_as_sender"
  on recommendations for insert
  with check (auth.uid() = from_user_id);

create policy "recommendations_update_as_receiver"
  on recommendations for update
  using (auth.uid() = to_user_id);


-- lists
create policy "lists_select_public"
  on lists for select using (true);

create policy "lists_insert_own"
  on lists for insert with check (auth.uid() = owner_id);

create policy "lists_update_own"
  on lists for update using (auth.uid() = owner_id);

create policy "lists_delete_own"
  on lists for delete using (auth.uid() = owner_id);


-- list_members
create policy "list_members_select_public"
  on list_members for select using (true);

create policy "list_members_insert_owner"
  on list_members for insert with check (
    auth.uid() = (select owner_id from lists where id = list_id)
  );

create policy "list_members_delete_owner_or_self"
  on list_members for delete using (
    auth.uid() = user_id
    or auth.uid() = (select owner_id from lists where id = list_id)
  );


-- list_items
create policy "list_items_select_public"
  on list_items for select using (true);

create policy "list_items_insert_member_or_owner"
  on list_items for insert with check (
    auth.uid() = added_by
    and (
      auth.uid() = (select owner_id from lists where id = list_id)
      or exists (
        select 1 from list_members
        where list_id = list_items.list_id
          and user_id = auth.uid()
      )
    )
  );

create policy "list_items_delete_adder_or_owner"
  on list_items for delete using (
    auth.uid() = added_by
    or auth.uid() = (select owner_id from lists where id = list_id)
  );


-- notifications
create policy "notifications_select_own"
  on notifications for select using (auth.uid() = user_id);

create policy "notifications_update_own"
  on notifications for update using (auth.uid() = user_id);


-- reports
create policy "reports_insert_auth"
  on reports for insert with check (auth.uid() = reporter_id);


-- ============================================================
-- TRIGGER: auto-crear perfil al registrarse
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
-- security definer: necesario para escribir en users sin que el usuario
-- registrándose tenga permisos directos sobre la tabla.
set search_path = public
as $$
declare
  raw_username text;
  clean_username text;
  final_username text;
  counter int := 0;
begin
  -- 1. Extraer la parte antes del @ del email
  raw_username := split_part(new.email, '@', 1);

  -- 2. Eliminar caracteres no permitidos (solo a-z, A-Z, 0-9, _)
  clean_username := regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g');

  -- 3. Garantizar longitud mínima si el email-prefix queda vacío
  if length(clean_username) = 0 then
    clean_username := 'user';
  end if;

  -- 4. Truncar a 15 caracteres (deja margen para sufijo numérico hasta 99999)
  clean_username := left(clean_username, 15);
  final_username := clean_username;

  -- 5. Resolver duplicados añadiendo sufijo numérico incremental
  while exists (select 1 from users where username = final_username) loop
    counter := counter + 1;
    final_username := clean_username || counter::text;
  end loop;

  -- 6. Insertar perfil de usuario
  insert into users (id, username, avatar_initials, avatar_color)
  values (
    new.id,
    final_username,
    upper(left(final_username, 2)),
    '#E82020'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
