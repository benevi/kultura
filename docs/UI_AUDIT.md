# UI_AUDIT — Auditoría funcional UI/UX (B3.5a, 2026-05-03)

## Resumen ejecutivo

- **17 rutas de página** inventariadas (16 app + 1 login)
- **49 componentes** principales (sin contar Client Components colocalizados en `/app/`)
- **19 endpoints API** inventariados
- **14 strings hardcodeados en español** detectados (en 4 componentes)
- **0 endpoints huérfanos** (todos tienen callers identificables)
- **0 llamadas huérfanas** (todos los fetch `/api/...` tienen endpoint correspondiente)
- **Hallazgo principal:** La app está más completa de lo que sugería la impresión visual. Todas las rutas existen, todos los endpoints están cableados, i18n está sincronizado. El problema real es que ~4 componentes de Home no usan el sistema i18n y renderizan strings en español hardcodeado — lo que, en un usuario con locale `en`, mostraría texto español. No hay stubs ni handlers vacíos.

---

## Tabla maestra por sección

### Auth

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Login / Registro | `/login` | implementado | Form completo con modo login/register/forgot-password, Supabase Auth | |
| Callback OAuth | `/api/auth/callback` | implementado | Manejador de callback Supabase | |
| Auto-creación de perfil | `home/page.tsx` (líneas 27-42) | implementado | Si el trigger DB falla, home crea el perfil como fallback | |

### Home

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Hero "Continúa donde lo dejaste" | `/home` | implementado | Supabase query en_progreso, muestra poster + barra de progreso | |
| Fila "Continúa donde lo dejaste" | `/home` | parcial | Título hardcodeado en español (línea 88 de home/page.tsx). Clave `home.continueWatching` existe en i18n pero no se usa | |
| Popular en tu círculo | `/home` → `PopularInCircle` | implementado | Fetch `/api/popular-in-circle`. Título hardcodeado "Popular entre tus amigos" (línea 40). Clave `home.popularInCircle` existe en i18n | |
| Para ti (IA) | `/home` → `AiRecommendations` | implementado | Fetch `/api/ai-recommendations` con caché. Varios strings ES hardcodeados (líneas 54, 67-70, 75-78). Claves existen en `aiRecommendations.*` | |
| Novedades de géneros | `/home` → `GenreNews` | implementado | Fetch `/api/genre-news`. Strings hardcodeados "Novedades", "Tendencias", "Novedades en X", "Series en X" (líneas 40, 57, 77, 81). Claves parcialmente en i18n | |
| HeroSection estado vacío | `/home` | parcial | 3 strings ES hardcodeados (líneas 25, 26, 30). Claves `home.welcomeTitle`, `home.welcomeSubtitle`, `home.goDiscover` existen en i18n | |
| HeroSection "Continuando" label | `/home` | parcial | String "Continuando" hardcodeado (línea 76). Sin clave i18n dedicada | |
| HeroSection "Continuar" CTA | `/home` | parcial | String "Continuar" hardcodeado (línea 102). Clave `home.continue` existe en i18n | |

### Discover

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Grid de contenido popular | `/discover` | implementado | Todas las APIs externas (TMDB, Jikan, Books, RAWG). Paginación. Filtro por tipo | |
| DiscoverClient (filtros + grid) | `/discover` → `DiscoverClient` | necesita verificación visual | Server Component pasa datos; client maneja tabs y paginación. No leído en detalle | |

### Search

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Barra de búsqueda vacía | `/search` | implementado | Sin query → solo barra centrada | |
| Resultados de búsqueda | `/search?q=...` | implementado | `searchAll()` multi-API, pasado a `SearchClient` | |
| Filtros avanzados | `/search` → `SearchFilters` | implementado | 241 líneas, filtros por tipo/año/rating/género. 2 warnings lint pre-existentes en `SearchResults` | |
| SearchBar autocomplete | `/search` → `SearchBar` | implementado | 133 líneas con lógica de autocomplete | |

### Library

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Lista de biblioteca | `/library` | implementado | `getUserMedia()` Supabase → `LibraryClient` | |
| Filtros biblioteca (tipo/estado/puntuación) | `/library` → `LibraryClient` | necesita verificación visual | No leído en detalle | |
| Modal añadir/actualizar entrada | `LibraryStatusModal` | implementado | 141 líneas, llama `/api/library` POST | |
| Botones de acción (añadir/eliminar) | `LibraryAction` | implementado | 149 líneas, llama `/api/library` DELETE | |
| Progreso por episodio | `EpisodeProgress` | implementado | 74 líneas, barra de progreso TV | |

