# KULTURA — Inventario del alcance v2.0 (`FUNCIONES_V2.md`)

**Qué es:** el índice de lo que la UI v2 tiene que cubrir, sacado del código de `master` (`28479c1`) el 2026-11-06. Lo genera el paso de F0 de `PLAN_ESTRATEGICO.md` §7.3. Git (`v1-ui`, cuando exista) guarda la memoria completa; este documento es el mapa.
**Cómo se sacó:** `find src/app -name page.tsx` (37 pantallas), `find src/app/api -name route.ts` (51 rutas), imports de cada carpeta de pantalla, búsqueda de `/api/<ruta>` en `src/` y namespaces de `messages/es.json`. Lo que no se pudo comprobar se marca **(no verificado)**.
**Alcance:** completo, 13 flujos (decisión D5 en `04_DECISIONES_Y_RIESGOS.md`).

**Revisión independiente (regla 2):** 2026-11-06, subagente revisor; 3 hallazgos graves y 5 menores, todos corregidos en esta versión (registro en `04_DECISIONES_Y_RIESGOS.md` §4). En §4 «llamadores» son llamadas HTTP reales (`fetch`), no imports ni comentarios.

Convenciones: las rutas de pantalla son relativas a `src/app/[locale]/`; las de `lib`/`components` a `src/`. «Estados» se refiere a los archivos `loading.tsx` / `error.tsx` de cada carpeta (el estado vacío vive dentro de cada cliente y no se inventaría aquí).

---

## 0. Armazón de la app (todas las pantallas de `(app)`)

`(app)/layout.tsx:33` monta `components/layout/AppChrome`, que monta `UnreadChatProvider` (`AppChrome.tsx:40`). Ese proveedor llama a `fetch('/api/chat?countOnly=1')` (`UnreadChatProvider.tsx:47`) **en cada pantalla con sesión**: un flujo v2.0 depende hoy de una ruta v2.1.

- **Piezas:** `layout/AppChrome`, `layout/UnreadChatProvider`, `layout/SocialMenu`, `layout/AvatarDropdown`, `layout/AppFooter`, `layout/DemoBanner`, `pwa/InstallPrompt`, `push/PushOffer`.
- **API:** `chat` (contador), `auth/demo/exit` (`DemoBanner`), `pwa/installed` (`InstallPrompt`), `push/status` (`PushOffer` vía `lib/push/offer`).
- **Decisión para el armazón v2:** no montar `UnreadChatProvider` mientras el chat esté aparcado, o mantener `/api/chat` vivo hasta v2.1. Se decide al construir el interruptor `ui_v2` (riesgo R8).

## 1. Flujos v2.0

### F3-1 · Entrar / Crear cuenta
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `login/page.tsx` | `/es/login` | — | `LoginPage`, `AuthShell`, `PasswordField`, `TermsCheckbox`, `in-app-browser.ts`, `supabase-lazy.ts`, `opengraph-image` |
| `reset-password/page.tsx` | `/es/reset-password` | — | `ResetPasswordForm` (reutiliza `AuthShell`, `PasswordField`, `supabase-lazy` de `login/`) |

- **API:** `auth/callback`, `auth/demo`, `settings` (identidad: importa `@/app/api/settings/identity` directamente).
- **lib:** `utils/auth-errors`, `utils/safe-redirect`, `analytics/attribution`, `push/client`, `demo`.
- **Textos:** `auth`, `onboarding`, `errors`, `demo`.
- **Tests:** `tests/unit/auth` (9), `tests/e2e/auth.spec.ts`. Sin e2e contra BD real.
- **Rescate (F0):** `useAuthFlow` a extraer de `LoginPage.tsx`; `in-app-browser.ts` y `supabase-lazy.ts` a `src/lib/`.
- **Nota:** la rama `feat/login-el-hueco` (`225a9be`) rediseña esta pantalla; aparcada (R6).

### F3-2 · Bienvenida
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `welcome/page.tsx` | `/es/welcome` | `layout.tsx` | `WelcomeFlow`, `WelcomeImport`, `RateStars`, `starter-titles.ts` |

