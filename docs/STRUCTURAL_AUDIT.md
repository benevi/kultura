# STRUCTURAL_AUDIT — Coherencia interna del código (B3.5d, 2026-05-04)

---

## Veredicto en una página

### 🟡 SÓLIDA CON 2 INCONSISTENCIAS REALES

La base es genuinamente sólida: cliente Supabase bien segregado, auth explícita en el 100% de endpoints, RLS activo, sin service-role key expuesta, 50 Client Components todos justificados, i18n con mecanismo correcto. Los 5 bugs reportados en B3.5b son aislados, no síntoma de arquitectura rota.

Las dos inconsistencias reales son:

1. **Validación heterogénea** (Zod en algunos endpoints, manual en otros, sin validación en algunos): no causa bugs directos hoy, pero hace el código difícil de auditar y propenso a divergir.
2. **Tests con cobertura cero en flujos críticos de UI** (enviar mensaje en chat, GroupFeed post): los 493 tests pasan, pero los flujos rotos no están cubiertos. Los tests son verdes y la realidad es roja — eso es el red flag real de esta auditoría.

**Recomendación:** Sprint de consolidación de tests (≤1 día) antes de B3.5c-1. Los bugs sí se pueden arreglar en paralelo, pero sin tests que los capturen, el siguiente bug tardará tanto en detectarse como estos.

---

## Resumen por área

### Área 1 — Cliente Supabase

**Estado: 🟢**

