# ESTADO_PROYECTO — KULTURA

**Fecha del informe:** 2026-05-02
**Auditor:** Claude Opus 4.7 (modo diagnóstico, no implementación)
**Scope:** Repositorio completo en `e:\app movies\kultura\`
**Metodología:** Lectura archivo por archivo del código, configuración, documentación interna, historial de git, tests, migraciones y mensajes i18n. Lo no verificado se marca explícitamente como `[NO ENCONTRADO]` o `[REQUIERE CONFIRMACIÓN DEL USUARIO]`. Las inferencias se etiquetan con `Inferido:`.

> Este documento es **diagnóstico, no plan de acción**. No se proponen pasos siguientes ni soluciones — esa fase queda para una sesión posterior.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Objetivos originales del proyecto](#2-objetivos-originales-del-proyecto)
3. [Arquitectura y stack tecnológico](#3-arquitectura-y-stack-tecnológico)
4. [Estructura de directorios](#4-estructura-de-directorios)
5. [Inventario exhaustivo de componentes y módulos](#5-inventario-exhaustivo-de-componentes-y-módulos)
6. [Flujos de la aplicación](#6-flujos-de-la-aplicación)
7. [Modelo de datos](#7-modelo-de-datos)
8. [API / Endpoints / Rutas](#8-api--endpoints--rutas)
9. [Interfaz de usuario y diseño](#9-interfaz-de-usuario-y-diseño)
10. [Decisiones de diseño y arquitectura — el "por qué"](#10-decisiones-de-diseño-y-arquitectura--el-por-qué)
11. [Tests y calidad](#11-tests-y-calidad)
12. [Configuración y despliegue](#12-configuración-y-despliegue)
13. [Análisis de cumplimiento de objetivos](#13-análisis-de-cumplimiento-de-objetivos)
14. [Desviaciones del plan original](#14-desviaciones-del-plan-original)
15. [Problemas detectados](#15-problemas-detectados)
16. [Dependencias externas](#16-dependencias-externas)
17. [Puntos fuertes del proyecto](#17-puntos-fuertes-del-proyecto)
18. [Riesgos y bloqueantes actuales](#18-riesgos-y-bloqueantes-actuales)

---

## 1. Resumen ejecutivo

**KULTURA** es una web app de descubrimiento y seguimiento cultural multidominio: películas, series, anime, libros, cómics, manga y videojuegos. Permite a un usuario mantener una biblioteca personal con estados (pendiente, en curso, completado, abandonado) y puntuación, y añadir capa social (amigos, listas colaborativas, recomendaciones directas, chat, grupos, feed de actividad), búsqueda agregada en 6 APIs externas, y recomendaciones generadas por Claude Sonnet 4.6.

**Estado general:** ~75 % completado respecto a un MVP funcional con capa social. La fase de hardening de producción — ítem que el propio repositorio identifica explícitamente — está aproximadamente al 20 %: hay CI verde y credenciales rotadas, pero las migraciones SQL versionadas, el rate limiting distribuido, la observabilidad, el cumplimiento legal y la monetización siguen sin existir.

**Veredicto:** **Parcialmente alineado** con los objetivos originales. La parte funcional/UX está prácticamente entera; falta toda la capa de "producción real" que el propio `AUDIT.md` y `docs/BACKLOG.md` enumeran. El proyecto avanza siguiendo el flujo NOW/BACKLOG/DONE definido en `CLAUDE.md`, con la tarea actual atascada en B2 (migraciones SQL) tras una sesión cerrada con estado inconsistente.

---

## 2. Objetivos originales del proyecto

### 2.1 Fuente: `CLAUDE.md` (líneas 1-3, 240-242)

> "Web app de descubrimiento cultural (películas, series, anime, libros, cómics, manga, videojuegos). Biblioteca personal, amigos, listas, recomendaciones IA."

> "Las fases originales (Fundación → APIs → Biblioteca → Social → IA → Pulido) están **completadas o en pulido**; el trabajo abierto es **hardening de seguridad, infra y producción**, ordenado en `docs/BACKLOG.md`."

### 2.2 Fuente: `AUDIT.md` (2026-04-23)

`AUDIT.md` enumera el "estado real" en el momento del audit y deja explícitos los objetivos de producción pendientes (Fases 0-4 del roadmap del audit):

- **Fase 0 — Hardening inmediato:** rotar credenciales, limpiar `.claude/settings.json`, migraciones SQL, CI/CD básico.
- **Fase 1 — Producción real:** rate limiting → Vercel KV, Sentry, SEO dinámico, eliminar `console.error` de producción, error boundaries, GDPR.
- **Fase 2 — Calidad y features:** ComicVine, tests de componentes React, E2E ampliado, validación de env vars, paginación, OAuth.
- **Fase 3 — Monetización:** modelo de negocio, schema billing, Stripe, dashboard admin, onboarding.
- **Fase 4 — Escalado:** CDN, caché Redis, edge functions, monitoring de performance.

### 2.3 Objetivos derivados de los commits semilla `SPEC-001..SPEC-007`

Los primeros 7 commits del repositorio (anteriores al refactor `[A5.x]`) referencian especificaciones numeradas:

```
SPEC-001 — chore(setup): inicializa proyecto KULTURA
SPEC-002 — feat(db-agent): esquema inicial, RLS y trigger
SPEC-003 — feat(auth-agent): clientes Supabase y middleware de sesión
SPEC-004 — feat(api-agent): tipos TypeScript compartidos
SPEC-005 — feat(i18n-agent): mensajes completos para Fase 1 y helper de errores auth
SPEC-006 — feat(ui-agent): componentes UI base
SPEC-007 — feat(auth-agent): páginas login/registro/recuperación
```

Las especificaciones (`SPEC-XXX.md`) no están presentes en el repo actual — `[NO ENCONTRADO]` ningún archivo `SPEC-*.md` o `specs/` ni `requirements.md` o `PRD.md`. El flujo aparente fue: especificaciones generadas por agentes, ejecutadas, y conservadas solo en el árbol de commits.

### 2.4 Objetivos inferidos del código

`Inferido:` (no documentados explícitamente, pero codificados):

- **Mobile-first**: regla 7 de `CLAUDE.md` y presencia de `BottomNav` específico para móvil + clases `md:` en todos los componentes.
- **Internacionalización es/en con `es` por defecto**: `src/i18n/routing.ts` y 454 líneas en `messages/es.json` y `messages/en.json`.
- **Agnóstico al tipo de medio**: el tipo `MediaItem` (`src/types/media.ts:59-84`) es la fuente de verdad y todas las APIs externas se normalizan antes de llegar a UI (regla 2 de `CLAUDE.md`).
- **Server-only para credenciales sensibles**: regla 1 de `CLAUDE.md` + middleware en `src/middleware.ts` + clientes diferenciados en `src/lib/supabase/{client,server}.ts`.
- **TypeScript estricto, sin `any`**: regla 6 de `CLAUDE.md`. Solo se permite `any` en `metadata: Record<string, any>` de `MediaItem` y en un `as any` documentado de middleware.

### 2.5 Lo que NO está documentado como objetivo

- No hay objetivo formal de monetización (`AUDIT.md` lo identifica como gap crítico para una ronda de inversión, pero no como objetivo del producto en sí).
- No hay objetivo formal de cumplimiento GDPR explícito (también gap detectado por `AUDIT.md`).
- No hay objetivo de OAuth — solo email/password.

---

## 3. Arquitectura y stack tecnológico

### 3.1 Stack real (verificado en `package.json`)

| Capa | Tecnología | Versión exacta |
|------|-----------|---------------|
| Framework | Next.js (App Router) | 14.2.35 |
| UI runtime | React | ^18 |
| Estilos | Tailwind CSS | ^3.4.1 |
| Lenguaje | TypeScript | ^5 (modo `strict`) |
| Auth + DB + Realtime | Supabase | `@supabase/supabase-js` ^2.103.0, `@supabase/ssr` ^0.10.2 |
| IA | Anthropic SDK | `@anthropic-ai/sdk` ^0.88.0 |
| i18n | next-intl | ^4.9.1 |
| Validación | Zod | ^4.3.6 |
| Componentes | Radix UI Slot, lucide-react, class-variance-authority, clsx, tailwind-merge | varias |
| Tests unitarios | Vitest | ^4.1.4 |
| Tests E2E | Playwright | ^1.59.1 |
| Coverage | `@vitest/coverage-v8` | ^4.1.4 |
| DOM en tests | jsdom | ^29.0.2 |
| Lint | ESLint + `eslint-config-next` | ^8 / 14.2.35 |
| Runtime mínimo | Node.js | >= 20 |

> **Nota:** el `dependencies` de `package.json` declara `lucide-react` ^1.8.0. La versión actual del paquete es bastante más alta — `[REQUIERE CONFIRMACIÓN]` si el lock instala efectivamente esa versión o una nueva (el lock no ha sido inspeccionado).

### 3.2 Modelo de IA y otras claves externas

`CLAUDE.md:40` indica `claude-sonnet-4-20250514` como modelo, pero el código de `src/lib/claude/recommendations.ts:188` usa **`claude-sonnet-4-6`**. **Inconsistencia documentación↔código.** El comentario inline en el archivo (`// claude-sonnet-4-6`) confirma la intención.

### 3.3 APIs externas integradas

| API | Adaptador en código | Auth | Idioma | Estado |
|-----|---------------------|------|--------|--------|
| TMDB v3 (movie/tv) | `src/lib/api/tmdb.ts` | `process.env.TMDB_API_KEY` (server-only) | `es-ES` por defecto | ✅ |
| Jikan v4 (anime/manga) | `src/lib/api/jikan.ts` | sin auth | inglés | ✅ |
| Google Books v1 | `src/lib/api/googlebooks.ts` | `process.env.GOOGLE_BOOKS_KEY` (server-only) | `langRestrict=es` | ✅ |
| Open Library | `src/lib/api/openlibrary.ts` | sin auth | — | ✅ (presente como fallback, sin usarse en `searchAll` actualmente) |
| MangaDex v5 | `src/lib/api/mangadex.ts` | sin auth | en/ja-ro | ✅ |
| RAWG | `src/lib/api/rawg.ts` | `process.env.RAWG_API_KEY` (server-only) | inglés | ✅ |
| ComicVine | — | `COMICVINE_KEY` en `.env.local` | — | ❌ **NO IMPLEMENTADO** (clave existe, sin adapter) |
| Anthropic Claude | `src/lib/claude/recommendations.ts` | `ANTHROPIC_API_KEY` (server-only) | bilingüe (prompt switch) | ✅ |

### 3.4 Diagrama textual de la arquitectura

```
┌────────────────────────────────────────────────────────────────────┐
│  Cliente (Browser)                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  React 18 + Next.js App Router (Server + Client Components) │   │
│  │  Tailwind CSS · next-intl (es/en) · Mobile-first            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────┬──────────────────────────────────────────────────┬──────────┘
       │ HTTPS                                            │ HTTPS
       ▼                                                  ▼
┌──────────────────────────┐                   ┌──────────────────────┐
│  Next.js (Vercel iad1)   │                   │ Supabase Realtime    │
│  ┌────────────────────┐  │                   │ (WebSocket wss://)   │
│  │ middleware.ts      │  │                   │ usado en chat        │
│  │ (auth + locale)    │  │                   └──────────────────────┘
│  ├────────────────────┤  │
│  │ Server Components  │  │
│  │ (page.tsx)         │  │
│  ├────────────────────┤  │           ┌──────────────────────────────┐
│  │ Route Handlers     │  ├──────────►│ Supabase PostgreSQL          │
│  │ (API)              │  │           │ ┌─────────────────────────┐  │
│  │  · /api/library    │  │           │ │ users · media           │  │
│  │  · /api/search     │  │           │ │ user_media · friendships│  │
│  │  · /api/friends    │  │           │ │ recommendations · lists │  │
│  │  · /api/chat       │  │           │ │ list_members · list_items│ │
│  │  · /api/groups     │  │           │ │ notifications · reports │  │
│  │  · /api/ai-recom.  │  │           │ │ conversations · messages│  │
│  │  · 13 más          │  │           │ │ groups · group_members  │  │
│  ├────────────────────┤  │           │ │ group_posts · suggestions│ │
│  │ rate-limit.ts      │  │           │ │ + RLS en todas          │  │
│  │ (Map en memoria)   │  │           │ └─────────────────────────┘  │
│  └────────────────────┘  │           └──────────────────────────────┘
└─────┬────────────────────┘
      │ HTTPS
      ▼
┌──────────────────────────────────────────────────────────────────┐
│  APIs externas (todas server-side)                               │
│  TMDB · Jikan · Google Books · Open Library · MangaDex · RAWG    │
│  Anthropic Claude (claude-sonnet-4-6)                            │
└──────────────────────────────────────────────────────────────────┘
```

