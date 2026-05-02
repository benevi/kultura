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

Next.js 14 App Router · React 18 · TypeScript strict · Tailwind CSS 3 · Supabase (PG + Auth + RLS + Realtime) · Anthropic SDK (Claude `claude-sonnet-4-6`) · next-intl 4 · Vitest 4 · Playwright 1 · Vercel · Node ≥ 20

## APIs externas
| Tipo | API | Base URL | Auth |
|------|-----|----------|------|
| Movies+TV | TMDB | api.themoviedb.org/3 | `?api_key=TMDB_API_KEY` |
| Anime+Manga | Jikan v4 | api.jikan.moe/v4 | — |
| Books | Google Books | googleapis.com/books/v1 | `?key=GOOGLE_BOOKS_KEY` |
| Books fallback | Open Library | openlibrary.org | — |
| Comics | ComicVine | comicvine.gamespot.com/api | `?api_key=COMICVINE_KEY` (clave presente, sin handler — E6) |
| Manga | MangaDex | api.mangadex.org | — |
| Games | RAWG | api.rawg.io/api | `?key=RAWG_API_KEY` |
| AI | Claude | api.anthropic.com/v1 | Bearer `ANTHROPIC_API_KEY` |

**Idioma:** TMDB→`language=es-ES` fallback `en-US` · Books→`langRestrict=es` · resto inglés.

**Imágenes:**
- TMDB poster: `image.tmdb.org/t/p/w500{poster_path}`
- TMDB backdrop: `image.tmdb.org/t/p/w1280{backdrop_path}`
- TMDB logo: `image.tmdb.org/t/p/original{logo_path}`
- Books: `volumeInfo.imageLinks.thumbnail`
- MangaDex: `uploads.mangadex.org/covers/{manga_id}/{filename}`
- RAWG: `background_image`

**Tráilers:** TMDB `/movie/{id}/videos` · `/tv/{id}/videos` · Jikan `/anime/{id}/videos` → embed `youtube.com/embed/{key}`

## Env vars
```
TMDB_API_KEY=               # server-only
RAWG_API_KEY=               # server-only
GOOGLE_BOOKS_KEY=           # server-only
COMICVINE_KEY=              # server-only — presente, sin uso en código actual (E6)
ANTHROPIC_API_KEY=          # server-only
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # server-only
SUPABASE_TEST_URL=          # proyecto Supabase separado para tests de integración
SUPABASE_TEST_ANON_KEY=
NEXT_PUBLIC_SITE_URL=       # base URL pública (usada por SEO/og:url)
```

> **Nota:** estas claves NO deben aparecer en el repo. `.env.local` está en `.gitignore`. Producción → Vercel Environment Variables.
> Los nombres canónicos son sin prefijo `NEXT_PUBLIC_` para todo lo server-only (post-A4). Sincronizado con `.env.local` y Vercel.

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
  api/      tmdb · jikan · googlebooks · openlibrary · mangadex · rawg ·
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

> 17 tablas reales en producción. 10 documentadas a continuación con su SQL canónico (derivado del código + tipos en `src/types/supabase.ts`); 7 más solo descritas a alto nivel y marcadas `[POR VERIFICAR EN B2]` porque el SQL exacto vive en el dashboard remoto y `supabase/migrations/` está pendiente de recuperar (ver B2 / B2-DOC). RLS activado en todas (49 policies según baseline B2).

```sql
create table users (
  id uuid references auth.users primary key,
  username text unique not null,
  avatar_color text not null default '#E82020',
  avatar_initials text not null,
  preferred_locale text,                -- añadido en migración 010 (histórica)
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

### Tablas adicionales — documentación a alto nivel `[POR VERIFICAR EN B2]`

Estas 7 tablas existen en producción y son consumidas por el código, pero su SQL exacto (constraints, defaults, índices, RLS policies) está pendiente de recuperar. Lo aquí descrito está **derivado de los tipos ad-hoc inline** (`as unknown as Array<{...}>`) en los Route Handlers que las leen. El detalle completo se confirmará en B2.

```text
suggestions                 -- /api/suggestions
  user_id uuid FK → users(id)
  type    text — enum 'bug' | 'feature' | 'improvement' | 'other'
  subject text — 3..120 chars (Zod en endpoint)
  description text — 10..2000 chars
  created_at timestamptz   [POR VERIFICAR EN B2]

