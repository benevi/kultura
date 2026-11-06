# Auditoría de cimientos — KULTURA (`28479c1`, master)

Método: solo lectura del repo (`wc -l`, `grep -rn`, `find`). No se ejecutó build, tests ni `npm install`; lo que exige ejecución se marca como *no verificable aquí*. Rutas relativas a `/home/claude/benevi/kultura`.

**Veredicto global:** los cimientos (datos, esquema, seguridad, i18n, tests de lógica, operaciones) son de calidad alta y están razonablemente separados de la capa visual. El diseño actual **no** es una plantilla por defecto (sistema de tokens propio, sets cerrados, fuentes e iconos propios); lo que se percibe como genérico es la **composición de pantallas** (cards redondeadas en rejilla, skeletons, header con nav + campana + avatar), no los tokens. Recomendación: **(a) sustituir la capa visual conservando cimientos**. Empezar de cero destruiría ~6.100 líneas de SQL endurecido y ~41.000 líneas de tests de lógica que no dependen del diseño.

---

## 1. Mapa del repo en cifras

| Carpeta | Archivos | Líneas | Notas |
|---|---|---|---|
| `src/app` (total) | 192 código (+7 fuentes/iconos) | 23.242 | 37 `page.tsx`, 7 `layout.tsx`, 10 `loading.tsx`, 11 `error.tsx` |
| └ `src/app/api` | 60 | 7.375 | **51 `route.ts`** + 9 helpers (`collect.ts`, `purge.ts`, `shared.ts`…) |
| └ páginas + clientes (`[locale]/**`) | 132 | ~15.870 | incluye 11 `.ts` de lógica (1.012 líneas, ver §2) |
| `src/components` | 113 (102 `.tsx` + 10 `.ts` + 1 css) | 14.938 | `ui/` 22 archivos/2.290 líneas; `landing/` 1.199; `social/` 1.928; `media/` 1.826 |
| `src/lib` | 184 | 28.277 | `api/` 56 archivos/9.595; `import/` 21/3.073; `social/` 1.915; `library/` 1.547; `email/` 1.335; `push/` 1.218 |
| `src/types` | 5 | 2.381 | `supabase.ts` 2.011 (generado, cubre las 35 tablas + 14 funciones/vistas) |
| `src/i18n` + `src/hooks` + `middleware.ts` | 11 | 798 | |
| **`src` total** | **512** | **69.636** | |
| `supabase/migrations` | 31 `.sql` + README | 6.141 | baseline 1.264 + 30 incrementales |
| `tests/unit` | 363 `.test.*` (241 `.ts`, 119 `.tsx`) + fixtures | 63.165 (58.956 de test) | **3.749 `it(`/`test(`**; 3 snapshots (559 KB) |
| `tests/integration` | 12 | 2.502 | RLS ataques/caminos felices/auditoría, triggers, moderación, identidad |
| `tests/contract` | 12 | 715 | uno por proveedor + relevancia; red real, cron semanal |
| `tests/e2e` | 13 specs | 2.366 | 6 a11y (en CI), 1 pwa, 1 auth, 6 `b3_5e_safety_net` (fuera de CI) |
| `messages/es.json` / `en.json` | 2 | 2.186 c/u | **1.754 claves** en 46 espacios de nombres, paridad 100 % (0 faltantes en cada sentido) |
| `scripts/` | 9 | 1.736 | seed demo/test, `db-diff.sh`, `landing-media/build.py` (522) |
| `.github/workflows` | 4 | 494 | `ci.yml` (243), `backup.yml`, `contract.yml`, `landing-media.yml` |

---

## 2. Separación diseño ↔ lógica (la pregunta clave)

**Medida:** `src/lib` + `src/app/api` = **35.652 líneas (54 %)** frente a `src/components` + páginas/clientes ≈ **30.800 líneas (46 %)**.