- **API:** `library`, `settings`.
- **lib:** `import/i18n`, `utils/safe-redirect`, `demo`; componente `home/AiRecommendations`.
- **Textos:** `onboarding`, `import`.
- **Rescate:** `starter-titles.ts` → `src/lib/`.

### F3-3 · Inicio
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `(app)/home/page.tsx` | `/es/home` | `loading`, `error` | `sections.tsx`, `TonightClient`, `tonight.ts` |

- **API:** `ai-recommendations`, `popular-in-circle`, `genre-news`, `library`, `settings`.
- **lib:** `claude/recommendations`, `library/progress-server`, `recommendations/starter`, `social/feed`, `supabase/admin`.
- **Componentes:** `home/HeroSection`, `home/ContinueRow`, `home/AiRecommendations`, `home/PopularInCircle`, `home/GenreNews`.
- **Textos:** `home`, `aiRecommendations`, `popularInCircle`, `genreNews`.
- **Rescate:** `tonight.ts` → `src/lib/`.
- **Nota:** «Popular en tu círculo» y «Noticias por género» (`(app)/home/page.tsx:197-198`) quedan como **candidatos**: el brief de Inicio en F2 decide si entran (D-I2).

### F3-4 · Buscar (Descubrir)
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `(app)/discover/page.tsx` | `/es/discover` | `loading`, `error` | `DiscoverClient`, `DiscoverResults`, `DiscoverToolbar`, `discover-config.ts`, `useFilterGroups.ts` |
| `(app)/search/page.tsx` | `/es/search` | `error` | solo redirección permanente a `/discover` (E-DISCOVER-SEARCH-MERGE); conservar para no romper enlaces |

- **API:** `search`, `discover`.
- **lib:** `api/*` (normalizer, aggregate, search-rank, discover-params), `discover/type-filters`; hooks `useDiscoverQuery`, `useDiscoverUrl`.
- **Componentes:** `search/SearchBar`, `media/MediaGrid`, `ui/FilterBar`, `ui/Pagination`.
- **Textos:** `search`, `discover`, `discoverFilters`, `filters`.
- **Tests:** `tests/unit/search` (10), `discover` (3), `catalogo` (10); e2e con BD real: `b3_5e_safety_net/discover-filters.spec.ts`, `discover-pagination.spec.ts`.
- **PWA:** `share/route.ts` es el receptor `share_target` («Compartir → KULTURA» desde otra app): saca el título y abre la búsqueda o Descubrir (`share/route.ts:1-8`).
- **Rescate:** `discover-config.ts`, `useFilterGroups.ts` → `src/lib/` / `src/hooks/`.

### F3-5 · Ficha pública de título
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `media/[type]/[id]/page.tsx` | `/es/media/movie/550` | `error` | — |

- **API:** `library` (vía `components/library/LibraryAction`), `lists` (vía `social/AddToListButton`), `recommendations` (vía `social/RecommendModal`), `reports` (vía `social/ReportButton`, `MediaDetail.tsx:416`).
- **lib:** `media/detail-data`, `media/kultura-rating`, `media/seo`, `media/viewer`, `recommendations/match-score`, `translate/synopsis`, `library/queries`, `library/scale`, `best/best-of`; importa `u/[username]/r/_lib/rating-share` (lógica atrapada en UI).
- **Componentes:** `media/MediaDetail`, `media/AdaptationsSection`, `media/AddFranchiseButton`.
- **Textos:** `media`, `media_detail`, `adaptations`, `share`, `status`.
- **Tests:** `fichas` (8), `adaptations` (12), `media` (4).

### F3-6 · Biblioteca (estados, progreso)
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `(app)/library/page.tsx` | `/es/library` | `loading`, `error` | `LibraryClient` |

