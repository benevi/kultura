# KULTURA — CLAUDE.md

Web app de descubrimiento cultural (películas, series, anime, libros, cómics, manga, videojuegos). Biblioteca personal, amigos, listas, recomendaciones IA.

---

## ⚡ Flujo de trabajo (LEER PRIMERO)

### Objetivo del proyecto (la vara de medir todo lo demás)

Kultura tiene que llegar a un nivel de calidad técnica y sensorial que aguante comparación con apps con equipo de producto y diseño dedicados, con vistas a monetizar. Toda decisión — qué construir, en qué orden, cuánto pulir un detalle, si vale la pena una dependencia nueva — se evalúa contra esto: ¿esto acerca la app a "espectacular" (se ve y se siente premium, fluida, coherente) o es solo "funciona"? Ante la duda entre lo rápido y lo excelente, por defecto se elige excelente, salvo que el propio usuario indique lo contrario.

**Autonomía total dentro de ese objetivo.** Libertad para decidir qué se construye y en qué orden, re-priorizar `docs/BACKLOG.md`, encadenar tareas sin pedir confirmación en cada cierre, y expandir el alcance de una tarea cuando sirve directamente a la calidad del resultado (dejando constancia del porqué en el commit/DONE, no pidiendo permiso primero). Pedir confirmación solo ante:
- decisiones genuinamente irreversibles o de alto impacto (borrar datos, tocar producción fuera del flujo normal de PR, un cambio de dirección de marca entre opciones igual de válidas),
- ambigüedad real donde el criterio del usuario pesa más que el propio (p. ej. dos direcciones de diseño igual de defendibles),
- lo que ya exige el protocolo de git/PR de la sesión (fusionar una PR, push directo a una rama protegida) — eso sigue requiriendo autorización explícita, es una capa aparte de este archivo.

**Paralelización.** Cuando haya trabajo independiente — rediseñar varias pantallas sin dependencias entre sí, escribir tests mientras se implementa otra pieza, investigar mientras avanza otra tarea — lanzar varios agentes en paralelo (herramienta Agent) en vez de secuenciar por costumbre.

**`docs/NOW.md` / `docs/BACKLOG.md` son memoria del proyecto, no una jaula.** Siguen sirviendo para que cualquier sesión (o el propio usuario) entienda qué se hizo, por qué y qué queda — pero ya no imponen "una tarea, cerrar, parar y pedir permiso" en cada ciclo. Se pueden cerrar varias tareas seguidas, reordenar el backlog, o trabajar varias líneas en paralelo, si eso lleva antes al objetivo.

**Criterio binario de hecho (se mantiene).** Al terminar cualquier tarea: ejecutar los comandos de verificación reales y pegar el output. "Debería funcionar" no cierra nada. Para cambios visuales/UI, verificación real significa además abrir la app (dev server o build) y mirarla — capturas si hace falta —, no solo tests en verde.

**Cierre de tarea:**
1. Verificar (output real pegado; captura si es visual).
2. `git commit` con mensaje `[{ID}] {descripción}`.
3. Añadir línea a `docs/DONE.md` con fecha + ID + hash.
4. Marcar `[x]` en `docs/BACKLOG.md`.
5. Seguir con la siguiente pieza de trabajo (misma línea u otra, o en paralelo) sin esperar confirmación — salvo que quede genuinamente bloqueado o toque uno de los puntos de la lista de arriba.

### Reglas de emergencia
- **Bug en tarea anterior:** detener la actual, crear `{ID}-FIX`, arreglar, verificar, retomar.
- **Dependencia bloqueante:** anotar en `docs/BLOCKERS.md` y proponer alternativa antes de seguir.
- **Tarea demasiado grande:** partirla en `{ID}-A`, `{ID}-B` en BACKLOG y seguir por la primera, sin parar a pedir permiso.
- **Test imposible (caso edge real):** documentar en `docs/TEST_EXCEPTIONS.md` con justificación. No skipear silenciosamente.

---

## Stack