Dónde viven las consultas a la base (`.from('…')`): **118 en `src/lib`, 117 en `src/app/api`, 26 en UI** (10 %). Las 26 de UI están en Server Components y helpers: `home/page.tsx` (6), `u/[username]/r/_lib/rating-share.ts` (3), `groups/[id]/GroupFeed.tsx` (3), `profile/[username]/page.tsx` (2), `chat/[id]/page.tsx` (2) y 10 archivos con 1. `.rpc(`: 3 en UI vs 14 en lib/api. Los Client Components no tocan Supabase salvo `auth.*` (login, ajustes) y realtime (`UnreadChatProvider`, `ConversationClient`): escriben vía `fetch('/api/…')` — 50 llamadas en 29 archivos, muchas ya encapsuladas en `src/lib/library/actions.ts` y `src/lib/social/actions.ts`.

La UI importa 100 módulos distintos de `@/lib/**` (los más usados: `utils`, `supabase/server`, `design/f0-tokens`, `social/friends`, `social/actions`, `best/best-of`, `library/progress`). Es la dirección correcta: la UI consume lib; lib no importa componentes.

**Componentes "gordos" (>300 líneas) en UI — 21 archivos:**

| Archivo | Líneas | Qué mezcla | Rescatar antes de borrar |
|---|---|---|---|
| `(app)/settings/SettingsForm.tsx` | 1.019 | 20+ `useState`, 7 `fetch` a `/api/settings`, `/api/account`, `/api/email/preferences`, `supabase.auth.updateUser` | flujo de borrado con gracia, cambio de correo, consentimiento semanal |
| `login/LoginPage.tsx` | 869 | `signInWithPassword/signUp/signInWithOAuth/resetPasswordForEmail/resend`, cooldown 60 s, detección in-app browser, atribución | `callbackUrl()`, `recordImmediateSignup()`, `welcomeHref()`, cooldown; `in-app-browser.ts` ya está aparte |
| `chat/[id]/ConversationClient.tsx` | 587 | realtime + `last_read_at` + envío | suscripción realtime |
| `welcome/WelcomeFlow.tsx` | 585 | onboarding, `fetch`, `starter-titles.ts` | nada: `starter-titles.ts` ya separado |
| `components/media/MediaDetail.tsx` | 535 | solo presentación (datos vienen de `lib/media/detail-data.ts`) | nada |
| `components/landing/engine.ts` | 532 | WebGL puro sin React | conservar íntegro (es diseño con valor) |
| `settings/import/ImportClient.tsx` | 526 | estado del importador por lotes | lógica ya en `lib/import/run.ts` |
| `lists/[id]/ListDetail.tsx` / `ReorderableItems.tsx` | 526 / 379 | reorden drag + `fetch` | reorden → `/api/lists/[id]` ya existe |
| `components/library/LibraryStatusModal.tsx` / `LibraryAction.tsx` | 452 / 426 | estado + rating + progreso | reglas en `lib/library/progress.ts` (440) ya separadas |
| `u/[username]/page.tsx` | 382 | Server Component con queries | mover a `lib/social/public-collection.ts` (ya tiene 465) |
| `u/[username]/r/_lib/rating-share.ts` | 351 | **HMAC de firma de tarjetas, no es UI** | mover a `src/lib/` |

`DiscoverClient.tsx` **ya no es gordo**: 117 líneas, dividido en `useDiscoverQuery.ts`, `useDiscoverUrl.ts`, `DiscoverToolbar`, `DiscoverResults`, `useFilterGroups.ts`.

Lógica que vive bajo `src/app/[locale]` en `.ts` (1.012 líneas) y debería sobrevivir: `rating-share.ts` (351), `settings/platforms.ts` (111), `welcome/starter-titles.ts` (109), `home/tonight.ts` (106), `discover/discover-config.ts` (86), `import-storage.ts` (67), `top-four.ts` (51), `in-app-browser.ts` (41).