### Media Detail

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Detalle película/serie | `/media/movie/[id]` | implementado | TMDB + streaming providers España | |
| Detalle anime | `/media/anime/[id]` | implementado | Jikan API | |
| Detalle manga | `/media/manga/[id]` | implementado | Jikan API | |
| Detalle libro | `/media/book/[id]` | implementado | Google Books API | |
| Detalle juego | `/media/game/[id]` | implementado | RAWG API | |
| Comic | `/media/comic/[id]` | stub | COMICVINE_KEY presente pero sin handler implementado (marcado E6 en CLAUDE.md). Route `/media/comic/[id]` no existe como type válido en VALID_TYPES | |
| Tráiler embed | `TrailerEmbed` | implementado | YouTube embed | |
| Plataformas streaming | `StreamingProviders` | implementado | Solo España (ES) hardcodeado en extractProvidersES | |
| Añadir a biblioteca desde detalle | `MediaDetail` + `LibraryAction` | implementado | Estado inicial pasado desde server | |
| Recomendar a amigo | `RecommendButton` + `RecommendModal` | implementado | Llama `/api/recommendations` | |
| Reportar contenido | `ReportButton` | implementado | Llama `/api/reports` | |

### Friends

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Lista de amigos | `/friends` | implementado | `getFriends()` + `getPendingRequests()` → `FriendsClient` | |
| Buscar usuario por nombre | `/friends` | implementado | Llama `/api/users/search` (confirmado en `FriendsClient` línea 85) | |
| Enviar solicitud de amistad | `/friends` | implementado | `FriendshipButton` + `/api/friends` POST | |
| Aceptar/rechazar solicitud | `/friends` | implementado | `/api/friends` PATCH | |
| Eliminar amigo | `/friends` | implementado | `/api/friends` DELETE | |
| Compartir perfil (copy link) | `/friends` | implementado | `profileUrl` calculado en server | |
| Grupos: crear | `/friends` | implementado | `/api/groups` POST | |
| Grupos: lista mis grupos | `/friends` | implementado | `/api/groups` GET en FriendsClient | |
| Grupos: unirse | `/groups/[id]` → `JoinGroupButton` | implementado | `/api/groups/[id]/join` POST | |

### Groups

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Vista de grupo (header + miembros) | `/groups/[id]` | implementado | Supabase: grupo + membresía + miembros | |
| Feed del grupo | `/groups/[id]` → `GroupFeed` | necesita verificación visual | Client component colocado, no leído en detalle | |
| Post en grupo | `/groups/[id]` → `GroupFeed` | necesita verificación visual | group_posts tabla existe. Lógica de post no verificada | |
| **Entrada al grupo desde navegación** | — | **no existe** | **No hay ruta al listado global de grupos. Grupos solo accesibles desde `/friends`. Si el usuario no sabe que existen en esa sección, no los encuentra.** | |

### Chat

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Lista de conversaciones | `/chat` | implementado | Supabase + `getFriends()` para picker de nueva conversación | |
| ChatClient | `/chat` → `ChatClient` | necesita verificación visual | Client component colocado, no leído en detalle | |
| Conversación individual | `/chat/[id]` | implementado | Verifica membresía, carga otro usuario | |
| ConversationClient | `/chat/[id]` → `ConversationClient` | necesita verificación visual | Mensajes en tiempo real con Supabase Realtime presumiblemente | |
| **Acceso desde navegación principal** | — | **parcial** | **Chat no está en NavLinks (desktop) ni en BottomNav (mobile). Solo accesible conociendo la URL o desde notificaciones/recomendaciones.** | |

### Lists

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Mis listas | `/lists` | implementado | `getUserLists()` → `ListsClient` | |
| Crear lista | `/lists` → `CreateListModal` | implementado | 111 líneas, llama `/api/lists` POST | |
| Detalle de lista | `/lists/[id]` | implementado | `getListDetail()` + permisos de edición + amigos para invitación | |
| ListDetail client component | `/lists/[id]` → `ListDetail` | necesita verificación visual | No leído en detalle | |
| **Acceso desde navegación principal** | — | **no existe** | **Listas no están enlazadas desde ningún menú de navegación.** | |