Next.js 14 App Router · React 18 · TypeScript strict · Tailwind CSS 3 · Supabase (PG + Auth + RLS + Realtime) · Anthropic Claude SDK (`@anthropic-ai/sdk`, modelo `claude-haiku-4-5`) · next-intl 4 · Vitest 4 · Playwright 1 · Vercel · Node ≥ 22

## APIs externas
| Tipo | API | Base URL | Auth |
|------|-----|----------|------|
| Movies+TV | TMDB | api.themoviedb.org/3 | `?api_key=TMDB_API_KEY` |
| Anime+Manga | Jikan v4 (MyAnimeList) | api.jikan.moe/v4 | — · **sirve hoy anime Y manga** |
| Books | **Google Books** | www.googleapis.com/books/v1 | `?key=GOOGLE_BOOKS_KEY` (opcional; sin key la cuota anónima por IP puede ser 0 → 429) |
| Books (legacy) | Open Library | openlibrary.org | — (solo fichas de ids `book_OL…` ya guardados) |
| Comics | ComicVine | comicvine.gamespot.com/api | `?api_key=COMICVINE_KEY` — **implementado y en uso** (`src/lib/api/comicvine.ts` + `comicvine-maps.ts`: Descubrir, búsqueda y ficha) |
| Manga (preparado, no en pipeline) | MangaDex | api.mangadex.org | — · cliente localizado pero NO enchufado: la familia manga la sirve Jikan → **E-MANGA-SOURCE** |
| Games | RAWG (Descubrir/listados/paginación) | api.rawg.io/api | `?key=RAWG_API_KEY` |
| Games — detalle | **Steam Store** (enriquece la ficha: precio, capturas, idiomas) | store.steampowered.com/api | — (sin key) · solo `/media/game/{id}`, degrada en silencio |
| AI | Anthropic Claude (`claude-haiku-4-5`) | api.anthropic.com | `ANTHROPIC_API_KEY` |

**Idioma:** derivado del **locale activo** (`es`/`en`) — fuente única: `src/lib/api/locale.ts`. El locale se resuelve en el borde (`getLocale()` en `/api/discover`, `/api/search`, `/api/genre-news`; `params.locale` en `/[locale]/media/...`) y viaja como parámetro explícito hasta cada cliente de API.
- TMDB → `language=es-ES | en-US` (+ `region=ES|US` en `watch/providers`)
- Google Books → `langRestrict=es | en` (el trigger `idioma` de Descubrir lo sobreescribe)
- MangaDex → `availableTranslatedLanguage[]=es,es-la,en | en` + texto elegido con `pickLocalizedText`
- **Jikan (anime/manga) → inglés/japonés únicamente. Limitación aceptada:** no existe API gratuita de anime con traducción ES completa.
- **ComicVine (cómics) → inglés únicamente. Limitación aceptada:** sin alternativa con catálogo ES.
- RAWG (juegos) → inglés; la ficha se enriquece con Steam (`l=spanish|english`).

**Imágenes:**
- TMDB poster: `image.tmdb.org/t/p/w500{poster_path}`
- TMDB backdrop: `image.tmdb.org/t/p/w1280{backdrop_path}`
- TMDB logo: `image.tmdb.org/t/p/original{logo_path}`
- Books (Google Books): `imageLinks` del volumen, normalizado a https + `zoom=1` (`googleBooksCover`)
- Books legacy (Open Library): `covers.openlibrary.org/b/id/{cover_i}-L.jpg`
- MangaDex: `uploads.mangadex.org/covers/{manga_id}/{filename}`
- RAWG: `background_image`
- Steam (capturas de la ficha de juego): `path_thumbnail` / `path_full` (`*.steamstatic.com`, `shared.akamaihd.net`)

**Tráilers:** TMDB `/movie/{id}/videos` · `/tv/{id}/videos` · Jikan `/anime/{id}/videos` → embed `youtube.com/embed/{key}`

