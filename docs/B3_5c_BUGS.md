# B3.5c — Diagnóstico de bugs (sin arreglar)

> Fuente: B3.5b (verificación visual del usuario), B3.5e-3-local-FIX (tests E2E),
> reproducción manual del usuario contra producción para bugs 3, 4 y 5.

---

## Bug 1 — `/chat` POST /api/chat 500

**Severidad:** 🔥 Crítico.
**Estado de red de seguridad:** ROJO-ESPERADO en `chat-send.spec.ts` (correctamente capturado).
**Síntoma:** al elegir amigo y enviar mensaje, la app hace POST /api/chat → 500 → no hay redirect a `/chat/[id]`.

### Hipótesis

**H1 — RLS bloquea INSERT en `conversations` desde Route Handler (alta confianza)**

El Route Handler POST `/api/chat` usa `createClient()` de `src/lib/supabase/server.ts`, que crea un `createServerClient` con el `ANON_KEY` más las cookies de sesión del request. El INSERT en `conversations` tiene RLS: `"Authenticated users can create conversations" ... WITH CHECK (true)` — parece permisiva. Sin embargo, hay un patrón conocido con `@supabase/ssr`: si el middleware no refresca la sesión correctamente antes del Route Handler, el `getUser()` devuelve un usuario válido pero el cliente no tiene un JWT válido en las cookies que Supabase lee para las operaciones de RLS. El `getUser()` puede retornar `user` incluso con una sesión stale, pero el INSERT fallará con 401/403 en Supabase.

Evidencia de soporte: el error es 500, no 400. El handler en `route.ts:124` devuelve 500 solo si `convError || !conv` — esto apunta a que el INSERT falla a nivel DB (RLS reject o sesión inválida), no a un error de validación del body.

**H2 — conversation_members INSERT doble falla silenciosamente y la respuesta 201 llega pero sin redirect (media confianza)**

La inserción de members en línea 129-132 usa `await supabase.from('conversation_members').insert([...])` sin manejar el error. La RLS policy para `conversation_members` INSERT es `WITH CHECK (user_id = auth.uid())` — el segundo insert (el del `targetUserId`) fallará si el RLS se evalúa para cada fila por separado y el `auth.uid()` no puede "ser" el otro usuario. En `insert([row1, row2])` bulk, Supabase evalúa la policy por fila: row1 pasa (user_id = auth.uid()), row2 falla (targetUserId ≠ auth.uid()). Esto causaría que la conversación se crea pero el otro miembro no se añade — sin embargo la respuesta sería 201, no 500.

**Conclusión más probable:** H1 explica el 500. La sesión se obtiene correctamente en `getUser()` pero el JWT en cookie no pasa la verificación de RLS en el INSERT de `conversations`. Posible causa secundaria: el middleware no está configurado para refrescar el token en rutas `/api/chat`.

### Archivos implicados

- `src/app/api/chat/route.ts` — lines 118-132 (INSERT conversations + members)
- `src/lib/supabase/server.ts` — createServerClient con cookies (verifica si el token se refresca)
- `src/middleware.ts` — verifica si `/api/chat` está en el matcher de refresh
- `supabase/migrations/20260502233945_remote_schema.sql` — RLS policies: líneas 616, 684

### Test E2E correspondiente

`tests/e2e/b3_5e_safety_net/chat-send.spec.ts` — ROJO-ESPERADO: falla en `waitForURL(/\/chat\/[uuid]/)` porque el redirect nunca llega (500 en el POST).

### Refuerzo de aserciones recomendado para B3.5c-3

Añadir aserción intermedia: después del click en el amigo, verificar que la respuesta del fetch no fue un error antes del waitForURL. Ejemplo: interceptar `page.on('response', r => r.url().includes('/api/chat') && r.status())` para distinguir 500 de timeout.

---

## Bug 2 — `/lists` no accesible desde navegación

**Severidad:** 🟡 Medio.
**Estado de red de seguridad:** Sin test E2E (navegación pura, no flujo).
**Síntoma:** ruta `/lists` funciona si se accede directamente, pero ningún menú la enlaza.

### Hipótesis

**Confirmada: omisión en ambos componentes de navegación.**

