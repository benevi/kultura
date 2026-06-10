# KULTURA — CLAUDE.md

Web app de descubrimiento cultural (películas, series, anime, libros, cómics, manga, videojuegos). Biblioteca personal, amigos, listas, recomendaciones IA.

---

## ⚡ Flujo de trabajo (LEER PRIMERO)

**Antes de escribir código, leer en este orden:**
1. `docs/NOW.md` — la única tarea activa.
2. `docs/BACKLOG.md` — lista priorizada de pendientes (solo si NOW está vacío).

**Una tarea a la vez.** Si el usuario pide algo fuera de la tarea de NOW.md, responder:
> "Eso no es la tarea activa en NOW.md (que es {tarea}). ¿Lo añadimos al BACKLOG o cambiamos de tarea?"

**No expandir alcance.** Frases prohibidas: "aprovechando que toco este archivo", "ya que estoy aquí", "esto también debería". Lo que aparezca durante la ejecución va al BACKLOG, no al turno actual.

**Criterio binario de hecho.** Al terminar, ejecutar los comandos de "Cómo sé que funciona" de NOW.md y pegar el output real. No "debería funcionar". Output pegado o no está hecho.

**Cierre de tarea (ejecutar en orden):**
1. Verificar (output pegado).
2. `git commit` con mensaje `[{ID}] {descripción}` (ej: `[A1] Rotar credenciales expuestas`).
3. Añadir línea a `docs/DONE.md` con fecha + ID + hash.
4. Marcar `[x]` en `docs/BACKLOG.md`.
5. Sustituir contenido de `docs/NOW.md` con la siguiente tarea (rellenar 4 secciones: Qué cambia / Cómo sé que funciona / Archivos que toco / Cuándo paro).
6. **Parar.** No empezar la siguiente sin confirmación del usuario.

**Aprobación:** se aprueba **bloque** entero (A, B, C…), no tarea por tarea. Dentro de un bloque, encadenar tareas sin pedir permiso por cada una; pedir confirmación solo al cerrar el bloque.

### Reglas de emergencia
- **Bug en tarea anterior:** detener la actual, crear `{ID}-FIX` en NOW.md, arreglar, verificar, retomar.
- **Dependencia bloqueante:** anotar en `docs/BLOCKERS.md` y proponer alternativa antes de seguir.
- **Tarea demasiado grande:** detener, partir en `{ID}-A`, `{ID}-B` en BACKLOG, empezar por la primera.
- **Test imposible (caso edge real):** documentar en `docs/TEST_EXCEPTIONS.md` con justificación. No skipear silenciosamente.

---

## Stack

Next.js 14 App Router · React 18 · TypeScript strict · Tailwind CSS 3 · Supabase (PG + Auth + RLS + Realtime) · Anthropic Claude SDK (`@anthropic-ai/sdk`, modelo `claude-haiku-4-5`) · next-intl 4 · Vitest 4 · Playwright 1 · Vercel · Node ≥ 20

## APIs externas
| Tipo | API | Base URL | Auth |
|------|-----|----------|------|
| Movies+TV | TMDB | api.themoviedb.org/3 | `?api_key=TMDB_API_KEY` |
| Anime+Manga | Jikan v4 | api.jikan.moe/v4 | — |
| Books | Open Library | openlibrary.org | — |
| Comics | ComicVine | comicvine.gamespot.com/api | `?api_key=COMICVINE_KEY` (clave presente, sin handler — E6) |
| Manga | MangaDex | api.mangadex.org | — |
| Games | RAWG | api.rawg.io/api | `?key=RAWG_API_KEY` |
| AI | Anthropic Claude (`claude-haiku-4-5`) | api.anthropic.com | `ANTHROPIC_API_KEY` |

**Idioma:** TMDB→`language=es-ES` fallback `en-US` · Books (Open Library)→`language:<ISO-639-3>` cuando se filtra · resto inglés.