- **API:** `library`, `library/progress`, `library/diary`, `library/prefs`.
- **lib:** `library/actions`, `library/queries`, `library/diary`, `library/scale`, `library/stats`.
- **Componentes:** `library/DiaryList`, `media/MediaGrid`, `ui/SegmentedControl`, `ui/FilterChip`.
- **Textos:** `library`, `diary`, `progress`, `status`.
- **Tests:** `library` (6), `progress` (6), `diary` (5). Sin e2e contra BD real (CUJ «cambiar estado y progreso» pendiente).

### F3-7 · Perfil público + invitación
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `(app)/profile/[username]/page.tsx` | `/es/profile/victor` | `loading`, `error` | — (perfil dentro de la app) |
| `u/[username]/page.tsx` | `/es/u/victor` | — | perfil público indexable, `opengraph-image` |
| `u/[username]/r/[type]/[id]/page.tsx` | `/es/u/victor/r/movie/550` | — | nota compartible («le da 9/10»), `card/[sig]`, `opengraph-image`, `_lib/rating-share.ts`, `_lib/top-four.ts` |
| `(app)/friends/page.tsx` | `/es/friends` | `error` | `FriendsClient`. **Versión mínima en v2.0 (D-I1):** lista de amigos, solicitudes y buscar usuario; bloqueos y chat fuera |

- **API:** `settings` (bio), `friends`, `users/search` (búsqueda de usuarios en la pantalla de amigos), `friends/blocks` (`FriendshipButton.tsx:11-13`, usado en `profile/[username]/page.tsx:169`; y `FriendsClient.tsx:12`), `reports` (`ReportButton` en `u/[username]/page.tsx:377`).
- **lib:** `social/public-collection`, `social/friends`, `library/stats`, `analytics/invite`, `analytics/attribution`, `media/media-id`.
- **Componentes:** `profile/ProfileHeader`, `ProfileStats`, `ProfileGenres`, `ProfileBio`, `collection/PublicCollection`, `collection/InviteLinkButton`, `social/ShareLinkButton`.
- **Textos:** `profile`, `invite`, `collection`, `share`.
- **Tests:** `public-profile` (4), `identity` (10).
- **Rescate:** `u/[username]/r/_lib/*.ts` → `src/lib/` (lo usa también la Ficha).

### F3-8 · Listas (índice, detalle, pública, colaborar)
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `(app)/lists/page.tsx` | `/es/lists` | `loading`, `error` | `ListsClient` |
| `(app)/lists/[id]/page.tsx` | `/es/lists/<uuid>` | `loading` | `ListDetail`, `ItemNote`, `ReorderableItems` |
| `u/[username]/l/[id]/page.tsx` | `/es/u/victor/l/<uuid>` | — | lista pública indexable |

- **API:** `lists`, `lists/[id]`, `reports` (`ReportButton` en `u/[username]/l/[id]/page.tsx:160`).
- **lib:** `social/lists`, `social/public-collection`.
- **Componentes:** `social/ListCard`, `social/CreateListModal`, `social/AddToListButton`, `collection/OrderedListGrid`.
- **Textos:** `lists`, `collection`.
- **Tests:** `plataformas-listas` (10), parte de `social` (16).
- **Nota:** `/es/lists` es la ruta propuesta para probar el interruptor `ui_v2` (§7.3).

— *Aquí termina el alcance mínimo (8 flujos).* —

### F3-9 · Rankings
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `best/page.tsx` | `/es/best` | — | — |
| `best/[format]/page.tsx` | `/es/best/movie` | — | — |
| `best/[format]/[year]/page.tsx` | `/es/best/movie/2025` | — | `opengraph-image` |

- **API:** ninguna por HTTP; los datos salen de `lib/api/discover` en el servidor (`lib/best/best-of.ts:21`). `revalidate` invalida su caché.
- **lib:** `best/best-of`, `best/links`, `best/seo`, `best/sitemap`, `best/cache-tags`, `og/*`.
- **Componentes:** `best/BestNav`, `BestTopRow`, `BestOfList`, `ShareRanking`.
- **Textos:** `best`.
- **Tests:** `best` (6).
- **Nota:** credibilidad (suelo de votos) pendiente en F0 (§7.3).