`src/components/layout/NavLinks.tsx` — `NAV_ITEMS` tiene solo 4 entradas: home, discover, library, friends. `/lists` no está.

`src/components/layout/BottomNav.tsx` — `items` tiene 5 entradas: home, discover, search, library, profile. `/lists` no está.

La clave i18n `nav.lists` no fue verificada — probablemente ausente (solo se detectó `nav.chat` y `nav.suggestions` en UI_AUDIT). Revisar antes del fix en B3.5c-2.

Causa: omisión de desarrollo. Ruta y componente listos, enlace no añadido.

### Archivos implicados

- `src/components/layout/NavLinks.tsx` — `NAV_ITEMS` array (línea 7-12)
- `src/components/layout/BottomNav.tsx` — `items` array (línea 16-22)
- `messages/es.json` + `messages/en.json` — verificar si existe `nav.lists`

### Test E2E correspondiente

Ninguno. Para B3.5c-3: añadir test que verifique que `/lists` aparece como link en el header (desktop) o en BottomNav (mobile). Usar `page.locator('a[href*="/lists"]')`.

---

## Bug 3 — Selector de idioma no cambia textos

**Severidad:** 🔥 Crítico.
**Estado de red de seguridad:** VERDE-INESPERADO en `language-switch.spec.ts`. Confirmado manualmente: URL sí cambia a `/en/...` pero textos siguen en ES.
**Causa identificada en B3.5a:** 18 strings hardcoded en 4 componentes de Home — las claves i18n existen pero los componentes no usan `t()`.

### Hipótesis

**Confirmada por código + reproducción manual.** Los 4 componentes renderizan literales ES. La URL cambia (next-intl enruta correctamente), el `html[lang]` cambia (verificado por el test), pero los strings de UI son literales inmutables. No hay nada que pueda cambiarlos sin modificar el código.

### Archivos implicados — líneas verificadas en código real

| Componente | Archivo | Línea(s) | String hardcodeado actual |
|---|---|---|---|
| `HeroSection` | `src/components/home/HeroSection.tsx` | 25 | `"¿Qué estás viendo?"` |
| `HeroSection` | `src/components/home/HeroSection.tsx` | 26 | `"Añade títulos a tu biblioteca..."` |
| `HeroSection` | `src/components/home/HeroSection.tsx` | 31 | `"Explorar contenido"` |
| `HeroSection` | `src/components/home/HeroSection.tsx` | 76 | `"Continuando"` |
| `HeroSection` | `src/components/home/HeroSection.tsx` | 102 | `"Continuar"` |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 9-17 | `TYPE_LABELS` dict (7 tipos en ES) |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 54 | `"Para ti"` |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 55 | `"Claude IA"` |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 68 | `"Añade al menos 3 títulos..."` |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 75 | `"Demasiadas solicitudes..."` |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 77 | `"No se pudieron cargar..."` |
| `AiRecommendations` | `src/components/home/AiRecommendations.tsx` | 82 | `"Reintentar"` |
| `PopularInCircle` | `src/components/home/PopularInCircle.tsx` | 40 | `"Popular entre tus amigos"` |
| `PopularInCircle` | `src/components/home/PopularInCircle.tsx` | 43 | `"Añade amigos para ver qué están viendo"` |
| `PopularInCircle` | `src/components/home/PopularInCircle.tsx` | 44 | `"Añadir amigos"` |
| `GenreNews` | `src/components/home/GenreNews.tsx` | 40 | `"Novedades"` |
| `GenreNews` | `src/components/home/GenreNews.tsx` | 57 | `"Tendencias"` |
| `GenreNews` | `src/components/home/GenreNews.tsx` | 77 | `` `Novedades en ${genres[0]}` `` |
| `GenreNews` | `src/components/home/GenreNews.tsx` | 81 | `` `Series en ${genreLabel}` `` |
| `home/page.tsx` | `src/app/[locale]/(app)/home/page.tsx` | 88 | `"Continúa donde lo dejaste"` |

