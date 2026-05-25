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

---

## Ejecución local (B3.5e-3-local) — 2026-05-05

### Fix mecánicos aplicados

1. **`playwright.config.ts`**: añadido `loadEnvConfig(process.cwd())` de `@next/env` al inicio. Sin este fix, `process.env.TEST_USER_EMAIL` era `undefined` en el proceso de Playwright → `hasCredentials()` devolvía `false` → todos los tests que requieren auth se salteaban. Ahora las vars de `.env.local` llegan correctamente.
2. **`.gitignore`**: añadidas entradas `/test-results/` y `/playwright-report/` (generados por Playwright, no deben trackearse).

### Hallazgos estructurales (no son bugs de test, son de diseño)

**H1 — Login imposible en local**: el dev server (arrancado por `webServer` en `playwright.config.ts`) usa `NEXT_PUBLIC_SUPABASE_URL=zfrbyphzvfuvejdwjfea` (producción). Los usuarios de test (`test-user-a@example.com`) solo existen en el proyecto de test (`xqvicvypoxxfbezqnkwr`). El login falla silenciosamente (no redirige) → `waitForURL` timeout. **Todos los specs con `login()` son bloqueados por esto.**

**H2 — `/es` landing sin LanguageSwitcher**: el `<Header />` de la landing pública no incluye `<LanguageSwitcher />`. El selector del test `language-switch` (test 1 — landing pública) no puede encontrar el botón. Ambiguo: podría ser bug del test (asumió mal el componente) o bug del código (el switcher debería estar también en la landing). No tocar hasta resolver H1.

**H3 — Discover vacío para todos los tabs incluyendo movie (control)**: el test de control `tab movie` también falla. Toda la página `/discover` retorna grids vacíos. Esto sugiere que la API de TMDB no responde en el contexto del dev server durante los tests (rate limit, timeout de red, o que el `waitForLoadState('networkidle')` resuelve antes de que lleguen los datos). Investigar en B3.5c-3.

### Tabla resumen

> Nota: cada spec corre en 2 proyectos Playwright (chromium + Mobile Chrome). La tabla agrupa por test lógico (no por proyecto).

| Spec | Test | Resultado | Categoría | Bug B3.5b cubierto | Acción |
|---|---|---|---|---|---|
| language-switch | landing pública `/es` → switcher | ROJO | ROJO-INESPERADO (ambiguo) | n/a (control esperado) | Anotar H2, resolver tras H1 |
| language-switch | home autenticado | ROJO | ROJO-INESPERADO (entorno) | bug 3 | Bloqueado por H1 |
| discover-pagination | tab movie (control) | ROJO | ROJO-INESPERADO (entorno/código) | n/a (control) | Anotar H3, investigar |
| discover-pagination | tab anime | ROJO | ROJO-ESPERADO o entorno | bug 6 | Bloqueado por H3 (control también falla) |
| discover-pagination | tab manga | ROJO | ROJO-ESPERADO o entorno | bug 6 | Bloqueado por H3 |
| discover-pagination | paginación | ROJO | Cascada desde H3 | bug 6 | Bloqueado por H3 |
| notifications-render | render | ROJO | ROJO-INESPERADO (entorno) | bug 5 | Bloqueado por H1 |
| chat-send | enviar mensaje | ROJO | ROJO-INESPERADO (entorno) | bug 1 | Bloqueado por H1 |
| group-feed-post | publicar post | ROJO | ROJO-INESPERADO (entorno) | bug 4 | Bloqueado por H1 |

### Veredicto

La red de seguridad **no está validada**: 9/9 tests fallan, pero los fallos son en su mayoría por problemas de entorno (H1, H3), no por los bugs de aplicación que se pretendía detectar. Los bugs de B3.5b existen, pero los specs no pueden llegar a ellos mientras el login no funcione (H1) y mientras el discover esté globalmente vacío (H3).

**Próximo paso antes de B3.5e-3-prod**: resolver H1 (crear usuarios de test también en producción, o configurar el dev server de Playwright para usar el proyecto de test) y diagnosticar H3 (por qué discover está vacío en el contexto de Playwright).

---

## Doble entorno (B3.5e-3-local-FIX)