### F3-10 · Importar / Exportar
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `(app)/settings/import/page.tsx` | `/es/settings/import` | — | `ImportClient`, `LetterboxdExport`, `import-storage.ts` |

- **API:** `account/import/external` (`ImportClient.tsx:44`), `account/export/letterboxd` (`LetterboxdExport.tsx:23`). El import/export del JSON propio (`account/import`, `account/export`) se llama desde Ajustes (`SettingsForm.tsx:350,382`).
- **lib:** `import/*` (parse-file, run, report, limits, validate, server/process-batch).
- **Textos:** `import`.
- **Tests:** `import` (15). Sin e2e contra BD real (CUJ «importar CSV» y «exportar» pendientes).
- **Rescate:** `import-storage.ts` → `src/lib/import/`.
- **Nota F4:** base de las páginas «Vengo de…» (Letterboxd, MyAnimeList, Goodreads, IMDb, TV Time ya tienen importador; FilmAffinity y Trakt no).

### F3-11 · Ajustes mínimos (cuenta, privacidad, plataformas)
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `(app)/settings/page.tsx` | `/es/settings` | `loading` | `SettingsForm`, `PlatformsSection`, `platforms.ts` |

- **API:** `settings`, `account` (borrado), `account/export` (RGPD), `email/preferences`, `auth/callback` (cambio de correo), `push/*` (vía `lib/push/client`).
- **lib:** `email/config`, `email/consent`, `email/preferences`, `email/unsubscribe-token`, `library/scale`, `constants/avatarColors`, `push/client`.
- **Textos:** `settings`, `platforms`, `email`, `push`.
- **Tests:** `settings` (2), `plataforma` (4).
- **Rescate:** `useAccountSettings` a extraer de `SettingsForm.tsx`; `platforms.ts` → `src/lib/`.
- **Nota:** el formulario mezcla correo semanal y push (v2.1); «mínimos» = cuenta, privacidad, plataformas, escala de notas, exportar, borrar.

### F3-12 · Legal + Manifiesto
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `legal/page.tsx` | `/es/legal` | — | — |
| `privacy/page.tsx` | `/es/privacy` | — | — |
| `terms/page.tsx` | `/es/terms` | — | — |
| `accessibility/page.tsx` | `/es/accessibility` | — | — |
| *(nueva)* Manifiesto / Cómo se sostiene | **no existe** | — | decisión D4; sin enlace de apoyo hasta respuesta de TMDB/ComicVine (R4) |

- **Componentes:** `legal/LegalDocument`, `legal/DataAttribution`.
- **Textos:** `legal`, `accessibility`.
- **Tests:** `legal` (2).

### F3-13 · Landing coherente
| Pantalla | URL | Estados | Piezas propias |
|---|---|---|---|
| `page.tsx` | `/es` | `error.tsx`, `not-found.tsx` (raíz) | `opengraph-image` |

- **API:** `landing/sources` (la consume `scripts/landing-media/build.py:361`, lanzado por `.github/workflows/landing-media.yml`, para renovar las imágenes semanales), `auth/demo`.
- **lib:** `landing/media`, `landing/scenes`, `landing/faq`, `landing/showcase`, `best/best-of`.
- **Componentes:** `landing/Landing`.
- **Textos:** `landing`, `meta`.
- **Tests:** `landing` (5).

---

## 2. Aparcados para v2.1 (no se rehacen en v2.0; **no se borran**)

