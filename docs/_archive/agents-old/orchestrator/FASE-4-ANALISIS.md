# Análisis completo — Fase 4 KULTURA

**Fecha:** 2026-04-14
**Estado:** CERRADA ✅ — Fase 5 iniciada
**Tareas:** 4.1 – 4.7 (7/7)
**Tests:** 367 pasando (57 nuevos sobre 310), 0 failures
**Build:** limpio (3 errores pre-existentes conocidos)
**Archivos de producción nuevos:** 28 archivos
**Post-dictamen:** 6 correcciones adicionales aplicadas tras revisión externa

---

## Resumen ejecutivo

7 tareas completadas. La Fase 4 construyó toda la capa social de KULTURA: sistema de amigos con solicitudes bidireccionales, feed de actividad en tiempo de carga, recomendaciones directas entre amigos, listas colaborativas con roles owner/miembro, notificaciones in-app con badge en header, y reportes de usuarios y títulos. Se introdujo el route group `(app)/` para aplicar AuthHeader a todas las páginas autenticadas sin cambiar URLs. La auditoría detectó 5 bugs: payload de notificación incompleto (faltaban `fromUsername` y `mediaTitle`), dos usos de `any` en el GET de amigos, y dos helpers que silenciaban errores de BD devolviendo `[]` en vez de lanzar.

---

## 1. Sistema de amigos (4.1 / SPEC-022)

**Route group `(app)/` — decisión correcta:** Mover las páginas autenticadas bajo `(app)/` aplica `AuthHeader` vía `layout.tsx` sin cambiar ninguna URL. Alternativa habría sido importar `AuthHeader` en cada `page.tsx` manualmente — propenso a olvidos. El patrón de route group es el mecanismo idiomático de Next.js App Router para layouts compartidos.

**`getFriendshipStatus` — doble dirección con `.or()` correcto:** La query usa `or(requester_id.eq.A,receiver_id.eq.A AND requester_id.eq.B...)` para cubrir ambas direcciones en una sola query. Alternativa habría sido dos queries separadas — innecesario. El resultado es una discriminación limpia de `none | pending_sent | pending_received | accepted`.

**PATCH solo el receptor puede aceptar/rechazar — ✅ CORRECTO:** El handler verifica `friendship.receiver_id !== user.id` antes de permitir accept/decline. Evita que el solicitante se auto-acepte. El DELETE permite a cualquier participante (requester o receiver) eliminar la amistad — semántica correcta para "dejar de ser amigos".

**GET /api/friends añadido en SPEC-024 — deuda de diseño menor:** El GET se añadió para que `RecommendModal` pudiera fetchear amigos en el cliente sin exponer Supabase. Correcto técnicamente, pero el endpoint fue creado como efecto secundario de otra SPEC en vez de planificarse en SPEC-022. No afecta al funcionamiento.

**`any` en GET handler — detectado y corregido en auditoría:** `(data ?? []).map((row: any) => ...)` y `.filter((f: any) => ...)` reemplazados por tipo `FriendRow` explícito con type guard `(f): f is { friendshipId: string; user: NonNullable<FriendRow['requester']> } => f.user !== null`. Sin cambio funcional.

---

## 2. Feed de actividad (4.2 / SPEC-023)

**Estrategia dos queries — correcto para el caso de uso:** La primera query obtiene IDs de amigos; la segunda hace `user_media IN (friendIds)`. Alternativa: un único JOIN con `OR` en múltiples tablas — más complejo y menos legible. La estrategia en dos pasos es óptima para bibliotecas de hasta ~200 amigos con ~5000 items combinados.

**`getFriendsFeed` silenciaba error de friendships — corregido en auditoría:** `if (friendError) return []` devolvía silenciosamente un array vacío si la primera query fallaba. El feed parecería "sin actividad" en vez de mostrar un error. Cambiado a `throw new Error(...)` para propagar correctamente al Server Component y activar `error.tsx`.

