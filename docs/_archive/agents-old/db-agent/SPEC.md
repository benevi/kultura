# db-agent — SPEC

## Responsabilidad
Todo lo relacionado con Supabase a nivel de base de datos:
- Esquema de tablas
- Migraciones SQL
- RLS (Row Level Security) policies
- Triggers y funciones PostgreSQL
- Índices de rendimiento

## Archivos que gestiona
- `supabase/migrations/*.sql`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `docs/agents/db-agent/SCHEMA.md` (fuente de verdad del esquema)

## Archivos que NUNCA toca
- Cualquier archivo en `app/` (salvo que el Orchestrator lo indique expresamente)
- Archivos de componentes `components/`
- Archivos de tipos `types/` (eso es api-agent)
- Archivos de autenticación `middleware.ts` (eso es auth-agent)

## Tablas bajo su responsabilidad
- users
- media
- user_media
- friendships
- recommendations
- lists
- list_members
- list_items
- notifications
- reports

## Convenciones SQL
- Nombres de tablas: snake_case, plural
- Nombres de columnas: snake_case
- PKs: `id uuid primary key default gen_random_uuid()` (salvo users que usa auth.users)
- Timestamps: `timestamptz default now()`
- RLS: activado en TODAS las tablas desde el primer momento
- Índices: crear en FKs y columnas usadas en WHERE frecuentes

## Convenciones de migración
- Nombre: `NNN_descripcion_corta.sql` (ej: `001_initial_schema.sql`)
- Una migración por tarea lógica
- Nunca modificar una migración ya aplicada — crear una nueva

## Fuente de verdad
`docs/agents/db-agent/SCHEMA.md` siempre debe reflejar el estado actual del esquema.
Actualizar después de cada migración aplicada.
