# Supabase

Migraciones SQL del proyecto KULTURA.

## Estado actual

`supabase/migrations/` está **vacío en el filesystem**. El schema real
de producción tiene 17 tablas, 49 RLS policies y 4 funciones trigger,
pero la baseline `20260502155455_remote_schema.sql` generada por
`supabase db pull` durante la sesión 2026-05-02 desapareció antes de
commitearse (ver `docs/SESSION_2026-05-02.md`).

> **Las migraciones versionadas están pendientes de recuperar.** Tarea
> activa: **B2** en [`docs/BACKLOG.md`](../docs/BACKLOG.md). Hasta que
> B2 cierre, la fuente de verdad del schema es el dashboard remoto
> (`zfrbyphzvfuvejdwjfea`, "app movies", Central EU).

## Levantar Supabase en local

Requisitos:

- Supabase CLI ≥ v2.78.
- Docker Desktop corriendo (necesario para el shadow database de
  `db reset`).

```bash
supabase start            # arranca contenedores Postgres + Studio
supabase db reset         # aplica todas las migraciones desde cero
```

Tras B2, `supabase db reset` dejará el schema local idéntico al de
producción. Hoy `db reset` no aplica nada porque no hay archivos
`migrations/*.sql`.

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
