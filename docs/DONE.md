# DONE

Log de tareas cerradas. Formato: `fecha | id | commit corto | nota si aplica`.

No se edita a mano durante el día. Solo se añade una línea al terminar cada tarea.

---

2026-05-01 | A1 | (sin commit, trabajo de dashboards) | Migración a sistema nuevo de Supabase API keys (`sb_publishable_*` + `sb_secret_*`). Legacy JWT keys deshabilitadas. App verificada en local + Vercel actualizado.

---

2026-05-01 | A2 | (sin commit, verificación) | .gitignore ya contenía `.claude/` (línea 42). 4 checks pasan: .claude/ ignorado, no trackeado, sin secretos en archivos trackeados, sin tokens en historial git.

---

2026-05-01 | A3 | (sin commit, dashboards externos) | Rotadas claves de Anthropic, TMDB, RAWG, Google Books y ComicVine. Valores nuevos en .env.local + Vercel. App verificada con npm run dev: TMDB/RAWG/Books/Anthropic OK.

---

2026-05-01 | A4 | (sin commit, verificación) | Diagnóstico: código y .env.local ya estaban unificados sin NEXT_PUBLIC_ para claves server-only (4/4 leídas correctamente: TMDB, RAWG, GOOGLE_BOOKS, ANTHROPIC). COMICVINE_KEY existe en env pero no se lee en src/ porque la integración no está implementada (E6).

---

 2026-05-01 | B1-A | a519684 | Limpiar tests huérfanos (3 tests sobre componentes 
       inexistentes borrados, 1 test de @/lib/env movido a _pending) + sincronizar 
       mock de queries.test.ts con .order(). Descubierto: 4 tests pre-existentes 
       fallando en register-form (no relacionados con B1-A).

---

2026-05-02 | B1-B+B1-C | 6f987bc | CI verde en GitHub Actions (lint, typecheck, test, build). Fixes en camino: Node 24 (lock file mismatch), button.tsx case-sensitivity (Linux CI), signOut mock faltante en register-form tests. B1-C absorbida.

---

2026-05-02 | A5 | 0986cec (HEAD post-rewrite) | Versionar estado del proyecto en 13 commits temáticos (A5.1→A5.13) + reescritura de identidad de los 22 commits (placeholder → benevi <victor_franco@hotmail.es>) + push a https://github.com/benevi/kultura (privado). 14 commits totales en master, ~14K líneas netas, 0 errores nuevos de TypeScript, working tree vacío. Hashes finales de cada subtarea: A5.1 4227f4d, A5.2 58798fb, A5.2-bis 7d90197, A5.3 4e49b6c, A5.4 496f315, A5.5 7e16206, A5.6 56753a4, A5.7 10068be, A5.8 424525d, A5.9 7d3bb23, A5.10 28570b2, A5.11 7e30637, A5.12 ec0f403, A5.13 0986cec. Decisiones: A5.10 absorbió refactor cn + 3 consumidores (Button, MediaCard, MediaGrid) por atomicidad; supabase/.temp/ ignorado en .gitignore; docs/_archive/ preservado como referencia histórica.

---

2026-05-03 | B2 | (pendiente de commit) | Baseline SQL versionada recuperada en `supabase/migrations/20260502233945_remote_schema.sql` (~32 KB, 17 tablas, 49 RLS policies, 4 funciones trigger). Camino: actualizar Supabase CLI 2.78.1 → 2.95.4, re-link al proyecto `app movies` (ref `zfrbyphzvfuvejdwjfea`), `supabase migration repair --status reverted 20260502155455` para limpiar entrada huérfana del intento fallido del 2026-05-02, `supabase db pull --schema public` exitoso. Verificación contra `db_snapshot.txt` (7 secciones) sin discrepancias. Verificación de reproducibilidad con postgres puro (Plan B): SQL sintácticamente válido, todas las DDLs principales aplican sin error real. Verificación con stack Supabase completo (`supabase db reset` local) bloqueada por degradación de Docker Desktop (`input/output error` persistente tras restart) → queda en B2-VERIFY.

---

2026-05-03 | B2-DOC | (pendiente de commit) | `supabase/migrations/README.md` creado (cómo aplicar baseline, política de migraciones, advertencia de no-`db push` sobre baseline). Tipos completos en `src/types/supabase.ts` para las 7 tablas previamente sin tipar. Marcadores `[POR VERIFICAR EN B2]` en CLAUDE.md NO actualizados — discrepancia detectada en `group_members.role` (real: `'owner' | 'member'`; CLAUDE.md inferido: `'owner' | 'admin' | 'member'`); decisión separada en B2-DOC-CLAUDE.

---