conversations               -- /api/chat (DM 1-a-1 entre amigos)
  id              uuid PK
  last_message_at timestamptz   [POR VERIFICAR EN B2]

conversation_members        -- pivot users ↔ conversations
  conversation_id uuid FK → conversations(id)
  user_id         uuid FK → users(id)
  last_read_at    timestamptz | null
  PK (conversation_id, user_id)   [POR VERIFICAR EN B2]

messages                    -- mensajes dentro de una conversación
  id              uuid PK
  conversation_id uuid FK → conversations(id) on delete cascade
  sender_id       uuid FK → users(id)
  content         text
  created_at      timestamptz   [POR VERIFICAR EN B2]

groups                      -- /api/groups
  id           uuid PK
  owner_id     uuid FK → users(id)
  name         text — 2..60 chars
  description  text | null — ≤200 chars
  cover_color  text — formato hex `#RRGGBB` (default '#E82020')
  created_at   timestamptz   [POR VERIFICAR EN B2]

group_members               -- pivot users ↔ groups
  group_id  uuid FK → groups(id)
  user_id   uuid FK → users(id)
  role      text — `Inferido:` enum 'owner' | 'admin' | 'member'
  joined_at timestamptz
  PK (group_id, user_id)   [POR VERIFICAR EN B2]

group_posts                 -- feed dentro de un grupo (consumido por components/social/GroupFeed)
  -- columnas exactas no derivables del código actual.   [POR VERIFICAR EN B2]
```

### Funciones trigger `[POR VERIFICAR EN B2]`

4 funciones presentes en producción según baseline B2. SQL exacto pendiente de capturar (`docs/SESSION_2026-05-02.md`):

- `handle_new_user` — `Inferido:` se dispara al crear fila en `auth.users` y crea la fila correspondiente en `public.users` (avatar_color/avatar_initials por defecto).
- `handle_new_group` — `Inferido:` al crear `groups`, inserta al `owner_id` como miembro inicial en `group_members` (rol `owner`).
- `handle_new_message` — `Inferido:` al insertar en `messages`, actualiza `conversations.last_message_at`.
- `set_updated_at` — trigger genérico `BEFORE UPDATE` que mantiene la columna `updated_at` (ver `user_media`).

> El schema completo (incluyendo RLS policies y SQL exacto de las 7 tablas + 4 funciones) debe vivir en `supabase/migrations/`. Tarea **B2** del backlog (recuperar el `db pull` desaparecido) y **B2-DOC** (sustituir aquí los `[POR VERIFICAR EN B2]` por el SQL canónico).

---

## Reglas técnicas innegociables

1. **`COMICVINE_KEY`, `ANTHROPIC_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY`** → server-only. Nunca en `NEXT_PUBLIC_*`. Acceso solo vía Route Handlers.
2. **Toda respuesta de API externa pasa por `normalizer`** antes de llegar a componentes. Componentes solo conocen `MediaItem`.
3. **Cache de títulos en tabla `media`**: upsert antes de insertar en `user_media`. No llamar a APIs externas para títulos ya guardados.
4. **RLS activado en todas las tablas.** Cualquier tabla nueva se crea con policies en la misma migración.
5. **Un commit por tarea.** Mensaje: `[{ID}] {descripción}`.
6. **TypeScript estricto.** Sin `any` salvo `metadata: Record<string, any>` en MediaItem.
7. **Mobile-first** en todos los componentes.
8. **Nuevas dependencias se proponen antes de instalar.** No `npm install` silencioso.
9. **Sin `Co-Authored-By` en commits.** Los commits son del autor humano. La asistencia de IA es herramienta, no co-autoría. Si una plantilla o herramienta inserta el trailer automáticamente, eliminarlo antes del commit.

---

## Estado del proyecto

Hay un `AUDIT.md` con el estado real del codebase y los gaps abiertos. El BACKLOG actual deriva de ese audit. Las fases originales (Fundación → APIs → Biblioteca → Social → IA → Pulido) están **completadas o en pulido**; el trabajo abierto es **hardening de seguridad, infra y producción**, ordenado en `docs/BACKLOG.md`.