### 3.5 Patrón arquitectónico

- **Patrón nominal:** Next.js App Router con división Server Components / Client Components según necesidad de interactividad.
- **Aproximación a hexagonal** en `src/lib/api/` (cada API externa tiene su adaptador) + `normalizer.ts` (capa anti-corrupción que devuelve siempre `MediaItem`). La regla 2 de `CLAUDE.md` blinda este patrón.
- **Server Actions clásico, no usado:** el proyecto usa Route Handlers en lugar de Server Actions para escritura. `Inferido:` decisión por compatibilidad con clientes JS más explícitos (las acciones en `src/lib/library/actions.ts`, `src/lib/social/actions.ts` hacen `fetch('/api/...')`).
- **Lo que rompe el patrón:**
  - `src/lib/library/queries.ts` mezcla acceso directo a Supabase con tipos del dominio: la capa de "queries" no es estrictamente un repositorio porque devuelve objetos del dominio (`LibraryEntry`) y conoce el tipo de DB (`DbUserMedia`).
  - `src/lib/social/circle.ts` y `src/lib/social/feed.ts` agregan datos en JS dentro de la capa de queries — funcionan bien para escala pequeña pero acoplan lógica de presentación con consulta.
  - `src/app/[locale]/(app)/library/LibraryClient.tsx` aplica los filtros en cliente (memoria del browser), no via query params al backend — el server pasa **toda** la biblioteca y luego el cliente filtra.

---

## 4. Estructura de directorios

```
kultura/
├── .claude/                        — config local de Claude Code (ignorado en git)
├── .git/
├── .github/
│   └── workflows/
│       └── ci.yml                  — GitHub Actions: lint + typecheck + test + build
├── .next/                          — build cache (ignored)
├── .vercel/                        — Vercel link (ignored)
├── docs/
│   ├── _archive/agents-old/        — flujo de agentes antiguo, congelado
│   ├── BACKLOG.md                  — plan completo por bloques (A-F)
│   ├── DONE.md                     — log de tareas cerradas
│   ├── NOW.md                      — única tarea activa (B2 actualmente)
│   └── SESSION_2026-05-02.md       — notas de la última sesión
├── messages/
│   ├── es.json                     — 454 líneas
│   └── en.json                     — 454 líneas
├── node_modules/                   — (ignored)
├── public/                         — [NO ENCONTRADO] (no listado en exploración inicial; revisar si existe vacío)
├── src/
│   ├── app/                        — App Router (rutas + Route Handlers)
│   │   ├── [locale]/
│   │   │   ├── (app)/              — rutas autenticadas
│   │   │   │   ├── chat/
│   │   │   │   ├── discover/
│   │   │   │   ├── friends/
│   │   │   │   ├── groups/[id]/
│   │   │   │   ├── home/
│   │   │   │   ├── library/
│   │   │   │   ├── lists/, lists/[id]/
│   │   │   │   ├── media/[type]/[id]/
│   │   │   │   ├── notifications/
│   │   │   │   ├── profile/[username]/
│   │   │   │   ├── search/
│   │   │   │   ├── settings/
│   │   │   │   ├── suggestions/
│   │   │   │   ├── error.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── login/
│   │   │   ├── error.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            — landing pública
│   │   ├── api/                    — 18 archivos route.ts
│   │   ├── favicon.ico
│   │   ├── fonts/
│   │   ├── globals.css
│   │   └── layout.tsx              — root layout mínimo
│   ├── components/
│   │   ├── home/                   — HeroSection, MediaRow, AiRecommendations, GenreNews, PopularInCircle
│   │   ├── layout/                 — AuthHeader, Header, Footer, AppFooter, BottomNav, AvatarDropdown, NavLinks, LanguageSwitcher
│   │   ├── library/                — LibraryAction, LibraryStatusModal, EpisodeProgress
│   │   ├── lists/                  — (carpeta presente, vacía en filesystem según exploración)
│   │   ├── media/                  — MediaCard, MediaGrid, MediaDetail, TrailerEmbed, StreamingProviders, SynopsisSection
│   │   ├── profile/                — ProfileHeader, ProfileBio, ProfileStats, ProfileGenres
│   │   ├── search/                 — SearchBar, SearchFilters, SearchResults
│   │   ├── social/                 — FriendCard, FriendshipButton, RecommendButton, RecommendModal, ListCard, CreateListModal, ReportButton
│   │   └── ui/                     — Avatar, Badge, FilterBar, Pagination, Select, Spinner, StarRating, StatusSelector, Toast, ToastProvider, button, input
│   ├── hooks/
│   │   └── useToast.ts
│   ├── i18n/
│   │   ├── navigation.ts           — re-export de Link/redirect tipados
│   │   ├── request.ts              — carga messages dinámicamente
│   │   └── routing.ts              — locales: es (default), en
│   ├── lib/
│   │   ├── api/                    — tmdb, jikan, googlebooks, openlibrary, mangadex, rawg, normalizer, search, genre-news
│   │   ├── claude/
│   │   │   └── recommendations.ts  — prompt + fetch + cache + parser
│   │   ├── constants/
│   │   │   └── avatarColors.ts
│   │   ├── library/                — actions (cliente), queries (server), stats
│   │   ├── social/                 — actions, circle, feed, friends, lists, notifications
│   │   ├── supabase/
│   │   │   ├── client.ts           — uso en Client Components
│   │   │   └── server.ts           — uso en Server Components / Route Handlers
│   │   ├── utils/
│   │   │   ├── auth-errors.ts      — mapeo Supabase Auth → claves i18n
│   │   │   └── index.ts            — `cn(...)` (clsx + tailwind-merge)
│   │   └── rate-limit.ts           — sliding window en memoria
│   ├── middleware.ts               — auth + locale routing
│   └── types/
│       ├── library.ts
│       ├── list.ts
│       ├── media.ts
│       ├── supabase.ts             — Database type para `createClient<Database>()`
│       └── user.ts
├── supabase/
│   ├── migrations/                 — VACÍO (la baseline desapareció en sesión 2026-05-02)
│   └── README.md                   — contiene un heredoc PowerShell sin evaluar (bug, ver §15)
├── tests/
│   ├── _pending/                   — tests congelados (test de `@/lib/env`, módulo aún no creado)
│   ├── contract/                   — 5 specs (TMDB, Jikan, Google Books, MangaDex, RAWG)
│   ├── e2e/                        — auth.spec.ts (Playwright)
│   ├── integration/
│   │   ├── auth/                   — supabase-clients.test.ts
│   │   └── db/                     — friends, library-upsert, rls-policies, trigger
│   ├── setup.ts
│   └── unit/                       — ~50 archivos
├── .env.local                      — credenciales reales locales (ignored)
├── .eslintrc.json
├── .gitignore                      — incluye `.env*.local`, `.claude/`, `supabase/.temp/`
├── AUDIT.md                        — auditoría tech-DD del 2026-04-23
├── CLAUDE.md                       — guía operativa para Claude
├── components.json                 — config de shadcn/ui
├── kultura-backup-2026-05-01.zip   — (en e:\app movies\, fuera del repo) ~280 MB
├── next.config.mjs
├── package.json, package-lock.json
├── playwright.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json, tsconfig.tsbuildinfo
├── vercel.json
├── vitest.config.ts
├── vitest.contract.config.ts
└── vitest.integration.config.ts
```

**Responsabilidades de las carpetas principales:**

- `src/app/[locale]/` — rutas con prefijo de idioma manejadas por next-intl. `(app)` es un route group: agrupa todas las rutas autenticadas bajo un layout que verifica sesión y monta `AuthHeader + BottomNav + AppFooter + ToastProvider`.
- `src/app/api/` — 18 Route Handlers, todos server-only, sin prefijo de locale (intencional — i18n no aplica a APIs).
- `src/components/` — UI dividida por dominio. La carpeta `ui/` actúa como sistema de diseño base (Avatar, Button, Input, Spinner, Select, FilterBar, etc.).
- `src/lib/api/` — adaptadores externos. Regla: **ningún componente puede importar nada de aquí directamente**, debe pasar por `normalizer.ts`.
- `src/lib/{library,social}/` — capas de dominio. `actions.ts` para cliente (fetch a APIs), `queries.ts` para servidor (Supabase directo).
- `src/lib/supabase/` — fábrica de clientes. `client.ts` para browser, `server.ts` para SSR + Route Handlers. Hay una nota explícita en el `server.ts:28` indicando que el `try/catch` en `setAll` es necesario porque los Server Components no pueden escribir cookies.
- `src/types/` — tipos de dominio (Media, Library, List, User) y tipos de DB (`supabase.ts`, escrito a mano).
- `src/i18n/` — config de routing y request de next-intl.
- `tests/{unit,integration,contract,e2e}/` — separación por velocidad y dependencias externas. CI ejecuta solo unit + build (no integration ni contract).

---

## 5. Inventario exhaustivo de componentes y módulos

> El nivel de detalle pedido por el prompt original (firma de cada función) sería excesivo para algunos archivos triviales (componentes pequeños). Para cada archivo se indica: ruta, propósito, exports principales, dependencias internas relevantes, consumidores conocidos, y estado actual.

### 5.1 Configuración global

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| `src/middleware.ts` | Refresca la sesión Supabase server-side y aplica el routing de next-intl. Acumula cookies y las aplica a la respuesta. | ✅ Funciona. Único `as any` aceptado del proyecto (línea 40, comentado). |
| `next.config.mjs` | CSP estricta (con relajación en dev), `remotePatterns` para imágenes, headers de seguridad (`X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`). | ✅ |
| `tsconfig.json` | `strict: true`, alias `@/*` → `./src/*`, `moduleResolution: bundler`. | ✅ Sin `forceConsistentCasingInFileNames` — pendiente E12. |
| `tailwind.config.ts` | Paleta custom (bg, surface, accent rojo `#E82020`, text, muted), fuentes display Bebas Neue + body DM Sans + mono JetBrains, plugin `.scrollbar-hide`. | ✅ |
| `src/i18n/routing.ts` | Locales `['es', 'en']`, default `es`. | ✅ |
| `src/i18n/request.ts` | Carga dinámica de `messages/${locale}.json`. | ✅ |
| `src/i18n/navigation.ts` | Re-export de Link/redirect/router tipados con el routing del proyecto. | ✅ |

### 5.2 Tipos (`src/types/`)

| Archivo | Exports principales | Nota |
|---------|--------------------|------|
| `media.ts` | `MediaType`, `MediaStatus`, `RatingSource`, `StreamingType`, `StreamingProvider`, `MediaItem` | `MediaItem` es la fuente de verdad para todo el dominio. |
| `library.ts` | `LibraryStatus`, `isLibraryStatus(value)`, `EpisodeProgress`, `LibraryEntry`, `LibraryPayload` | `LibraryEntry` opcionalmente lleva `title/poster/year` para evitar joins en componentes. |
| `list.ts` | `List`, `ListItem`, `ListMember`, re-export `UserProfile` | DEC-008: una lista contiene un solo `mediaType`. |
| `user.ts` | `UserProfile`, `UserMedia`, `EpisodeProgress`, `FriendshipStatus`, `Friendship`, `Recommendation`, `NotificationType`, `Notification` | `EpisodeProgress` está duplicado con `library.ts` — pequeña deuda. |
| `supabase.ts` | `DbUser`, `DbMedia`, `DbUserMedia`, `DbFriendship`, `DbRecommendation`, `DbList`, `DbListMember`, `DbListItem`, `DbNotification`, `DbReport`, `Database` (mapa completo) | Escrito a mano. **Solo refleja 10 de las 17 tablas reales**. Faltan tipos para: `conversations`, `conversation_members`, `messages`, `groups`, `group_members`, `group_posts`, `suggestions`. Documentado en deuda B2-DOC. |