| Pantalla | URL | Motivo | APIs que la sostienen |
|---|---|---|---|
| `(app)/calendar/page.tsx` | `/es/calendar` | Anexo A: calendario → v2.1 | — (datos server-side `lib/calendar/*`) |
| `(app)/chat/page.tsx` | `/es/chat` | chat → v2.1 | `chat` |
| `(app)/chat/[id]/page.tsx` | `/es/chat/<id>` | chat → v2.1 | `chat/[id]`, `chat/[id]/messages/[messageId]` |
| `(app)/groups/page.tsx` | `/es/groups` | grupos → v2.1 | `groups`, `groups/discover` |
| `(app)/groups/[id]/page.tsx` | `/es/groups/<id>` | grupos → v2.1 | `groups/[id]/join`, `groups/[id]/invitations`, `groups/[id]/members/[userId]`, `groups/[id]/posts/[postId]`, `groups/invitations/[invitationId]` |
| `(app)/notifications/page.tsx` | `/es/notifications` | notificaciones → v2.1 | `notifications` |
| `email/confirm/page.tsx` | `/es/email/confirm` | correo semanal → v2.1: doble opt-in (`email/confirm/page.tsx:2`); sigue funcionando con la UI vieja (D-I4) | `email/confirm` |
| `email/unsubscribe/page.tsx` | `/es/email/unsubscribe` | correo semanal → v2.1 (pero la baja en 1 clic debe seguir funcionando: obligación legal) | `email/unsubscribe` |

## 3. Transversales / sin flujo propio (se mantienen, se re-estilizan con el sistema final)

| Pantalla | URL | Qué es |
|---|---|---|
| `report/page.tsx` | `/es/report` | denuncia sin cuenta, DSA art. 16 (`report/page.tsx:2`; `reports`, `reports/public`). Obligatoria: se mantiene en v2.0 (D-I5). |
| `(app)/suggestions/page.tsx` | `/es/suggestions` | buzón de sugerencias a KULTURA (enlazado en `layout/AppFooter.tsx:37` y `layout/AvatarDropdown.tsx:60`); canal de feedback para F4/F5 (D-I3). No son las «sugerencias a amigos» del Anexo A (v2.1). |
| `offline/page.tsx` | `/es/offline` | página sin conexión de la PWA. |
| `[...rest]/page.tsx` | cualquier ruta desconocida | `notFound()`; usa `not-found.tsx` raíz. |

---

## 4. Rutas de API → flujo dueño (51)

El «dueño» es el flujo que la rehace o la consume primero; otras pantallas pueden usarla.