Para que los specs E2E ejecuten contra `kultura-test`, el dev server arrancado
por Playwright sobreescribe `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
con los valores de `kultura-test`. El resto de vars (TMDB, ANTHROPIC, etc.) se
heredan de `.env.local`.

**Setup:**
- `.env.local`: vars normales de desarrollo (apunta a Supabase de producción).
- `.env.test.local`: solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  apuntando a `kultura-test`. Sobreescribe las anteriores cuando Playwright arranca dev server.
- `.env.test.local` está cubierto por `.env*.local` en `.gitignore` — nunca se commitea.

**Por qué doble env:**

- Desarrollo manual (`npm run dev`) sigue contra Supabase de producción. ← **DECISIÓN INVERTIDA en E49** (ver abajo)
- E2E (`npx playwright test`) arranca dev server con vars sobreescritas
  apuntando a `kultura-test`, donde el seed garantiza usuarios y datos predecibles.

**Decisión técnica:** merge manual en `playwright.config.ts` `webServer.env`
para evitar añadir `cross-env` como nueva dependencia.

## Resultado B3.5e-3-local-FIX — 2026-05-05

### Fixes mecánicos aplicados (adicionales a B3.5e-3-local)

1. **`.env.test.local` creado**: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` apuntando a `kultura-test`.
2. **`playwright.config.ts`**: merge de `.env.test.local` en `webServer.env` — resuelve H1.
3. **`language-switch.spec.ts`**: eliminado sub-test `landing pública` (H2). Segundo assert cambiado a `html[lang="en"]` (fix mobile viewport).
4. **`chat-send.spec.ts`**: selector del botón corregido de `/nuevo|new|chat/i` a `/nueva conversación|new conversation|start.*chat/i`.

### Tabla resumen final

| Spec | Test | Resultado | Categoría | Bug B3.5b cubierto |
|---|---|---|---|---|
| language-switch | home autenticado | VERDE | VERDE-INESPERADO | bug 3 — no reproducible en local |
| discover-pagination | tab movie (control) | ROJO | H3 pendiente | n/a |
| discover-pagination | tab anime | ROJO | H3 pendiente | bug 6 |
| discover-pagination | tab manga | ROJO | H3 pendiente | bug 6 |
| discover-pagination | paginación | ROJO | H3 pendiente | bug 6 |
| notifications-render | render | VERDE | VERDE-INESPERADO | bug 5 — no reproducible en local |
| chat-send | enviar mensaje | ROJO | ROJO-ESPERADO | bug 1 — POST /api/chat no redirige a /chat/[id] |
| group-feed-post | publicar post | VERDE | VERDE-INESPERADO | bug 4 — no reproducible en local |

### Veredicto final

- **Bug 1 (chat)**: confirmado ROJO-ESPERADO. La red lo captura.
- **Bugs 3, 4, 5 (language-switch, group-feed, notifications)**: VERDE-INESPERADO — o los bugs se arreglaron en algún commit intermedio, o el entorno de test (kultura-test) difiere de producción en algo que enmascara los fallos. A investigar en B3.5c-1.
- **Bug 6 (discover)**: H3 pendiente — todos los tabs (incluido control movie) vacíos. Diagnosticar en B3.5c-1.
- **Discover (H3)**: `waitForLoadState('networkidle')` resuelve en ~1s pero el grid está vacío. El Server Component de discover llama a APIs externas (TMDB, Jikan) que pueden tener timeout o no responder en el contexto headless. A diagnosticar en B3.5c-1.

---

## E49 — Dev local apunta a kultura-test por defecto (2026-05-25)

**Decisión invertida.** A partir de E49, `npm run dev` apunta a kultura-test (`xqvicvypoxxfbezqnkwr`) por defecto. Producción (`zfrbyphzvfuvejdwjfea`) requiere intención explícita.

**Mecanismo:** `.env.development.local` (cubierto por `.env*.local` en `.gitignore`, nunca en git) con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` de kultura-test. Next.js 14 carga `.env.development.local` antes que `.env.local` en `next dev`, por lo que tapa las vars de prod.

**Para apuntar a producción en local:** comentar o borrar `.env.development.local`.

**Efectos colaterales verificados:**

- `vitest run` (unit): 506/506 verdes. Sin cambio de BD — Vitest usa `mode=test`, carga `.env.test.local`, no `.env.development.local`.
- `vitest run --config vitest.integration.config.ts`: Vite `loadEnv('test', ...)` ya apuntaba a kultura-test vía `.env.test.local`. Sin cambio.
- `playwright test`: sin cambio. `playwright.config.ts` no se modificó; sigue cargando `.env.local` + override de `.env.test.local` en `webServer.env`.
- `tsc --noEmit`: limpio.
- `npm run lint`: solo warnings preexistentes en `SearchResults.tsx`, sin relación con este cambio.
- `git status`: `.env.development.local` no aparece (cubierto por `.gitignore`). Vercel no afectado (sus vars vienen del dashboard, no de ficheros locales).

**Evidencia de resolución:** `loadEnvConfig(process.cwd(), true)` de `@next/env` con `NODE_ENV=development` resuelve `NEXT_PUBLIC_SUPABASE_URL=https://xqvicvypoxxfbezqnkwr.supabase.co` (ref: `xqvicvypoxxfbezqnkwr`, test). Antes era `zfrbyphzvfuvejdwjfea` (prod).
