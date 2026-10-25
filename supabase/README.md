# Supabase

Migraciones SQL del proyecto KULTURA. **Las migraciones del repo son la fuente
de verdad del esquema**: producción tiene que ser exactamente lo que resulta de
aplicarlas en orden (comprobación más abajo, en *Deriva*).

## Estado actual

Producción es el proyecto `zfrbyphzvfuvejdwjfea` ("app movies", **Central EU /
Frankfurt**); las funciones de Vercel corren en `fra1` (`vercel.json`) para
estar en la misma zona. Las migraciones se aplican **a mano en el SQL Editor**
de Supabase (producción y proyecto de test), así que la tabla
`supabase_migrations.schema_migrations` del remoto no refleja lo aplicado: no
usar `supabase db push` ni `supabase migration list` para saber qué falta.

### Orden de las migraciones

Se aplican siempre en orden de nombre (el prefijo es la fecha). La columna
"Producción" es el estado conocido a 2026-10-25: el volcado de `pg_policies`,
tablas y funciones de producción de la oleada 0 coincide exactamente (19
tablas, 110 políticas, 11 funciones) con aplicar las migraciones hasta
`20261014000001`.

| # | Migración | Qué hace | Producción |
|---|---|---|---|
| 1 | `20260502233945_remote_schema.sql` | Baseline (`db pull`): 17 tablas, RLS, triggers | aplicada |
| 2 | `20260506000001_fix_conversation_members_policy.sql` | Política de miembros de chat | aplicada |
| 3 | `20260506000002_fix_conversation_members_recursion.sql` | `is_conversation_member()` sin recursión | aplicada |
| 4 | `20260506000003_fix_conversation_members_select_recursion.sql` | SELECT de miembros sin recursión | aplicada |
| 5 | `20260512183131_dedupe_users_update_policies.sql` | Una sola política UPDATE en `users` | aplicada |
| 6 | `20260512183147_harden_conversations_insert_policy.sql` | INSERT de conversaciones | aplicada |
| 7 | `20260520000001_rpc_create_conversation_with_members.sql` | RPC para abrir un DM | aplicada |
| 8 | `20260531000001_fix_group_members_self_join.sql` | Alta propia en grupos (archivo posterior a aplicarla a mano) | aplicada |
| 9 | `20260531180450_rpc_discover_groups.sql` | RPC de descubrir grupos | aplicada |
| 10 | `20260531201838_drop_rpc_discover_groups.sql` | La retira | aplicada |
| 11 | `20260601000001_add_group_visibility.sql` | `groups.is_public` (archivo posterior a aplicarla a mano) | aplicada |
| 12 | `20260601000002_group_invitations.sql` | Tabla `group_invitations` | aplicada |
| 13 | `20260716000001_dm_only_between_friends.sql` | DMs solo entre amigos | aplicada |
| 14 | `20260913220000_avatar_and_group_icons.sql` | `users.avatar_icon`, `groups.icon` | aplicada |
| 15 | `20260914090000_media_translations.sql` | Tabla `media_translations` | aplicada |
| 16 | `20261008000001_demo_read_only.sql` | Cuenta demo de solo lectura (`demo_no_*`) | aplicada |
| 17 | `20261014000001_public_lists.sql` | `lists.is_public` | aplicada |
| 18 | `20261023020001_harden_rls.sql` | RLS y permisos endurecidos, `rls_audit()` (F-02) | **pendiente** |
| 19 | `20261023030001_media_server_only.sql` | `media` solo la escribe el servidor (F-03) | **pendiente** |
| 20 | `20261023040001_ai_budget.sql` | `ai_usage`, `ai_recs`, `increment_ai_usage()` (F-04) | **pendiente** |
| 21 | `20261101110001_moderation.sql` | `blocks`, `group_bans`, denuncias sin sesión (F-11) | **pendiente** |
| 22 | `20261101120001_identity_privacy.sql` | `account_state`, `username_history`, `library_visibility` (F-12) | **pendiente** |
| 23 | `20261115170001_analytics.sql` | `analytics_events`, vista `funnel_weekly` (F-17) | **pendiente** |

Las 23 se han aplicado limpias, en este orden, sobre un PostgreSQL 16 vacío
(con roles `anon`/`authenticated`/`service_role` y `auth.users` mínimos), y las
seis pendientes además dos veces seguidas (son idempotentes). El código
desplegado funciona antes y después de cada una.

### Aplicar las pendientes (Víctor)