Nota: UI_AUDIT dice línea 9-17 para `TYPE_LABELS` y líneas 54, 55, 67-70, 75-78 para AiRecommendations. Código real: TYPE_LABELS en líneas 9-17 ✓, `"Para ti"` en línea 54 ✓, `"Claude IA"` en línea 55 ✓, estados de error en líneas 68/75/77/82 (UI_AUDIT tenía 67-70, 75-78 — desviación de 1-2 líneas por diferencias de espaciado, no material). `"Continuando"` está en línea 76 (UI_AUDIT correcto). `"Continuar"` en línea 102 (UI_AUDIT correcto).

Nota sobre GenreNews: `"Series en ${genreLabel}"` (línea 81) no tiene clave i18n dedicada → requiere añadir clave nueva además del fix. Mismo caso para `"Continuando"` (HeroSection línea 76).

### Test E2E correspondiente

`tests/e2e/b3_5e_safety_net/language-switch.spec.ts` — VERDE-INESPERADO: solo verifica que `html[lang="en"]` cambia tras click en switcher. No verifica que los textos de la página sean en inglés.

### Refuerzo de aserciones recomendado para B3.5c-3

Tras click en switcher EN, verificar que el heading de HeroSection (o cualquier string del Home) es el valor EN. Ejemplo:
```typescript
await expect(page.getByText('What are you watching?')).toBeVisible()
// o el equivalente del estado vacío de HeroSection
```
Esto convierte el test en sensible al bug: si los strings siguen en ES, el test falla.

---

## Bug 4 — GroupFeed no publica posts

**Severidad:** 🔥 Crítico.
**Estado de red de seguridad:** VERDE-INESPERADO en `group-feed-post.spec.ts`. Confirmado manualmente: el post no se publica.

### Hipótesis

**H1 — RLS policy de `group_posts` INSERT bloquea silenciosamente (alta confianza)**

`GroupFeed.tsx` usa `createClient()` de `src/lib/supabase/client.ts` (browser client con `createBrowserClient`). El INSERT es:
```typescript
await supabase.from('group_posts').insert({ group_id: groupId, user_id: currentUserId, content })
```
No hay manejo de error — el resultado del `await` se ignora completamente (línea 78, sin `.then()` ni destructuring de `error`).

La RLS policy para INSERT en `group_posts` es:
```sql
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = group_posts.group_id
    AND group_members.user_id = auth.uid()
  )
)
```
Si el browser client no tiene sesión válida (token expirado, cookie mal propagada), `auth.uid()` devuelve NULL → la policy falla → el INSERT retorna error → silenciosamente ignorado → el post nunca aparece → el Realtime `INSERT` callback nunca se dispara → UI permanece igual.

**H2 — Realtime no está suscrito a la tabla a tiempo (media confianza)**

El canal `supabase.channel('group:${groupId}')` se subscribe a `postgres_changes` en `group_posts`. Si el INSERT ocurre antes de que la suscripción esté activa (race condition al montar el componente), el evento se pierde. Sin embargo, incluso con este race condition, la query inicial `.select()` al montar debería cargar el post recién insertado en el siguiente re-render. Esto solo explicaría ausencia en tiempo real, no ausencia total.

**H3 — `currentUserId` es `undefined` o incorrecto (baja confianza)**

`GroupFeed` recibe `currentUserId` como prop desde `src/app/[locale]/(app)/groups/[id]/page.tsx`. Si la page pasa el ID incorrecto, el INSERT falla por `user_id ≠ auth.uid()` (misma consecuencia que H1 pero causa diferente).

**Conclusión:** H1 es la causa más probable. El silent fail del `await supabase.from('group_posts').insert(...)` sin captura de error es el patrón de "silent fail" documentado en STRUCTURAL_AUDIT. El bug se manifiesta idénticamente tanto si la RLS falla como si hay un error de red.

### Archivos implicados

- `src/app/[locale]/(app)/groups/[id]/GroupFeed.tsx` — línea 78 (insert sin manejo de error)
- `src/lib/supabase/client.ts` — browser client (verifica si la sesión se propaga correctamente)
- `supabase/migrations/20260502233945_remote_schema.sql` — RLS `"Group members can post"` (línea 624)

### Test E2E correspondiente