### 5.3 Cliente Supabase (`src/lib/supabase/`)

| Archivo | Función | Comentario |
|---------|---------|------------|
| `client.ts` | `createClient()` con `createBrowserClient` de `@supabase/ssr` y env vars públicas. | Trivial, 12 líneas. |
| `server.ts` | `createClient()` con `cookies()` de `next/headers`, `try/catch` en `setAll` para Server Components. | Comentado el porqué del `catch`. |

### 5.4 Rate limiting (`src/lib/rate-limit.ts`)

- `checkRateLimit(key, opts) → RateLimitResult` — sliding window con `Map<string, { timestamps: number[] }>` global.
- `_resetStoreForTests()` — solo tests.
- `LIMITS` — 7 perfiles predefinidos (library 30/min, friends 10/min, recommendations 10/min, reports 5/min, search 60/min por IP, lists 20/min, notifications 30/min).
- **Limitación documentada en el propio archivo** (línea 5): no funciona en producción multi-instancia. Backlog C3 lo reemplaza por Vercel KV.

### 5.5 Adaptadores de APIs externas (`src/lib/api/`)

| Archivo | Funciones públicas | Auth requerida | Estado |
|---------|--------------------|---------------|--------|
| `tmdb.ts` | `searchMovies`, `searchTV`, `getMovie`, `getTV`, `getPopularMovies`, `getPopularTV`, `getTrendingMovies`, `getMovieVideos`, `getTVVideos`, `getMovieProviders`, `getTVProviders`, `discoverByGenre`, `tmdbPoster`, `tmdbBackdrop`, `TMDB_GENRE_MAP` | `process.env.TMDB_API_KEY!` (server) | ✅ |
| `jikan.ts` | `searchAnime`, `getAnime`, `getPopularAnime`, `getAnimeVideos`, `searchManga`, `getManga`, `getPopularManga` | sin auth | ✅ |
| `googlebooks.ts` | `searchBooks`, `getBook` | `process.env.GOOGLE_BOOKS_KEY` opcional | ✅ |
| `openlibrary.ts` | `searchBooks`, `getBook`, `openLibraryCover` | sin auth | ✅ presente, no usado en `searchAll` actualmente — efectivamente código muerto en runtime. |
| `mangadex.ts` | `searchManga`, `getManga`, `getPopularManga`, `getMangaCoverUrl`, `extractMangaCover` | sin auth | ✅ |
| `rawg.ts` | `searchGames`, `getGame`, `getPopularGames` | `process.env.RAWG_API_KEY!` (server) | ✅ |
| `normalizer.ts` | `normalizeMovie`, `normalizeTV`, `normalizeAnime`, `normalizeMangaJikan`, `normalizeMangaDex`, `normalizeBookGoogle`, `normalizeBookOpenLibrary`, `normalizeGame` | — | ✅. Centraliza extracción de tráiler, año y proveedores ES. |
| `search.ts` | `searchAll(query)`, `searchByType(query, type)` | — | ⚠️ No usa MangaDex (manga viene de Jikan), no usa Open Library, `comic` devuelve `[]`. |
| `genre-news.ts` | `getGenreNews(topGenres, limit)` | — | ✅ Solo movie/tv. |

> **Inconsistencia con `CLAUDE.md`:** `CLAUDE.md` líneas 67-76 declara `NEXT_PUBLIC_TMDB_API_KEY`, `NEXT_PUBLIC_RAWG_KEY` y `NEXT_PUBLIC_GOOGLE_BOOKS_KEY`. El **código real** usa `TMDB_API_KEY`, `RAWG_API_KEY` y `GOOGLE_BOOKS_KEY` (sin prefijo público). El `.env.local` también usa los nombres sin prefijo público. La doc está desactualizada — A4 cerró esto en código pero CLAUDE.md no se actualizó. El workflow de CI (`.github/workflows/ci.yml:18-25`) también usa los nombres antiguos `NEXT_PUBLIC_*` para los placeholders, lo que probablemente no rompe el build (el código no los lee bajo ese nombre, así que TMDB falla silenciosamente en CI con `undefined`, pero CI solo hace `next build` que no ejecuta llamadas reales).

### 5.6 Claude (`src/lib/claude/recommendations.ts`)

- `getLibraryContext(userId, supabaseClient?)` — toma items completados o con `score >= 4`, máximo 15.
- `buildPrompt(items, topGenres, locale)` — prompt en español o inglés según locale, pide JSON estricto.
- `getAiRecommendations(userId, topGenres, locale='es')` — orquesta cache, contexto, llamada a Claude (`claude-sonnet-4-6`, max 1024 tokens), parser tolerante (regex `\{[\s\S]*\}`), validación de tipos, `slice(0, 5)`.
- `invalidateRecCache(userId)` — invalida todas las variantes de locale/versión del usuario.
- Cache en memoria con TTL 1 h.
- 3 `console.error` para debug (línea 179, 200, 241).
- **Misma limitación que rate-limit:** cache no es distribuida.

### 5.7 Library (`src/lib/library/`)

| Archivo | Exports | Consumidores |
|---------|---------|--------------|
| `actions.ts` (cliente) | `addToLibrary(payload)`, `updateLibrary(payload)`, `removeFromLibrary(mediaId)` | `LibraryAction.tsx` |
| `queries.ts` (server) | `getUserMedia(userId)`, `getRecentLibraryByStatus(userId, status, limit)`, `getMediaEntry(userId, mediaId)` | `library/page.tsx`, `profile/[username]/page.tsx`, `media/[type]/[id]/page.tsx` |
| `stats.ts` (server) | `getUserStats(userId) → { totalItems, totalCompleted, totalInProgress, byType, topGenres }` | `home/page.tsx` (vía `genre-news` y `ai-recommendations`), `profile/[username]/page.tsx` |

### 5.8 Social (`src/lib/social/`)

| Archivo | Exports | Notas |
|---------|---------|-------|
| `actions.ts` (cliente) | `sendFriendRequest`, `respondToFriendRequest`, `removeFriend` | Capa fina sobre `/api/friends`. |
| `circle.ts` (server) | `getPopularInCircle(userId, limit=5)` | Agrega en JS. Comentario explica que el círculo social es típicamente <50 amigos, evita SQL pesado. |
| `feed.ts` (server) | `getFriendsFeed(userId, limit=30)` | Usa `updated_at` con trigger (migración 006 según comentario). |
| `friends.ts` (server) | `getFriends(userId)`, `getPendingRequests(userId)`, `getFriendshipStatus(currentUserId, targetUserId)` | `FriendshipStatusResult = 'none' | 'pending_sent' | 'pending_received' | 'accepted'` |
| `lists.ts` (server) | `getUserLists`, `getListDetail`, `canEditList` | Usa 3 queries paralelas para detalle (items + members + count). |
| `notifications.ts` (server) | `getNotifications`, `getUnreadCount`, `markAllRead`, `markOneRead` | Cap de 50 notificaciones por consulta. |

### 5.9 Utils

- `src/lib/utils/index.ts` — `cn(...inputs)` con `clsx + tailwind-merge`.
- `src/lib/utils/auth-errors.ts` — `getAuthErrorKey(message): AuthErrorKey` mapea mensajes hardcoded de Supabase Auth a claves i18n (invalidCredentials, emailNotConfirmed, userAlreadyExists, passwordTooShort, tooManyRequests, invalidEmail, somethingWentWrong).
- `src/lib/constants/avatarColors.ts` — 8 colores predefinidos, helpers `isValidAvatarColor(name)`, `isValidLocale(value)`, `getAvatarHex(name)`. `SUPPORTED_LOCALES = ['es', 'en']`.

### 5.10 Páginas (`src/app/[locale]/`)

| Ruta | Tipo | Función | Notas |
|------|------|---------|-------|
| `/` (locale-aware) | Server | Landing pública con hero + features + CTA | Usa `Header` y `Footer` (no autenticado). |
| `/login` | Client | Form login/registro/reset con tabs | `getAuthErrorKey` para mensajes traducidos. |
| `/(app)/home` | Server | Hero `in_progress` + recientes + Popular en círculo + AI recs + Genre news | Auto-crea perfil si no existe (con fallback `username1` ante colisión). |
| `/(app)/discover` | Server | Browse popular por tipo (movie, tv, anime, manga, book, game) con paginación | Sin filtro de género visible. |
| `/(app)/search` | Server | Search aggregator (todas las APIs) con tabs por tipo | `generateMetadata` usa `q`. |
| `/(app)/library` | Server → Client | Biblioteca completa pasada al cliente, filtros en JS | **Riesgo de OOM con bibliotecas grandes**, ver §15. |
| `/(app)/lists` | Server → Client | Listas propias + colaborativas | |
| `/(app)/lists/[id]` | Server → Client | Detalle de lista | |
| `/(app)/media/[type]/[id]` | Server | Detalle de un título | **Tiene `generateMetadata` con OG/Twitter** — contradice gap [SEO-01] del audit del 2026-04-23. |
| `/(app)/profile/[username]` | Server | Stats + recientes + género + amistad | También con `generateMetadata`. |
| `/(app)/notifications` | Server | Lista + marca todo como leído al cargar | |
| `/(app)/friends` | Server → Client | Lista de amigos + pendientes + share link | |
| `/(app)/settings` | Server → Client | Form de username, color de avatar, locale | |
| `/(app)/suggestions` | Server → Client | Form de sugerencias/feedback | |
| `/(app)/chat` | Server → Client | Lista de conversaciones | |
| `/(app)/chat/[id]` | Server → Client | Conversación con Realtime | Verifica membership server-side. |
| `/(app)/groups/[id]` | Server | Grupo: feed + miembros + join button | Sin página `/groups` que liste todos los grupos (`Inferido:` aún no implementada). |

`error.tsx` existe en cada subruta y en `[locale]/(app)/`, todos delegan en `useTranslations('errors')` para `somethingWentWrong` + `tryAgain` — implementación uniforme.

### 5.11 Componentes UI base (`src/components/ui/`)

- `button.tsx` — `cva` con variants: default, primary (rojo accent), destructive, outline, secondary, ghost, link; sizes: default, sm, md, lg, icon. `asChild` para componer con `Link`. `loading` con `Spinner`. **Default variant ahora es `primary`**, no `default`.
- `input.tsx` — wrapper con label, error, hint. Auto-genera `id` desde el label si no se proporciona.
- `Avatar.tsx` — circular, con `initials` o `src` (Image), tamaños sm/md/lg.
- `Badge.tsx`, `Spinner.tsx`, `Select.tsx`, `Pagination.tsx`, `FilterBar.tsx`, `StarRating.tsx`, `StatusSelector.tsx` — utilidades reutilizables.
- `Toast.tsx` + `ToastProvider.tsx` + `useToast.ts` — sistema de toast con context.
- `EpisodeProgress.tsx` — input para temporada/episodio.

### 5.12 Componentes de dominio

- `home/`: `HeroSection` (continue watching), `MediaRow` (carrusel scroll-snap), `AiRecommendations` (con estados loading/empty/rate_limited/error/done), `GenreNews`, `PopularInCircle`.
- `media/`: `MediaCard`, `MediaGrid`, `MediaDetail`, `TrailerEmbed` (YouTube nocookie), `StreamingProviders`, `SynopsisSection` (truncable).
- `library/`: `LibraryAction` (CTA con modal), `LibraryStatusModal`, `EpisodeProgress`.
- `profile/`: `ProfileHeader`, `ProfileBio` (inline edit), `ProfileStats`, `ProfileGenres`.
- `social/`: `FriendCard`, `FriendshipButton`, `RecommendButton`, `RecommendModal`, `ListCard`, `CreateListModal`, `ReportButton`.
- `search/`: `SearchBar` (autocomplete con `/api/search`), `SearchFilters`, `SearchResults`.
- `layout/`: `Header` (público), `AuthHeader` (autenticado, con `unreadCount`), `Footer`, `AppFooter`, `BottomNav` (5 entradas: home, discover, search, library, profile), `AvatarDropdown`, `NavLinks`, `LanguageSwitcher`.