1. En el **proyecto de test** y después en **producción**: SQL Editor → pegar el
   archivo completo → *Run*, una migración cada vez y **en el orden de la
   tabla** (18 → 23). Cada archivo explica al principio qué hace y cómo
   comprobarlo.
2. Comprobar qué está aplicado (todas deben salir `true`):

   ```sql
   select m.migracion, m.aplicada from (values
     ('20261023020001_harden_rls',        to_regprocedure('public.rls_audit()') is not null),
     ('20261023030001_media_server_only', not exists (select 1 from pg_policies
        where schemaname = 'public' and tablename = 'media' and policyname = 'media_insert_auth')),
     ('20261023040001_ai_budget',         to_regclass('public.ai_usage') is not null),
     ('20261101110001_moderation',        to_regclass('public.blocks') is not null),
     ('20261101120001_identity_privacy',  to_regclass('public.account_state') is not null),
     ('20261115170001_analytics',         to_regclass('public.analytics_events') is not null)
   ) as m(migracion, aplicada);
   ```
3. Con todas aplicadas, comprobar la deriva (siguiente sección) y pegar la
   salida en el PR.

## Deriva entre el repo y una base real

`scripts/db-diff.sh` compara las migraciones del repo con una base. La URL va
en `SUPABASE_DB_URL` o `--db-url` (Supabase → *Connect* → **Session pooler**,
puerto 5432, con la contraseña de la base; la misma que el secreto del
backup). El script nunca imprime la URL.

```bash
export SUPABASE_DB_URL='postgresql://postgres.zfrbyphzvfuvejdwjfea:<contraseña>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'

# 1. Deriva completa (tablas, columnas, índices, funciones, políticas, triggers).
#    Necesita Docker Desktop arrancado: levanta una base "sombra" con las 23
#    migraciones y la compara con producción (supabase db diff, CLI 2.120.0).
scripts/db-diff.sh                 # --pg-major 15 si el proyecto es Postgres 15

# 2. Sin Docker: deriva de tipos (tablas, vistas, columnas, tipos, nulos,
#    claves ajenas y funciones; no mira políticas).
scripts/db-diff.sh --types
```

Salida: `SIN DERIVA…` y código **0**; `DERIVA DETECTADA…` con el detalle y
código **1**; cualquier error de entorno (sin URL, sin Docker, URL del
*Transaction pooler*…) código **2**. Si la deriva son `DROP` de objetos que
crea una migración del repo (o, en `--types`, tablas que faltan), es que esa
migración aún no está aplicada en esa base. Cualquier otra cosa es un cambio
hecho a mano en el panel: se recoge en una migración nueva (no se edita una
vieja) y se vuelve a comprobar hasta que salga sin deriva.

La versión de Postgres del proyecto está en Supabase → *Settings →
Infrastructure*; `--pg-major` (por defecto 17) solo afecta a la base sombra.

### Tipos generados

`src/types/supabase.ts` tiene un bloque generado (`Database`, entre las marcas
`<supabase-gen-types>`) y, debajo, los tipos de dominio `Db*` escritos a mano.
El bloque se genera con postgres-meta 0.100.0, el mismo motor que usa
`supabase gen types typescript`:

```bash
scripts/db-diff.sh --gen-types                  # sin Docker (postgres-meta)
scripts/db-diff.sh --gen-types --generator cli  # supabase gen types --db-url (Docker)
npx tsc --noEmit
```

Solo se sustituye lo que hay entre las marcas (por eso no se usa
`supabase gen types … > src/types/supabase.ts`, que borraría los `Db*`). Si una
tabla gana o pierde columnas y su `Db*` no se actualiza, `tsc` falla nombrando
la columna. **Regenerar desde producción solo con todas las migraciones
aplicadas**; mientras tanto el bloque del repo refleja las 23 migraciones.

`tests/unit/schema/schema-drift.test.ts` (en la suite unitaria) comprueba sin
base de datos que las tablas, columnas, vistas y funciones de las migraciones
coinciden con el bloque generado, y que todo `.from()`, `.select()`, filtro,
escritura y `.rpc()` de `src/` usa tablas, columnas y argumentos que existen.

## Nuevas migraciones