**Dictamen:** sí, se puede sustituir la capa visual entera conservando `src/lib`, `src/app/api`, `supabase/`, `messages/` y `src/types`. Coste de rescate previo: ~1.000 líneas de `.ts` en `app/` + extraer de `SettingsForm`/`LoginPage`/`ConversationClient` los flujos de auth y realtime a hooks (~2–4 días). Las páginas Server Component (37) hay que reescribirlas, pero su "lógica" es orquestación de llamadas a lib (ej. `u/[username]/page.tsx`: `getPublicCollection`, `currentViewer`, `isValidInviteSignature`).

---

## 3. Calidad de los cimientos

| Área | Veredicto | Evidencia |
|---|---|---|
| **Proveedores** (`src/lib/api/*`) | **CONSERVAR** | `http.ts` (798): `providerFetch` con plazo 6 s/8 s, reintento solo 5xx, Zod permisivo con modo `log|enforce`, circuit breaker 5 fallos/5 min → 10 min abierto, `unstable_cache` solo de respuestas válidas, cupos (RAWG 20k/mes, ComicVine 200/h) en Upstash, User-Agent propio. Adaptador por familia (`families/*`, ADR `docs/adr/0001-…`). 9 clientes + 9 `*-maps.ts` + 9 schemas; `normalizer.ts` (486) → `MediaItem` único. 12 tests de contrato semanales. |
| **Esquema Supabase** | **CONSERVAR** (ejemplar) | 31 migraciones, 35 tablas, 49 funciones, 24 triggers, 151 `create policy` (110 `drop policy`: reescritura en `harden_rls`). 52 `security definer` / 53 `set search_path`: las 5 funciones que nacieron sin él (`handle_new_user/group/message` en la baseline, `is_group_owner` e `handle_invitation_accepted` en `group_invitations`) se redefinen o se `alter function … set search_path` en `harden_rls` (líneas 320-360, 588-596) e `identity_privacy` (232-234). Políticas RESTRICTIVE `demo_no_insert/update/delete` re-aplicadas en bucle `DO` al final de **11 migraciones**; tablas solo-servidor (`ai_*`, `analytics_events`) con RLS y 0 políticas + `revoke`. `rls_audit()` para comprobar. Cada migración documenta "antes y después funciona" e idempotencia (127 `if not exists`, 142 `if exists`). **Deriva:** `rpc_discover_groups` creada y borrada 20 min después (2 migraciones); timestamps 20261115–20261229 son **posteriores a hoy** (nombres no cronológicos; ordenan bien pero confunden). Reproducibilidad con `supabase db reset` *no verificable aquí* (el README lo deja pendiente). |
| **Auth y seguridad** | **CONSERVAR** | `middleware.ts` (190): CSP con nonce por petición + CSP fija en rutas CDN (`lib/csp.ts`, 195; `report-uri`/`report-to` a `/api/csp-report`), bloqueo demo (`lib/demo.ts`). `safe-redirect.ts` (78). `rate-limit.ts` (351): memoria + Upstash distribuido con fallback; **45 de 51 rutas lo usan**. `env.server.ts` con Zod + `server-only`; `supabase/admin.ts` sin `server-only` explícito (se apoya en que la key no es `NEXT_PUBLIC`): añadirlo. Secretos comparados con `timingSafeEqual` (`cron/daily`). |
| **i18n** | **CONSERVAR** | next-intl; 1.754 claves, paridad exacta, 6 tests (`missing-messages`, `dead-keys`, `icu`, `jsx-strings`, `glossary`). 60 valores idénticos es/en: nombres propios (`anime`, `manga`, avatares). |
| **Tests** | **CONSERVAR lógica / REHACER UI** | 241 tests `.ts` (41.366 líneas) importan solo lib/api → sobreviven; 119 `.tsx` (17.590 líneas) + 150 archivos que importan `@/components|@/app` → se pierden con el rediseño. Snapshots `discover-client-markup` (162 KB) y `discover-golden` (369 KB) son frágiles. **Obsoleto:** `tests/e2e/auth.spec.ts` busca el titular "Descubre, registra" que ya no existe en `messages/`; `b3_5e_safety_net` exige credenciales reales y no corre en CI. a11y (axe, teclado, reflow, `type-scale`, `grid`) sí corre en CI con Supabase simulado. |
| **Rendimiento** | **CONSERVAR** | Lighthouse CI con presupuesto 150 KB JS inicial + CLS 0,05 en portada/ranking/legal (`lighthouserc.json`). Fuentes autoalojadas `display: optional` (`fonts/index.ts`). `next/dynamic` solo en 1 archivo (`WelcomeImport`). **`three` está en `package.json` pero 0 imports en `src`**: la landing usa WebGL a mano (`engine.ts`). `next/image` 4 usos vs 13 `<img>` (pósteres por `poster-url.ts`). |
| **IA** | **CONSERVAR** | `lib/claude/budget.ts`: tope `AI_DAILY_CALL_CAP` (100) con `increment_ai_usage` atómico (advisory lock) y fallback en memoria; `ai_recs` 1 fila/usuario/día; `claude-haiku-4-5`, `max_tokens 1024`; candidatos reales del catálogo, nunca títulos inventados. |
| **Operaciones** | **CONSERVAR** | `ci.yml`: audit, lint, typecheck, tests de diseño, unit, build, a11y, Lighthouse, integración manual/semanal. `backup.yml`: volcado cifrado con `age` semanal (90 días). `contract.yml` abre issue si falla. Sentry (`tracesSampleRate 0.1`), `/api/health?deep=1`, cron único diario (`vercel.json`, Hobby). |

