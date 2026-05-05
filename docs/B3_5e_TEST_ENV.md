# B3.5e — Entorno de test Supabase

## Proyecto

- Nombre: kultura-test
- Project ref: xqvicvypoxxfbezqnkwr
- Región: (misma región que producción)
- Creado: 2026-05-05

## Variables de entorno

Las 3 variables viven en `.env.local` (no trackeado por git):

- `SUPABASE_TEST_URL` — URL del proyecto kultura-test
- `SUPABASE_TEST_ANON_KEY` — anon key del proyecto kultura-test
- `SUPABASE_TEST_SERVICE_ROLE_KEY` — service_role key (solo para migraciones/seed, nunca en código de app)

Documentadas también en `CLAUDE.md` sección "Env vars".

## Schema aplicado

Baseline `supabase/migrations/20260502233945_remote_schema.sql` aplicada el 2026-05-05 vía:

```
supabase db push --db-url "postgresql://postgres:<password>@db.xqvicvypoxxfbezqnkwr.supabase.co:5432/postgres"
```

Opción A usada (db push directo con --db-url, sin desvincular el proyecto de producción).

### Verificación (2026-05-05)

| Métrica | Producción | Test | Match |
|---|---|---|---|
| Tablas en public | 17 | 17 | ✓ |
| RLS policies | 49 | 49 | ✓ |
| Funciones trigger | 4 | 4 | ✓ |
| RLS habilitado | 17/17 | 17/17 | ✓ |

Funciones trigger confirmadas: `handle_new_group`, `handle_new_message`, `handle_new_user`, `set_updated_at`.

## Tests verificados

- `vitest integration` (supabase-clients): 4/4 verdes (no requieren seed).
- `vitest integration` (friends, rls-policies, library-upsert, trigger): fallan por falta de usuarios pre-creados — esperado, requieren seed (B3.5e-2).
- `vitest unit`: 493/493 verdes.

### Hallazgo B3.5e-1

Los tests de trigger (`trigger.test.ts`) usan el dominio `@kultura.test` para registrar usuarios en Supabase Auth. El proyecto de test rechaza este dominio con `email_address_invalid`. Causa probable: configuración de dominios permitidos en el proyecto de test, o restricción de Supabase free tier. A resolver en B3.5e-2 al crear el seed (usar dominio válido como `@example.com` o configurar el proyecto para aceptar cualquier dominio).

### Fix aplicado en B3.5e-1

`vitest.integration.config.ts` actualizado para cargar `.env.local` vía `loadEnv` de Vite (antes el config de integración no cargaba variables de entorno, causando `supabaseUrl is required`).

## Seed (B3.5e-2)

Script: `scripts/seed-test.mjs`. Idempotente. Lee credenciales de `.env.local`.

**Ejecutar:**
```bash
node --env-file=.env.local scripts/seed-test.mjs
```

**Datos creados:**
- 2 usuarios (`test-user-a@example.com`, `test-user-b@example.com`).
- Amistad aceptada A↔B.
- 1 grupo con A=owner y B=member.
- 1 group_post de A en el grupo.
- 1 conversación A↔B con 1 mensaje.
- 1 notificación para A.

**Variables consumidas por specs E2E:**
- `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` — login de usuario A.
- `TEST_USER_B_EMAIL` — referencia para flujos sociales.
- `TEST_GROUP_ID` — UUID del grupo seedeado.

**Próximo paso:** B3.5e-3 ejecuta los 5 specs E2E contra este seed.