`tests/e2e/b3_5e_safety_net/group-feed-post.spec.ts` — VERDE-INESPERADO: el test hace `test.skip(!hasCredentials() || !TEST_GROUP_ID, ...)`. Si `TEST_GROUP_ID` no está en `.env.local`, el test se salta y aparece como verde (skipped ≠ passing, pero Playwright lo cuenta como no-fallido). El test nunca ejecutó realmente el flujo.

### Refuerzo de aserciones recomendado para B3.5c-3

1. Asegurarse de que `TEST_GROUP_ID` está configurado en `.env.local` con un grupo donde el usuario de prueba es miembro.
2. Añadir captura del error de inserción: tras el click en "Publicar", verificar que NO aparece ningún estado de error (si se añade manejo de error en el fix) y que el texto del post aparece.
3. El fix de B3.5c debe añadir `const { error } = await supabase.from('group_posts').insert(...)` y mostrar feedback de error al usuario.

---

## Bug 5 — `/notifications` roto

**Severidad:** 🔥 Crítico.
**Estado de red de seguridad:** VERDE-INESPERADO en `notifications-render.spec.ts`. No reproducible manualmente por el usuario (falta de datos de prueba).
**Notas:** hipótesis C confirmada — el test verifica que la página renderiza (heading visible) pero el second assert `expect(hasItems).toBeTruthy()` puede pasar si el seed tiene notificaciones; o puede pasar vacío si el assert de "crash silencioso" ya cubre el caso. Ver análisis.

### Hipótesis

**H1 — Payload de notificación con campos ausentes provoca render parcial o crash silencioso (alta confianza)**

`NotificationsList.tsx` accede a `notif.payload` con casts directos sin validación:
```typescript
const fromUsername = p.fromUsername as string   // puede ser undefined
const mediaTitle   = p.mediaTitle   as string   // puede ser undefined
const mediaId      = p.mediaId      as string   // puede ser undefined
```
Si el payload fue insertado sin todos los campos requeridos (e.g., una recomendación creada antes de que el schema del payload estuviera documentado, o con un campo con nombre distinto), `fromUsername` sería `undefined` y el componente renderizaría `undefined` en el texto — visible como un agujero en el texto o como un link con `href="/profile/undefined"`.

En el caso de `mediaId`, si `p.mediaId` es undefined, la expresión `mediaId.split('_')[0]` lanza un TypeError → crash del componente → React Error Boundary (si existe) o pantalla en blanco de esa notificación.

**H2 — `getNotifications()` lanza excepción que no se captura en la page (media confianza)**

`src/lib/social/notifications.ts:37`:
```typescript
if (error) throw new Error(`Failed to fetch notifications: ${error.message}`)
```
Si la query falla (RLS problem, DB error), lanza. En `notifications/page.tsx:24`, la llamada es `const notifications = await getNotifications(user.id)` sin try/catch. Next.js App Router convierte los throws en error pages — si no hay `error.tsx` en esa ruta, muestra la página de error genérica de Next.js. Esto explicaría "sección rota" observado en B3.5b.

**H3 — El usuario de prueba no tiene notificaciones y el test pasa vacío (alta confianza para la red de seguridad)**

El segundo assert del test es `expect(hasItems).toBeTruthy()`. Si el usuario de prueba no tenía notificaciones en el seed de B3.5e-2, `hasItems = false` y el test debería fallar. Pero el test fue reportado como VERDE-INESPERADO — esto implica que el seed SÍ creó notificaciones, o que el assert no se ejecutó (el test se saltó por alguna razón). Revisar el seed de B3.5e-2.

**Conclusión:** el bug "roto" observado en B3.5b es más probablemente H2 (la query lanza y la page crashea sin error boundary) o H1 (payload con campo undefined causa TypeError en el render). Ambas producen una página rota sin feedback visual de error.

**Deuda detectada:** `NotificationsList.tsx` no valida el shape del payload antes de usarlo. Los casts `as string` son inseguros si el payload no está garantizado por el código que inserta las notificaciones.

### Archivos implicados

- `src/app/[locale]/(app)/notifications/NotificationsList.tsx` — líneas 36-37 (`mediaId.split(...)` con posible undefined)
- `src/lib/social/notifications.ts` — línea 37 (throw no capturado en page.tsx)
- `src/app/[locale]/(app)/notifications/page.tsx` — línea 24 (sin try/catch para getNotifications)