### 5.13 Tests

- **Unitarios** (`tests/unit/`, ~50 archivos): cubren rate-limit, normalizer, search aggregator, AI recommendations, claude, security headers, library actions/queries/route/stats, settings form/route, social (circle, feed, friends, lists, notifications, recommendations, reports, route), components (Button, Avatar, Toast, MediaCard, MediaGrid, MediaDetail, StreamingProviders, TrailerEmbed, LibraryAction, LibraryStatusModal, EpisodeProgress, ProfileGenres, ProfileHeader, ProfileStats, SearchBar, SearchResults, login-form, register-form, AuthHeader, BottomNav, Header, HeroSection, MediaRow, FilterBar, pagination, select, star-rating, status-selector), hooks (useToast), error-boundaries, i18n messages, types (media), utils (auth-errors), pages (landing).
- **Integración** (`tests/integration/`, 5 archivos): supabase-clients, friends, library-upsert, rls-policies, trigger. Requiere proyecto Supabase de test (`SUPABASE_TEST_URL`/`SUPABASE_TEST_ANON_KEY` en `.env.local`).
- **Contract** (`tests/contract/`, 5 archivos): TMDB, Jikan, Google Books, MangaDex, RAWG. Hace llamadas reales — se ejecuta solo localmente, no en CI.
- **E2E** (`tests/e2e/`): solo `auth.spec.ts`. Configurado para Chromium + Mobile Chrome.
- **`tests/_pending/`**: contiene un test sobre `@/lib/env` que existe pero el módulo no — pendiente B3.

---

## 6. Flujos de la aplicación

### 6.1 Flujo de autenticación

1. Usuario sin sesión visita una ruta bajo `/[locale]/(app)/...`.
2. `middleware.ts` ejecuta `supabase.auth.getUser()` → no hay sesión.
3. El layout `[locale]/(app)/layout.tsx` también valida con `getUser()` y redirige a `/login`.
4. `LoginPage` (Client) usa `supabase.auth.signInWithPassword` o `signUp`.
5. Tras éxito, redirige a `/home`.
6. En `signUp` con confirmación de email, redirige al endpoint `/api/auth/callback?code=...&next=/...`.
7. `callback/route.ts` hace `exchangeCodeForSession(code)` y redirige al `next` o muestra `?error=auth_callback_error`.
8. **Auto-creación de perfil:** si el usuario está autenticado pero falta fila en `users`, `home/page.tsx` la crea inferiendo `username` del email. Si hay colisión `23505`, intenta `${username}1`. Si vuelve a fallar, hace `signOut` y vuelve a `/login`.

### 6.2 Flujo de búsqueda y añadir a biblioteca

1. Usuario en `/search?q=interstellar`.
2. Server Component llama `searchAll(q)` → `Promise.allSettled` con TMDB movie + TMDB TV + Jikan anime + Jikan manga + Google Books + RAWG.
3. Cada resultado pasa por `normalizer.ts` → `MediaItem`.
4. `SearchClient` muestra tabs por tipo.
5. Click en una tarjeta → `/media/{type}/{externalId}`.
6. Server Component obtiene detalle (TMDB con `append_to_response=credits,videos,watch/providers`, etc.), normaliza, llama a `getMediaEntry(user.id, mediaId)` para detectar si ya está en biblioteca.
7. `MediaDetail` renderiza hero + synopsis + detalles + streaming + tráiler. Componente cliente `LibraryAction` recibe `initialEntry` y `mediaCache`.
8. Click "Añadir" → `LibraryStatusModal` con campos status/score/watchedAt/episodeProgress.
9. Save → `addToLibrary(payload)` → `POST /api/library` con `mediaCache`.
10. Backend: rate-limit (30/min/usuario) → upsert `media` (cache de título) → upsert `user_media` → `invalidateRecCache(user.id)` → 200.

### 6.3 Flujo de recomendación de amigo

1. Usuario en detalle de un título, click "Recomendar a amigo" (`RecommendButton`).
2. `RecommendModal` carga amigos vía `GET /api/friends`.
3. Selecciona amigo + escribe mensaje → `POST /api/recommendations`.
4. Backend: rate-limit (10/min) → valida `mediaId` formato → upsert `media` cache → insert `recommendations` → insert `notifications` (best-effort) → 201.

### 6.4 Flujo de chat con Supabase Realtime

1. `/chat` lista conversaciones (cada una con `lastMessage`, `unread`).
2. Click → `/chat/[id]`. El layout server verifica membership en `conversation_members`.
3. `ConversationClient` (cliente) carga mensajes vía `GET /api/chat/[id]` (límite 100) y se suscribe vía Supabase Realtime al canal de la tabla `messages` filtrado por `conversation_id`.
4. Al cargar, `GET /api/chat/[id]` actualiza `last_read_at` (best-effort, sin await).
5. Send → `POST /api/chat/[id]` → insert en `messages`. `Inferido:` un trigger de DB actualiza `conversations.last_message_at` (función `handle_new_message` mencionada en SESSION_2026-05-02.md).

### 6.5 Flujo de IA recomendaciones

1. Componente `AiRecommendations` (cliente) hace `GET /api/ai-recommendations` al montar.
2. Backend: rate-limit (5/min) → `getUserStats(user.id)` → `getAiRecommendations(user.id, topGenres, locale)`.
3. `getAiRecommendations` busca en cache (1 h TTL) por `${userId}:${locale}:v2`.
4. Si miss: `getLibraryContext` extrae 15 items completados o score ≥ 4 → `buildPrompt` → `client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1024, ... })`.
5. Parser tolerante: regex `\{[\s\S]*\}`, validación de tipo MediaType, año entre 1800 y currentYear+5, `slice(0, 5)`.
6. Cache + return. Cliente recibe array y muestra cards (sin poster — sólo iniciales con badge de tipo).
7. Si `< 3` items en biblioteca → `[]` → cliente muestra empty state.

### 6.6 Manejo de errores y edge cases

- Errores 401/400/403/404/409/429/500 explícitos en cada Route Handler.
- `error.tsx` en `[locale]/`, `[locale]/(app)/` y subrutas (notifications, profile, lists, library, etc.) — UX uniforme con i18n.
- **Sin Error Boundaries dentro de componentes cliente.** Solo los `error.tsx` de Next.js, que actúan a nivel de segmento de ruta.
- Validaciones: `mediaId` debe coincidir `^[a-z]+_.+$`. Status acotado por enum. `score` entre 1-5 (CHECK constraint). Reportarse a sí mismo bloqueado. Recomendación a sí mismo bloqueada.

---

## 7. Modelo de datos

### 7.1 Estado actual de las migraciones

- **`supabase/migrations/`** está **vacío en el filesystem**.
- Hubo un `supabase db pull` en 2026-05-02 que generó `20260502155455_remote_schema.sql` (32 KB, 17 tablas, 49 RLS policies, 4 funciones trigger), pero el archivo desapareció y el `supabase/.temp/` también — se documenta en `docs/SESSION_2026-05-02.md`.
- El historial remoto de Supabase tiene esa migración marcada como `applied`. Las migraciones antiguas (001, 002, 006) están marcadas como `reverted`.
- La tarea **B2 está en estado inconsistente** (NOW.md actual). La sesión cerró sin commitear el SQL.
- **Riesgo:** un dev nuevo no puede levantar el schema desde cero. La fuente de verdad es el dashboard remoto de Supabase.

### 7.2 Schema documentado en `CLAUDE.md`

`CLAUDE.md:146-220` documenta 10 tablas:

```sql
users (id uuid PK ref auth.users, username unique, avatar_color, avatar_initials, created_at)
media (id text PK "{type}_{external_id}", external_id, type, title, poster, backdrop, year, metadata jsonb, updated_at)
user_media (id uuid, user_id, media_id, status enum, score 1-5, watched_at, episode_progress jsonb, created_at, UNIQUE(user_id, media_id))
friendships (id uuid, requester_id, receiver_id, status enum, created_at, UNIQUE(requester_id, receiver_id))
recommendations (id uuid, from_user_id, to_user_id, media_id, message, read_at, created_at)
lists (id uuid, owner_id, name, media_type, is_collaborative, created_at)
list_members (list_id, user_id, PK compuesta)
list_items (id uuid, list_id, media_id, added_by, added_at)
notifications (id uuid, user_id, type enum, payload jsonb, read_at, created_at)
reports (id uuid, reporter_id, target_type enum, target_id, reason, created_at)
```

Con CHECK constraints para enums y FK con `on delete cascade`.

### 7.3 Tablas adicionales reales (descubiertas en código y `SESSION_2026-05-02.md`)

```
suggestions (user_id, type enum, subject, description, ...)        — usada por /api/suggestions
conversations (id uuid, last_message_at)                            — chat
conversation_members (conversation_id, user_id, last_read_at)       — chat
messages (id uuid, conversation_id, sender_id, content, created_at) — chat
groups (id uuid, owner_id, name, description, cover_color, created_at) — grupos
group_members (group_id, user_id, role, joined_at)                  — grupos
group_posts (...)                                                   — feed de grupos (referenciada por components, GroupFeed)
```

Y 4 funciones trigger no documentadas en CLAUDE.md:

```
handle_new_user, handle_new_group, handle_new_message, set_updated_at
```

> **Total: 17 tablas reales vs 10 documentadas.** B2-DOC en backlog cubre actualizar `CLAUDE.md`.

### 7.4 Relaciones (de los joins detectados en código)

- `users` 1—N `user_media` ←N—1 `media`
- `users` 1—N `friendships` (en ambas direcciones via requester/receiver)
- `users` 1—N `recommendations` (en ambas direcciones)
- `lists` 1—N `list_items` ←N—1 `media`
- `lists` 1—N `list_members` ←N—1 `users`
- `users` 1—N `notifications`
- `users` 1—N `reports` y `reports.target_id` puede apuntar a `users.id` o `media.id` según `target_type`
- `users` 1—N `conversation_members` ←N—1 `conversations`
- `conversations` 1—N `messages`
- `users` 1—N `group_members` ←N—1 `groups`
- `groups` 1—N `group_posts`

### 7.5 Tipos TypeScript correspondientes

- `src/types/supabase.ts` exporta el `Database` con 10 tablas — **falta tipar 7 tablas**.
- En el código que usa esas tablas, los tipos se hacen ad-hoc inline (`as unknown as Array<{...}>`) en `groups/route.ts`, `chat/route.ts`, `conversation_members` reads, etc.

### 7.6 Índices

- **Implícitos:** PKs y FKs.
- **Explícitos:** `[NO ENCONTRADO]` en migraciones (las migraciones no están commiteadas). En el dashboard de Supabase pueden existir más, no verificable sin acceso al panel.

### 7.7 RLS

- Activado en todas las tablas según `AUDIT.md` y comprobado por `tests/integration/db/rls-policies.test.ts`. La baseline de B2 reportaba 49 policies en total.

---

## 8. API / Endpoints / Rutas

> 19 archivos `route.ts` en `src/app/api/`. Cada uno se documenta en formato compacto: método, path, params, body esperado, respuesta, auth, descripción.

### 8.1 Auth

| Método | Path | Auth | Body / Query | Respuesta | Descripción |
|--------|------|------|---------------|-----------|-------------|
| GET | `/api/auth/callback?code=&next=` | — | query: `code`, `next` | 302 redirect | PKCE exchange tras confirmación email/reset. Error → `/login?error=auth_callback_error`. |

### 8.2 Library

| Método | Path | Auth | Body | Respuesta | Rate limit | Descripción |
|--------|------|------|------|-----------|------------|-------------|
| POST | `/api/library` | sí | `{ mediaId, status, score?, watchedAt?, episodeProgress?, mediaCache? }` | `{ entry }` o 400/401/429/500 | 30/min/user | Upsert en `user_media`. Si viene `mediaCache`, upsert en `media`. Invalida cache de IA. |
| DELETE | `/api/library` | sí | `{ mediaId }` | `{ ok }` o 404 | — | Elimina entrada. Invalida cache. |

