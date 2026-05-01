# Análisis completo — Fase 2 KULTURA

**Fecha:** 2026-04-12
**Revisado:** 2026-04-12 (dictamen técnico incorporado)
**Estado:** CERRADA ✅ — Fase 3 iniciada
**Tareas:** 2.0 – 2.9 (10/10)
**Tests:** 221 pasando (140 nuevos), 0 failures
**Build:** limpio
**Archivos de producción nuevos:** ~2.160 líneas en 22 archivos

---

## Resumen ejecutivo

10 tareas completadas. La Fase 2 construyó toda la capa de datos externa: 6 módulos de API, un normalizer unificado, búsqueda global resiliente, página discover con paginación y filtros por tipo, y página de detalle con tráiler y streaming providers. El patrón `Promise.allSettled` aplicado consistentemente garantiza que ninguna API caída bloquea al usuario. La arquitectura Server/Client Component está bien separada. Hay dos deudas de seguridad que deben incorporarse a BLOCKERS antes de iniciar Fase 3 (API keys en cliente, CSP para iframe YouTube), más seis observaciones de robustez documentadas a continuación.

---

## 1. Deuda técnica resuelta de Fase 1 (2.0 / SPEC-010)

**Resuelto correctamente:**

- `synopsis` añadida a tabla `media` via migración no-destructiva (`002_add_synopsis.sql`: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS synopsis text`). Filas existentes reciben `NULL` — sin impacto en datos previos. Migración idempotente — segura para re-ejecutar.
- `DbMedia` en `src/types/supabase.ts` actualizado: `synopsis: string | null` en `Row`, `synopsis?: string | null` en `Insert`.
- Trigger `handle_new_user()` envuelto en `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION ...` — fallo silencioso eliminado.
- `LoginPage` bug de texto hardcodeado corregido con `tAuth("tagline")`.
- `Footer`: año dinámico con `new Date().getFullYear()`.

**Resuelto parcialmente — `NEXT_PUBLIC_SITE_URL`:**

`window.location.origin` en `handleReset` fue sustituido por `process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin`. Resuelve el problema en producción si la variable está configurada, pero el `??` como fallback significa que si la variable no está definida en algún entorno (staging, nueva máquina de desarrollo), el bug original vuelve silenciosamente. Patrón más robusto:

```typescript
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not defined");
```

La solución completa requiere validación de entorno al arranque (patrón `t3-env` / Zod). Registrado como deuda media.

---

## 2. lib/api/ — 6 módulos + normalizer (2.1–2.5 / SPEC-011)

### 2.1 Arquitectura de módulos

Cada módulo API tiene tipos internos concretos (sin `any`), un helper de fetch privado con parámetros base, y funciones exportadas con nombres descriptivos. El patrón es consistente entre los 6 módulos.

**tmdb.ts (195 líneas):** Helper `tmdbFetch<T>` inyecta `language=es-ES` en todas las llamadas. Tipos internos (`TmdbMovieDetail`, `TmdbTVDetail`) incluyen los campos opcionales `videos`, `watch/providers` y `credits` — se piden vía `append_to_response` en las llamadas de detalle, evitando llamadas extra.

**jikan.ts (118 líneas):** Sin API key. Rate limiting de Jikan (3 req/s) no gestionado con reintentos — ver sección 4.4 para el impacto real.

**googlebooks.ts / openlibrary.ts:** Google Books es la fuente principal (`langRestrict=es`). Open Library es fallback — tiene normalizer propio pero no se usa en el discover actual.

**mangadex.ts:** La extracción del cover requiere recorrer `relationships[]` buscando `type === "cover_art"` — función helper `extractMangaCover` bien encapsulada.

**rawg.ts:** Rating RAWG es 0–5. Normalización a 0–10 (×2) correcta y documentada.

### 2.2 API keys `NEXT_PUBLIC_` — deuda de seguridad media-alta

El análisis inicial describía esto como aceptable. No lo es sin matices. `NEXT_PUBLIC_` expone la variable en el bundle del cliente — visible en DevTools sin autenticación. Consecuencias concretas:

- **TMDB:** Rate limiting de 40 req/10s por IP, pero la key en sí no debería ser pública. Si se usa para abusar la API desde otra aplicación, TMDB puede revocarla.
- **Google Books:** Google puede generar costes si se excede la cuota con una key comprometida. La cuota gratuita es de 1.000 req/día.
- **RAWG:** Similar — key comprometida puede agotar la cuota de la cuenta.

Los fetches que actualmente usan estas keys en el servidor (páginas Server Component) son seguros. El problema real es si alguno de estos fetches se mueve al cliente en el futuro — la key ya estaría expuesta. La solución correcta es mover todos los fetches a Route Handlers y usar variables sin `NEXT_PUBLIC_`. Documentado como deuda media-alta.

### 2.3 Normalizer (308 líneas)

El normalizer es el archivo más importante de la Fase 2. Cada función recibe el tipo crudo de su API y devuelve un `MediaItem` con garantías:

- `id` siempre `"{type}_{externalId}"` con `externalId` siempre `string`
- `poster` siempre URL completa o `undefined` (nunca path relativo)
- `year` extraído con regex `/^(\d{4})/` — robusto a variantes de formato de fecha
- Rating normalizado: TMDB/MAL passthrough (0–10), Google Books `×2`, RAWG `×2`
- `streamingProviders` extraídos para región ES con prioridad `flatrate > rent > buy`

**`extractProviders` duplicado:** Función existe en `normalizer.ts` y casi idéntica (`extractProvidersES`) en `src/app/[locale]/media/[type]/[id]/page.tsx`. La versión en `page.tsx` retorna `[]` en vez de `undefined`. No causa bugs pero añade superficie de mantenimiento. Deuda menor — refactor en Fase 6.

### 2.4 Type casts en la frontera list→detail

`getPopularMovies` devuelve `TmdbMovie[]` (lista, sin `credits`/`videos`/`watch/providers`). El normalizer espera `TmdbMovieDetail`. El cast `as unknown as TmdbMovieDetail` en `discover/page.tsx:53,61,95` y `as JikanAnimeDetail` en `search.ts:47,52` es estructuralmente correcto — los campos extra opcionales simplemente quedan `undefined`. Sin embargo, es frágil: si la API añade un campo requerido en `TmdbMovieDetail`, TypeScript no lo detectará en los puntos de cast.

**Impacto:** Bajo ahora. Resoluble en Fase 6 creando `TmdbMovieSummary` para listas o unificando los tipos donde sea posible.

---

## 3. Página discover (2.6 / SPEC-012)

**Correcto:** `page.tsx` es Server Component puro — fetch en servidor, sin keys expuestas. `DiscoverClient` gestiona los filtros via `router.push` con searchParams — estado en URL, back-button funcional, enlaces compartibles.

**Workaround para libros — `searchBooks("popular")`:** Google Books no tiene endpoint de "populares". Se usa `searchBooks("popular", startIndex)` como proxy. Consecuencia no documentada anteriormente: la query "popular" en Google Books no tiene ordenación reproducible — el mismo usuario paginando en dos sesiones distintas puede recibir resultados en orden diferente, o incluso solapados entre páginas. No es un bug crítico pero es comportamiento confuso. Se limita a 50 páginas para evitar resultados vacíos. Documentado como comportamiento conocido.

**`generateMetadata` en discover:** La metadata del título está hardcodeada por locale (`"Descubrir"` / `"Discover"`) en vez de usar i18n. Rompe el patrón del resto de páginas. Deuda trivial — añadir key `discover.title` al namespace.

---

## 4. Búsqueda global (2.7 / SPEC-013)

### 4.1 searchAll — resiliencia y degradación silenciosa

`Promise.allSettled` garantiza que si una API cae, los demás resultados siguen disponibles. Cada tipo fallido devuelve `[]`. Sin embargo, la interfaz `SearchResults` no incluye información sobre qué fuentes fallaron. Si Jikan cae durante una búsqueda de anime, el usuario ve cero resultados de anime sin ningún mensaje de error diferenciado. El comportamiento es correcto para resiliencia pero carece de feedback de degradación.

Solución a documentar para Fase 6: añadir `partialFailure?: string[]` a `SearchResults` — lista de tipos que fallaron. La UI puede mostrar un banner "Algunos resultados pueden no estar disponibles".

### 4.2 Autocomplete — Route Handler `/api/search`

Diseño correcto: solo TMDB (velocidad), 3 películas + 2 series, límite 5, guard `q.length < 2`. No hay rate limiting propio en el Route Handler — delega en el rate limiting de TMDB. Para escala inicial es suficiente.

**Ausencia de caché HTTP:** El Route Handler no añade cabeceras `Cache-Control`. Queries frecuentes como `"batman"` se resuelven contra TMDB en cada request. En Fase 6: `Cache-Control: public, s-maxage=60`.

### 4.3 SearchBar — debounce y accesibilidad

400ms de debounce correcto. El dropdown usa `<ul>/<li>/<button>` — semánticamente correcto. Cierre con `mousedown` en lugar de `click` previene el flicker si el botón recibe focus antes del click.

**Sin navegación por teclado en sugerencias:** El dropdown no implementa flechas ↑↓. El usuario puede cerrar con Escape y enviar con Enter, pero no puede seleccionar una sugerencia específica por teclado. WCAG 2.1 recomienda `role="listbox"` + navegación por teclado para este patrón. Deuda de accesibilidad — Fase 6.

### 4.4 Jikan sin reintentos — el riesgo real

El riesgo no es solo de escala. Jikan es API pública no oficial de MyAnimeList con historial de caídas frecuentes y mantenimiento irregular. Sin reintentos con backoff exponencial, una caída parcial de Jikan durante una búsqueda de anime devuelve `[]` silenciosamente — el usuario no sabe si no hay resultados o si el servicio está caído. Conectado con el punto 4.1: el flag `partialFailure` resuelve también este caso.

### 4.5 Exclusión de manga del autocomplete

Correcto y documentado. La búsqueda completa de manga sí funciona vía `searchAll` en `/search`.

---

## 5. Página de detalle (2.8 / SPEC-014)

### 5.1 Fetch paralelo por tipo

| Tipo | Fetches paralelos | Notfound si falla |
| --- | --- | --- |
| movie | detail + videos + providers | solo detail |
| tv | detail + videos + providers | solo detail |
| anime | detail + videos | solo detail |
| manga | detail solo | sí |
| book | detail solo | sí |
| game | detail solo | sí |

`Promise.allSettled` para movie/tv/anime — videos y providers son opcionales, su fallo no genera 404. `catch(() => null)` para manga/book/game — fetch único, fallo → 404. Patrón consistente.

### 5.2 generateMetadata — doble fetch y deduplicación

`generateMetadata` hace su propia llamada a la API, idéntica a la del Page. La deduplicación de `fetch()` nativo en Next.js 14 aplica cuando se llama con la misma URL y las mismas opciones dentro del mismo render cycle. Sin ver las opciones exactas de fetch en ambos puntos no se puede confirmar si la deduplicación actúa o si son dos llamadas reales. El documento debería ser preciso: si ambas llamadas usan el mismo cache mode (por defecto `force-cache` en Server Components), la deduplicación aplica y el impacto es nulo. Si alguna usa `cache: 'no-store'`, son dos llamadas reales. Pendiente de verificar en Fase 6 con `--debug` en el build.

### 5.3 MediaDetail — Server Component async

`MediaDetail` usa `getTranslations` del servidor — correcto. `priority` solo en poster (above-the-fold), sin `priority` en backdrop — correcto.

**`<img>` nativo en StreamingProviders y SearchBar:** Logos de providers y thumbnails de sugerencias usan `<img>` nativo con `// eslint-disable-next-line @next/next/no-img-element`. Decisión documentada en SPEC-014 (muchos elementos pequeños). Es pragmático pero genera warnings de ESLint que hay que silenciar manualmente.

### 5.4 CSP para iframe YouTube — deuda de seguridad

`TrailerEmbed` embebe un `<iframe>` de `youtube-nocookie.com`. Sin cabecera `Content-Security-Policy` que incluya `frame-src https://www.youtube-nocookie.com`, el iframe puede ser bloqueado en entornos corporativos. Más importante: la ausencia de CSP es una vulnerabilidad de seguridad web básica — sin ella, no hay protección contra XSS vía iframes inyectados. La configuración correcta va en `next.config.mjs` via `headers()`:

```javascript
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; frame-src https://www.youtube-nocookie.com; ..."
}
```

Documentado como deuda de seguridad media — registrar en BLOCKERS.

### 5.5 Tipo en page.tsx — `eslint-disable`

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let item: ReturnType<typeof normalizeMovie> | undefined;
```

Simplificable a `let item: MediaItem | undefined` — misma semántica, sin disable. Deuda trivial.

---

## 6. Error boundaries — ausencia en Client Components

El análisis inicial no lo mencionaba. `DiscoverClient`, `SearchBar` y `SearchClient` son Client Components. Si alguno lanza una excepción en runtime (por ejemplo, respuesta de API con forma inesperada que el normalizer no manejó), el error desmontaría toda la página sin mensaje al usuario. En Next.js App Router la solución estándar es `error.tsx` por ruta — actúa como Error Boundary para todo el árbol de esa ruta.

**A verificar:** ¿Existe `src/app/[locale]/discover/error.tsx`, `src/app/[locale]/search/error.tsx`, `src/app/[locale]/media/[type]/[id]/error.tsx`? Si no, es deuda de robustez media.

---

## Cobertura de tests

| Archivo / Área | Tests | Tipo |
| --- | --- | --- |
| `normalizer.test.ts` | 72 | Unit — fixtures hardcodeadas por función |
| `search.test.ts` | 25 | Unit — mocks de los 6 módulos API |
| `MediaDetail.test.tsx` | 31 | Unit |
| `StreamingProviders.test.tsx` | 9 | Unit |
| `TrailerEmbed.test.tsx` | 8 | Unit |
| `SearchBar.test.tsx` | 12 | Unit |
| `SearchResults.test.tsx` | 21 | Unit |
| **Total Fase 2 nuevos** | **178** | — |
| **Total acumulado** | **221** | — |

**Deuda oculta de los fixtures del normalizer:** Los 72 tests con fixtures hardcodeadas son el activo más valioso de la Fase 2. Pero los fixtures están congelados en el formato de respuesta actual de las APIs. Si TMDB cambia el formato de un campo, los tests siguen pasando porque los fixtures tienen el formato antiguo — exactamente el escenario que deberían prevenir. La solución es tests de contrato complementarios: una llamada real a la API que valide la forma de la respuesta contra el schema esperado. Esto es lo que BLOQ-002 debería cubrir — el análisis lo identifica pero no lo liga explícitamente a los fixtures.

**Sin tests de integración de APIs reales:** Los tests del normalizer y search usan mocks. Si una API externa cambia su contrato, los tests pasan pero la app falla en producción.

---

## Deuda técnica — estado al cierre de Fase 2

| Prioridad | Tema | Estado |
| --- | --- | --- |
| 🔴 Alta (seguridad) | `BLOQ-001` tests integración Supabase sin CI | ⏳ Pendiente — registrado en BLOCKERS.md |
| 🔴 Alta (seguridad) | Rate limiting Route Handlers sin definir | ⏳ DEC pendiente antes de usuarios reales |
| 🔴 Media-alta (seguridad) | API keys `NEXT_PUBLIC_` expuestas en bundle cliente | ⏳ Mover fetches a Route Handlers — Fase 6 |
| 🔴 Media (seguridad) | CSP ausente — iframe YouTube sin `frame-src` | ⏳ Añadir en `next.config.mjs` — Fase 6 |
| 🟡 Media | `NEXT_PUBLIC_SITE_URL ?? window.location.origin` — fallback silencioso | ⏳ Validación de entorno al arranque — Fase 6 |
| 🟡 Media | Error boundaries (`error.tsx`) no verificados en rutas Fase 2 | ⏳ Verificar y añadir — Fase 3 |
| 🟡 Media | `searchAll` sin `partialFailure` — degradación silenciosa sin feedback | ⏳ Fase 6 — UX de resiliencia |
| 🟡 Media | Doble fetch en `generateMetadata` + Page — deduplicación no verificada | ⏳ Verificar con build `--debug` — Fase 6 |
| 🟡 Media | `extractProviders` duplicado en normalizer y page.tsx | ⏳ Refactor menor — Fase 6 |
| 🟡 Media | Type casts `as unknown as TmdbMovieDetail` en discover y search | ⏳ Tipos lista vs. detalle — Fase 6 |
| 🟡 Media | Fixtures del normalizer congelados — BLOQ-002: tests de contrato | ⏳ Fase 6 |
| 🟡 Media | Autocomplete sin navegación por teclado (accesibilidad WCAG) | ⏳ Fase 6 |
| 🟡 Media | `avatar_initials` desync | ⏳ Pendiente hasta Fase 3 (edición de perfil) |
| 🟢 Baja | `generateMetadata` en discover hardcodea locale en vez de i18n | ⏳ Trivial — Fase 6 |
| 🟢 Baja | Jikan sin reintentos — caída de API invisible al usuario | ⏳ Resuelto por `partialFailure` cuando se implemente |
| 🟢 Baja | `searchBooks("popular")` — paginación sin orden reproducible | ⏳ Comportamiento conocido y aceptado |
| 🟢 Baja | Autocomplete sin `Cache-Control` en Route Handler | ⏳ Fase 6 — optimización |
| 🟢 Baja | `<img>` nativo en providers y autocomplete genera ESLint warnings | ⏳ Aceptado — documentado en SPECs |
| 🟢 Baja | `let item: ReturnType<...>` → simplificar a `let item: MediaItem` | ⏳ Trivial — Fase 6 |
| 🟢 Baja | `list_items` RLS con subqueries sin índices | ⏳ Fase 6 — índices |

---

## Lo que se hizo bien

**Normalizer como contrato único.** Todos los componentes de UI reciben `MediaItem` — ninguno sabe qué API está detrás. Cuando en Fase 5 el AI-agent necesite comparar dos títulos de fuentes distintas, operará sobre el mismo tipo.

**`Promise.allSettled` consistente.** Aplicado en `searchAll`, en el Route Handler de autocomplete, y en los fetches de detalle para movie/tv/anime. Una API caída nunca bloquea al usuario — degrada graciosamente. El gap es el feedback de degradación, no la resiliencia en sí.

**Estado en URL.** Discover y search mantienen el estado en `searchParams`. Back-button funciona, las URLs son compartibles, sin estado de React para lo que puede ser URL.

**Server Components para fetch.** `page.tsx` de discover, search y media detail hacen todos sus fetches en el servidor. El riesgo de las `NEXT_PUBLIC_` keys está en la exposición del bundle, no en que se filtren en los logs del servidor.

---

## Veredicto

La Fase 2 entrega una capa de APIs robusta y bien abstraída. El normalizer es el activo más valioso. La deuda nueva identificada en este dictamen añade dos items de seguridad (API keys en bundle, CSP para YouTube) que deben registrarse en BLOCKERS antes de que haya usuarios reales. Los demás puntos son de robustez y no bloquean Fase 3.

**Fase 3 iniciada — Biblioteca personal.**