2026-05-03 | E17 | (pendiente de commit) | Añadidas interfaces `DbSuggestion`, `DbConversation`, `DbConversationMember`, `DbMessage`, `DbGroup`, `DbGroupMember`, `DbGroupPost` en `src/types/supabase.ts` + entradas en mapa `Database`. `npm run type-check` exit 0. Refactor de los `as unknown as Array<{...}>` ad-hoc queda en E19.

---

2026-05-03 | B2-DOC-CLAUDE | (pendiente de commit, absorbida en commit B2) | CLAUDE.md actualizado con SQL canónico confirmado: marcadores `[POR VERIFICAR EN B2]` eliminados, `group_members.role` corregido a `'owner' | 'member'` (rol `admin` no existe en CHECK constraint), `users.bio` documentada (columna existía en BD pero no en docs), cuerpos de las 4 funciones trigger confirmados y documentados.

---

2026-05-03 | B4 | (sin commit — operación fuera del repo) | Zip `kultura-backup-2026-05-01.zip` (280.4 MB, 30876 archivos) auditado en sesión B3. Contenía `kultura\.env.local` con credenciales reales y vigentes idénticas al `.env.local` actual. Tras verificación de 6 puntos por el usuario (no OneDrive, no Google Drive, no compartido, no segunda máquina, no backup automático en la nube), confirmado que el zip nunca salió de la máquina. Decisión: NO rotar claves. Zip borrado por el usuario con `Remove-Item -Force`. Carpeta temporal de auditoría `C:\temp\kultura-zip-audit` eliminada.

---

2026-05-03 | C4 | (pendiente de commit) | Rate-limit aplicado en 6 endpoints sin proteger: `POST /api/chat` (10/h), `POST /api/chat/[id]` (10/min), `GET /api/chat/[id]` (60/min), `POST /api/groups` (5/h), `POST /api/suggestions` (3/h), `GET /api/users/search` (30/min). `LIMITS` en `src/lib/rate-limit.ts` extendido con 6 nuevos presets. 6 tests nuevos añadidos en `tests/unit/rate-limit/rate-limit.test.ts` (18 total, todos green). Todos los endpoints devuelven HTTP 429 + `Retry-After` al superar cuota.

---

2026-05-03 | B3-headers | (pendiente de commit) | `next.config.mjs` actualizado: añadidos `Strict-Transport-Security: max-age=31536000` (conservador, verificar si Vercel ya lo añade) y `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`. CSP enforce existente sin cambios. Auditoría de dominios externos: sin gaps detectados (APIs externas son server-side, no browser-fetch). `npm run build` ✅, `tsc --noEmit` ✅, `vitest run` 493/493 ✅.

---

## B3 — Hardening de seguridad básico (cerrado 2026-05-03)

- Rate-limit añadido a 6 endpoints (4 planificados + 2 detectados durante implementación): POST /api/chat, POST /api/chat/[id], GET /api/chat/[id], POST /api/groups, POST /api/suggestions, GET /api/users/search.
- Headers de seguridad: Permissions-Policy añadido en next.config.mjs. HSTS gestionado por Vercel (verificado, no se duplica). CSP enforce ya existía con 'unsafe-inline' (ver C5/C7).
- Auditoría de zip backup: limpia, borrado.
- Documentos generados: docs/B3_DEPLOY_PLAN.md.
- BACKLOG: cerradas B4-zip y C4. Añadidas C5, C6, C7, C8.
- Tests: 487 → 493 (+6 tests del rate-limit).
- Commits: 224dcac, 03e4c29, b9e941f.
- Verificación post-deploy: headers OK, consola limpia, sin warnings CSP.
- Hallazgo colateral: app en estado funcionalmente incompleta a nivel UI/UX (no causado por B3; preexistente). Motiva el sprint B3.5.

---

## B3.5a — Auditoría UI/UX por código (cerrado 2026-05-03)

- Inventario sistemático de 17 rutas, 49 componentes, 19 endpoints.
- 0 endpoints huérfanos, 0 llamadas huérfanas.
- 18 strings hardcodeados en español detectados en 4 componentes de Home.
- Hallazgo: chat, lists y suggestions no enlazados desde NavLinks ni BottomNav.
- Documento: docs/UI_AUDIT.md (commit 9f4e1f5).

---

## B3.5b — Verificación visual del usuario (cerrado 2026-05-04)

- Pase visual por los hallazgos de B3.5a + componentes "necesita verificación".
- 5 flujos rotos en runtime: chat (POST 500), GroupFeed, /en/home (switcher no cambia idioma), /notifications, paginación de Discover.
- 2 flujos OK: settings, library (con nota de mejorar filtros).
- Hallazgos anotados en la sección "Recomendaciones" de docs/UI_AUDIT.md.

---

## B3.5e-1 — Proyecto Supabase de test aprovisionado (cerrado 2026-05-05)