### 8.3 Search

| Método | Path | Auth | Query | Respuesta | Rate limit | Descripción |
|--------|------|------|-------|-----------|------------|-------------|
| GET | `/api/search?q=` | — | `q` (≥2 chars) | array de `MediaItem` (max 5) | 60/min/IP | Autocomplete: solo TMDB movie + TV. |

> **Nota:** la búsqueda completa multi-API NO es un endpoint — se hace directamente en `src/app/[locale]/(app)/search/page.tsx` (Server Component) llamando a `searchAll`. El endpoint `/api/search` es solo autocomplete ligero. El AUDIT del 2026-04-23 incluía erróneamente `GET /api/search` como búsqueda multi-API.

### 8.4 Friends

| Método | Path | Auth | Body | Respuesta | Rate limit | Descripción |
|--------|------|------|------|-----------|------------|-------------|
| GET | `/api/friends` | sí | — | `{ friends: [{ friendshipId, user }] }` | — | Amigos aceptados (ambas direcciones). |
| POST | `/api/friends` | sí | `{ receiverId }` | `{ friendship }` o 400/404/409 | 10/min/user | Solicita amistad. |
| PATCH | `/api/friends` | sí | `{ friendshipId, action: 'accept'|'decline' }` | `{ friendship }` o `{ ok }` | — | Solo el receptor puede actuar. Decline borra la fila. |
| DELETE | `/api/friends` | sí | `{ friendshipId }` | `{ ok }` | — | Cualquier participante puede eliminar. |

### 8.5 Recommendations

| Método | Path | Auth | Body | Respuesta | Rate limit | Descripción |
|--------|------|------|------|-----------|------------|-------------|
| POST | `/api/recommendations` | sí | `{ toUserId, mediaId, message?, mediaCache? }` | `{ recommendationId }` | 10/min/user | Inserta `recommendations` + `notifications` (best-effort). |

### 8.6 Lists

| Método | Path | Auth | Body / Headers | Respuesta | Rate limit | Descripción |
|--------|------|------|----------------|-----------|------------|-------------|
| POST | `/api/lists` | sí | `{ name, mediaType, isCollaborative? }` | `{ list }` 201 | 20/min/user | Crear lista. |
| DELETE | `/api/lists` | sí | `{ listId }` | `{ ok }` | 20/min/user | Solo owner. |
| POST | `/api/lists/[id]` (header `x-action: invite`) | sí | `{ userId }` | 201 | 20/min/user | Invita miembro a lista colaborativa (solo owner). Inserta notificación. |
| POST | `/api/lists/[id]` | sí | `{ mediaId, mediaCache? }` | `{ item }` 201 | 20/min/user | Añade item. Anti-duplicado por `(list_id, media_id)`. Permite si `canEditList`. |
| DELETE | `/api/lists/[id]` (header `x-action: remove-member`) | sí | `{ userId }` | `{ ok }` | 20/min/user | Eliminar miembro (owner o el propio). |
| DELETE | `/api/lists/[id]` | sí | `{ itemId }` | `{ ok }` | 20/min/user | Eliminar item (si `canEditList`). |

### 8.7 Notifications

| Método | Path | Auth | Body | Respuesta | Rate limit | Descripción |
|--------|------|------|------|-----------|------------|-------------|
| GET | `/api/notifications` | sí | — | `{ notifications, unreadCount }` | — | Limit 50. |
| PATCH | `/api/notifications` | sí | `{ id? }` (sin id → marca todas) | `{ ok }` | 30/min/user | — |

### 8.8 Reports

| Método | Path | Auth | Body | Respuesta | Rate limit | Descripción |
|--------|------|------|------|-----------|------------|-------------|
| POST | `/api/reports` | sí | `{ targetType: 'user'|'media', targetId, reason? }` | `{ reportId }` | 5/min/user | Verifica que el target existe. No reportarse a sí mismo. |

### 8.9 IA + agregados

| Método | Path | Auth | Body / Query | Respuesta | Rate limit | Descripción |
|--------|------|------|---------------|-----------|------------|-------------|
| GET | `/api/ai-recommendations` | sí | — | `{ recommendations: AiRec[] }` | 5/min/user | Cache 1 h. |
| GET | `/api/popular-in-circle` | sí | — | `{ items: CircleMediaItem[] }` | 20/min/user | — |
| GET | `/api/genre-news` | sí | — | `{ movies, tv, genres }` | 20/min/user | TMDB discover por géneros top. |

### 8.10 Settings y misc

| Método | Path | Auth | Body | Respuesta | Rate limit | Descripción |
|--------|------|------|------|-----------|------------|-------------|
| GET | `/api/settings` | sí | — | `{ username, avatar_color, preferred_locale }` | — | — |
| PATCH | `/api/settings` | sí | `{ username?, avatar_color?, preferred_locale? }` (Zod) | `{ success, updated }` o 409 `username_taken` | — | — |
| POST | `/api/suggestions` | sí | `{ type, subject, description }` (Zod) | `{ ok }` | — | Inserta en `suggestions`. |
| GET | `/api/users/search?q=` | sí | `q` (≥2 chars) | `{ users }` (max 8) | — | `ilike '%q%'` excluye al propio usuario. |

### 8.11 Chat

| Método | Path | Auth | Body | Respuesta | Rate limit | Descripción |
|--------|------|------|------|-----------|------------|-------------|
| GET | `/api/chat` | sí | — | `{ conversations }` enriquecido | — | Para cada conv: otra parte + último mensaje + `unread`. **N+1 query**: 1 query por conversation. |
| POST | `/api/chat` | sí | `{ targetUserId }` | `{ conversationId }` | — | Crea o devuelve la existente. **Búsqueda O(n) en JS** sobre conversaciones del usuario. |
| GET | `/api/chat/[id]` | sí | — | `{ messages, currentUserId }` | — | Verifica membership. Marca `last_read_at`. |
| POST | `/api/chat/[id]` | sí | `{ content }` | `{ message }` 201 | — | Sin rate-limit. **Posible vector de spam.** |

### 8.12 Groups

| Método | Path | Auth | Body | Respuesta | Rate limit | Descripción |
|--------|------|------|------|-----------|------------|-------------|
| GET | `/api/groups` | sí | — | `{ groups }` | — | Grupos donde el usuario es miembro. |
| POST | `/api/groups` | sí | `{ name (2-60), description? (≤200), cover_color? hex }` Zod | `{ group }` 201 | — | Sin rate-limit. |
| POST | `/api/groups/[id]/join` | sí | — | `{ joined: true|false }` 201 | — | Toggle: si miembro → leave (owner no puede); si no → insert role 'member'. |

> **Sin endpoint `DELETE /api/groups/[id]`** ni edit. **Sin endpoint para postear en `group_posts`** desde Route Handler — `Inferido:` se hace directo desde cliente con cliente Supabase, lo que requiere RLS adecuada.

---

## 9. Interfaz de usuario y diseño

### 9.1 Páginas/pantallas existentes

(Ver §5.10 para tabla completa.)

Resumen de pantallas:
- 1 landing pública
- 1 login (con tres modos: signin, signup, reset)
- 13 rutas autenticadas: home, discover, search, library, lists, lists/[id], media/[type]/[id], profile/[username], notifications, friends, settings, suggestions, chat, chat/[id], groups/[id]

### 9.2 Sistema de diseño

- **Tailwind CSS 3.4.1** + `class-variance-authority` + `tailwind-merge` + `clsx` (vía `cn()`).
- **shadcn/ui** está configurado (`components.json`) con `style: "default"`, `baseColor: "neutral"`, `tsx: true`. Solo `Button` sigue claramente el patrón shadcn (con cva); el resto son componentes custom.
- **Design tokens** en `tailwind.config.ts`:
  - **Colores:** `bg #080b10`, `surface #0e1218`, `surface2 #151b24`, `surface3 #1c2430`, `border #1e2730`, `accent #E82020` (rojo brand), `accent-hover #c91a1a`, `accent-subtle rgba(232,32,32,0.12)`, `text #d4dce8`, `muted #5a6878`, `muted-light #8a9ab0`, `success #22c55e`, `warning #f59e0b`, `info #3b82f6`, `danger #ef4444`.
  - **Tipografía:** `font-display` Bebas Neue (titulares), `font-body` DM Sans (cuerpo), `font-mono` JetBrains Mono.
  - **Plugin custom:** `.scrollbar-hide` para carruseles.
- **Breakpoints:** los de Tailwind por defecto (`sm 640px`, `md 768px`, `lg 1024px`, `xl 1280px`, `2xl 1536px`). Los componentes usan principalmente `md:` para alternar mobile/desktop.

### 9.3 Componentes UI reutilizables

(Ver §5.11.)

### 9.4 Decisiones de UX visibles en el código

- **Validación de forms en cliente** (`LoginPage` valida email + longitud password antes de submit).
- **Feedback de auth errors traducido** (vía `getAuthErrorKey`).
- **Loading states explícitos** en `Button` con `loading` prop + `Spinner`.
- **Estados error/empty/rate_limited/done** explícitos en `AiRecommendations`.
- **Toast system** disponible (no verificado dónde se usa exactamente).
- **BottomNav** solo en mobile (`md:hidden`); desktop usa `NavLinks` en header.
- **`safe-area-inset-bottom`** en `BottomNav` para iPhones con home indicator.
- **Imágenes:** `next/image` con `fill`/`width`/`height`/`sizes`, `priority` en hero. `remotePatterns` configurados para 7 hosts.
- **CSP activa** que limita `frame-src` a YouTube, `img-src` a `https:` con `data: blob:`, `connect-src` a Supabase Realtime.
- **Prefijo `accent-` rojo bandera** intencional (similar a la marca KULTURA = rojo).
- **i18n totalmente cableada:** 454 líneas por archivo de mensajes (es/en), namespaces detectados: `auth`, `errors`, `landing`, `nav`, `library`, `filters`, `friends`, `groups`, `notifications`, `settings`, `suggestions`, `chat`, `media_detail`, `media`, `profile`.
- **Accesibilidad parcial:** `aria-label` en iconos (search, notifications), `htmlFor` en algunos labels, `noValidate` en form login. **Pendiente E9** del backlog: añadir id/name a inputs.

### 9.5 SEO

- `metadataBase` configurado con `NEXT_PUBLIC_SITE_URL` (fallback `https://kultura.app`).
- `metadata` global en `[locale]/layout.tsx` con OG y Twitter cards.
- `generateMetadata()` implementado en: `library`, `discover`, `search`, `media/[type]/[id]` (con OG image desde TMDB poster), `profile/[username]`, `lists/[id]`, `notifications`, `settings`, `suggestions`, `chat`, `chat/[id]`, `groups/[id]`, `friends`, `lists`, `home`.
- **Discrepancia con AUDIT.md:** el AUDIT decía "Sin metadata dinámica". Esto **ya no es cierto** — fue añadido posteriormente (commits A5.x).

---

## 10. Decisiones de diseño y arquitectura — el "por qué"

> Ordenadas por impacto. Para cada decisión: qué, por qué, alternativas, consecuencias.

### 10.1 Stack: Next.js App Router + Supabase + Anthropic en Vercel

- **Qué:** Next.js 14 App Router con Server Components SSR, Supabase para auth + DB + Realtime, Anthropic SDK para IA, deployment en Vercel.
- **Por qué (Inferido):** stack típico para indie maker / hobby project con foco en rapidez de iteración. El usuario es un hobbista (memoria `user_profile.md`) que pide features de alto nivel ("mejorar UI", "quiero chats como WhatsApp"). Supabase reduce la fricción de auth + RLS + Realtime sin SaaS adicional. Vercel es plug-and-play con Next.
- **Alternativas:** SvelteKit, Remix, Nuxt; Firebase/Hasura/PlanetScale; Pinecone/OpenAI; Render/Railway/AWS.
- **Consecuencias:**
  - Beneficio: tiempo a primera demo muy bajo.
  - Coste: rate limit en Vercel multi-instancia no funciona (problema documentado).
  - Coste: dependencia fuerte de Supabase para schema, RLS y Realtime — cambio de proveedor sería caro.

