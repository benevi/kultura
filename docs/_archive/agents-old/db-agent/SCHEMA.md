# db-agent — SCHEMA (fuente de verdad)

Estado actual del esquema de base de datos. Se actualiza después de cada migración.

## Última migración aplicada
`001_initial_schema.sql` — commit: pendiente de aplicar en Supabase (requiere SUPABASE_TEST_URL configurado)

## Tablas

### users
```sql
id uuid references auth.users primary key
username text unique not null
avatar_color text not null default '#E82020'
avatar_initials text not null
created_at timestamptz default now()
```

### media
```sql
id text primary key  -- formato: "{type}_{external_id}"
external_id text not null
type text not null   -- movie | tv | anime | book | comic | manga | game
title text not null
poster text
backdrop text
year int
metadata jsonb
updated_at timestamptz default now()
```

### user_media
```sql
id uuid primary key default gen_random_uuid()
user_id uuid references users(id) on delete cascade
media_id text references media(id)
status text not null  -- completed | in_progress | pending | abandoned
score smallint        -- 1-5
watched_at date
episode_progress jsonb  -- { season: number, episode: number }
created_at timestamptz default now()
UNIQUE(user_id, media_id)
```

### friendships
```sql
id uuid primary key default gen_random_uuid()
requester_id uuid references users(id) on delete cascade
receiver_id uuid references users(id) on delete cascade
status text not null  -- pending | accepted
created_at timestamptz default now()
UNIQUE(requester_id, receiver_id)
```

### recommendations
```sql
id uuid primary key default gen_random_uuid()
from_user_id uuid references users(id) on delete cascade
to_user_id uuid references users(id) on delete cascade
media_id text references media(id)
message text
read_at timestamptz
created_at timestamptz default now()
```

### lists
```sql
id uuid primary key default gen_random_uuid()
owner_id uuid references users(id) on delete cascade
name text not null
media_type text not null  -- movie | tv | anime | book | comic | manga | game
is_collaborative boolean default false
created_at timestamptz default now()
```

### list_members
```sql
list_id uuid references lists(id) on delete cascade
user_id uuid references users(id) on delete cascade
PRIMARY KEY(list_id, user_id)
```

### list_items
```sql
id uuid primary key default gen_random_uuid()
list_id uuid references lists(id) on delete cascade
media_id text references media(id)
added_by uuid references users(id)
added_at timestamptz default now()
```

### notifications
```sql
id uuid primary key default gen_random_uuid()
user_id uuid references users(id) on delete cascade
type text not null  -- recommendation | list_invite
payload jsonb not null
read_at timestamptz
created_at timestamptz default now()
```

### reports
```sql
id uuid primary key default gen_random_uuid()
reporter_id uuid references users(id) on delete cascade
target_type text not null  -- user | media
target_id text not null
reason text
created_at timestamptz default now()
```

## Índices planificados
- `user_media(user_id)`
- `user_media(media_id)`
- `friendships(requester_id)`
- `friendships(receiver_id)`
- `recommendations(to_user_id)`
- `notifications(user_id, read_at)`

## RLS
Implementado en `001_initial_schema.sql`. Resumen de policies:

| Tabla | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| users | público (true) | — (trigger) | propio uid | — |
| media | público | autenticado | autenticado | — |
| user_media | público | user_id = uid | user_id = uid | user_id = uid |
| friendships | requester o receiver | requester = uid | receiver = uid | requester o receiver |
| recommendations | from o to | from = uid | to = uid | — |
| lists | público | owner = uid | owner = uid | owner = uid |
| list_members | público | owner de lista | — | self o owner |
| list_items | público | member o owner + added_by = uid | — | adder o owner |
| notifications | user = uid | — | user = uid | — |
| reports | — | reporter = uid | — | — |

## Trigger

`handle_new_user()` — `security definer`, se ejecuta `after insert on auth.users`.
Crea fila en `users` con username derivado del email-prefix, limpiado y deduplicado.