**`if (!friendships || friendships.length === 0) return []` — correcto:** Si el usuario no tiene amigos, el feed vacío es el comportamiento esperado, no un error. Distinguir "sin amigos" (vacío legítimo) de "error de BD" (excepción) es la semántica correcta.

**`FeedItem` sin enlace a perfil del amigo:** El componente muestra el username con avatar pero no es clicable hacia `/profile/[username]`. Deuda de UX menor — fácil de añadir en Fase 6.

**`created_at` de `user_media` como fecha de actividad:** El campo refleja cuándo se añadió el item, no cuándo se actualizó (ej: cambiar status de `pending` a `completed`). Un usuario que completa un item semanas después de añadirlo no aparece en el feed. Deuda conocida documentada — `updated_at` en `user_media` requeriría migración de BD.

---

## 3. Recomendaciones directas (4.3 / SPEC-024)

**Payload de notificación incompleto — detectado y corregido en auditoría:** `NotificationsList` esperaba `fromUsername` y `mediaTitle` en el payload, pero el route handler solo incluía `fromUserId` y `mediaId`. La página `/notifications` mostraría `undefined` en los textos. Corregido añadiendo fetch de `senderProfile.username` y usando `body.mediaCache?.title`.

**`mediaTitle` depende de `mediaCache` opcional:** Si el cliente llama a `POST /api/recommendations` sin enviar `mediaCache`, `mediaTitle` queda como `''` en el payload. `RecommendModal` siempre envía `mediaCache` (incluye el `MediaItem` completo), así que en la práctica nunca ocurre. Para un consumidor de la API que no envíe `mediaCache`, la notificación mostraría título vacío — deuda menor documentada.

**Promise.all en RecommendModal — correcto:** Recomendar a múltiples amigos es un conjunto de operaciones independientes. `Promise.all` las paraliza en vez de secuenciarlas. Si alguna falla, el modal muestra error pero las otras ya se enviaron — comportamiento aceptable.

**No verificar amistad antes de recomendar:** El handler valida que el receptor existe pero no que sea amigo del remitente. Un usuario podría recomendar a cualquier usuario de la plataforma con su ID. Las recomendaciones son notificaciones benign (no spam agresivo), y la UI solo muestra amigos en el modal, así que el riesgo es bajo. En Fase 6 se podría añadir la verificación de amistad.

---

## 4. Listas colaborativas (4.4 / SPEC-025)

**`x-action` header para sub-operaciones — patrón aceptable con deuda de tipos:** Usar el header `x-action: invite` vs `x-action: remove-member` evita proliferación de rutas. Sin embargo, los valores válidos están definidos como strings literales implícitos en el handler, no como un tipo discriminado. Si en Fase 6 se añade una nueva acción, TypeScript no avisa si el cliente escribe mal el valor del header — el error sería silencioso en runtime. Deuda 🟢: definir `type ListAction = 'invite' | 'remove-member'` y validar con type guard en el handler.

**`canEditList` centralizado — correcto:** La lógica "owner → true; miembro de colaborativa → true; resto → false" está encapsulada en una función exportada usada por ambos handlers (POST add-item y DELETE remove-item). Evita duplicación y divergencia futura. Correctamente mockeada en tests.

**Payload `list_invite` sin `fromUsername` — detectado y corregido en auditoría:** `NotificationsList` necesitaba `fromUsername` pero el payload solo incluía `fromUserId`. Corregido añadiendo fetch paralelo de `senderProfile.username` con `Promise.all` junto a la verificación del target.

**`getUserLists` — dos queries por diseño:** Una query obtiene listas propias, otra listas donde el usuario es miembro. Se combinan con `Set` para evitar duplicados (un owner que también es miembro de otra lista). El item count se calcula con una query extra por lista — `O(n)` queries donde n = número de listas. Aceptable para Fase 4 (usuarios tendrán <20 listas). Deuda conocida: usar `COUNT` en la query principal con GROUP BY.