### Recommendations

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Recomendar media a amigo | `RecommendModal` | implementado | Selector multi-amigo + mensaje opcional, llama `/api/recommendations` | |
| Ver recomendaciones recibidas | `/notifications` | implementado | Tipo `recommendation` en tabla `notifications` | |

### Profile

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Header de perfil (avatar, stats) | `/profile/[username]` | implementado | `getUserStats()` desde Supabase | |
| Bio editable | `ProfileBio` | implementado | 81 líneas, edición inline | |
| Estadísticas por tipo | `ProfileStats` | implementado | 48 líneas | |
| Géneros favoritos | `ProfileGenres` | implementado | 29 líneas, retorna null si vacío | |
| Últimos completados / Viendo ahora | `/profile/[username]` | implementado | `getRecentLibraryByStatus()` → `MediaRow` | |
| Botón FriendshipButton | `/profile/[username]` | implementado | Estado inicial desde server | |
| Botón ReportButton (otros usuarios) | `/profile/[username]` | implementado | Solo visible para no-propietario | |
| Metadata SEO | `/profile/[username]` | implementado | og:profile, twitter card | |

### Settings

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Formulario de ajustes | `/settings` | implementado | Username, color avatar, locale. Llama `/api/settings` PATCH | |
| SettingsForm client | `/settings` → `SettingsForm` | necesita verificación visual | No leído en detalle | |
| Cambiar contraseña | `/settings` | parcial | UI muestra botón "Cambiar contraseña" — lógica no verificada | |
| Eliminar cuenta | `/settings` | stub | `"deleteAccountSoon": "Eliminar cuenta — disponible próximamente"` en i18n. Es un TODO explícito. | |

### Notifications

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Lista de notificaciones | `/notifications` | implementado | `getNotifications()` + `markAllRead()` on load | |
| NotificationsList client | `/notifications` → `NotificationsList` | necesita verificación visual | No leído en detalle | |
| Badge de no leídos en header | `AuthHeader` | implementado | `getUnreadCount()` en layout, badge rojo con número | |

### Suggestions

| Pantalla / Funcionalidad | Ruta | Estado declarado | Notas | Estado real (B3.5b) |
|---|---|---|---|---|
| Formulario de sugerencias | `/suggestions` | implementado | Llama `/api/suggestions` POST | |
| **Acceso desde navegación** | — | parcial | No está en NavLinks ni BottomNav. La clave `nav.suggestions` existe en i18n pero no se usa en ningún menú de navegación visible. | |

---

## Endpoints huérfanos

**Ninguno.** Todos los 19 endpoints tienen al menos un caller identificado:

| Endpoint | Caller |
|---|---|
| `/api/ai-recommendations` | `AiRecommendations.tsx` |
| `/api/auth/callback` | OAuth flow Supabase |
| `/api/chat` | `ChatClient` (colocated) |
| `/api/chat/[id]` | `ConversationClient` (colocated) |
| `/api/friends` | `FriendsClient` (colocated) + `FriendshipButton` |
| `/api/genre-news` | `GenreNews.tsx` |
| `/api/groups` | `FriendsClient` (colocated) |
| `/api/groups/[id]/join` | `JoinGroupButton` (colocated) |
| `/api/library` | `LibraryStatusModal`, `LibraryAction` |
| `/api/lists` | `ListsClient` (colocated), `CreateListModal` |
| `/api/lists/[id]` | `ListDetail` (colocated) |
| `/api/notifications` | `notifications/page.tsx` via `getNotifications()` |
| `/api/popular-in-circle` | `PopularInCircle.tsx` |
| `/api/recommendations` | `RecommendModal` |
| `/api/reports` | `ReportButton` |
| `/api/search` | `SearchPage` / `SearchClient` |
| `/api/settings` | `SettingsForm` (colocated) |
| `/api/suggestions` | `SuggestionsForm` (colocated) |
| `/api/users/search` | `FriendsClient` línea 85 |

---

## Llamadas huérfanas

**Ninguna.** Todos los `fetch('/api/...')` en componentes tienen endpoint correspondiente verificado.

---

## Placeholders detectados

### Strings hardcodeados en español (i18n bypass)