| Ruta | Dueño | Llamadores en `src/` |
|---|---|---|
| `/api/auth/callback` | F3-1 | login, reset-password, settings |
| `/api/auth/demo` | F3-1 | login, landing, `DemoBanner` |
| `/api/auth/demo/exit` | F3-1 | `DemoBanner` |
| `/api/settings` | F3-11 | settings, login, welcome, home, profile, `ProfileBio` |
| `/api/library` | F3-6 | `LibraryAction`, `AddFranchiseButton`, welcome, home |
| `/api/library/progress` | F3-6 | `lib/library/actions` |
| `/api/library/diary` | F3-6 | `lib/library/actions` |
| `/api/library/prefs` | F3-6 | `lib/library/actions` |
| `/api/search` | F3-4 | `SearchBar`, `lib/api/*` |
| `/api/discover` | F3-4 | `hooks/useDiscoverQuery.ts:62` (Rankings, landing e IA usan `lib/api/discover` directamente, sin HTTP: `lib/best/best-of.ts:21`) |
| `/api/ai-recommendations` | F3-3 | `home/AiRecommendations` |
| `/api/popular-in-circle` | F3-3 | `home/PopularInCircle` |
| `/api/genre-news` | F3-3 | `home/GenreNews` |
| `/api/recommendations` | F3-5 | `social/RecommendModal` |
| `/api/friends` | F3-7 | `RecommendModal`, `lib/social/actions` |
| `/api/lists` | F3-8 | lists, `AddToListButton`, `CreateListModal`, `lib/social/lists` |
| `/api/lists/[id]` | F3-8 | lists/[id], `AddToListButton`, `lib/social/lists` |
| `/api/revalidate` | F3-9 | sin llamador HTTP en `src/`: invalida etiquetas de caché (`lib/best/cache-tags`) desde fuera **(no verificado quién la llama)** |
| `/api/account` | F3-11 | `SettingsForm.tsx:416,458,480` (leer, cambiar, borrar cuenta) |
| `/api/account/export` | F3-10 | settings, `LetterboxdExport` |
| `/api/account/export/letterboxd` | F3-10 | `LetterboxdExport` |
| `/api/account/import` | F3-10 | `SettingsForm.tsx:382` (importar el JSON propio de KULTURA desde Ajustes) |
| `/api/account/import/external` | F3-10 | `ImportClient` |
| `/api/email/preferences` | F3-11 | `SettingsForm` |
| `/api/email/confirm` | v2.1 | email/confirm |
| `/api/landing/sources` | F3-13 | `scripts/landing-media/build.py:361` (workflow `landing-media.yml`) |
| `/api/chat` | v2.1 | chat, `lib/social/actions` y **`UnreadChatProvider` en el armazón de todas las pantallas (§0, R8)** |
| `/api/chat/[id]` | v2.1 | `ConversationClient`, `lib/social/actions` |
| `/api/chat/[id]/messages/[messageId]` | v2.1 | `lib/social/actions` |
| `/api/groups` | v2.1 | groups, notifications, `CreateGroupForm`, `InviteFriendsModal` |
| `/api/groups/discover` | v2.1 | `DiscoverGroupsClient` |
| `/api/groups/[id]/join` | v2.1 | `JoinGroupButton` |
| `/api/groups/[id]/invitations` | v2.1 | `InviteFriendsModal` |
| `/api/groups/[id]/members/[userId]` | v2.1 | `lib/social/actions` |
| `/api/groups/[id]/posts/[postId]` | v2.1 | `lib/social/actions` |
| `/api/groups/invitations/[invitationId]` | v2.1 | `NotificationsList` |
| `/api/notifications` | v2.1 | sin llamador por cadena; consumo vía `lib/social/notifications` **(no verificado)** |
| `/api/friends/blocks` | F3-7 | `lib/social/actions` ← `FriendshipButton` (perfil) y `FriendsClient`. La gestión de bloqueos queda fuera de la pantalla mínima (D-I1), pero el botón de bloquear la usa: **no se puede aparcar** |
| `/api/users/search` | F3-7 | `FriendsClient` |
| `/api/suggestions` | transversal | `SuggestionsForm` |
| `/api/email/unsubscribe` | v2.1 | email/unsubscribe, `lib/email/digest` |
| `/api/push/status` | v2.1 | `lib/push/client`, `lib/push/offer` |
| `/api/push/subscribe` | v2.1 | `lib/push/client` |
| `/api/push/unsubscribe` | v2.1 | `lib/push/client` |
| `/api/push/dispatch` | v2.1 | trigger de BD `push_on_event` |
| `/api/reports` | transversal | report, `lib/social/actions` ← `ReportButton` en Ficha (F3-5), perfil público (F3-7), lista pública (F3-8), chat y grupos |
| `/api/reports/public` | transversal | `lib/social/actions` |
| `/api/pwa/installed` | transversal | `pwa/InstallPrompt` |
| `/api/cron/daily` | infra | cron de `vercel.json` (06:00), mantiene viva Supabase |
| `/api/csp-report` | infra | `lib/csp` (cabecera CSP) |
| `/api/health` | infra | sondas de proveedores (`lib/api/*`) |

---

## 5. Lógica atrapada en `app/[locale]` (11 `.ts`, para el PR de rescate de F0)

| Archivo | Flujo | Destino propuesto |
|---|---|---|
| `login/in-app-browser.ts` | F3-1 | `src/lib/auth/` |
| `login/supabase-lazy.ts` | F3-1 | `src/lib/supabase/` |
| `welcome/starter-titles.ts` | F3-2 | `src/lib/recommendations/` |
| `(app)/home/tonight.ts` | F3-3 | `src/lib/home/` |
| `(app)/discover/discover-config.ts` | F3-4 | `src/lib/discover/` |
| `(app)/discover/useFilterGroups.ts` | F3-4 | `src/hooks/` |
| `u/[username]/r/_lib/rating-share.ts` | F3-7 (lo usa F3-5) | `src/lib/share/` |
| `u/[username]/r/_lib/top-four.ts` | F3-7 | `src/lib/share/` |
| `(app)/settings/import/import-storage.ts` | F3-10 | `src/lib/import/` |
| `(app)/settings/platforms.ts` | F3-11 | `src/lib/platforms/` |
| `share/route.ts` | F3-4 | receptor `share_target` de la PWA; es un route handler: se queda en `app/[locale]/` (la URL la fija `src/app/manifest.ts`) |

