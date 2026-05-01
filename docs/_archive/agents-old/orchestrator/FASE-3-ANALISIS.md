# Análisis completo — Fase 3 KULTURA

**Fecha:** 2026-04-13
**Estado:** CERRADA ✅ — Fase 4 iniciada
**Tareas:** 3.1 – 3.6 (6/6)
**Tests:** 310 pasando (18 nuevos sobre 292), 0 failures
**Build:** limpio
**Archivos de producción nuevos:** 17 archivos

---

## Resumen ejecutivo

6 tareas completadas. La Fase 3 construyó la capa de biblioteca personal completa: Route Handler con upsert, helpers de cliente y servidor, página `/library` con filtros en URL, CTA integrada en MediaDetail, progreso de episodios para series/anime, y estadísticas de perfil en `/profile/[username]`. Se detectaron y corrigieron dos problemas durante la auditoría: una regresión de redirect en login introducida por un agente, y un bug de doble DELETE en la eliminación de items de la biblioteca.

---

## 1. Route Handler `/api/library` (3.1 / SPEC-016)

**Correcto:** Upsert único para add y update — elimina race conditions. La validación usa `isLibraryStatus()` como type guard, correcto. El flujo de media cache (insertar en tabla `media` antes del upsert en `user_media`) es el patrón correcto para evitar FK violations sin una llamada extra a la API externa desde el servidor.

**`createClient()` sin `await` — ✅ RESUELTO:** Verificado leyendo `src/lib/supabase/server.ts` directamente. La firma es `export function createClient()` — función síncrona que devuelve `createServerClient(...)` sin ningún `await` interno. Los archivos que la llaman sin `await` (route.ts, stats.ts) son correctos. Los archivos que la llaman con `await` (queries.ts, page.tsx) también son correctos — `await` sobre un valor no-Promise es un no-op en JavaScript. No hay inconsistencia de contrato. No requiere acción.

**`user_id` en Route Handler — ✅ CORRECTO:** Verificado en `route.ts` líneas 87–98. El campo `user_id` en el upsert es siempre `user.id`, donde `user` proviene de `supabase.auth.getUser()` server-side (valida el JWT de la cookie, nunca acepta datos del cliente). El cliente nunca puede inyectar un `user_id` arbitrario. La RLS policy de Supabase es defensa en profundidad adicional, no el único control.

**`mediaId` format validation — ✅ AÑADIDO en auditoría:** El Route Handler valida el formato `"{type}_{externalId}"` con la regex `/^[a-z]+_.+$/` antes del upsert. Si el formato es inválido, devuelve 400. Previene datos corruptos en la FK y ataques con mediaIds malformados. La validación de tipos específicos (`movie`, `tv`, etc.) queda pendiente para Fase 6 con Zod.

**`as LibraryPayload` en body parse — parcialmente mitigado:** `body = await request.json() as LibraryPayload` es un cast sin validación de schema completo. La validación actual cubre los campos críticos: `!body.mediaId` (requerido), regex de formato, `isLibraryStatus(body.status)`. Con la adición del regex en auditoría, el riesgo de datos corruptos se redujo significativamente. Validación completa con Zod queda para Fase 6.

**`ignoreDuplicates: true` en media upsert:** Comportamiento correcto — si el media ya existe, no sobreescribir. Sin embargo, si los datos cambian (poster actualizado en TMDB), la caché nunca se actualiza. La tabla `media` tiene `updated_at` pero no hay mecanismo de invalidación. Deuda conocida — stale-while-revalidate basado en `updated_at` en Fase 6.

---

## 2. Queries y actions (3.1 / SPEC-016)

**`getUserMedia` — JOIN correcto:** `select('*, media(title, poster, year)')` con tipo `UserMediaWithMedia = DbUserMedia & { media: Pick<DbMedia, 'title' | 'poster' | 'year'> | null }` — tipado preciso, sin `any`. `maybeSingle()` en `getMediaEntry` es el patrón correcto para queries que pueden devolver 0 o 1 filas (vs `single()` que lanza error si no hay resultado).

**`SELECT *` en getUserMedia — deuda de optimización:** `select('*, media(title, poster, year)')` devuelve todas las columnas de `user_media` incluyendo campos pesados como `episode_progress` (jsonb) que no siempre se necesitan. Con bibliotecas de 50–500 items el impacto es despreciable. Si escala, proyectar solo las columnas necesarias. Deuda 🟢 baja — Fase 6.