---

## 4. Por qué el diseño se percibe genérico (evidencia objetiva)

Primero lo que **no** es: `components.json` existe pero solo hay 3 primitivos Radix (`Dialog`, `Popover`, `Slot`), 0 `cva`, y los componentes son propios (`KButton`, `KInput`, `Modal`). `tailwind.config.ts` sustituye (no extiende) radios, tipografía y sombras; ESLint prohíbe `text-[…]`, `rounded-[…]`, `shadow-[…]`; 12 tests en `tests/unit/visual|design` vigilan que `DISENO.md` y el config coincidan. Fuentes propias (Bricolage Grotesque + Figtree + KulturaDisplay), 42 iconos rellenos propios (`icons/index.tsx`: "sustituye lucide-react").

**Señales de plantilla (medidas en `src/components` + `src/app`):**

1. Todo es redondo: 99 `rounded-2xl` + 97 `rounded-bento` + 181 `rounded-full/pill`; 0 esquinas vivas fuera de la landing.
2. Patrón card repetido: 15× literal `border border-surface-border bg-surface-default`, 58 bordes `surface-border`; 68 `grid-cols-*`.
3. Modo oscuro único, neutros de un solo matiz (280) — `globals.css`.
4. 21 skeletons `animate-pulse` en 10 `loading.tsx`; 83 `transition-colors`.
5. `KButton` primario = pill rosa `hover:brightness-110 active:scale-[0.98]`: micro-interacción estándar.
6. Badges con `backdrop-blur` sobre pósteres (`MediaCard.tsx` líneas 87 y 95).
7. Header de app: logo + 5 enlaces + campana + avatar (`nav-shared.tsx`); `DISENO.md` §Componentes lo llama "deuda conocida" frente al canvas F0 (solo búsqueda + avatar).
8. `PageHeading` admite **emoji en el h1** ("Tus listas 📋", "Grupos 🎉") mientras `VOZ.md` regla 8 prohíbe emojis en textos: contradicción interna.
9. Estructura de landing SaaS canónica en `messages/es.json → landing`: hero / features / how / rankings / compare / faq.
10. 194 `style={{…}}` inline en UI (gradientes de póster, landing): dificulta restilizar.
11. 94 menciones a `legacy` y dobles alias de tokens (`--surface2`, `--accent-color`, `bg`, `surface2`, `muted-light`) en `globals.css`/`tailwind.config.ts`.
12. `ui/input.tsx` (shadcn, minúscula) convive con `KInput.tsx`; lo usa solo `FriendsClient.tsx`.

