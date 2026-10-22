# Supabase

Migraciones SQL del proyecto KULTURA.

## Estado actual

Las migraciones versionadas están en `supabase/migrations/`, empezando por la
baseline `20260502233945_remote_schema.sql` (detalle en
[`migrations/README.md`](migrations/README.md)). Producción es el proyecto
`zfrbyphzvfuvejdwjfea` ("app movies", **Central EU / Frankfurt**); las funciones
de Vercel corren en `fra1` (`vercel.json`) para estar en la misma zona.

## Levantar Supabase en local

Requisitos:

- Supabase CLI ≥ v2.78.
- Docker Desktop corriendo (necesario para el shadow database de
  `db reset`).

```bash
supabase start            # arranca contenedores Postgres + Studio
supabase db reset         # aplica todas las migraciones desde cero
```

`supabase db reset` aplica la baseline y el resto de `migrations/*.sql` en
orden de timestamp.

## Aplicar migraciones contra el proyecto remoto

```bash
supabase link --project-ref <ref>
supabase db push          # aplica solo las migraciones que falten
```

## Generar nuevas migraciones

Cuando se cambia el schema (en el dashboard o vía SQL editor):

```bash
supabase db diff -f <descripcion_corta>
```

Eso crea `migrations/<timestamp>_<descripcion>.sql`. Revisar el SQL
generado a mano antes de commitear.

**Regla:** no editar archivos de migración ya commiteados. Si una
migración tiene un error, generar una nueva que lo corrija.

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