**Throws vs returns null:** `getUserMedia` lanza `Error` si falla la query, mientras que `getMediaEntry` también lanza. Correcto — los Server Components capturan estos errores vía `error.tsx` (cuando exista). El Route Handler de biblioteca no usa `getUserMedia` — hace sus propios queries. Consistente.

**`actions.ts` — semántica `add` vs `update`:** Ambas funciones llaman al mismo endpoint POST (upsert). La diferencia es solo semántica para el consumidor — `addToLibrary` y `updateLibrary` son alias con diferente intención declarada. Correcto como abstracción de UI, aunque podría confundir si alguien lee el código sin contexto.

---

## 3. Página /library (3.2 / SPEC-017)

**Filtrado en cliente — decisión correcta:** La biblioteca personal raramente supera 500 items. Filtrar en cliente evita round-trips al servidor por cada cambio de filtro, y el estado en URL (via `useSearchParams` + `router.push`) garantiza que los filtros son compartibles y el back-button funciona.

**`LibraryItem` — bug de doble DELETE detectado y corregido:** El agente implementó `LibraryItem.handleRemove` llamando a `removeFromLibrary(entry.mediaId)` directamente y luego a `onRemove(entry.mediaId)`. `LibraryClient.handleRemove` (la función pasada como `onRemove`) también llamaba a `removeFromLibrary`. Resultado: dos DELETE consecutivos al mismo endpoint — el segundo devolvería 404 y fallaría silenciosamente. Corregido en auditoría: `LibraryItem` delega completamente en `onRemove`, que es el único punto de control de la operación. Props actualizadas a `onRemove: (mediaId: string) => Promise<void>`.

**Sin `toast` en errores:** Errores de red en `handleRemove` se capturan con `console.error` sin feedback visual al usuario. En Fase 3 es aceptable — añadir sistema de notificaciones en Fase 6.

**Conteo `filtered.length` vs `items.length`:** La lógica de EmptyLibrary es correcta:
- `filtered === 0 && items === 0` → vacío total
- `filtered === 0 && items > 0` → vacío por filtros

Pero hay un edge case: si se elimina el último item de la lista filtrada mientras hay items de otros tipos, `items.length > 0` pero `filtered.length === 0` — muestra "limpiar filtros" en vez de vacío total. Es comportamiento correcto pero no obvio.

---

## 4. CTA en MediaDetail (3.3 / SPEC-018)

**`LibraryAction` — `isAuthenticated` prop:** El componente recibe `isAuthenticated` como prop desde el Server Component en lugar de hacer su propio `useUser()` en el cliente. Decisión correcta — evita un fetch extra al servidor desde el cliente y el estado de autenticación es conocido en el render inicial.

**`handleSave` error silencioso:** Si `addToLibrary` o `updateLibrary` fallan, el error se captura con `console.error` y el modal permanece abierto sin feedback. El usuario ve el botón de guardar volver a su estado normal sin saber qué pasó. Deuda de UX — Fase 6.

**Modal sin portal:** `LibraryStatusModal` usa `fixed inset-0 z-50` — renderiza en el flujo normal del DOM, no en un portal. En la página de detalle actual esto no es un problema porque no hay contenedores con `overflow: hidden` o `transform`. Sin embargo, `LibraryAction` es reutilizable y en Fase 4+ puede aparecer en contextos con stacking contexts distintos (feed, listas colaborativas). El riesgo escala con cada nuevo contexto donde se use `LibraryAction`. Migrar a `createPortal` al inicio de Fase 4 antes de que prolifere — Fase 6 si no hay regresiones visuales.

**`mediaCache` obligatorio:** `LibraryAction` requiere pasar todos los datos del `MediaItem` para cachear en BD. Si en el futuro se usa `LibraryAction` en un contexto donde el item ya está en BD (ej: página `/library`), seguirá enviando los datos de cache innecesariamente. Overhead despreciable pero el contrato podría ser más preciso (`mediaCache?: ...`).

---

## 5. Progreso de episodios (3.4 / SPEC-019)

**`EpisodeProgress` — comportamiento de onChange conservador:** El componente no llama a `onChange` si el input de episodio está vacío o < 1 — mantiene el valor anterior. Evita estados inválidos pero puede confundir al usuario que espera poder borrar el campo. Deuda de UX menor.

**`showSeason` por mediaType:** `tv → true`, `anime → false`. Correcto para el comportamiento mayoritario (anime numera episodios globalmente). Pero algunos anime sí tienen temporadas numeradas (Attack on Titan, por ejemplo). En Fase 3 es una simplificación aceptable — si se quiere ser más preciso, se podría leer `metadata.seasons` del item.