**Invitación sin aceptar/rechazar — superficie de abuso potencial:** La invitación crea `list_member` directamente sin consentimiento del invitado. Consecuencia concreta: un usuario puede ser añadido a listas con nombres inapropiados o contenido que no quiere asociar a su perfil — solo puede abandonar después, no rechazar antes. Para una plataforma social esto es una superficie de abuso (acoso, listas con nombres ofensivos). Clasificado DEC-008 como decisión de Fase 4, pero debe evaluarse antes de abrir registro público. Reclasificado: 🟡 evaluar en Fase 5.

---

## 5. Notificaciones in-app (4.5 / SPEC-026)

**`NotificationBadge` Server Component — sin polling correcto para Fase 4:** El badge se re-renderiza con cada navegación server-side. En una SPA con routing client-side, el badge quedaría obsoleto entre navegaciones. Next.js App Router re-ejecuta Server Components en cada navegación — badge actualizado correctamente sin WebSocket ni polling. Comportamiento óptimo para el patrón de arquitectura elegido.

**`markAllRead` best-effort — logging añadido:** La página `/notifications` llama `markAllRead` sin bloquear el render. El `catch` original suprimía el error completamente con `catch(() => {})`. Corregido a `catch((err) => console.error('markAllRead failed:', err))`. La consecuencia del fallo silencioso original era peor de lo documentado: si `markAllRead` fallaba de forma persistente (error de BD), el badge mostraría siempre notificaciones no leídas aunque el usuario hubiera visitado la página repetidamente. Sin logging, el problema sería invisible en producción.

**Formato `mediaId` en NotificationsList — deuda de mantenimiento:** `mediaId.split('_')[0]` para el tipo y `mediaId.split('_').slice(1).join('_')` para el externalId es técnicamente correcto, pero la lógica de parseo está inline en el componente. El mismo patrón `{type}_{externalId}` se usa en múltiples sitios del codebase. Si el formato cambiara, habría que buscar todos los usos manualmente. Deuda 🟢: extraer `parseMediaId(id: string): { type: MediaType; externalId: string }` al normalizer o utils.

**No paginación en /notifications:** La query está limitada a 50 notificaciones. Sin paginación ni infinite scroll. Para Fase 4 es suficiente — la mayoría de usuarios tendrán <20 notificaciones. Fase 6.

---

## 6. Reportes (4.6 / SPEC-027)

**Sin UI de revisión admin — deliberado:** Los reportes se almacenan en la tabla `reports` sin flujo de revisión. El scope de Fase 4 es solo captura de datos. Panel de administración queda para una hipotética Fase 7 o herramienta externa.

**No-self-report validado server-side — ✅ CORRECTO:** El handler valida `targetType === 'user' && targetId === user.id` usando el JWT, nunca el body. El cliente no puede bypassear esta validación.

**`ReportButton` inline form vs modal separado — decisión de UI correcta:** Un textarea inline evita el overhead de un modal para una acción secundaria poco frecuente. El estado `sent` es permanente en sesión — previene reportes accidentales múltiples sin recargar.

**Sin rate limiting en `/api/reports`:** Un usuario podría enviar N reportes arbitrarios. Sin rate limiting en Fase 4 — deuda de seguridad compartida con todos los Route Handlers. Fase 6.

**Validación de existencia del targetId — añadida post-auditoría:** La tabla `reports.target_id` es `text NOT NULL` sin FK constraint (el target puede ser `users.id` o `media.id`, no hay forma de expresar una FK polimórfica en PostgreSQL sin extensiones). Sin validación explícita, un cliente podría insertar reportes con UUIDs o IDs inventados, generando ruido en la tabla. Corregido en el handler: si `targetType === 'user'`, se verifica en `users`; si `targetType === 'media'`, se verifica en `media`. Devuelve 404 si no existe. Test añadido.

---

## Bugs detectados en auditoría