**Imágenes:**
- TMDB poster: `image.tmdb.org/t/p/w500{poster_path}`
- TMDB backdrop: `image.tmdb.org/t/p/w1280{backdrop_path}`
- TMDB logo: `image.tmdb.org/t/p/original{logo_path}`
- Books (Open Library): `covers.openlibrary.org/b/id/{cover_i}-L.jpg`
- MangaDex: `uploads.mangadex.org/covers/{manga_id}/{filename}`
- RAWG: `background_image`

**Tráilers:** TMDB `/movie/{id}/videos` · `/tv/{id}/videos` · Jikan `/anime/{id}/videos` → embed `youtube.com/embed/{key}`

## Env vars
```
TMDB_API_KEY=               # server-only
RAWG_API_KEY=               # server-only
GOOGLE_BOOKS_KEY=           # server-only — RETIRADO en E84c (libros → Open Library, sin auth). Sin uso en código.
COMICVINE_KEY=              # server-only — presente, sin uso en código actual (E6)
ANTHROPIC_API_KEY=          # server-only — Anthropic Claude (recomendaciones IA, claude-haiku-4-5)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # server-only
SUPABASE_TEST_URL=               # proyecto Supabase separado para tests de integración (kultura-test)
SUPABASE_TEST_ANON_KEY=          # anon key del proyecto kultura-test
SUPABASE_TEST_SERVICE_ROLE_KEY=  # service_role key — solo para migraciones/seed, nunca en código de app
NEXT_PUBLIC_SITE_URL=            # base URL pública (usada por SEO/og:url)
TEST_USER_EMAIL=                 # server-only — email usuario A para specs E2E (test-user-a@example.com)
TEST_USER_PASSWORD=              # server-only — password compartida usuarios A y B (seed B3.5e-2)
TEST_USER_B_EMAIL=               # server-only — email usuario B para flujos sociales E2E
TEST_GROUP_ID=                   # server-only — UUID del grupo seedeado (rellenar tras correr seed)
```

> **Nota:** estas claves NO deben aparecer en el repo. `.env.local` está en `.gitignore`. Producción → Vercel Environment Variables.
> Los nombres canónicos son sin prefijo `NEXT_PUBLIC_` para todo lo server-only (post-A4). Sincronizado con `.env.local` y Vercel.
>
> **`.env.test.local`** (no en git, cubierto por `.env*.local` en `.gitignore`): sobreescribe `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los valores de `kultura-test`. Usado exclusivamente por Playwright al arrancar el dev server para specs E2E — ver `playwright.config.ts` `webServer.env`. Desarrollo manual (`npm run dev`) sigue contra Supabase de producción.

## Comandos clave
```bash
npm run dev                                      # Dev server
npm run build                                    # Producción
tsc --noEmit                                     # Type check
npm run lint                                     # ESLint
vitest run                                       # Tests unitarios
vitest run -c vitest.integration.config.ts       # Integración (Supabase real)
vitest run -c vitest.contract.config.ts          # Contratos APIs externas
npx playwright test                              # E2E
```

## Estructura
```
src/app/[locale]/
  page.tsx · login/ · (app)/{home,discover,search,library,media/[type]/[id],
                       profile/[username],lists/[id],friends,notifications,
                       settings,suggestions,chat,groups/[id]}
src/app/api/
  ai-recommendations · auth/callback · chat · friends · genre-news ·
  groups · groups/[id]/join · library · lists · lists/[id] · notifications ·
  popular-in-circle · recommendations · reports · search · settings ·
  suggestions · users/search
src/components/
  ui/ · layout/ · media/ · home/ · library/ · profile/ · search/ · social/
src/lib/
  api/      tmdb · jikan · openlibrary · mangadex · rawg ·
            normalizer · search · genre-news
  claude/   recommendations
  supabase/ client · server
  library/  actions · queries · stats
  social/   actions · circle · feed · friends · lists · notifications
  utils/    auth-errors · index
  rate-limit.ts