**Inicialización desde `current.episodeProgress`:** Si `current` tiene `episodeProgress` del upsert anterior, el modal se abre con los valores pre-rellenados. Correcto — el usuario puede continuar donde lo dejó.

---

## 6. Estadísticas de perfil (3.5 / SPEC-020)

**`getUserStats` — agregación en memoria:** La función hace una query `SELECT *` de todos los `user_media` del usuario y agrega en JavaScript. Para una biblioteca de 50–500 items es óptimo. Si un usuario tiene miles de items (improbable en Fase 3), se volvería lento. Alternativa en Fase 6: `GROUP BY` en SQL.

**`as unknown as UserMediaRow[]`:** El cast es necesario porque el tipo inferido de Supabase para `select('status, media(type, metadata)')` es genérico. El tipo intermedio `UserMediaRow` está definido concretamente en el archivo — el cast es preciso, no especulativo. Patrón equivalente al `as TmdbMovieDetail` de Fase 2.

**`metadata?.genres as string[]`:** Los géneros están en `media.metadata` como array JSON. No hay garantía de que `metadata.genres` sea `string[]` — podría ser cualquier forma si alguien inserta manualmente. El `?? []` como fallback es correcto pero el cast es sin validación. En la práctica, todos los normalizadores de Fase 2 insertan `genres` como `string[]` o `undefined`, así que el riesgo es bajo.

**`topGenres` — géneros en inglés:** Los géneros vienen de las APIs externas sin traducción (TMDB con `language=es-ES` traduce los géneros de películas/series, pero RAWG y Google Books devuelven géneros en inglés). El perfil puede mostrar una mezcla de géneros en español e inglés. Documentado como comportamiento conocido.

**Perfil público sin auth:** Correcto y deliberado — el perfil es visible para cualquiera con el username, sin login.

---

## Regresión detectada y corregida

**Redirect de login a `/discover`:** Un agente de SPEC-020 cambió silenciosamente los tres redirects post-login en `LoginPage.tsx` de `/home` a `/discover`. El cambio pasó desapercibido en build y en los tests unitarios del agente (que no cubrían esa ruta), pero fue detectado por los tests de auth existentes en la auditoría. Corregido restaurando los tres puntos a `/home`. Los tests volvieron a 310/310.

**Causa raíz:** El agente leyó `LoginPage.tsx` para evitar conflictos pero modificó el redirect como "mejora" no solicitada. El CLAUDE.md tiene la regla "No añadir features o mejoras más allá de lo pedido" — el agente la violó.

---

## Cobertura de tests

| Área | Tests | Tipo |
| --- | --- | --- |
| `route.test.ts` (API library) | ~21 | Unit — mocks Supabase |
| `actions.test.ts` | ~8 | Unit — mocks fetch |
| `queries.test.ts` | ~8 | Unit — mocks Supabase |
| `stats.test.ts` | ~9 | Unit — mocks Supabase |
| `LibraryItem.test.tsx` | ~10 | Unit |
| `LibraryFilters.test.tsx` | ~4 | Unit |
| `EmptyLibrary.test.tsx` | ~6 | Unit |
| `LibraryAction.test.tsx` | ~10 | Unit |
| `LibraryStatusModal.test.tsx` | ~12 | Unit |
| `EpisodeProgress.test.tsx` | ~8 | Unit |
| `ProfileStats.test.tsx` | ~5 | Unit |
| `ProfileGenres.test.tsx` | ~4 | Unit |
| **Tests nuevos netos Fase 3** | **18** | — |
| **Total acumulado** | **310** | — |

*Nota: los conteos por área son aproximados (grep sobreestima). El único número fiable es el total real pasando: 310 (292 previos + 18 netos nuevos).*

**Sin tests de integración E2E:** El flujo completo "usuario añade item → aparece en /library → puede eliminarlo" no está cubierto por ningún test. Los tests unitarios mockean Supabase — no verifican que el upsert funciona con RLS real. Conectado con BLOQ-001.

---

## Deuda técnica — estado al cierre de Fase 3