| # | Archivo | Bug | Impacto | Corrección |
| --- | --- | --- | --- | --- |
| 1 | `api/recommendations/route.ts` | Payload notif sin `fromUsername`, `mediaTitle`, `message` | `/notifications` mostraba `undefined` en textos | Añadido fetch `senderProfile.username`, uso de `mediaCache.title` y `message` |
| 2 | `api/lists/[id]/route.ts` | Payload `list_invite` sin `fromUsername` | ídem | Fetch paralelo `senderProfile.username` con `Promise.all` |
| 3 | `api/friends/route.ts` | Dos `any` en GET (map + filter) | Tipos inseguros en producción | Tipo `FriendRow` explícito + type guard en filter |
| 4 | `lib/social/friends.ts` | `getFriends`: `if (error) return []` silenciaba error de BD | Error invisible, feed/amigos parecía vacío | `throw new Error(...)` |
| 5 | `lib/social/feed.ts` | `getFriendsFeed`: `if (friendError) return []` silenciaba error | Feed parecía sin actividad ante error de BD | `throw new Error(...)` |
| 6 | `components/social/RecommendModal.tsx` | `Promise.all` — fallo en una llamada cancelaba las pendientes | Recomendaciones parcialmente enviadas sin saberlo | Cambiado a `Promise.allSettled`; estado `error` si alguna falla |
| 7 | `notifications/page.tsx` | `markAllRead().catch(() => {})` — error silencioso | Badge rojo permanente ante fallo persistente de BD sin visibilidad | Cambiado a `catch((err) => console.error(...))` |
| 8 | `api/reports/route.ts` | Sin verificación de existencia del `targetId` | Reportes con IDs inventados insertados en BD | Validación explícita contra `users` o `media` según `targetType`; 404 si no existe |
| 9 | `tests/unit/components/media-card.test.tsx` + `media-grid.test.tsx` | Mock de `@/i18n/navigation` ausente — `next/navigation` no resuelve en test env | 2 test files fallidos persistentemente | Mock de `Link` como `<a>` añadido; ahora 41/41 archivos pasan |

---

## Cobertura de tests

| Área | Tests nuevos | Tipo |
| --- | --- | --- |
| `friends.test.ts` (lib/social/friends) | ~8 | Unit — mocks Supabase |
| `route.test.ts` (api/friends) | ~8 | Unit — mocks Supabase |
| `feed.test.ts` | ~7 | Unit — mocks Supabase |
| `recommendations.test.ts` | ~6 | Unit — mocks Supabase |
| `lists.test.ts` | ~10 | Unit — mocks Supabase |
| `notifications.test.ts` | ~5 | Unit — mocks Supabase |
| `reports.test.ts` | ~7 | Unit — mocks Supabase (incl. test de 404 targetId inexistente) |
| `media-card.test.tsx` + `media-grid.test.tsx` | 0 nuevos | Pre-existentes — ahora pasan con mock de `@/i18n/navigation` |
| **Tests nuevos netos Fase 4** | **~57** | — |
| **Total acumulado** | **367** | — |

**Sin tests de integración E2E:** El flujo completo "usuario A recomienda a usuario B → B ve la notificación → badge se actualiza" no está cubierto por tests unitarios que mockean Supabase. BLOQ-001 sigue abierto.

---

## Deuda técnica — estado al cierre de Fase 4