En la misma carpeta que los `.ts` de F3-7 hay también `u/[username]/r/_lib/rated-card.tsx` y el handler de imagen `u/[username]/r/[type]/[id]/card/[sig]/route.tsx`.

**UI que importa de `@/app/api/`** (lógica de API usada desde pantallas; mover a `src/lib/` en el mismo PR de rescate): 10 archivos — `login/LoginPage.tsx`, `welcome/page.tsx`, `welcome/WelcomeFlow.tsx`, `(app)/home/page.tsx`, `(app)/settings/page.tsx`, `(app)/settings/SettingsForm.tsx`, `(app)/profile/[username]/page.tsx`, `(app)/lists/page.tsx`, `(app)/lists/[id]/page.tsx`, `report/page.tsx`. Módulos importados: `settings/identity`, `settings/account-state`, `lists/shared`, `reports/shared`.

## 6. Red de pruebas: qué hay y qué falta (para los 8 CUJ de F0)

e2e con BD real existentes (`tests/e2e/b3_5e_safety_net/`): `discover-filters`, `discover-pagination` (F3-4), `language-switch` (transversal), `chat-send`, `group-feed-post`, `notifications-render` (v2.1). Otros e2e: `tests/e2e/a11y/` (Supabase simulado, solo accesibilidad) y `tests/e2e/pwa/pwa.spec.ts`.

| CUJ de §7.3 | Flujo | e2e con BD real hoy |
|---|---|---|
| Registro | F3-1 | no (`tests/e2e/auth.spec.ts` usa `example.com` y no inicia sesión: no toca BD real) |
| Entrar | F3-1 | no (ídem) |
| Buscar y añadir | F3-4 + F3-5 | buscar sí; añadir no |
| Cambiar estado y progreso | F3-6 | no |
| Crear lista y compartir | F3-8 | no |
| Perfil público | F3-7 | no |
| Importar CSV | F3-10 | no |
| Exportar | F3-10 | no |

## 7. Tolerancia a migraciones (`isNotMigrated`) en lo que sobrevive

21 archivos con `isNotMigrated` (`grep -rlE isNotMigrated src | wc -l` = 21; limpieza de F0, §7.5): 14 en `src/app/api/` (11 rutas y 3 módulos `.ts`: `cron/daily/purge`, `lists/shared`, `settings/account-state`) (`account/export/letterboxd`, `account/import`, `cron/daily/purge`, `friends/blocks`, `groups/[id]/members/[userId]`, `library/diary`, `library/progress`, `library`, `lists`, `lists/shared`, `lists/[id]`, `reports/public`, `settings/account-state`, `settings`), 6 en `src/lib/` (`import/server/process-batch`, `library/diary`, `library/progress-server`, `library/scale`, `social/friends`, `social/lists`) y 1 en UI (`(app)/profile/[username]/page.tsx`, se va con la UI vieja).

## 8. Dudas del inventario (resueltas el 2026-11-06)

Registradas en `04_DECISIONES_Y_RIESGOS.md` §1b (D-I1 … D-I5).

1. `friends` → versión mínima dentro de F3-7 (D-I1).
2. Inicio: bloques sociales y de noticias como candidatos; decide el brief de F2 (D-I2).
3. `suggestions` → transversal v2.0 (D-I3).
4. `email/confirm` → aparcado v2.1, sigue con la UI vieja (D-I4).
5. `report` → transversal v2.0, obligación DSA art. 16 según el código (D-I5).