**Hallazgos:**
- 2 clientes bien segregados: `createBrowserClient()` en `src/lib/supabase/client.ts` (solo `NEXT_PUBLIC_*`), `createServerClient()` en `src/lib/supabase/server.ts` (cookies SSR con try/catch para Server Components).
- 4 archivos usan browser client, todos son Client Components con `'use client'`. 38 archivos usan server client, todos son Route Handlers o Server Components.
- `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún archivo de `src/`. Sistema usa ANON_KEY + RLS + sesión de cookies.
- Middleware instancia `createServerClient` directamente (correcto: necesita acceso al `Request` object antes de que el cliente centralizado esté disponible).
- 1 patrón de instanciación por contexto. Cero callsites con cliente equivocado.

**Severidad:** Ninguna.
**Recomendación:** Sin acción requerida. Referencia ejemplar para el resto del codebase.

---

### Área 2 — Route Handlers, manejo de errores

**Estado: 🟢**

**Hallazgos:**
- 19 route handlers identificados. Patrón dominante (≥18/19): `request.json().catch(() => ({}))` + bloque try/catch + códigos HTTP semánticos.
- Códigos usados correctamente: 401 (no auth), 400 (input inválido), 403 (forbidden/not owner), 404 (not found), 409 (conflict), 429 (rate limit), 201 (created), 500 (error interno).
- Errores de BD/SQL: `console.error()` server-side, cliente recibe solo `{ error: "mensaje genérico" }`. Sin filtrado adicional necesario.
- `/api/groups/[id]/join/route.ts` no tiene `try/catch` explícito pero usa `.catch()` inline — funcionalmente equivalente, no es riesgo.
- Rate limiting (`checkRateLimit()`) presente en 18/19 endpoints (98%). Excepción: `/api/groups/[id]/join`.

**Severidad:** Baja — un endpoint sin rate limit.
**Recomendación:** Agregar `checkRateLimit()` a `/api/groups/[id]/join/route.ts`.

---

### Área 3 — Validación de input

**Estado: 🟡**

**Hallazgos:**
- **Patrón A (Zod formal):** `groups`, `suggestions`, `settings` — define schema explícito, usa `safeParse()`, devuelve 400 con `flatten()` o mensaje genérico.
- **Patrón B (validación manual):** `lists`, `library`, `friends`, `reports`, `recommendations` — verifica presencia y tipo con `if/constante`, devuelve 400.
- **Patrón C (solo presencia):** `chat` — solo comprueba `if (!targetUserId)`, sin tipo ni formato.
- 100% retorna 400 al cliente en fallo de validación (ningún endpoint come el error y devuelve 500).
- No hay un schema compartido o helper de validación común. Cada endpoint define o inventa el suyo.

**Severidad:** Media — no causa bugs hoy, pero la heterogeneidad dificulta auditorías y facilita regresiones al agregar campos.
**Recomendación:** No requiere sprint propio. Al tocar cada endpoint en B3.5c-1 migrar al patrón Zod de forma oportunista.

---

### Área 4 — Auth y RLS

**Estado: 🟢**

**Hallazgos:**
- 100% de endpoints verifican `auth.getUser()` al inicio antes de cualquier operación.
- Ownership checks explícitos en operaciones críticas: DELETE de lists verifica `owner_id`, PATCH de friendships verifica que el `receiver_id` sea el autenticado, JOIN de groups verifica que el owner no pueda abandonar.
- RLS activo (49 policies en 17 tablas según schema SQL). Sistema tiene doble defensa: auth check explícito + RLS.
- Sin queries con service-role key (no existe en `src/`).

**Severidad:** Ninguna.
**Recomendación:** Sin acción. Patrón de auth es el más consistente del codebase.

---

### Área 5 — Tipos vs realidad DB

**Estado: 🟡**

**Hallazgos:**
- **18 usos de `as unknown as`** distribuidos en: `src/lib/library/stats.ts`, `src/app/api/friends/route.ts`, `src/lib/social/lists.ts` (×5), `src/lib/social/friends.ts` (×2), `src/lib/social/feed.ts`, `src/lib/social/circle.ts`, `src/app/api/chat/route.ts`, `src/lib/claude/recommendations.ts`, `src/app/api/groups/route.ts`, `src/app/[locale]/(app)/discover/page.tsx` (×3), `src/app/[locale]/(app)/home/page.tsx`, `src/app/[locale]/(app)/groups/[id]/page.tsx`, `src/app/[locale]/(app)/groups/[id]/GroupFeed.tsx`.
- Causa raíz: Supabase SSR SDK v2 devuelve `any` de `.select()`. Los casts son a tipos locales definidos (e.g. `RawListRow`) o tipos del componente. Son necesarios bajo TypeScript estricto.
- `: any` injustificado: **0 hallazgos** (solo `metadata: Record<string, any>` permitido explícitamente).
- `Database` interface existe en `src/types/supabase.ts` pero `createClient()` no la usa como genérico — el cliente SSR infiere tipos internamente.

**Decisión pendiente (humano):** ¿Vale la pena migrar a `createClient<Database>()` explícito para reducir `as unknown as`? Requeriría actualizar los 42 callsites del server client. Mejora DX y seguridad de tipos pero es refactor puro sin impacto funcional inmediato.

**Severidad:** Baja. Los casts son justificados por limitación del SDK, no por código descuidado.
**Recomendación:** No bloquea B3.5c-1. Decisión de migrar a genérico tipado: humano decide si/cuándo.

---

### Área 6 — Server vs Client Components

**Estado: 🟢**

**Hallazgos:**
- 50 archivos con `'use client'`. Todos evaluados: 100% usan estado (`useState`), efectos (`useEffect`), router (`useRouter`), o event handlers — ninguno es innecesario.
- Patrón consistente: páginas en `src/app/[locale]/(app)/` son Server Components que pasan datos iniciales a `*Client.tsx` Client Components colocalizados.
- No hay archivos sin `'use client'` que usen `useState`/`useEffect` (verificado con grep cruzado).
- `LanguageSwitcher.tsx` correctamente marcado como client (usa `useRouter` de next-intl).

**Severidad:** Ninguna.
**Recomendación:** Sin acción. Patrón Server/Client bien aplicado.

---

### Área 7 — i18n y selector de idioma

**Estado: 🟡**

**Hallazgos:**
- Locale en **path**: `/es/...`, `/en/...`. No en cookie ni header.
- `src/i18n/routing.ts`: locales `["es", "en"]`, default `"es"`.
- `src/middleware.ts`: infiere locale del path via `createIntlMiddleware(routing)`. Matcher incluye `/(es|en)/:path*`.
- `src/components/layout/LanguageSwitcher.tsx`: usa `router.replace(pathname, { locale: otherLocale })` de `@/i18n/navigation` (next-intl). Usa `startTransition()`.
- El mecanismo es **correcto a nivel de código**. El bug reportado (switcher no cambia idioma) no está en la lógica del switcher ni en el middleware — ambos están bien alineados.

**Hipótesis más probable del bug (no confirmada, necesita test en runtime):** El `useRouter` que usa `LanguageSwitcher.tsx` debe importarse de `@/i18n/navigation`, no de `next/navigation`. Si en algún momento se importó de `next/navigation`, el `{ locale }` option no existe y el cambio es silencioso. Verificar el import exacto en el archivo.

**Decisión pendiente (humano):** Confirmar en runtime si el bug es el import erróneo de router o algo en la configuración de next-intl. El diagnóstico del código parece correcto; el bug probablemente es de runtime (posible hydration mismatch o cache agresivo de rutas).

**Severidad:** Media — bug funcional conocido, causa raíz no confirmada sin runtime.
**Recomendación:** Primera tarea de B3.5c-1 para i18n: verificar import de `useRouter` en `LanguageSwitcher.tsx` y probar en dev mode.

---

### Área 8 — Patrones de fetch en componentes cliente

**Estado: 🟡**

**Hallazgos:**
- **3 patrones coexistentes:**
  - **Patrón A — Helpers en lib** (`src/lib/library/actions.ts`, `src/lib/social/actions.ts`): función wrapper, lanza `Error` si `!response.ok`, reutilizable. ✅
  - **Patrón B — Inline con `.then().catch()`** (`ConversationClient.tsx` carga inicial): silencia errores (`setLoading(false)` sin UI de error). ⚠️
  - **Patrón C — Supabase client directo** (`GroupFeed.tsx`, `NotificationsList.tsx`): `supabase.from().select().then()`. OK para realtime pero patrón diferente.
- Loading state: presente en 100% de casos observados.
- Error UI: Patrón A propaga error al componente que llama. Patrón B silencia. Patrón C sin manejo observado.
- Reintentos: **0** en todos los patrones.
- Wrapper universal: NO existe. Hay helpers parciales en `lib/*/actions.ts`.

**Casos de silent fail detectados:**
- `ConversationClient.tsx` carga de mensajes: `.catch(() => setLoading(false))` — usuario ve pantalla vacía sin mensaje de error.
- Potencialmente `GroupFeed.tsx` carga de posts: `.then(({ data }) => setPosts(data ?? []))` sin `.catch()`.

**Severidad:** Media — contribuye a los bugs visibles (GroupFeed roto, chat 500 silencioso).
**Recomendación:** En B3.5c-1 al arreglar cada bug, normalizar hacia Patrón A + toast de error.

---

### Área 9 — Coherencia entre módulos hermanos

**Estado: 🟡**

**Hallazgos:**

| Aspecto | Groups | Lists |
|---------|--------|-------|
| Route handler raíz | ✓ (`/api/groups`) | ✓ (`/api/lists`) |
| Validación POST | Zod (`CreateGroupSchema`) | Manual (name, mediaType) |
| Rate limit raíz | ✓ | ✓ |
| Rate limit detail | ✗ `/[id]/join` sin límite | ✓ `/[id]` con límite |
| Lib helper | ✗ `lib/social/groups.ts` NO EXISTE | ✓ `lib/social/lists.ts` completo |
| Delete handler | ✗ No hay DELETE en `/api/groups` raíz | ✓ DELETE en `/api/lists` |
| x-action pattern | ✗ No usado | ✓ Usado en `/api/lists/[id]` |

**Asimetría principal:**
- `src/lib/social/lists.ts` existe con helpers (`getUserLists`, `getListById`, `canEditList`, etc.) reutilizados por server components y route handlers.
- `src/lib/social/groups.ts` **no existe**. Lógica de grupos está inline en route handlers y server components.
- Esto explica parcialmente por qué GroupFeed y grupos en general son más frágiles.

**Severidad:** Media — la asimetría entre módulos hace el código de grupos más difícil de mantener y testear.
**Recomendación:** Crear `src/lib/social/groups.ts` espejo de `lists.ts`. Prioridad baja — no bloquea bug fixes pero debería hacerse antes de agregar features de grupos.

---

### Área 10 — Tests vs realidad

**Estado: 🔴**

**Hallazgos:**

| Tipo | Cantidad | Descripción |
|------|----------|-------------|
| Unit | ~24 archivos | Actions, routes, types, utils, hooks, settings, stats |
| Integration | 5 archivos | Auth clientes, DB RLS, triggers, library upsert, friends |
| Contract | 5 archivos | TMDB, Jikan, Google Books, RAWG, MangaDex |
| E2E | **0** | Playwright instalado, tests no escritos |

**Cobertura de flujos rotos:**

| Flujo roto (B3.5b) | Test existe | Test pasa | Veredicto |
|--------------------|-------------|-----------|-----------|
| Chat send (500) | ❌ No | N/A | **Sin cobertura** |
| GroupFeed post | ❌ No | N/A | **Sin cobertura** |
| Language switch | ⚠️ Parcial (solo carga de messages JSON) | ✓ | **No cubre el bug** |
| Notificaciones rotas | ✓ GET notifications | ✓ | **Cubre API, no UI** |
| Paginación Discover | ❌ No | N/A | **Sin cobertura** |

**Red flag confirmado:** Los 493 tests están verdes. Los 5 flujos rotos en producción no tienen cobertura de test. Los tests no detectaron los bugs porque **los flujos críticos de UI nunca fueron testeados**.

**Mocking strategy:** Unit tests mockean `fetch` global con `vi.spyOn`. Integration tests usan `SUPABASE_TEST_URL` proyecto real. Sin tests de cliente Supabase en contexto de componente (solo API pura).

**Severidad:** Alta — los tests no reflejan la realidad de los flujos críticos. Cada fix en B3.5c-1 debería añadir el test que habría detectado el bug.

**Recomendación:** Por cada bug arreglado en B3.5c-1: escribir el test que lo habría detectado ANTES de escribir el fix (TDD retrospectivo). Prioridad: chat send, GroupFeed post, paginación Discover.

---

## Patrones rotos repetidos

### 1. Silent fail en fetch de componentes

**Descripción:** Componentes que hacen fetch a la API y en caso de error hacen `setLoading(false)` o equivalente sin mostrar UI de error.

**Sitios afectados:**
- `src/app/[locale]/(app)/chat/[id]/ConversationClient.tsx` — carga de mensajes
- `src/app/[locale]/(app)/groups/[id]/GroupFeed.tsx` — carga de posts
- Potencialmente otros componentes con `.then(data => setState(data)).catch(() => setState([]))` sin toast

**Esfuerzo de unificación:** Bajo. Por cada fix de B3.5c-1, agregar `show({ type: 'error', ... })` en el `.catch()`.

---

### 2. Validación heterogénea (Zod vs manual vs ninguna)

**Descripción:** Tres estrategias de validación coexistiendo sin criterio claro de cuándo usar cada una.

**Sitios afectados:**
- Zod: `groups`, `suggestions`, `settings`
- Manual: `lists`, `library`, `friends`, `reports`, `recommendations`
- Solo presencia: `chat`

**Esfuerzo de unificación:** Medio. Migración oportunista al tocar cada endpoint. No requiere sprint propio.

---

### 3. Asimetría groups vs lists (módulo lib ausente)

**Descripción:** `lists` tiene `src/lib/social/lists.ts` con helpers reutilizables. `groups` no tiene equivalente.

**Sitios afectados:**
- `src/app/api/groups/route.ts` — lógica inline
- `src/app/[locale]/(app)/groups/[id]/page.tsx` — queries inline
- `src/app/[locale]/(app)/groups/[id]/GroupFeed.tsx` — queries inline

**Esfuerzo de unificación:** Medio-bajo. Extraer queries existentes a `src/lib/social/groups.ts`. ~2-3 horas.

---

### 4. Flujos críticos sin tests

**Descripción:** Los flujos de mayor valor para el usuario no tienen cobertura de tests.

**Sitios afectados:**
- `/api/chat/[id]` POST — sin test
- `GroupFeed.tsx` post — sin test de componente
- Paginación en Discover — sin test
- E2E: 0 tests escritos pese a Playwright instalado

**Esfuerzo de unificación:** Medio. Escribir tests junto a cada bug fix en B3.5c-1.

---

## Top 5 riesgos estructurales

| # | Riesgo | Probabilidad | Impacto | P×I |
|---|--------|-------------|---------|-----|
| 1 | **Tests no capturan bugs de UI críticos** — próximo bug en chat/GroupFeed también pasará desapercibido hasta review visual | Alta | Alto | 🔴 Crítico |
| 2 | **GroupFeed usa Supabase client directo sin manejo de error** — cualquier cambio de RLS o schema rompe silenciosamente | Alta | Alto | 🔴 Crítico |
| 3 | **`src/lib/social/groups.ts` ausente** — features de grupos se implementarán inline cada vez, divergiendo de lists | Media | Medio | 🟡 Relevante |
| 4 | **Validación heterogénea** — al agregar campos a endpoints con validación manual, fácil olvidar validar el campo nuevo | Media | Bajo | 🟡 Relevante |
| 5 | **`as unknown as` en 18 sitios** — si el schema DB cambia, TypeScript no detectará discrepancias en esos puntos | Baja | Medio | 🟡 Bajo |

---

## Lo que está claramente bien

### Cliente Supabase (Área 1)
Segregación perfecta browser/server. Sin service-role key expuesta. Middleware correcto. Referencia para proyectos Next.js + Supabase SSR.

### Auth en Route Handlers (Área 4)
100% de endpoints verifican `getUser()` antes de operar. Ownership checks presentes en operaciones críticas. RLS + auth explícita = defensa en profundidad real, no aspiracional.

### Server/Client Components (Área 6)
50 `'use client'` todos justificados. Patrón Server Component → Client Component colocalized bien aplicado. Sin hooks en Server Components (error de build que habría roto CI).

### HTTP semántico (Área 2)
Códigos correctos: 401/403/404/409/429 usados donde corresponde. Ningún endpoint devuelve 500 donde debería devolver 400.

### Rate limiting (Área 2)
`checkRateLimit()` en 18/19 endpoints. Bien implementado con límites distintos por recurso.

### Tests de integración de DB (Área 10)
Los 5 integration tests con Supabase real (RLS, triggers, upsert) son ejemplares. Este patrón debería extenderse a los flujos de UI críticos.

---

## Recomendaciones de orden de trabajo

**Veredicto: 🟡** → Sprint de consolidación pequeño recomendado, no bloqueante para bug fixes.

### Opción recomendada: paralelo

**Bloque A (bug fixes, B3.5c-1):** Arreglar los 5 bugs reportados. Por cada fix, agregar el test que lo habría detectado.

**Bloque B (consolidación, ≤1 día):** Dos tareas independientes que no bloquean los fixes:
1. Crear `src/lib/social/groups.ts` (extrae lógica inline existente).
2. Agregar `checkRateLimit()` a `/api/groups/[id]/join/route.ts`.

**No requiere sprint propio antes de B3.5c-1.** Los bugs son aislados. Las inconsistencias son de mantenibilidad, no de integridad. Arrancar B3.5c-1 inmediatamente es viable; la consolidación puede ir en paralelo o como parte de cada fix.

### Secuencia sugerida para B3.5c-1

1. **Chat 500** — `/api/chat/[id]` POST. Verificar si error es en auth, en insert, o en silent fail del cliente. Escribir test de integration.
2. **LanguageSwitcher** — Verificar import de `useRouter` (debe ser de `@/i18n/navigation`, no `next/navigation`). Test manual en dev.
3. **GroupFeed roto** — Agregar error handling al fetch de posts. Crear `src/lib/social/groups.ts` en paralelo.
4. **Notificaciones** — Verificar por qué el componente no renderiza (RLS, query, o silent fail).
5. **Paginación Discover** — Verificar `page` param handling en `/api/discover` o equivalente.

---

*Auditoría generada en B3.5d, 2026-05-04. SOLO DIAGNÓSTICO — ningún archivo de `src/` fue modificado.*