## Env vars
```
TMDB_API_KEY=               # server-only
RAWG_API_KEY=               # server-only
GOOGLE_BOOKS_KEY=           # server-only — OPCIONAL, REACTIVADO en E-BOOKS-GOOGLE (libros → Google Books).
                            # La API responde sin key, pero su cuota anónima va por IP y suele estar a 0 en cloud → ponerla en producción.
COMICVINE_KEY=              # server-only — EN USO (cómics: Descubrir/búsqueda/ficha). Sin ella, `getKey()` lanza y la familia cómic queda vacía;
                            # el resto de la app no se ve afectada.
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
> **`.env.test.local`** (no en git, cubierto por `.env*.local` en `.gitignore`): sobreescribe `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los valores de `kultura-test`. Usado por Playwright al arrancar el dev server para specs E2E — ver `playwright.config.ts` `webServer.env`.
>
> **`.env.development.local`** (no en git): EXISTE en `kultura/` y Next.js lo carga con **prioridad sobre `.env.local`** en modo dev. Contiene las credenciales de `kultura-test` (proyecto `xqvicvypoxxfbezqnkwr`) → **`npm run dev` pega contra la BD de TEST, NO contra producción.** Motivo: aislar el desarrollo manual de los datos reales de producción.
> ⚠️ Si necesitas dev contra producción, renombra o elimina temporalmente `.env.development.local` (y restáuralo al terminar).

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
  api/      tmdb · jikan · googlebooks · openlibrary (legacy) · mangadex ·
            rawg · comicvine · locale · normalizer · search · discover ·
            aggregate · genre-news
  claude/   recommendations
  supabase/ client · server
  library/  actions · queries · stats
  social/   actions · circle · feed · friends · lists · notifications
  utils/    auth-errors · index
  rate-limit.ts
src/i18n/   navigation · request · routing
src/middleware.ts
src/types/  library · list · media · supabase · user
messages/   es.json · en.json   (596 keys c/u — recontadas 2026-09-12)
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

> **18 tablas** reales en producción. Baseline (17 tablas, 49 policies) en `supabase/migrations/20260502233945_remote_schema.sql` (verificada contra db_snapshot.txt el 2026-05-03); la 18ª es `group_invitations` (migración `20260601000002`). RLS activado en las 18 tablas, **53 policies** vigentes tras aplicar las 14 migraciones (recuento del audit de E98, 2026-07-16). Los tipos TypeScript correspondientes están en `src/types/supabase.ts`.
> Las tablas listadas abajo son el SQL canónico de la baseline; `group_invitations` no aparece en el bloque (ver su migración).

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

1. **`COMICVINE_KEY`, `ANTHROPIC_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY`** → server-only. Nunca en `NEXT_PUBLIC_*`. Acceso solo vía Route Handlers.
1b. **Todo nuevo endpoint POST/PATCH/DELETE debe aplicar `checkRateLimit` antes de cualquier operación de BD o llamada a API externa.** Para endpoints que llaman a un LLM (Anthropic Claude, otros), límite estricto (≤10 req/min por usuario). Usar el sistema en `src/lib/rate-limit.ts`: añadir preset a `LIMITS`, aplicar patrón `const rl = checkRateLimit(key, LIMITS.x); if (!rl.allowed) return 429`.
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
13. **Ningún cambio visual/UI se da por hecho solo con tests en verde.** Antes de cerrar la tarea: levantar el dev server, navegar la pantalla afectada en mobile y desktop, y comprobar que se ve y se siente a la altura del objetivo del proyecto (arriba). Si algo desentona (espaciado, contraste, animación brusca, inconsistencia con el resto del sistema visual), es parte de la tarea arreglarlo antes de cerrar, no un ticket nuevo para el BACKLOG.

---

## Estado del proyecto

Hay un `AUDIT.md` con el estado real del codebase y los gaps abiertos. El BACKLOG actual deriva de ese audit. Las fases originales (Fundación → APIs → Biblioteca → Social → IA → Pulido) están **completadas o en pulido**; el trabajo abierto es **hardening de seguridad, infra y producción**, ordenado en `docs/BACKLOG.md`.