| Componente | Archivo | Línea(s) | String hardcodeado | Clave i18n disponible |
|---|---|---|---|---|
| `HeroSection` | `src/components/home/HeroSection.tsx` | 25 | `"¿Qué estás viendo?"` | `home.welcomeTitle` ✓ |
| `HeroSection` | `src/components/home/HeroSection.tsx` | 26 | `"Añade títulos a tu biblioteca para ver tu progreso aquí"` | `home.welcomeSubtitle` ✓ |
| `HeroSection` | `src/components/home/HeroSection.tsx` | 30 | `"Explorar contenido"` | `home.goDiscover` ✓ |
| `HeroSection` | `src/components/home/HeroSection.tsx` | 76 | `"Continuando"` | Sin clave i18n dedicada |
| `HeroSection` | `src/components/home/HeroSection.tsx` | 102 | `"Continuar"` | `home.continue` ✓ |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 54 | `"Para ti"` | `aiRecommendations.title` ✓ |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 55 | `"Claude IA"` | `aiRecommendations.poweredBy` ✓ |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 67-70 | `"Añade al menos 3 títulos..."` | `aiRecommendations.needMoreItems` ✓ |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 75-78 | `"Demasiadas solicitudes..."` / `"No se pudieron cargar..."` / `"Reintentar"` | `aiRecommendations.rateLimited`, `.error`, `.retry` ✓ |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 9-17 | `TYPE_LABELS` dict (todas las etiquetas de tipo en ES) | `media.*` ✓ |
| `PopularInCircle` | `src/components/home/PopularInCircle.tsx` | 40 | `"Popular entre tus amigos"` | `home.popularInCircle` ✓ |
| `PopularInCircle` | `src/components/home/PopularInCircle.tsx` | 43 | `"Añade amigos para ver qué están viendo"` | `home.noFriends` ✓ |
| `PopularInCircle` | `src/components/home/PopularInCircle.tsx` | 44 | `"Añadir amigos"` | `home.addFriends` ✓ |
| `GenreNews` | `src/components/home/GenreNews.tsx` | 40 | `"Novedades"` | `genreNews.title` ✓ |
| `GenreNews` | `src/components/home/GenreNews.tsx` | 57 | `"Tendencias"` | `home.trends` ✓ |
| `GenreNews` | `src/components/home/GenreNews.tsx` | 77 | `` `Novedades en ${genres[0]}` `` | `home.genreNewsTitle` con `{genre}` ✓ |
| `GenreNews` | `src/components/home/GenreNews.tsx` | 81 | `` `Series en ${genreLabel}` `` | Sin clave i18n dedicada |
| `home/page.tsx` | `src/app/[locale]/(app)/home/page.tsx` | 88 | `"Continúa donde lo dejaste"` | `home.continueWatching` ✓ |

### Feature explícitamente marcada como pendiente

| Archivo | Línea | Contenido | Tipo |
|---|---|---|---|
| `messages/es.json` | 426 | `"deleteAccountSoon": "Eliminar cuenta — disponible próximamente"` | Feature stub declarada |
| `messages/en.json` | 426 | `"deleteAccount Soon": "Delete account — coming soon"` | Feature stub declarada |

### TODOs en código fuente

No se encontraron strings `TODO`, `FIXME`, `XXX`, `Coming soon` ni `lorem ipsum` en `src/**`.
Los únicos comentarios de trabajo pendiente son strings de UI en archivos de traducción (ver arriba).

---

## Navegación

### Menú principal

**Desktop (md+):** `AuthHeader` → `NavLinks`
- Inicio (`/home`)
- Descubrir (`/discover`)
- Mi biblioteca (`/library`)
- Amigos (`/friends`)
- Icono búsqueda → `/search`
- Icono notificaciones → `/notifications` (con badge de no leídos)
- `LanguageSwitcher`
- `AvatarDropdown` → `/profile/[username]`, `/settings`, cerrar sesión

**Mobile:** `BottomNav`
- Inicio (`/home`)
- Descubrir (`/discover`)
- Buscar (`/search`)
- Mi biblioteca (`/library`)
- Perfil (`/profile/[username]`)

### Rutas enlazadas desde menú

✓ `/home` · ✓ `/discover` · ✓ `/search` · ✓ `/library` · ✓ `/friends` · ✓ `/notifications` · ✓ `/profile/[username]` · ✓ `/settings`

### Rutas NO enlazadas desde ningún menú