**Lo que SÍ tiene carácter propio (conservar como semilla del nuevo diseño):**

- **Landing v2** (`components/landing/*`, 1.199 líneas): WebGL sin dependencias con mapas de profundidad (`engine.ts`), chaflán 18 px por `clip-path` (`landing.css` 59/76/195), apertura `kl-open`, fuente `KulturaDisplay` 17 KB (wdth 75/wght 800), pipeline `scripts/landing-media/build.py` + workflow semanal.
- **Sombras duras** `shadow-hard` (10px 10px 0) y `shadow-sticker` con rotaciones −8°: 12 + 12 usos.
- **Grano** global `.grain::before` (SVG `feTurbulence`, `globals.css` 247).
- **Logo** con 3 rectángulos rotados en cascada (`Logo.tsx`) y formas de avatar 32/32/32/8 "bocadillo".
- **Voz** (`VOZ.md`) con tests que la hacen cumplir (ICU, sin "Error al…", sin emojis en `messages`).

---

## 5. Deuda y riesgos

- **Dependencias muertas:** `three` y `@types/three` (0 imports). `GeistVF.woff` + `GeistMonoVF.woff` (134 KB) sin referencia. `tailwind.config.ts` incluye `./src/pages/**` (no existe).
- **Docs huérfanos:** se citan `docs/E59_FILTER_SPEC.md`, `E59_FILTER_SPEC_V2.md`, `TEST_SETUP_B3_5e.md`, `BACKLOG.md`; solo existe `docs/adr/0001…`.
- **Banderas con dos caminos vivos (7):** `MODERATION_V2` (16 refs/12 archivos), `RATING_SCALE_10` (18/12; `RatingInput` tiene modo `legacy` 1-5 y fino 0,5-10), `PROGRESS_V2` (17/10), `MIXED_LISTS` (9/8), `LIBRARY_VISIBILITY` (3/3), `INVITE_NOTIFY`, `SHARE_PUBLIC_LIBRARY`. Además **tolerancia a migración no aplicada**: 79 refs en 34 archivos a `isNotMigrated|42P01|PGRST205`, con `isNotMigrated` definido **3 veces** (`api/settings/account-state.ts`, `lib/library/scale.ts`, `lib/social/friends.ts`). Si las migraciones ya están en producción, todo eso es código muerto defensivo.
- **Tipado:** 52 `as unknown as` (concentrados en `lib/social/*` por joins de PostgREST), 1 `as any`, 0 `@ts-ignore`, 23 `eslint-disable`. 0 `TODO/FIXME` reales (los 12 hits son la palabra "TODO" en español).
- **Tests frágiles:** 2 snapshots de markup de 531 KB; `auth.spec.ts` desactualizado; e2e no-a11y fuera de CI.
- **Riesgo operativo:** breaker y rate-limit en memoria por instancia salvo Upstash (documentado); `admin.ts` sin `import "server-only"`.

---

## 6. Estimación comparada (1 dev + IA, días efectivos)