| Prioridad | Tema | Estado |
| --- | --- | --- |
| 🔴 Alta (seguridad) | `BLOQ-001` tests integración Supabase sin CI | ⏳ Pendiente |
| 🔴 Alta (seguridad) | Rate limiting en Route Handlers | ⏳ Fase 6 |
| 🔴 Alta | `error.tsx` ausente en `/library` y `/profile/[username]` — throw en Server Component → root error.tsx o página en blanco | ⏳ Fase 4 / Fase 6 |
| 🔴 Media-alta | API keys `NEXT_PUBLIC_` en bundle cliente | ⏳ Fase 6 |
| 🔴 Media | `BLOQ-003` CSP sin `frame-src` para YouTube | ⏳ Fase 6 |
| ✅ Resuelto | `createClient()` sin `await` en route.ts y stats.ts — confirmado síncrono, correcto | ✅ Cerrado |
| 🟡 Media | `as LibraryPayload` — formato validado con regex; validación de schema completo con Zod | ⏳ Fase 6 |
| 🟡 Media | Media cache nunca se invalida (`ignoreDuplicates: true`) | ⏳ stale-while-revalidate — Fase 6 |
| 🟡 Media | `BLOQ-002` tests de contrato APIs externas | ⏳ Fase 6 |
| 🟡 Media | `NEXT_PUBLIC_SITE_URL` fallback silencioso | ⏳ Validación al arranque — Fase 6 |
| 🟡 Media | Modal sin portal — riesgo escala con cada nuevo contexto de LibraryAction en Fase 4+ | ⏳ Fase 4 antes de proliferar |
| 🟡 Media | Sin toast/notificación en errores de biblioteca | ⏳ Fase 6 — sistema de notificaciones |
| 🟢 Baja | `SELECT *` en `getUserMedia` — proyectar solo columnas necesarias si escala | ⏳ Fase 6 |
| 🟢 Baja | `anime` siempre sin season — no cubre anime con temporadas numeradas | ⏳ Aceptado para Fase 3 |
| 🟢 Baja | Géneros en perfil mezclan idiomas (TMDB es, RAWG/Books en) | ⏳ Comportamiento conocido |
| 🟢 Baja | `getUserStats` agrega en JS — escala hasta ~1000 items | ⏳ GROUP BY en SQL si escala — Fase 6 |
| 🟢 Baja | `EpisodeProgress` no permite borrar campo con teclado | ⏳ UX menor — Fase 6 |

---

## Lo que se hizo bien

**Upsert único.** Un solo endpoint POST para add y update elimina la posibilidad de que el cliente envíe un PUT a un recurso que no existe. El `onConflict: 'user_id,media_id'` garantiza atomicidad.

**Media cache en el Route Handler.** El cliente pasa los datos del `MediaItem` junto con la acción de biblioteca. El servidor los persiste en la tabla `media` antes del upsert. Evita una llamada extra a la API externa desde el servidor y garantiza que la FK siempre tiene su referente.

**`isLibraryStatus` type guard.** En vez de `status as LibraryStatus`, el Route Handler valida con el type guard antes de usarlo. El único `as` restante (`status: row.status as LibraryStatus`) es el mapeo de salida desde la BD donde el valor ya fue validado al insertar.

**`user_id` siempre del JWT, nunca del cliente.** El Route Handler obtiene `user_id` exclusivamente de `supabase.auth.getUser()` server-side. El cliente no puede inyectar un `user_id` arbitrario. La RLS es defensa en profundidad adicional.

**`mediaId` format validation añadida en auditoría.** La regex `/^[a-z]+_.+$/` previene FK corruption y reduce la superficie de ataque antes de que el dato llegue a la BD.

**Delegación correcta de responsabilidades post-fix.** Tras corregir el bug de doble DELETE, `LibraryItem` es un componente de presentación puro que delega la operación a su padre. `LibraryClient` es el único responsable de la llamada a la API y de la actualización del estado local.

**Perfil público sin overhead de auth.** `getUserStats` usa `createClient()` server-side sin verificar autenticación — correcto porque el perfil es público. La autenticación solo se verifica en rutas privadas (`/library`).

---

## Veredicto

La Fase 3 entrega una biblioteca personal funcional end-to-end. El contrato entre cliente y servidor está bien definido, el upsert es robusto, y la experiencia de filtrado por URL es compartible. Los dos bugs detectados (doble DELETE, redirect de login) son representativos del riesgo de agentes que modifican archivos fuera de su scope — el flujo de auditoría los capturó antes de cierre. El análisis post-dictamen resolvió la pregunta sobre `createClient()` (síncrono, correcto en todos los usos) y confirmó que la seguridad de `user_id` está garantizada por JWT server-side con RLS como segunda línea.

**Fase 4 iniciada — Social.**