- Proyecto `kultura-test` (ref: `xqvicvypoxxfbezqnkwr`) configurado como entorno aislado de tests.
- Baseline `20260502233945_remote_schema.sql` aplicada vía `supabase db push --db-url` (Opción A, sin desvincular producción). Verificada: 17 tablas / 49 RLS policies / 4 trigger functions / RLS 17/17.
- `vitest.integration.config.ts` corregido: añadido `loadEnv` de Vite para que `.env.local` se cargue en tests de integración (bug pre-existente).
- Tests de integración: `supabase-clients` 4/4 verde. `friends`, `rls-policies`, `library-upsert`, `trigger` fallan por falta de usuarios pre-creados — esperado (B3.5e-2).
- Hallazgo: Supabase rechaza dominio `@kultura.test` en signUp (`email_address_invalid`). Resolver en B3.5e-2 usando `@example.com` o configurando el proyecto de test.
- Documentación: `docs/B3_5e_TEST_ENV.md` creado, `CLAUDE.md` actualizado con `SUPABASE_TEST_SERVICE_ROLE_KEY`.

---

## B3.5d — Diagnóstico estructural (cerrado 2026-05-04)

- Auditoría de coherencia interna del código en 10 áreas.
- Veredicto: 🟡 base sólida con 2 inconsistencias reales (validación heterogénea + tests con cobertura cero en flujos críticos UI).
- Lo que está bien: cliente Supabase, auth+RLS, server/client components, manejo de errores HTTP, rate limiting, tests de integración DB.
- Lo que falta: tests E2E de UI (0 escritos), src/lib/social/groups.ts (no existe; lists.ts sí), normalización de validación, error handling en GroupFeed/ConversationClient.
- Documento: docs/STRUCTURAL_AUDIT.md.
- Recomendación adoptada por el usuario: meter B3.5e (red de seguridad) antes de los fixes en B3.5c-1.

---

2026-05-05 [B3.5e-2] Script de seed automatizado para tests E2E — a32c19d

---

2026-05-05 [B3.5e-3-local] Specs E2E ejecutados en local; 0/9 verdes esperados, 0/9 rojos esperados — bloqueado por H1 (login vs prod Supabase) y H3 (discover vacío globalmente). 2 fixes mecánicos: loadEnvConfig en playwright.config.ts + playwright artifacts en .gitignore — 7f9479a

2026-05-05 [B3.5e-3-local-FIX] Doble env para E2E (NEXT_PUBLIC_SUPABASE_* → kultura-test) + 3 fixes mecánicos de tests. Resultado: bug 1 (chat) ROJO-ESPERADO; bugs 3/4/5 VERDE-INESPERADO; bug 6 (discover) H3 pendiente diagnóstico — a9a8651

---

2026-05-06 [B3.5c-1] Diagnóstico de los 6 bugs detectados en B3.5b — 359d0dd

---

2026-05-06 [B3.5c-2] UX mecánico: navegación + i18n Home + comic oculto — 3067802

---

2026-05-06 [B3.5c-3] Fixes bugs 1,4,5,6 + refuerzo tests E2E — 232ef07

---

2026-05-06 [B3.5c-3-CLOSE] Cierre B3.5c-3: i18n banner + migration prod + 3 verdes E2E + 2 deudas spec → BACKLOG (E25, E26) — 72ce003

---

2026-05-07 [B3.5c-3-FIX2] Fix recursión RLS conversation_members + limpieza diagnóstico — 3703fe4

---

2026-05-07 [B3.5c-3-FIX3] Fix recursión policy SELECT conversation_members — 92aa455

---

2026-05-11 [B3.5c-3-FIX4] Fix idempotencia password en seed-test.mjs (findOrCreateUser sincroniza con .env.local) — 0bc9b4c

---

2026-05-11 [B3.5c-3-CLOSE-FINAL] Cierre definitivo B3.5c-3 tras sub-saga FIX2/FIX3/FIX4 + verificación manual exitosa kultura-test. Bugs 1,4,5,6 cerrados. Deuda E27-E33 anotada en BACKLOG. Próximo: B3.5g-AUDIT-RLS-1 — e4589a8

---

2026-05-12 [B3.5g-AUDIT-RLS-1] AUDIT-1 cerrado: 46🟢 / 3🟡 / 0🔴, refactor planificado en AUDIT-2 (dedup users UPDATE + evaluar conversations INSERT) — 02ab06c

---

2026-05-12 [B3.5g-AUDIT-RLS-2] db: dedupe users UPDATE + harden conversations INSERT — ef0d1d9

---

2026-05-12 [B3.5g-AUDIT-RLS-2] docs: E34-E36 en BACKLOG, NOW como TBD, DONE actualizado — 541a3b2

---
