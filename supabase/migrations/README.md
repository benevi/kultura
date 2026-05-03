# Migraciones SQL — KULTURA

## Baseline

- **Archivo:** `20260502233945_remote_schema.sql`
- **Fecha:** 2026-05-02 23:39:45 UTC (recuperada el 2026-05-03 en B2)
- **Tamaño:** ~32 KB
- **Origen:** `supabase db pull --schema public` contra el proyecto `app movies` (ref `zfrbyphzvfuvejdwjfea`).
- **Contenido:**
  - 17 tablas (`users`, `media`, `user_media`, `friendships`, `recommendations`, `lists`, `list_members`, `list_items`, `notifications`, `reports`, `suggestions`, `conversations`, `conversation_members`, `messages`, `groups`, `group_members`, `group_posts`).
  - 49 RLS policies (RLS activado en las 17 tablas).
  - 4 funciones trigger: `handle_new_user`, `handle_new_group`, `handle_new_message`, `set_updated_at`.
  - Triggers: `on_auth_user_created` (`auth.users`), `on_group_created` (`groups`), `on_message_created` (`messages`), `user_media_set_updated_at` (`user_media`).
  - Extensiones: `pg_stat_statements`, `pgcrypto`, `supabase_vault`, `uuid-ossp`.
  - Publicación realtime con `messages` y `group_posts`.

## Aplicar la baseline en local

```bash
supabase start          # arranca el stack local (Docker)
supabase db reset       # aplica todas las migraciones desde cero
```

`db reset` recrea la BD local desde vacío y aplica los archivos de este directorio en orden de timestamp.

Inspección rápida:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# → 17

psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT count(*) FROM pg_policies WHERE schemaname='public';"
# → 49
```

Studio local: http://127.0.0.1:54323

## Verificar el estado del remoto

```bash
supabase migration list
```

Muestra qué migraciones están aplicadas en local vs remoto.

## Política de migraciones

A partir de aquí **todo cambio de schema** se hace creando una nueva migración:

```bash
supabase migration new <nombre_descriptivo>
# edita el archivo generado supabase/migrations/<timestamp>_<nombre_descriptivo>.sql
supabase db push    # aplica al remoto
```

**NUNCA** editar la baseline `20260502233945_remote_schema.sql` ni archivos de migraciones ya aplicadas. Cualquier corrección o cambio de schema → migración nueva.

## Importante: la baseline ya está aplicada en remoto

La baseline está marcada como `applied` en remoto (proyecto `app movies`, ref `zfrbyphzvfuvejdwjfea`). **NO ejecutar `supabase db push` sobre ella** — el remoto ya la tiene. Hacerlo provocaría error de duplicados o estados inconsistentes.

`db push` solo se usa para migraciones **nuevas** creadas tras la baseline.

## Verificación de reproducibilidad

La baseline fue verificada el 2026-05-03 contra postgres puro (no Supabase): el SQL es sintácticamente válido y todas las DDLs (`CREATE TABLE`, `CREATE FUNCTION`, FKs, CHECK constraints) ejecutan sin error. Los únicos errores observados son los esperables por ausencia de schemas/roles propios de Supabase (`auth`, `authenticated`, `anon`, `service_role`, `extensions`, `supabase_vault`, `supabase_realtime`).

La verificación con stack Supabase completo (`supabase db reset` local) quedó pendiente de Docker Desktop por degradación del backend de containerd. Anotada como **B2-VERIFY-LOCAL** en `docs/BACKLOG.md` para reintentar cuando Docker se restaure.