| Opción | Estimación | Qué se pierde | Riesgos | Qué se gana |
|---|---|---|---|---|
| **(a) Rediseñar capa visual, conservar cimientos** | **30–50 días** (2–4 rescate de lógica de `app/*.ts` y hooks de auth/realtime; 20–35 nuevas pantallas sobre 37 páginas/51 APIs/1.754 claves; 6–10 rehacer los 119 tests `.tsx` y re-apuntar a11y/Lighthouse) | 17.590 líneas de tests de componentes, snapshots, parte de `DISENO.md` | regresiones en flujos con bandera (7) y en demo/PWA; tentación de reusar componentes viejos a medias | identidad propia manteniendo RLS, proveedores, i18n, CI, legal; `messages/` reutilizable al 100 % |
| **(b) Reescribir UI+APIs desde cero, mismo stack, reutilizar solo Supabase + `src/lib`** | **55–90 días** | además de lo anterior: 7.375 líneas de API con rate-limit en 45 rutas, 37 tests de `tests/unit/api`, demo-blocking del middleware, CSP | reintroducir fallos ya corregidos (recursión RLS, redirects, cupos); duplicar el trabajo de `harden_rls` en el cliente | poca ganancia real frente a (a): las APIs no son "diseño" |
| **(c) Todo desde cero** | **120–200 días** para paridad (69.636 líneas `src` + 6.141 SQL + ~59.000 de tests + 1.754×2 textos) | todo lo de §7; meses de lecciones de producción codificadas en comentarios y ADR | nunca alcanzar la paridad actual de tests/seguridad; coste de oportunidad total | solo tiene sentido si se cambia de stack o de producto |

---

## 7. Cimientos que NO hay que perder / Borrable sin dolor

**Conservar (rutas):**
- `supabase/migrations/*` (31) + `supabase/README.md` + `scripts/db-diff.sh`, `seed-demo.ts`, `seed-test.mjs`.
- `src/lib/api/**` (56 archivos) + `docs/adr/0001-*.md` + `tests/contract/**`.
- `src/lib/{import,library,social,media,best,calendar,email,push,claude,recommendations,analytics,adaptations,translate}/**`.
- `src/lib/{csp,rate-limit,logger,demo,env.server,env.public,site-url}.ts`, `src/lib/utils/*`, `src/lib/supabase/*`, `src/middleware.ts`.
- `src/app/api/**` (51 rutas) y helpers; `src/app/{manifest,robots,sitemap}.ts`, `.well-known/*`.
- `src/types/*`, `src/i18n/*`, `messages/*.json`, `VOZ.md`.
- Textos legales: `messages/*.json → legal` (167 claves, ~20.600 caracteres) + `components/legal/LegalDocument.tsx` (lógica de secciones).
- `tests/unit/**/*.test.ts` (241), `tests/integration/**`, `tests/e2e/a11y/{mock-supabase,build,env}.cjs` (infra de CI sin red).
- `.github/workflows/*`, `lighthouserc.json`, `vercel.json`, `sentry.*`, `instrumentation*.ts`, `public/sw.js`.
- Diseño con valor: `components/landing/*`, `src/app/fonts/{Bricolage,Figtree,KulturaDisplay}*.woff2`, `components/icons/index.tsx`, `components/layout/Logo.tsx`, `scripts/landing-media/*`.

**Borrable sin dolor:**
- `src/components/{ui,layout,home,library,media,social,collection,profile,best,search,pwa,push}/**` (salvo `Logo`, `icons`, `landing`): ~12.000 líneas de presentación.
- Todas las `page.tsx`/`*Client.tsx`/`loading.tsx`/`error.tsx` de `src/app/[locale]` **tras** mover los 11 `.ts` de lógica a `src/lib`.
- `tests/unit/**/*.test.tsx` (119) y `tests/unit/catalogo/__snapshots__/*`, `tests/e2e/auth.spec.ts`, `tests/e2e/b3_5e_safety_net/*`.
- `three`, `@types/three`, `GeistVF.woff`, `GeistMonoVF.woff`, `components.json`, `ui/input.tsx`, alias `legacy` de `globals.css`/`tailwind.config.ts`, la entrada `src/pages` del `content`.
- `DISENO.md` como fuente de verdad del look actual (conservar §Formularios/foco y §Retícula: son accesibilidad, no estética).