### Test E2E correspondiente

`tests/e2e/b3_5e_safety_net/notifications-render.spec.ts` — VERDE-INESPERADO.

El test tiene lógica especial: si el usuario no tiene notificaciones, el primer assert `expect(hasItems || hasEmpty).toBeTruthy()` pasa (el estado vacío es visible), y el segundo `expect(hasItems).toBeTruthy()` falla. Sin embargo el test fue reportado verde → o el usuario de prueba tenía notificaciones y el render funcionó (H3 anulada), o el test se saltó por credenciales.

### Refuerzo de aserciones recomendado para B3.5c-3

1. Verificar en seed que el usuario de prueba tiene al menos 1 notificación con payload completo (`fromUsername`, `mediaTitle`, `mediaId`).
2. Añadir aserción sobre el contenido renderizado: verificar que el username del remitente aparece como texto (no "undefined").
3. Verificar que no hay errores en consola: `page.on('console', msg => msg.type() === 'error' && errors.push(msg.text()))`.

---

## Bug 6 — `/discover` grid vacío

**Severidad:** 🔥 Crítico.
**Estado de red de seguridad:** ROJO con causa H3 ambigua (4/4 tests fallan incluyendo el control "movie").
**Síntoma en tests:** grid vacío para TODOS los tabs incluyendo movie (el tab de control).

### Hipótesis

**H1 — El Server Component falla silenciosamente y devuelve `items = []` (alta confianza)**

`src/app/[locale]/(app)/discover/page.tsx` envuelve todo el fetch en un `try/catch` (líneas 48-104):
```typescript
try {
  switch (type) { ... }
} catch {
  items = [];
  totalPages = 1;
}
```
Si cualquier API externa lanza (TMDB key inválida, red no disponible en el entorno de test headless, rate limit), el catch silencia el error y retorna un array vacío. `DiscoverClient` recibe `items=[]` y renderiza `MediaGrid` con array vacío → estado vacío con texto "No hay contenido disponible".

**H2 — El selector del test no matchea lo que renderiza MediaCard (media confianza)**

El test busca `a[href*="/media/anime/"]`. `MediaCard.tsx` genera `href = /media/${item.type}/${item.externalId}`. Para anime normalizado por Jikan, `item.type = 'anime'` → el href sería `/media/anime/{id}`. Pero el selector del test incluye el locale: la URL real en el browser sería `/es/media/anime/{id}` (next-intl añade el prefijo). El `Link` de `@/i18n/navigation` genera URLs con locale automáticamente. Si el test navega a `http://localhost:3000/es/discover`, los hrefs de las cards serán `/es/media/anime/{id}` → `a[href*="/media/anime/"]` debería matchear igualmente (contiene la substring). Esto no parece ser el problema.

**H3 — Env var `TMDB_API_KEY` ausente o vacía en el proceso del dev server de Playwright (alta confianza)**

El `playwright.config.ts` arranca el dev server con:
```typescript
env: {
  ...(process.env as Record<string, string>),
  ...testEnvOverrides,  // sobreescribe NEXT_PUBLIC_SUPABASE_* con kultura-test
}
```
`testEnvOverrides` lee `.env.test.local`. Si `.env.test.local` define `TMDB_API_KEY=` (vacío) para sobreescribir algo, o si la variable simplemente no llega al proceso hijo, TMDB retorna 401 → `jikanFetch` lanza → catch → `items = []`.

El `loadEnvConfig(process.cwd())` en el playwright config carga `.env.local` al proceso Playwright (para que `TEST_USER_*` estén disponibles), y luego `process.env` se pasa al webServer. En Windows con PowerShell, `process.env` en el proceso Playwright puede no incluir todas las vars de `.env.local` si `loadEnvConfig` no las inyecta en `process.env` antes del spread. `@next/env`'s `loadEnvConfig` carga vars en `process.env` por defecto — pero verificar que no hay colisión con vars ya definidas en el entorno del sistema que sobreescriban con vacío.

**H4 — Jikan rate limit 429 en contexto headless (media confianza)**