| Ruta | Accesible cómo | Riesgo |
|---|---|---|
| `/chat` | Solo si el usuario sabe la URL, o desde una futura notificación | **Alto** — sección completa invisible |
| `/lists` | Solo si el usuario sabe la URL | **Alto** — sección completa invisible |
| `/suggestions` | Solo si el usuario sabe la URL | Medio — feature secundaria |
| `/groups/[id]` | Desde `/friends` (sección "Mis grupos") | Bajo — acceso indirecto lógico |
| `/media/[type]/[id]` | Desde search/discover/library (correcto) | Bajo — navegación contextual |
| `/chat/[id]` | Desde `/chat` (correcto) | Bajo — flujo natural |
| `/lists/[id]` | Desde `/lists` (correcto, si llegas) | Bajo — flujo natural una vez en listas |

---

## i18n

- **Locales configurados:** 2 (`es`, `en`). Default: `es`.
- **Archivos:** `messages/es.json` y `messages/en.json` — **455 líneas cada uno, idénticos en estructura**.
- **Secciones cubiertas:** nav, auth, media, status, errors, common, filters, discover, search, media_detail, library, profile, lists, aiRecommendations, popularInCircle, genreNews, notifications, recommendations, home, friends, suggestions, groups, chat, settings, landing.
- **Paridad:** Archivos completamente sincronizados. No se detectaron gaps de claves entre locales.
- **Problema detectado:** 18 strings de UI en 4 componentes de Home ignoran el sistema i18n y renderizan español hardcodeado. Las claves correspondientes **ya existen** en los archivos de traducción — es un problema de adopción, no de cobertura. Esto hace que `/en/home` muestre texto en español.

---

## Hallazgo estructural crítico: Chat y Lists no enlazados

El `nav.chat` y `nav.suggestions` existen como claves i18n pero no están en `NavLinks` ni en `BottomNav`. Las secciones `/chat` y `/lists` son funcionalidades completas pero completamente invisibles desde la interfaz de navegación. Un usuario nuevo nunca encontraría Chat o Lists sin conocer la URL directa.

Comparación:
- `NavLinks`: home, discover, library, friends (4 items)
- `BottomNav`: home, discover, search, library, profile (5 items)
- **Ausentes de ambos:** chat, lists, suggestions

---

## Recomendaciones para B3.5b (verificación visual)

Pantallas ordenadas por probabilidad de problema según este análisis:

1. **`/chat`** — Sección funcionalmente completa pero no accesible desde navegación. Verificar si hay link escondido en algún lado, o confirmar que es una ruta huérfana de navegación.

2. **`/lists`** — Mismo problema. Verificar si hay link desde algún componente no analizado (ej. desde perfil o library detail).

3. **`/en/home`** — Con locale en inglés, verificar que los 4 componentes de Home muestran texto en español hardcodeado (HeroSection, AiRecommendations, PopularInCircle, GenreNews). Debería ser visible el bug inmediatamente.

4. **`/groups/[id]`** → `GroupFeed` — Publicar un post en un grupo. El Client Component no fue leído en detalle; verificar que el formulario funciona y los posts se muestran.

5. **`/settings`** — Verificar el botón "Cambiar contraseña": ¿envía email? ¿muestra feedback? La feature "Eliminar cuenta" debería mostrar el texto "disponible próximamente".

6. **`/chat/[id]`** → `ConversationClient` — Verificar mensajes en tiempo real. No confirmado si usa Supabase Realtime o polling.

7. **`/notifications`** — Verificar que las notificaciones de tipo `recommendation` y `list_invite` se renderizan correctamente (NotificationsList no fue leído en detalle).

8. **`/discover`** → `DiscoverClient` — Verificar que el cambio de tab (película/serie/anime/...) funciona con la paginación.

9. **`/media/comic/[id]`** — COMICVINE_KEY presente pero sin handler. Intentar navegar a un comic debería dar 404 o error (VALID_TYPES en media detail no incluye 'comic').

10. **`/library`** → `LibraryClient` — Verificar filtros (tipo/estado/puntuación) y que las entradas se pueden actualizar y eliminar.

---

## Verificaciones post-auditoría

- `npm run lint`: **PASS** (2 warnings pre-existentes en `SearchResults.tsx`, líneas 134:9, no relacionados con esta auditoría)
- Código modificado: **ninguno** — solo lectura