### 10.2 Normalización a `MediaItem` antes de UI (regla 2 de `CLAUDE.md`)

- **Qué:** todos los adaptadores de APIs externas devuelven crudo, y `normalizer.ts` convierte a `MediaItem` antes de cualquier consumidor.
- **Por qué:** desacopla la UI de la forma de cada API. Cambiar de fuente de libros (E10/E11 en backlog) es modificar 1 archivo. Permite tests de contrato independientes de UI.
- **Alternativas:** consumir crudos en componentes (acoplamiento), GraphQL gateway (over-engineering), tipo unión discriminada (más type-safety pero más fricción).
- **Consecuencias:**
  - Beneficio: arquitectura limpia, swap de adapter es local.
  - Coste: pérdida de datos específicos a cada tipo se mitiga con `metadata: Record<string, unknown>` pero a costa de type-safety en metadata.

### 10.3 Cache de `media` en DB (regla 3 de `CLAUDE.md`)

- **Qué:** antes de insertar en `user_media`, se hace `upsert` en `media` con `mediaCache` enviado por el cliente.
- **Por qué:** evita N llamadas a APIs externas para títulos ya conocidos cuando se renderiza biblioteca/feed/listas. La FK `user_media.media_id → media.id` requiere existencia.
- **Alternativas:** lazy fetch al renderizar (caro y rompe responsiveness), cache en Redis (extra infra), almacenar todo en `user_media.metadata` (rompe normalización).
- **Consecuencias:**
  - Beneficio: feed/biblioteca renderizan rápido sin tocar TMDB/Jikan.
  - Coste: si TMDB cambia el título, el de la DB queda obsoleto hasta el próximo upsert. Sin invalidación TTL.

### 10.4 Rate limiting en memoria

- **Qué:** `Map<string, { timestamps: number[] }>` global en `src/lib/rate-limit.ts`.
- **Por qué (Inferido):** patrón mínimo viable para un MVP local; el propio archivo documenta que en Vercel multi-instancia hay que migrar a KV/Redis.
- **Alternativas:** Vercel KV (reciente), Upstash Redis, edge middleware con DurableObjects de Cloudflare.
- **Consecuencias:**
  - Beneficio: cero infra extra, funciona perfecto en dev.
  - Coste: en producción Vercel un atacante puede bypassear el límite con N requests paralelas (cada lambda warm tiene su Map). Bloqueante para Anthropic API (coste).

### 10.5 Cliente Supabase dividido server/client

- **Qué:** `lib/supabase/client.ts` para Client Components, `lib/supabase/server.ts` para Server Components / Route Handlers.
- **Por qué:** `@supabase/ssr` requiere cookies diferentes en cada contexto. Server Components no pueden escribir cookies — el `try/catch` en `setAll` lo hace explícito.
- **Alternativas:** un único cliente con detección de runtime (frágil), Server Actions (no usados en este proyecto).
- **Consecuencias:**
  - Beneficio: claridad y separación correcta.
  - Coste: el dev tiene que recordar cuál importar.

### 10.6 Filtros de biblioteca en cliente

- **Qué:** `library/page.tsx` (server) carga **todas** las entradas con `getUserMedia(userId)`; `LibraryClient.tsx` (cliente) filtra en memoria por type/status/score.
- **Por qué (Inferido):** simplicidad y feedback instantáneo al cambiar filtros. Para una biblioteca personal típica (decenas/cientos de items) es razonable.
- **Alternativas:** filtros en query params + nuevo SSR fetch por cambio (lento), endpoint dedicado con paginación.
- **Consecuencias:**
  - Beneficio: UX rápida.
  - Coste: con biblioteca de 5000 items el server transfiere todo en cada navegación, y sin paginación se carga todo a memoria del cliente. **Riesgo de OOM/latencia** en bibliotecas grandes.

### 10.7 Aggregation en JS para "popular en círculo" y feed

- **Qué:** `circle.ts` y `feed.ts` traen todas las filas relevantes y agregan en JS.
- **Por qué (Inferido):** el círculo social es típicamente <50 amigos; la query SQL con GROUP BY sería más compleja y los joins ya son caros. Comentado en `circle.ts:25`.
- **Alternativas:** vista materializada, RPC con SQL agregado, edge function.
- **Consecuencias:**
  - Beneficio: lógica en TS, fácil de testear.
  - Coste: se traen N filas redundantes; no escala con miles de amigos por usuario.

### 10.8 i18n con next-intl + JSON

- **Qué:** 454 entradas en `messages/{es,en}.json`, namespaces semánticos, default locale `es`.
- **Por qué:** producto en español primero (usuario hispanoparlante, mercado EU/LatAm), pero abierto a en. next-intl ofrece type-safety con namespaces.
- **Alternativas:** react-i18next, lingui, traducción solo de strings hardcoded.
- **Consecuencias:**
  - Beneficio: i18n correcto desde el inicio, traducciones sincronizadas (test `messages.test.ts`).
  - Coste: añadir un string nuevo requiere tocar 2 archivos JSON.

### 10.9 PRD-less dev: flujo NOW/BACKLOG/DONE

- **Qué:** `CLAUDE.md` impone un flujo: `NOW.md` con la única tarea activa, `BACKLOG.md` priorizado, `DONE.md` log; aprobación por bloque (A, B, C…), no por tarea.
- **Por qué:** evita scope creep, garantiza criterio binario de "hecho", deja un audit trail.
- **Alternativas:** Linear/Jira (pesado para hobby), kanban en Markdown (similar pero menos disciplinado).
- **Consecuencias:**
  - Beneficio: las sesiones rinden bien, el repo tiene historia coherente.
  - Coste: una sesión interrumpida deja a B2 en estado inconsistente (caso real, ver `docs/SESSION_2026-05-02.md`).

### 10.10 TypeScript estricto sin escape hatches

- **Qué:** `strict: true` en tsconfig, regla 6 de `CLAUDE.md` prohíbe `any` excepto en `metadata` de `MediaItem`.
- **Por qué:** correctitud temprana; Supabase devuelve datos crudos potencialmente nullable y la disciplina paga.
- **Alternativas:** `strict: false` (más rápido al inicio), `unknown` en lugar de `any` (más estricto pero igual de capable).
- **Consecuencias:**
  - Beneficio: refactors seguros, IDE útil.
  - Coste: muchos `as unknown as Array<{...}>` para joins de Supabase que el SDK no tipa bien — visible en chat, groups, lists routes. La regla obliga a esto en lugar de `any` puro.

### 10.11 Decisión documentada: DEC-008 — un tipo por lista

- **Qué:** `lists.media_type` es un solo tipo (movie, tv, anime, etc.).
- **Por qué (Inferido):** simplifica UX (filtros por tipo + visualización homogénea), y schema (CHECK constraint).
- **Alternativas:** lista mixta con `media_type[]`, lista sin restricción.
- **Consecuencias:** UX limpia; usuarios que quieran "una lista mixta" deben crear varias.

### 10.12 Sin Co-Authored-By en commits (regla 9 de `CLAUDE.md`)

- **Qué:** los commits son del autor humano. Cualquier trailer auto-añadido se elimina antes del commit.
- **Por qué:** el usuario considera la asistencia de IA herramienta, no co-autoría.
- **Consecuencias:** los commits se ven "humanos" en el log de GitHub.

### 10.13 Estrategia de tests por capas

- **Qué:** vitest unit + vitest integration (Supabase real) + vitest contract (APIs externas) + playwright e2e. Configs separadas.
- **Por qué:** velocidad — los unit corren en CI; integration y contract son lentos y se corren localmente.
- **Alternativas:** mocks para todo (rápido pero esconde bugs), un único runner (lento).
- **Consecuencias:**
  - Beneficio: CI rápido, alta confianza local.
  - Coste: mantenimiento de 3 configs; el test E2E mínimo (solo auth) deja flujos críticos sin cobertura E2E.

---

## 11. Tests y calidad

### 11.1 Configuraciones

- `vitest.config.ts` — unit, jsdom, glob `tests/unit/**`, setup `tests/setup.ts`. Usado por `npm test`.
- `vitest.integration.config.ts` — node, glob `tests/integration/**`. Usado por `npm run test:integration`.
- `vitest.contract.config.ts` — node, timeout 15s, glob `tests/contract/**`. Usado por `npm run test:contract`.
- `playwright.config.ts` — chromium + Mobile Chrome, single worker, dev server auto-iniciado.

### 11.2 Suites existentes

- **Unit (~50 archivos):** rate-limit, normalizer, search, AI/Claude, security headers, library (actions/queries/route/stats), social (circle/feed/friends/lists/notifications/recommendations/reports/route), settings, components (Button, Avatar, Toast, MediaCard/Grid/Detail, StreamingProviders, TrailerEmbed, LibraryAction/Modal/EpisodeProgress, ProfileGenres/Header/Stats, SearchBar/Results, login-form, register-form, AuthHeader, BottomNav, Header, HeroSection, MediaRow, FilterBar, pagination, select, star-rating, status-selector), hooks (useToast), error-boundaries, i18n, types (media), utils (auth-errors), pages (landing).
- **Integration (5):** Supabase clients, friends, library upsert, RLS policies, trigger.
- **Contract (5):** TMDB, Jikan, Google Books, MangaDex, RAWG.
- **E2E (1):** auth.spec.ts.

### 11.3 Cobertura

- `--coverage` configurado pero **no se ha ejecutado en ninguna sesión documentada**. `[NO ENCONTRADO]` % real.
- **Cobertura de componentes:** existe (Button, Avatar, MediaCard, etc.). Esto contradice el [TEST-01] del AUDIT del 2026-04-23 ("0 archivos `*.test.tsx`"). Los commits A5.11 y posteriores añadieron tests de componentes — el AUDIT.md está desactualizado en este punto.
- **Cobertura de E2E:** solo el flujo auth. Library, recomendaciones, listas, chat, grupos no tienen E2E. Sigue siendo el gap principal.

### 11.4 Linters / formatters / type-checking

- **ESLint:** `eslint-config-next` (next/core-web-vitals + next/typescript). Ejecutado en CI.
- **Prettier:** **no está en `devDependencies`**. `[NO ENCONTRADO]` config de Prettier. Inferido: formato manual / IDE + ESLint.
- **TypeScript:** `tsc --noEmit` en CI con `npm run type-check`.

### 11.5 CI/CD

- `.github/workflows/ci.yml` — Ubuntu, Node 24, en push y PR contra `master`. Steps: install (npm ci) → lint → typecheck → unit tests → build.
- **No hay deploy automático** (Vercel hace deploy on push a master, pero no controlado por este workflow).
- **Discrepancia:** las env vars del workflow (líneas 18-25) usan los nombres antiguos `NEXT_PUBLIC_*`. El código las lee con los nombres nuevos. Esto significa que en CI las claves quedan `undefined` — el build pasa porque no se hacen llamadas reales.

---

## 12. Configuración y despliegue

### 12.1 Variables de entorno

Detectadas en `.env.local` (nombres reales en uso, valores redactados):