Jikan v4 tiene rate limit de 3 req/seg y 60 req/min. Si los tests de discover se ejecutan consecutivamente (4 tests, cada uno cargando `/discover?type=anime`), el cuarto o quinto request a Jikan dentro del mismo segundo puede recibir 429 → `jikanFetch` lanza `"Jikan /top/anime → 429"` → catch → `items = []`. Esto explicaría fallo en anime/manga pero no en movie (TMDB es más permisivo). Sin embargo, los tests reportaron fallo en movie también (el control), lo que hace esta hipótesis menos probable como causa única.

**Conclusión:** H1 + H3 son las causas más probables para los 4/4 fallos. El catch silencioso en `discover/page.tsx` es la razón por la que el bug no produce un error visible — solo un grid vacío idéntico al estado "sin resultados" del año filter. Para confirmar si es H3: verificar el output del dev server arrancado por Playwright (¿hay errores de TMDB en los logs?). El servidor de desarrollo de Next.js loguea los errores de fetch en el proceso, no en el browser.

**Nota sobre "comic" en Discover:** `DiscoverClient` muestra "comic" como opción de tab en el FilterBar, pero `discover/page.tsx` no tiene `case "comic"` en el switch — cae al `default:` que carga películas. Esto es un bug silencioso adicional no reportado en B3.5b: el tab "comic" muestra películas en lugar de error. Deuda detectada.

### Archivos implicados

- `src/app/[locale]/(app)/discover/page.tsx` — líneas 48-104 (try/catch silencia todos los errores de API)
- `playwright.config.ts` — líneas 39-46 (env del webServer, propagación de TMDB_API_KEY)
- `.env.test.local` (no en repo) — verificar si sobreescribe o vacía TMDB_API_KEY
- `src/lib/api/jikan.ts` — `getPopularAnime`, `getPopularManga` (sin retry en 429)
- `src/lib/api/tmdb.ts` — `getPopularMovies` (verificar manejo de errores)

### Test E2E correspondiente

`tests/e2e/b3_5e_safety_net/discover-pagination.spec.ts` — 4/4 ROJO.

### Refuerzo de aserciones recomendado para B3.5c-3

1. Antes de los asserts de cards, verificar que el grid no está en estado de error silencioso: `expect(page.locator('[data-empty]')).not.toBeVisible()` (MediaGrid añade `data-empty` al div de estado vacío).
2. Capturar logs del servidor para detectar errores de fetch: difícil en Playwright, pero posible via `page.on('requestfailed', ...)`.
3. Diagnóstico previo al fix: ejecutar manualmente `npm run dev` con las mismas env vars que Playwright y navegar a `/discover` — si funciona, el problema es de propagación de env.

---

## Cuadro resumen

| # | Bug | Severidad | Estado red de seguridad | Causa identificada |
|---|---|---|---|---|
| 1 | chat POST 500 | 🔥 | ROJO ✓ | RLS rechaza INSERT en `conversations` — sesión no propagada correctamente al Route Handler (H1 alta confianza); o conversation_members bulk insert falla por policy row-level (H2) |
| 2 | /lists sin enlace | 🟡 | Sin test | Omisión: `/lists` no está en `NAV_ITEMS` (NavLinks) ni en `items` (BottomNav) |
| 3 | idioma no cambia textos | 🔥 | VERDE-INESPERADO | Confirmada: 19 strings hardcoded ES en 4 componentes de Home + home/page.tsx — no usan `t()` |
| 4 | GroupFeed no publica | 🔥 | VERDE-INESPERADO (test skipeado) | Silent fail: `await supabase.from('group_posts').insert(...)` sin captura de error; RLS puede rechazar el INSERT si la sesión del browser client no es válida |
| 5 | notifications roto | 🔥 | VERDE-INESPERADO | `getNotifications()` puede lanzar sin try/catch en page.tsx (H2); o payload con `mediaId = undefined` causa TypeError en `mediaId.split('_')` (H1) |
| 6 | discover vacío | 🔥 | ROJO ambiguo (4/4) | try/catch silencioso en Server Component devuelve `items=[]` al fallar las APIs externas; causa probable: `TMDB_API_KEY` no propagada al dev server de Playwright (H3 + H1) |