- Archivo `supabase/migrations/<AAAAMMDD><FF><NNNN>_<nombre>.sql` (`FF` = número
  del frente, para que no colisionen), escrito a mano e **idempotente**
  (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` antes de
  `CREATE POLICY`), con un comentario inicial de qué hace y cómo comprobarlo.
- El código tiene que funcionar **antes y después** de aplicarla.
- Toda tabla nueva: `ENABLE ROW LEVEL SECURITY`, políticas con `TO
  authenticated`, `WITH CHECK` en INSERT/UPDATE y las `demo_no_*`
  (lo exige `tests/unit/rls/migrations-lint.test.ts`).
- Tras escribirla: `scripts/db-diff.sh --gen-types` contra una base con la
  migración aplicada (proyecto de test) o, si aún no existe, actualizar el
  bloque igual que en este PR; `npx tsc --noEmit` y `npx vitest run
  tests/unit/schema`.
- **Nunca** editar una migración ya aplicada: si tiene un error, otra nueva que
  lo corrija.

El repo no incluye `supabase/config.toml`, así que `supabase start` / `supabase
db reset` no funcionan tal cual; `scripts/db-diff.sh` monta un proyecto
temporal con una copia de las migraciones. `migrations/README.md` describe solo
la baseline.

## Variables de entorno para tests

Los tests de integración (`vitest.integration.config.ts`) corren contra
un proyecto Supabase **separado** del de producción:

```
SUPABASE_TEST_URL=
SUPABASE_TEST_ANON_KEY=
```

Ambas viven en `.env.local` (no commiteado) y en GitHub Secrets cuando
CI ejecute la suite de integración (todavía no — el workflow actual
solo corre unit tests).

## Copias de seguridad

Supabase Free no hace backups. El workflow
[`.github/workflows/backup.yml`](../.github/workflows/backup.yml) vuelca cada
lunes (03:17 UTC, y a mano con *Run workflow*) roles, esquema y datos de
producción, los cifra con [`age`](https://github.com/FiloSottile/age) y los
sube como artefacto de 90 días. El repositorio es público y cualquiera con
cuenta de GitHub puede descargar sus artefactos: **solo se sube el `.age`**, y
sin la clave privada no se puede leer.

### Puesta en marcha (una vez)

1. Generar el par de claves en tu ordenador (no en GitHub):
   ```bash
   age-keygen -o kultura-backup.key
   # imprime: Public key: age1...
   ```
   Guarda `kultura-backup.key` en el gestor de contraseñas y en una copia
   fuera del ordenador. Si se pierde, los backups no se pueden abrir.
2. En GitHub → *Settings → Secrets and variables → Actions*:
   - `BACKUP_AGE_RECIPIENT` = la clave pública `age1…`.
   - `SUPABASE_DB_URL` = Supabase → *Connect* → **Session pooler** (los
     runners de GitHub no tienen IPv6 y la conexión directa de Supabase sí lo
     necesita), con la contraseña de la base:
     `postgresql://postgres.zfrbyphzvfuvejdwjfea:<contraseña>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
3. *Actions → Backup BD → Run workflow* y comprobar que termina en verde y deja
   un artefacto `kultura-db-<fecha>.tar.gz.age`.

GitHub desactiva los workflows programados de un repositorio público tras 60
días sin actividad: si el repo se queda quieto, reactivarlo en *Actions*.

### Restaurar

Siempre primero en el proyecto de **test**, nunca encima de producción salvo
desastre.

```bash
# 1. Descargar el artefacto (Actions → ejecución → Artifacts) y descomprimir el zip.
age -d -i kultura-backup.key kultura-db-<fecha>.tar.gz.age | tar -xz
sha256sum -c SHA256SUMS            # roles.sql, schema.sql y data.sql: OK

# 2. Cargar en la base de destino (Session pooler del proyecto de test).
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$TEST_DB_URL"
```

`session_replication_role = replica` desactiva triggers y claves foráneas
mientras se cargan los datos (si no, `on_auth_user_created` y compañía se
dispararían otra vez). Si el destino ya tiene el esquema, empezar desde un
proyecto vacío o hacer *Reset database* en el de test.

Comprobación rápida tras restaurar:

```sql
select count(*) from public.users;
select count(*) from public.user_media;
select count(*) from pg_policies where schemaname = 'public';
```

Los números deben coincidir con los de producción del día del volcado.

### Prueba trimestral

Cada trimestre (enero, abril, julio, octubre) restaurar el último artefacto en
el proyecto de test con los pasos de arriba y apuntar aquí la fecha:

| Fecha | Artefacto | Resultado |
|---|---|---|
| — | — | Pendiente de la primera ejecución |