src/i18n/   navigation · request · routing
src/middleware.ts
src/types/  library · list · media · supabase · user
messages/   es.json · en.json   (454 keys c/u)
supabase/migrations/
tests/{unit,integration,contract,e2e}/
```

## MediaItem (tipo normalizado)
```typescript
type MediaType = 'movie' | 'tv' | 'anime' | 'book' | 'comic' | 'manga' | 'game'

type MediaItem = {
  id: string              // "{type}_{external_id}"  e.g. "movie_550"
  externalId: string
  type: MediaType
  title: string
  originalTitle?: string
  poster?: string
  backdrop?: string
  year?: number
  synopsis?: string
  genres?: string[]
  rating?: number         // TMDB | MAL | Metacritic | ComicVine
  ratingSource?: string
  trailerKey?: string
  streamingProviders?: StreamingProvider[]
  metadata?: Record<string, any>
}
```

## DB Schema

> 17 tablas reales en producción. Schema completo en `supabase/migrations/20260502233945_remote_schema.sql` (baseline B2, verificada contra db_snapshot.txt el 2026-05-03). RLS activado en las 17 tablas (49 policies). Los tipos TypeScript correspondientes están en `src/types/supabase.ts`.

```sql
create table users (
  id uuid references auth.users primary key,
  username text unique not null,
  avatar_color text not null default '#E82020',
  avatar_initials text not null,
  bio text,                             -- biografía corta del usuario, mostrada en el perfil público
  preferred_locale text check (preferred_locale in ('es','en')),
  created_at timestamptz default now()
);
create table media (
  id text primary key,                  -- "{type}_{external_id}"
  external_id text not null, type text not null, title text not null,
  poster text, backdrop text, year int,
  synopsis text,                        -- añadido en migración 002 (histórica)
  metadata jsonb,
  updated_at timestamptz default now()
);
create table user_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  media_id text references media(id),
  status text not null check (status in ('completed','in_progress','pending','abandoned')),
  score smallint check (score between 1 and 5),
  watched_at date,
  episode_progress jsonb,               -- {season,episode}
  created_at timestamptz default now(),
  updated_at timestamptz default now(), -- mantenido por trigger set_updated_at
  unique(user_id, media_id)
);
create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references users(id) on delete cascade,
  receiver_id uuid references users(id) on delete cascade,
  status text not null check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  unique(requester_id, receiver_id)
);
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references users(id) on delete cascade,
  to_user_id uuid references users(id) on delete cascade,
  media_id text references media(id),
  message text, read_at timestamptz,
  created_at timestamptz default now()
);
create table lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  name text not null, media_type text not null,
  is_collaborative boolean default false,
  created_at timestamptz default now()
);
create table list_members (
  list_id uuid references lists(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  primary key(list_id, user_id)
);
create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references lists(id) on delete cascade,
  media_id text references media(id),
  added_by uuid references users(id),
  added_at timestamptz default now()
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null check (type in ('recommendation','list_invite')),
  payload jsonb not null, read_at timestamptz,
  created_at timestamptz default now()
);
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete cascade,
  target_type text not null check (target_type in ('user','media')),
  target_id text not null, reason text,
  created_at timestamptz default now()
);
```

### Tablas adicionales (SQL canónico confirmado en B2)

```sql
create table suggestions (                -- /api/suggestions
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  type text not null check (type in ('bug','feature','improvement','other')),
  subject text not null,                  -- 3..120 chars (Zod en endpoint)
  description text not null,             -- 10..2000 chars (Zod en endpoint)
  created_at timestamptz default now()
);
create table conversations (              -- DM 1-a-1 entre amigos
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  last_message_at timestamptz default now() -- actualizado por trigger handle_new_message
);
create table conversation_members (       -- pivot users ↔ conversations
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);
create table groups (                     -- /api/groups
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  name text not null,                     -- 2..60 chars (Zod en endpoint)
  description text,                       -- ≤200 chars (Zod en endpoint)
  cover_color text not null default '#E82020',
  created_at timestamptz default now()
);
create table group_members (              -- pivot users ↔ groups
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);
create table group_posts (                -- feed de un grupo
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  content text not null,
  media_id text references media(id),
  created_at timestamptz default now()
);
```

### Funciones trigger

4 funciones confirmadas en `supabase/migrations/20260502233945_remote_schema.sql`:

- `handle_new_user` — `AFTER INSERT ON auth.users`. Crea fila en `public.users`: deriva `username` del prefijo del email (limpio, truncado a 15 chars, sufijo numérico si duplicado), `avatar_initials` = `upper(left(username, 2))`, `avatar_color` = `'#E82020'`.
- `handle_new_group` — `AFTER INSERT ON groups`. Inserta al `owner_id` como miembro inicial en `group_members` con `role = 'owner'`.
- `handle_new_message` — `AFTER INSERT ON messages`. Actualiza `conversations.last_message_at = new.created_at`.
- `set_updated_at` — `BEFORE UPDATE ON user_media`. Mantiene `updated_at = now()`.

---

## Reglas técnicas innegociables

1. **`COMICVINE_KEY`, `GEMINI_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY`** → server-only. Nunca en `NEXT_PUBLIC_*`. Acceso solo vía Route Handlers.
1b. **Todo nuevo endpoint POST/PATCH/DELETE debe aplicar `checkRateLimit` antes de cualquier operación de BD o llamada a API externa.** Para endpoints que llaman a un LLM (Gemini, otros), límite estricto (≤10 req/min por usuario). Usar el sistema en `src/lib/rate-limit.ts`: añadir preset a `LIMITS`, aplicar patrón `const rl = checkRateLimit(key, LIMITS.x); if (!rl.allowed) return 429`.
2. **Toda respuesta de API externa pasa por `normalizer`** antes de llegar a componentes. Componentes solo conocen `MediaItem`.
3. **Cache de títulos en tabla `media`**: upsert antes de insertar en `user_media`. No llamar a APIs externas para títulos ya guardados.
4. **RLS activado en todas las tablas.** Cualquier tabla nueva se crea con policies en la misma migración.
5. **Un commit por tarea.** Mensaje: `[{ID}] {descripción}`.
6. **TypeScript estricto.** Sin `any` salvo `metadata: Record<string, any>` en MediaItem.
7. **Mobile-first** en todos los componentes.
8. **Nuevas dependencias se proponen antes de instalar.** No `npm install` silencioso.
9. **Sin `Co-Authored-By` en commits.** Los commits son del autor humano. La asistencia de IA es herramienta, no co-autoría. Si una plantilla o herramienta inserta el trailer automáticamente, eliminarlo antes del commit.
10. **Headers de seguridad: fuentes de verdad divididas.** Vercel gestiona HSTS (`max-age=63072000`, verificado 2026-05-03). `next.config.mjs` gestiona el resto: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Antes de añadir un header nuevo, verificar en DevTools de producción si Vercel ya lo añade.
11. **Verificación post-deploy NO se limita a headers HTTP, status codes y logs.** Incluye obligatoriamente un paso de uso funcional: abrir la app desplegada, navegar por las secciones principales (auth, biblioteca, feed, chat, grupos, perfil) e intentar las acciones críticas. Si algo falla visualmente o falta una sección, reportarlo aunque los headers y los tests estén verdes.
12. **Leer [`docs/DEBUG_PRINCIPLES.md`](docs/DEBUG_PRINCIPLES.md) antes de diagnosticar o tocar cualquier pantalla.** Formaliza cuatro principios recurrentes: verificar estado real (no mensajes de herramienta ni docs viejos), no fiar de NOW.md como fuente de verdad, diagnosticar la raíz antes de escribir código, y revisar explícitamente pantallas de borde (login, landing, errores, rutas públicas) al cerrar cualquier sprint de migración o rediseño.

---

## Estado del proyecto

Hay un `AUDIT.md` con el estado real del codebase y los gaps abiertos. El BACKLOG actual deriva de ese audit. Las fases originales (Fundación → APIs → Biblioteca → Social → IA → Pulido) están **completadas o en pulido**; el trabajo abierto es **hardening de seguridad, infra y producción**, ordenado en `docs/BACKLOG.md`.