| Prioridad | Tema | Estado |
| --- | --- | --- |
| 🔴 Alta | `BLOQ-001` tests integración Supabase sin CI | ⏳ Pendiente |
| 🔴 Alta | Rate limiting en todos los Route Handlers | ⏳ Fase 6 |
| 🔴 Alta | `error.tsx` ausente en rutas autenticadas — throw en Server Component → root error.tsx | ⏳ Fase 6 |
| 🔴 Media-alta | API keys `NEXT_PUBLIC_` en bundle cliente | ⏳ Fase 6 |
| 🟡 Media | Verificar amistad antes de recomendar (hoy: cualquier userId válido) | ⏳ Fase 6 |
| 🟡 Media | `mediaTitle` vacío si `mediaCache` no se envía a `/api/recommendations` | ⏳ Documentado, bajo riesgo |
| 🟡 Media | `getUserLists` — O(n) queries para item count por lista | ⏳ GROUP BY — Fase 6 |
| 🔴 Alta | Feed usa `created_at` de user_media — no refleja actualizaciones de status. Consecuencia: usuario que completa 20 libros añadidos hace meses no aparece en el feed de sus amigos. Impacta percepción de valor del producto y utilidad del módulo IA de Fase 5 | ⏳ Migración `updated_at` en BD — adelantar a Fase 5 |
| 🟡 Media | Sin paginación en `/notifications` (máx 50) | ⏳ Fase 6 |
| 🟡 Media | `FeedItem` sin enlace a perfil del amigo | ⏳ Fase 6 |
| 🟡 Media | Invitación a lista sin accept/rechazar — superficie de abuso potencial (listas con nombres inapropiados) | ⏳ Evaluar antes de registro público — Fase 5 |
| 🟡 Media | `x-action` header sin tipo discriminado — nuevas acciones pueden introducir typos silenciosos | ⏳ `type ListAction` + type guard — Fase 6 |
| 🟡 Media | `parseMediaId` inline en `NotificationsList` — mismo patrón duplicado en múltiples sitios | ⏳ Extraer a `utils.ts` — Fase 6 |
| 🟡 Media | Sin panel de revisión de reportes | ⏳ Herramienta externa / Fase 7 |
| 🟡 Media | Modal sin portal en `LibraryAction`, `CreateListModal`, `RecommendModal`, `ReportButton` | ⏳ Fase 6 |
| 🟢 Baja | `ReportButton`: estado `sent` no persiste tras recarga — permite re-reporte | ⏳ Aceptado Fase 4 |
| 🟢 Baja | Invitación a lista sin accept/rechazar (DEC-008) | ⏳ Comportamiento documentado |
| 🟢 Baja | `BLOQ-003` CSP sin `frame-src` para YouTube | ⏳ Fase 6 |

---

## Lo que se hizo bien

**JWT como única fuente de `user_id`.** Todos los Route Handlers de Fase 4 obtienen el ID del usuario exclusivamente de `supabase.auth.getUser()` server-side. El cuerpo del request nunca determina la identidad del actor. `reporter_id`, `owner_id`, `from_user_id`, `added_by` se asignan siempre desde el JWT.

**Route group `(app)/` sin disruption de URLs.** Mover las páginas autenticadas bajo el grupo añade el layout de header sin tocar ninguna URL pública. Cero cambios de redirección, cero breaking changes para usuarios existentes.

**Best-effort en notificaciones.** La inserción de notificaciones (recomendación, invitación a lista) no bloquea la respuesta principal. Si la tabla `notifications` tiene un problema transitorio, la operación principal (crear recomendación, añadir miembro) sigue completándose. El usuario puede perder una notificación pero no pierde la acción.

**`canEditList` centralizado.** Una única función con la lógica de permisos evita duplicación entre el handler de añadir items y el de eliminarlos. En auditorías futuras hay un único punto donde revisar.

**`x-action` header en lugar de rutas duplicadas.** Las sub-operaciones de `/api/lists/[id]` se distinguen por header en vez de por ruta. Mantiene la API surface pequeña sin sacrificar claridad.

**Upsert con `ignoreDuplicates` en list_members.** Evita el error si se invita dos veces al mismo usuario. Idempotente por diseño.

---

## Veredicto

La Fase 4 entrega la capa social completa. El contrato de autenticación es sólido en todos los nuevos endpoints. Los 9 bugs detectados (5 en auditoría interna + 4 en revisión externa) eran bugs reales: notificaciones con campos `undefined`, errores silenciosos en helpers de BD, `Promise.all` que podía abandonar llamadas pendientes, error de BD invisible en `markAllRead`, reportes con targets inexistentes, y 2 test files persistentemente fallidos. Todos corregidos.

La observación más relevante de la revisión externa es el reclasificado de `created_at` vs `updated_at` en el feed: lo que parecía deuda de precisión es un problema de percepción de valor del producto y afecta directamente al módulo de IA de Fase 5, que dependería de actividad reciente del usuario. Debe resolverse antes o durante Fase 5, no diferirse a Fase 6.

**Post-dictamen: 367/367 tests, 41/41 archivos. Fase 5 iniciada — IA (Claude API).**