```
TMDB_API_KEY               (server-only)
RAWG_API_KEY               (server-only)
GOOGLE_BOOKS_KEY           (server-only)
COMICVINE_KEY              (server-only, sin uso en código actual)
ANTHROPIC_API_KEY          (server-only)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  (server-only, presente en .env.local)
SUPABASE_TEST_URL          (proyecto separado para tests de integración)
SUPABASE_TEST_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

> `CLAUDE.md` líneas 67-76 lista nombres antiguos `NEXT_PUBLIC_TMDB_API_KEY`, `NEXT_PUBLIC_RAWG_KEY`, `NEXT_PUBLIC_GOOGLE_BOOKS_KEY`. Doc desactualizada.

### 12.2 Scripts de `package.json`

```
dev               next dev
build             next build
start             next start
lint              next lint
type-check        tsc --noEmit
test              vitest run
test:watch        vitest
test:coverage     vitest run --coverage
test:integration  vitest run --config vitest.integration.config.ts
test:contract     vitest run --config vitest.contract.config.ts
test:e2e          playwright test
test:e2e:ui       playwright test --ui
test:all          npm run type-check && npm run lint && npm run test && npm run test:e2e
verify            npm run build && npm run test:all
```

### 12.3 Despliegue

- `vercel.json` — `framework: nextjs`, `buildCommand: npm run build`, `regions: ["iad1"]` (Washington, no EU — `Inferido:` posible riesgo de latencia para usuarios EU si se monetiza ahí).
- `.vercel/` presente → proyecto vinculado a Vercel.
- Sin Dockerfile, sin docker-compose, sin Terraform/IaC.
- Push a master en https://github.com/benevi/kultura (privado) → Vercel deploy automático.

### 12.4 Arranque de Supabase para dev nuevo

- README de `supabase/` documenta `supabase start` + `supabase db reset` + `supabase db push`. Pero **el archivo SQL está vacío**, así que `db reset` no aplica nada.
- `supabase/README.md` actual contiene un heredoc PowerShell crudo (`@'...'@ | Set-Content...`) — **bug en el archivo**, ver §15.

---

## 13. Análisis de cumplimiento de objetivos

| Objetivo original (CLAUDE.md / AUDIT.md / SPEC) | Estado actual | Evidencia en el código |
|--------------------------------------------------|---------------|--------------------------|
| Web app de descubrimiento cultural multi-tipo | ✅ Cumplido | `src/types/media.ts:9` (7 tipos), `src/lib/api/*` (6 APIs), `MediaDetail`, `discover/page.tsx`. |
| Biblioteca personal con estados y puntuación | ✅ Cumplido | `user_media` schema, `LibraryAction`, `library/page.tsx`, `LibraryStatusModal`. |
| Sistema de amigos | ✅ Cumplido | `friendships` schema, `/api/friends`, `friends/page.tsx`, `FriendCard`. |
| Listas (incl. colaborativas) | ✅ Cumplido | `lists` + `list_members` + `list_items`, `/api/lists`, `lists/page.tsx`. |
| Recomendaciones IA | ✅ Cumplido | `lib/claude/recommendations.ts`, `/api/ai-recommendations`, `AiRecommendations.tsx`. |
| Recomendaciones user-to-user | ✅ Cumplido | `recommendations` schema, `/api/recommendations`, `RecommendModal`. |
| Sistema de reportes | ✅ Cumplido | `reports` schema, `/api/reports`, `ReportButton`. |
| Notificaciones in-app | ✅ Cumplido | `notifications` schema, `/api/notifications`, `notifications/page.tsx`. |
| i18n es/en | ✅ Cumplido | 454 líneas/locale, next-intl, `LanguageSwitcher`, mapeo de errores. |
| Auth Supabase con RLS | ✅ Cumplido | middleware + `lib/supabase/`, RLS policies (49 reportadas), tests de integración. |
| Mobile-first | ✅ Cumplido | `BottomNav`, breakpoints `md:`, `safe-area-inset-bottom`. |
| TypeScript estricto sin `any` | ✅ Cumplido | `strict: true`, 1 `as any` documentado en middleware. |
| Chat tipo WhatsApp con Realtime | ✅ Cumplido (parcial) | `conversations`/`messages` schema, `/api/chat[/id]`, Supabase Realtime suscripción client-side. |
| Grupos con feed | ✅ Cumplido (parcial) | `groups`/`group_members`/`group_posts`, `/api/groups`, `groups/[id]/page.tsx`. Falta listado `/groups`. |
| Sugerencias de feedback | ✅ Cumplido | `suggestions` schema, `/api/suggestions`, `SuggestionsForm`. |
| Bio en perfil | ✅ Cumplido | `users.bio`, `ProfileBio` con inline edit. |
| Score filter en biblioteca | ✅ Cumplido | `LibraryClient.tsx` filterGroups. |
| Búsqueda de usuarios por username | ✅ Cumplido | `/api/users/search`. |
| Filtros de género/tipo en discover | ⚠️ Parcial | discover acepta `type` pero no filtros de género/año visibles. AUDIT [DATA-02] backlog menciona "Filtro de año en Discover es client-side parcial". |
| ComicVine integration | ❌ No cumplido | Clave existe; sin adapter; `searchByType('comic')` devuelve `[]`. Backlog E6. |
| AUDIT Fase 0 — Hardening inmediato | ⚠️ Parcial | A1-A5 ✅ (creds rotadas, repo en GitHub). A6 ⏳ pendiente auditoría de coherencia. B1-A/B/C ✅ (CI verde). **B2 ❌ migraciones no commiteadas**. |
| AUDIT Fase 1 — Producción real | ❌ No empezado | Rate-limit aún en memoria, Sentry no integrado, console.error sin reemplazar. SEO sí mejoró (generateMetadata implementado, contradice AUDIT). |
| AUDIT Fase 2 — Calidad y features | ⚠️ Parcial | Tests de componentes existen (contradice AUDIT). E2E ampliado ❌. ComicVine ❌. Validación env vars ❌. |
| AUDIT Fase 3 — Monetización | ❌ No empezado | Bloque F del backlog, sin trabajo. |
| GDPR (privacidad/exportación/eliminación) | ❌ No cumplido | Bloque D del backlog. |
| Migraciones SQL versionadas | ❌ Bloqueante | B2 inconsistente. `supabase/migrations/` vacío. |
| OAuth (Google, GitHub) | ❌ No cumplido | E7 del backlog. Solo email/password. |
| 2FA / recuperación de contraseña personalizada | ⚠️ Parcial | Reset existe vía Supabase Auth; sin 2FA. E8 del backlog. |

---

## 14. Desviaciones del plan original

### 14.1 Lo construido NO listado explícitamente como objetivo inicial (SPEC-001..007)

- **Sistema de chat con Realtime** (`conversations`, `messages`, `/api/chat`, suscripción Realtime). El usuario lo pidió a posteriori ("quiero chats como WhatsApp", según `project_kultura.md`). `Inferido:` valor real para retención, no es deuda técnica.
- **Sistema de grupos** (`groups`, `group_members`, `group_posts`). Mismo origen — feature pedida después. Aporta valor al producto, pero hay endpoints incompletos (no hay endpoint para postear en `group_posts` desde Route Handler — se hace desde cliente).
- **Sistema de sugerencias/feedback** (`suggestions`, `/api/suggestions`, `/suggestions` page). Útil para el dueño del producto recopilar input de usuarios.
- **Reportes** (`reports`, `/api/reports`, `ReportButton`). Anticipa moderación; típico boilerplate maduro.
- **Cache de IA en memoria con TTL 1 h.** Inicialmente no estaba, sumado con A5.5. Aporta valor pero replica el problema de rate-limit (no distribuida).
- **Componentes shadcn/ui (parcial).** `components.json` configura shadcn pero solo `Button` sigue ese estilo claramente. **Half-finished** según los criterios del propio CLAUDE.md ("No half-finished implementations either" — del system prompt). Posible deuda.
- **`AppFooter` separado de `Footer`.** Hay dos footers: `Footer.tsx` (público) y `AppFooter.tsx` (autenticado, con link a sugerencias).
- **`generateMetadata()` en casi todas las páginas.** Añadido tras el AUDIT, contradice el AUDIT.

### 14.2 Lo eliminado

- `LibraryFilters.tsx` se menciona en `project_kultura.md` como "muerto — limpiar". Verificación rápida: **no existe en el repo actual** ya, fue limpiado.
- 3 tests de componentes Library inexistentes — borrados en B1-A.

### 14.3 Lo presente sin uso

- `src/lib/api/openlibrary.ts` — definido completamente pero `searchAll` no lo invoca. Funciones de fallback de libros sin pipeline. **Código muerto en runtime, vivo en tipos.**
- `COMICVINE_KEY` en `.env.local` — sin consumidor.
- `tests/_pending/` — tests congelados esperando módulo `lib/env`.

---

## 15. Problemas detectados

### 15.1 Bugs / archivos incorrectos

- **`supabase/README.md` contiene texto crudo de PowerShell heredoc en lugar del Markdown evaluado.** El archivo empieza con `@'\n# Supabase\n...` y termina con `'@ | Set-Content -Path supabase\README.md -Encoding UTF8`. **Bug:** el comando se commiteó tal cual en lugar de su salida. (Localización: `supabase/README.md:1-71`.)
- **`supabase/migrations/` está vacío** pese a que el remoto tiene la migración `20260502155455` aplicada. Documentado en `docs/SESSION_2026-05-02.md`. Riesgo de que el dev nuevo no pueda regenerar el schema.

### 15.2 Funcionalidades rotas o incompletas

- **ComicVine sin implementación** (`searchByType('comic')` devuelve `[]`, `MediaType` incluye `'comic'`). Pendiente E6.
- **`group_posts`: sin endpoint para crear posts** desde Route Handler. `Inferido:` se hace cliente-direct con RLS — no auditado en el SQL pull desaparecido.
- **Listado de grupos** (`/groups`) sin página. Solo `/groups/[id]`.
- **Listas públicas en perfil:** `project_kultura.md` indica "Listas públicas en Profile" como pendiente. No detectado en código.
- **Botón "Eliminar desde vista grid en Library":** mencionado en deuda. Confirmado: la grid de biblioteca permite filtrar pero no eliminar inline; hay que ir al detalle del título.
- **Login inputs no usan componente `<Input>`** — `LoginPage.tsx:303-372` usa `<input>` raw. Backlog mencionaba migración pendiente.

### 15.3 Code smells y duplicaciones

- **`EpisodeProgress` está definido dos veces:** `src/types/library.ts:17-20` y `src/types/user.ts:35-38`, con la misma forma. Duplicación leve.
- **Mapeo manual snake_case ↔ camelCase repetido** en `friends.ts`, `feed.ts`, `circle.ts`, `lists.ts` — cada query reusa un patrón similar de `as unknown as Array<{...}>` + `.map(row => ({ ... }))`. Posible utilidad común.
- **N+1 en `GET /api/chat`:** una query principal + 2 queries paralelas (members + lastMsg) por cada conversación. Para usuarios con muchas conversaciones es problemático. Mitigación: `Promise.all`, pero el round-trip por conv es N.
- **`POST /api/chat` busca conversación existente con loop O(n) en JS** sobre `conversation_members` del usuario, haciendo 1 query por iteración. Para usuarios con N conversaciones, complejidad O(N²) en peor caso.
- **CLAUDE.md desactualizado vs código:**
  - Modelo Anthropic: doc dice `claude-sonnet-4-20250514`, código usa `claude-sonnet-4-6`.
  - Env vars: doc lista `NEXT_PUBLIC_TMDB_API_KEY`, `NEXT_PUBLIC_RAWG_KEY`, `NEXT_PUBLIC_GOOGLE_BOOKS_KEY`; código usa `TMDB_API_KEY`, `RAWG_API_KEY`, `GOOGLE_BOOKS_KEY`.
  - DB Schema: doc tiene 10 tablas, hay 17 en realidad.
- **`AUDIT.md` (2026-04-23) ya tiene secciones desactualizadas:**
  - "Sin metadata dinámica" — falso, hay `generateMetadata` en muchas páginas.
  - "0 archivos `*.test.tsx`" — falso, hay tests de componentes desde A5.11.
  - "console.error en 15 instancias" — actualmente son **17 instancias** (ver §15.5).
- **Comentarios obsoletos en código:**
  - `src/types/supabase.ts:6` dice "Refleja exactamente las columnas de 001_initial_schema.sql" — esa migración ya no existe en el repo.
  - `src/lib/social/feed.ts:33` referencia "migración 006" — tampoco está en repo.

### 15.4 Deuda técnica documentada

Del backlog directamente:
- B2 (migraciones SQL versionadas) — **inconsistente**.
- B2-DOC, B2-VERIFY — pendientes.
- B3 (validación env vars) — pendiente.
- C1 (Sentry), C2 (logger), C3 (rate-limit Redis) — pendientes.
- D1, D2, D3 (GDPR) — pendientes.
- E1-E14 — backlog opcional.

### 15.5 Problemas de seguridad

- **Credenciales en `.env.local` (no commiteadas, pero presentes en disco) incluyen `SUPABASE_SERVICE_ROLE_KEY` y `ANTHROPIC_API_KEY`.** El backup `kultura-backup-2026-05-01.zip` (~280 MB) en `e:\app movies\` puede contener esas credenciales. `[REQUIERE CONFIRMACIÓN]` sobre si el zip se ha compartido.
- **A1-A4 ya rotaron las credenciales originales** (DONE.md). Las actuales son nuevas.
- **`POST /api/chat/[id]` sin rate-limit.** Vector de spam para envío de mensajes.
- **`POST /api/groups` sin rate-limit.** Un usuario podría crear miles de grupos.
- **`POST /api/suggestions` sin rate-limit.** Vector de spam.
- **`GET /api/users/search` sin rate-limit.** Vector de enumeración de usuarios (aunque solo devuelve 8 por query, alguien podría iterar prefijos).
- **CSP relativamente permisivo en producción:** `script-src 'self' 'unsafe-inline'` permite XSS si hay un sink. Mitigado parcialmente por React.
- **Rate limit en memoria:** ya cubierto en §10.4.

### 15.6 Problemas de rendimiento

- **`library/page.tsx` carga toda la biblioteca sin paginación.** Ver §10.6.
- **`circle.ts` y `feed.ts` traen todas las filas de amigos, agregan en JS.** Ver §10.7.
- **Sin índices verificados en DB.** Las migraciones no están commiteadas. Solo PK/FK.
- **Sin caché de respuestas de APIs externas a nivel de servidor** (más allá del cache de `media`). Cada visita a `/discover` golpea TMDB; cada `/home` llama a TMDB discover y a Anthropic (esta última cacheada).
- **Imágenes externas sin optimización custom.** `next/image` con `remotePatterns` (correcto), pero sin Vercel Image Optimization custom o CDN dedicado. Aceptable para escala MVP.

### 15.7 Inconsistencias

- **Naming env vars** entre código, `.env.local`, `CLAUDE.md` y `.github/workflows/ci.yml` (los placeholders del CI usan los nombres viejos `NEXT_PUBLIC_*`).
- **`recommendations` en CLAUDE.md** lista `'recommendation' | 'list_invite'` para `notifications.type`. Coincide con el código (`/api/recommendations`, `/api/lists/[id]` con `x-action: invite`). ✅
- **Doble carpeta para listas:** `src/components/lists/` está vacía pero presente; `src/components/social/ListCard.tsx` y `CreateListModal.tsx` viven en social. Inconsistencia organizativa.

### 15.8 `console.error` distribuidos

17 instancias detectadas (vs 15 que cita el AUDIT):
```
src/components/library/LibraryAction.tsx:74, 86
src/lib/claude/recommendations.ts:179, 200, 241
src/app/api/suggestions/route.ts:35
src/components/social/FriendshipButton.tsx:34, 47, 61
src/components/social/FriendCard.tsx:31, 42, 53
src/app/[locale]/(app)/notifications/page.tsx:26
src/app/api/groups/route.ts:64
src/app/[locale]/(app)/lists/[id]/ListDetail.tsx:47, 75, 90
```

Sin condicional `NODE_ENV`. Pendiente C2.

### 15.9 TODO/FIXME

`grep` de TODO|FIXME|HACK|XXX en `src/`: **0 matches**. El código no tiene marcadores; toda la deuda vive en `docs/BACKLOG.md`.

---

## 16. Dependencias externas

### 16.1 Dependencias de producción

```
@anthropic-ai/sdk        ^0.88.0
@radix-ui/react-slot     ^1.2.4
@supabase/ssr            ^0.10.2
@supabase/supabase-js    ^2.103.0
class-variance-authority ^0.7.1
clsx                     ^2.1.1
lucide-react             ^1.8.0   ⚠️ versión declarada baja
next                     14.2.35
next-intl                ^4.9.1
react                    ^18
react-dom                ^18
tailwind-merge           ^3.5.0
zod                      ^4.3.6
```

### 16.2 Dependencias de desarrollo

```
@playwright/test           ^1.59.1
@testing-library/jest-dom  ^6.9.1
@testing-library/react     ^16.3.2
@types/node                ^20
@types/react               ^18
@types/react-dom           ^18
@vitejs/plugin-react       ^6.0.1
@vitest/coverage-v8        ^4.1.4
eslint                     ^8
eslint-config-next         14.2.35
jsdom                      ^29.0.2
postcss                    ^8
tailwindcss                ^3.4.1
typescript                 ^5
vitest                     ^4.1.4
```

### 16.3 Versiones potencialmente desactualizadas

- `lucide-react` ^1.8.0 (sospechoso — la rama estable está mucho más alta). `[REQUIERE CONFIRMACIÓN]` consultando `package-lock.json` o `npm outdated`.
- `next` 14.2.35 — funcional, pero Next 15 estable existe desde hace meses (cutoff 2026-01).
- `eslint` ^8 — ESLint 9 está estable.
- `@types/node` ^20 vs Node 24 en CI — Node ya superado, los tipos pueden estar atrasados pero compatibles.

`[NO ENCONTRADO]` ejecución de `npm audit` documentada en sesiones recientes; sin datos de vulnerabilidades conocidas.

### 16.4 Dependencias sin uso aparente

- `@radix-ui/react-slot` — usado solo por `Button` (asChild). OK.
- `@vitest/coverage-v8` — no se ejecuta `test:coverage` en CI. Configurado pero no medido.
- `@testing-library/jest-dom` — `Inferido:` cargado en `tests/setup.ts` (no leído este archivo, pero estándar).

---

## 17. Puntos fuertes del proyecto

1. **Disciplina de TypeScript estricto.** `strict: true` + 1 `as any` documentado + regla 6 contra `any`. Calidad inusual en proyectos hobby.
2. **Arquitectura de normalización.** Todas las APIs externas pasan por `normalizer`; cambiar de fuente es local. La regla 2 de `CLAUDE.md` la blinda explícitamente.
3. **Separación correcta server/client.** Claves sensibles nunca en `NEXT_PUBLIC_`. Route Handlers actúan de proxy. CSP estricta. Headers de seguridad básicos puestos.
4. **Rate limiting desde el inicio.** Aunque sea en memoria, el patrón está bien aplicado en todas las rutas sensibles. Mejor que un proyecto que lo añade como hotfix.
5. **i18n completo.** 454 entradas en es/en, fallback de errores Supabase a claves traducidas, rutas con prefijo de idioma, switcher en header.
6. **Tests multicapa.** Unit + integration (Supabase real) + contract (APIs externas) + e2e (Playwright). Configs separadas para velocidad.
7. **Cache de `media` en DB.** Patrón correcto para evitar llamadas repetidas a APIs externas.
8. **Validación de input en endpoints.** Formato `mediaId`, enums, body JSON, Zod en grupos/settings/sugerencias. Sin SQL injection surface (ORM Supabase).
9. **Flujo de trabajo NOW/BACKLOG/DONE en `CLAUDE.md`.** Genera commits temáticos coherentes (ver A5.1..A5.13) y mantiene scope cerrado por bloque.
10. **CI verde con typecheck + lint + tests + build.** `[B1-B]` cerrado el 2026-05-02.
11. **`generateMetadata` extendido** con OG/Twitter cards en media detail (con poster TMDB), profile, library, search, etc. Esto contradice positivamente el AUDIT (que decía "SEO nulo") — fue mejorado en commits posteriores.
12. **Auto-creación de perfil con fallback de username** ante colisión 23505. Robustez en onboarding.
13. **Realtime para chat.** Suscripción client-side directa, server verifica membership.
14. **Modelo de datos bien restringido:** CHECK constraints para enums (`status`, `media.type`, `target_type`, etc.), UNIQUE en `(user_id, media_id)` y `(requester_id, receiver_id)`.
15. **Backup local de 2026-05-01** (`kultura-backup-2026-05-01.zip`) sugiere conciencia operativa.

---

## 18. Riesgos y bloqueantes actuales

### 18.1 Bloqueantes para producción

| Riesgo | Impacto | Mitigación pendiente |
|--------|---------|----------------------|
| **B2 inconsistente — sin migraciones SQL versionadas.** Schema solo en dashboard remoto. | No se puede reproducir entorno desde cero. Reset accidental del proyecto Supabase = pérdida total. | B2 + B2-VERIFY del backlog. |
| **Rate limiting no funciona en multi-instancia Vercel.** | Atacante puede abusar Anthropic API (coste $$) y otros endpoints. | C3 backlog. |
| **Sin observabilidad de producción.** | Bugs silenciosos, sin alertas, sin logs estructurados. | C1 + C2 backlog. |
| **GDPR no implementado.** | Riesgo legal si hay usuarios EU. | D1, D2, D3 backlog. |
| **Sin endpoints de eliminación/exportación de cuenta.** | Mismo riesgo que arriba. | D2, D3. |
| **Backup zip de 280 MB en disco contiene snapshots antiguos.** | `[REQUIERE CONFIRMACIÓN]` si fue compartido. | Auditoría manual. |

### 18.2 Bloqueantes para escalado

- Sin paginación verificada en todas las queries (`library`, `feed`, `circle`).
- Sin caché de respuestas de APIs externas (cada visita a `discover` golpea TMDB).
- Filtros de biblioteca client-side requieren cargar toda la biblioteca.
- N+1 en `/api/chat` y O(N²) potencial en `POST /api/chat`.
- Sin índices DB visibles en código (no hay migraciones que los declaren).

### 18.3 Bloqueantes para producto

- **Sin monetización ni schema de billing.** Bloque F del backlog explícitamente excluido hasta validación con usuarios.
- **ComicVine sin implementar** — uno de los 7 tipos de medio anunciados no es funcional.
- **OAuth ausente** — solo email/password. Reduce conversión.
- **Discoverability de SEO limitada** sin sitemap, sin meta global de tipo `book.author`/`video.movie` totalmente correcta (ya hay un parche en media detail), sin robots.txt verificado (`[NO ENCONTRADO]` en `public/`).
- **`/groups` sin listado público.** Los grupos son invisibles excepto a sus miembros.

### 18.4 Riesgos operativos

- **Dos asistentes Claude operando simultáneamente** sobre el proyecto (Claude.ai chat + Claude Code extension de Cursor) según `docs/SESSION_2026-05-02.md`. Causó la desaparición del SQL de B2. **Pendiente decidir un modelo de trabajo** para evitar repetición.
- **Documentación interna desactualizada** en CLAUDE.md y AUDIT.md respecto al código real (modelo Anthropic, env vars, schema, `generateMetadata`, console.error count, tests de componentes). Riesgo de tomar decisiones basadas en doc obsoleta.
- **CI no ejecuta `test:integration` ni `test:contract` ni `test:e2e`.** Solo unit + build. La regresión en RLS/triggers o en APIs externas no se detecta automáticamente.
- **Vercel deploy automático on master** sin gate manual. Si CI pasa pero el código tiene un bug funcional (no detectado por unit tests), llega a producción.

### 18.5 Riesgos del flujo de trabajo

- **Aprobación por bloque, no por tarea** (regla en `CLAUDE.md`). Si un bloque es muy grande, el usuario aprueba a ciegas.
- **`docs/_archive/agents-old/`** preservado como referencia pero no usado. Riesgo de deriva entre el flujo viejo y el nuevo.
- **`tests/_pending/`** congelado esperando B3 (env validation). Los tests congelados tienden a podrirse.
- **`DONE.md` lleva nota libre.** Sin formato estricto (ej. "sin commit" para A1-A4 porque era trabajo de dashboard externo). Trazabilidad imperfecta.

---

*Fin del informe. Documento generado leyendo el código real del repositorio en `e:\app movies\kultura\` el 2026-05-02. Las inferencias están etiquetadas como `Inferido:`. Los gaps no verificables están marcados como `[NO ENCONTRADO]` o `[REQUIERE CONFIRMACIÓN DEL USUARIO]`. Este informe NO propone acciones — la fase de planificación es posterior.*
