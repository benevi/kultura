# Plan de saneamiento de Kultura

- **Origen:** auditoría del 10-11-2026 (código, Supabase de producción en solo lectura, recorrido de la web pública y de la cuenta demo, `vercel env ls`, CI).
- **Revisión:** cuatro rondas de preguntas (Q1–Q33). Todas las decisiones de este plan están cerradas.
- **Decisión:** **arreglar, no rehacer**. Hay usuarios y datos reales (8 usuarios, 4 activos en 30 días) y el modelo de datos es salvable.

Estado de cada fase: ⬜ pendiente · 🟨 en curso · ✅ hecha

---

## Reglas

1. **Congelación total de funciones nuevas** hasta cerrar las fases 0–4 y la red de seguridad (Q1). Después:
   - Cada PR es **o arreglo o función**, nunca las dos cosas.
   - Una función que toque un módulo de la fase 6 aún sin sanear espera a que ese módulo esté saneado (Q30).
2. **Un PR por cambio**, pequeño y que se pueda revertir solo. Cada merge a `master` se despliega en producción (Q5).
3. Cada PR deja en verde `type-check`, `lint`, `test` y el job `cuj` de CI.
4. **Migraciones** (Q4):
   - En `kultura-test`, las aplica Claude.
   - En producción, solo después de lanzar el backup manual (`backup.yml` → *Run workflow*) y de un «sí» explícito de Víctor para **cada** migración.
5. **Numeración de migraciones** (Q13): las 8 migraciones con fecha `202612xx` **no se renombran**. Las nuevas se numeran después de `20261229350001` (`20261230000001`, `…02`, …) hasta que el calendario las alcance. Un test de CI falla si una migración nueva es anterior a la última existente.
6. **Ejecución** (Q3): las fases 0–3 van en secuencia en la sesión principal. A partir de ahí, las fases independientes (4, 5 y red de seguridad) van en paralelo, cada una en su sesión y su worktree.

---

## ✅ Bloqueantes (antes de subir ninguna rama)

Hoy, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` son una sola variable compartida por Development, Preview y Production. Por tanto, **cualquier despliegue de preview lee y escribe en la base de producción con la clave de servicio**.

### ✅ B1 · Separar Preview y Development de producción (Q20, Q24). Hecho el 10-11-2026

Comprobado: Preview y Development usan `xqvicvypoxxfbezqnkwr` y Production usa `zfrbyphzvfuvejdwjfea`. Pendiente menor: marcar como Sensitive la `SUPABASE_SERVICE_ROLE_KEY` de Production.

1. Vercel → proyecto `kultura` → Settings → Environment Variables.
2. Editar cada una de estas tres variables y dejarla marcada solo en **Production**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Crear esas mismas tres variables otra vez, marcadas en **Preview** y **Development**, con los valores de `kultura-test` (Supabase → proyecto `kultura-test` → Settings → API):
   - URL: `https://xqvicvypoxxfbezqnkwr.supabase.co`
   - Clave `anon`
   - Clave `service_role`
4. Quitar `SUPABASE_TEST_URL` y `SUPABASE_TEST_ANON_KEY` de Production y Preview. Solo se usan en GitHub Actions.
5. Borrar las variables de ramas de preview viejas: `GOOGLE_BOOKS_KEY` para `kultura/great-bohr-rqwuvw` y para `claude/revision-exhaustiva-proyecto-4mcw94`.
6. Comprobación (la hace Claude): `vercel env ls` muestra las tres variables de Supabase duplicadas por entorno.

### ✅ B2 · Redis para el límite de peticiones (Q21). Hecho el 11-11-2026: Upstash `kultura-redis` conectado a los tres entornos (`KV_REST_API_URL` y `KV_REST_API_TOKEN`)

1. Vercel → Marketplace → Upstash Redis (plan gratuito) → conectarlo al proyecto `kultura` en todos los entornos.
2. El código ya lee `KV_REST_API_URL` / `KV_REST_API_TOKEN` (`src/lib/rate-limit.ts:133`).
3. Comprobación: `vercel env ls` muestra las variables `KV_*`.

---

## ✅ Fase 0 · Cerrar la rama `chore/quitar-ui-v2` — PR #95 fusionado el 10-11-2026

Estado de partida:
- La rama solo existe en local.
- Tiene 150 ficheros cambiados: 77 en staged (64 borrados y 13 modificados) y 73 modificados sin añadir.
- La CI de `master` está en verde.

1. **Recuperar de `HEAD`** (Q2): el ADR `docs/adr/0001-…`, `docs/04_DECISIONES_Y_RIESGOS.md`, `docs/HANDOVER.md`, `PRODUCT.md` y `docs/sql/r9_repair_history.sql`.
2. **Se borran:** `DISENO.md`, `VOZ.md`, `FUNCIONES_V2`, `REDESIGN_AUDIT`, `RESCATE_F0`, `SKILLS_AND_TOOLS`, `F0_*`, `F1_*` y las capturas.
3. Revisar el diff de los 73 ficheros sin añadir y avisar si alguno no pertenece a «quitar UI v2» (Q17).
4. Decidir si se borran `tests/unit/visual/diseno-scales.test.ts` y `tests/unit/design/diseno-doc.test.ts`. Si se borran, ajustar `ci.yml`.
5. Arreglar los fallos reales de la rama:
   - `client-messages`: el grafo de namespaces.
   - `static-pages`.
   - `scales`: `reading 'code'`.
   - `vitest-env`.
6. Los fallos que solo dependen de Windows (`lighthouse-budget`, `despliegue`, `import/acceptance`, `push/migration-throttle`, `schema-drift`, y los timeouts de `static-csp` y `next-config`) se arreglan con el PR de `.gitattributes`. Mientras tanto, basta con comprobarlos en CI.
7. Quitar los comentarios que mencionan «v2» en `src/app/globals.css:7` y `src/app/fonts/index.ts:36`.
8. Eliminar el worktree viejo `.claude/worktrees/reverent-germain-3e5b66` si ya no se usa.
9. Un único commit, subir la rama (**después de B1**), PR y merge.

## ✅ PR de documentación (Q29) — PR #96

- Mover este fichero a `docs/PLAN_SANEAMIENTO.md`, en un PR que solo contenga eso.
- Marcar cada fase aquí mismo a medida que se cierra.

## ✅ PR de finales de línea (Q18) — PR #97

- Añadir `.gitattributes` con `* text=auto eol=lf` y normalizar el repo en un PR propio.
- Va antes de la fase 1, para que los diffs siguientes salgan limpios y los tests pasen también en Windows.

---

## ✅ Fase 1 · Pérdida de datos (solo código) — 1.1 #98 · 1.2 #99 · 1.3 #100 · 1.4 #101 · 1.5 #102 · 1.6 #103

| # | Problema | Arreglo |
|---|---|---|
| 1.1 | `src/app/api/account/route.ts:115`: si `scheduleDeletion` falla, se borra la cuenta en el acto y para siempre. | Si no se puede programar el borrado, devolver 503 y **no borrar**. Pedir contraseña, o un código por email si la cuenta es OAuth, antes de borrar (Q9). |
| 1.2 | `src/app/api/library/route.ts:171`: el upsert es completo y pone a null todo lo que no llega. `WelcomeFlow.tsx:193` solo envía `{mediaId, status, score}`. | Si la fila ya existe, actualizar solo los campos que llegan. Test: valorar en Welcome un título con progreso no borra el progreso ni `watched_at`. |
| 1.3 | `src/app/api/chat/[id]/route.ts:45`: orden ascendente con `limit(100)`, así que no se ven los mensajes nuevos. | Ordenar descendente, `limit(100)` y dar la vuelta en servidor. Añadir paginación `before=`. Test con 150 mensajes. |
| 1.4 | `src/app/api/account/import/route.ts:277-292`: los errores se ignoran y `.in()` no tiene tope. | Trocear en lotes de 200, comprobar cada error y devolver los ítems no importados. Añadir `maxDuration` y un tope al tamaño del body. |
| 1.5 | `src/lib/media/upsert-from-provider.ts:132,228`: `ignoreDuplicates:true` congela título, póster y sinopsis. | Actualizar los metadatos si tienen más de N días. Es la causa probable de los pósters vacíos. |
| 1.6 | `src/app/[locale]/(app)/home/page.tsx:55-68`: `ensureProfile` crea `users` sin crear `account_state`. | Crear las dos filas a la vez. |

**Verificación:** un test por punto y el CUJ de biblioteca/progreso en verde.

**Notas de la ejecución:**
- 1.1: para cuentas solo de Google se pide un inicio de sesión de hace menos de 10 minutos en vez de un código por email: hoy no hay servicio de email (sin `RESEND_API_KEY`). Revisar cuando lo haya.
- 1.5: el título no se refresca (depende del idioma de quien creó la ficha). En prod ninguna ficha tiene el póster a null, así que los pósters vacíos no venían de aquí: ver el punto 2 de pendientes (probable bloqueo de hotlinking en MangaDex o ComicVine).

---

## ✅ Fase 2 · Seguridad en la base de datos (migración `20261230000001_harden_grants_and_policies`) — #104 · prod: 11-11-2026

1. `alter default privileges in schema public revoke all on tables, sequences, functions from anon`. Revisar también lo que se concede por defecto a `authenticated`.
2. `is_group_member` e `is_conversation_member`: usar `auth.uid()` en lugar del parámetro, o revocar `EXECUTE` y llamarlas solo desde políticas.
3. **Eliminar `username_redirect`** y su uso en el código (Q8).
4. **Recomendaciones solo entre amistades aceptadas**: la política de INSERT exige amistad (Q7).
5. **Entrar en un grupo exige siempre una invitación aceptada**, también si la manda el dueño (Q10).
6. `list_items` INSERT: exigir `is_collaborative` a los colaboradores, igual que en UPDATE.
7. `conversations`: quitar la política de INSERT directo, porque la RPC es el único camino.
8. `set_updated_at` e `is_demo_session`: fijar `search_path`.
9. Copiar de `20261222340001_push_throttle.sql` el disparador que hace que **el servidor fije `messages.created_at`**. Las migraciones de push **no se aplican** en producción (Q14).
10. **Borrado de cuenta y mensajes** (Q6): `messages.sender_id` pasa a `ON DELETE SET NULL` y el texto de esos mensajes se vacía. El chat del otro usuario muestra «usuario eliminado».
11. Revisar el resto de funciones SECURITY DEFINER que avisa el linter y revocar `EXECUTE` donde solo se usen desde políticas.
12. Test de CI que vigila el orden de las migraciones (regla 5).
13. ~~Panel de Supabase: activar la protección contra contraseñas filtradas (Víctor).~~ Descartado el 11-11-2026: solo existe en el plan Pro y el proyecto está en el gratuito. Revisar si se cambia de plan.

**Verificación:** un test de RLS por punto en `tests/integration` contra `kultura-test`, y `get_advisors` (security) sin avisos nuevos.

**Notas de la ejecución:**
- Aplicada en `kultura-test` el 11-11-2026: `tests/integration/rls` (50) en verde, `fase2.test.ts` incluido. Producción: aplicada el 11-11-2026 tras la copia manual de las 00:41 y el «sí»; comprobado crear grupo, biblioteca y que el INSERT directo de conversaciones se rechaza.
- 1: los privilegios por defecto de `supabase_admin` no se pueden cambiar desde una migración. `authenticated` sigue recibiendo SELECT/INSERT/UPDATE/DELETE por defecto (la RLS decide); ver `supabase/migrations/README.md`.
- 2 y 11: las funciones SECURITY DEFINER que usan las políticas (`can_read_*`, `has_block_with`, `is_*`, `can_send_message`) necesitan EXECUTE para quien consulta: el aviso del linter sobre ellas es esperado. `is_group_owner` se deja igual (una política la llama con otro usuario).
- 3: `username_history` se conserva: un nombre antiguo sigue reservado (ya no redirige).
- 4: la API responde 403 `not_friends` si la base lo rechaza.
- La integración de CI no corre: faltan los secretos `SUPABASE_TEST_*` en GitHub. Añadidos el 11-11-2026: la integración corre en CI. Al correrla a mano salió que `createGroup` de los tests fallaba con grupos privados (RETURNING antes del disparador); la app ya lo evitaba.

---

## ✅ Fase 3 · Integridad e índices — #106 · prod: 11-11-2026

- No hay duplicados en producción (comprobado), así que no hace falta deduplicar antes.
- `media_translations` y `media_adaptations` son **cachés por id de proveedor**: no llevan clave foránea a `media` (Q15).

1. **Restricciones únicas:**
   - `friendships`: único sobre `(least(requester_id, receiver_id), greatest(…))`.
   - `list_items`: `(list_id, media_id)`.
   - Una sola conversación directa por pareja.
2. `user_media.media_id` con `on delete cascade`, igual que `user_media_logs`.
3. **Índices:**
   - `notifications(user_id, created_at desc)`
   - `friendships(receiver_id)`
   - `user_media(media_id)`
   - `conversation_members(user_id)`, `group_members(user_id)` y `list_members(user_id)`
   - `lists(owner_id)`
   - `group_posts(group_id, created_at)`
   - `recommendations(to_user_id)` y `recommendations(from_user_id)`
   - `messages(conversation_id, created_at)` y `messages(sender_id)`
   - `group_invitations(invitee_id)`
   - `media ((metadata->>'malId'))`
   - El resto de claves foráneas sin índice que avisa `get_advisors` (performance).
4. Regenerar `src/types/supabase.ts` y añadir `invite_accepted` a la unión de `src/lib/social/notifications.ts:11`.

**Notas de la ejecución:**
- Migración `20261231000001_integrity_and_indexes`, aplicada en producción el 11-11-2026 tras la copia de las 09:00. Sin duplicados antes de aplicarla.
- La conversación única por pareja usa dos columnas nuevas, `conversations.user_low` y `user_high`. En producción solo 1 de las 3 conversaciones tiene pareja: las otras dos tienen un solo miembro porque la otra cuenta se borró.
- `src/types/supabase.ts` se actualizó a mano, no se regeneró: el fichero lleva tipos propios (`Db*`) que el generador no produce.
- La API devuelve 409 (no 500) si una amistad o un título de lista choca con la restricción.

---

## ✅ Fase 4 · Seguridad en la API — #108 · 11-11-2026

- `HEALTH_DEEP_TOKEN` configurado en Vercel (Production); el monitor externo lo lleva si usa `?deep=1`.
- 4.6 ✅ cerrado en la fase 6 — #128 (migración `20261231000002_group_posts_insert_via_api`) · prod: 11-11-2026. Publicar en un grupo solo va por la API.

1. Usar `checkRateLimitDistributed`, ya con Redis, en `reports/public`, `ai-recommendations`, `recommendations`, `auth/demo` y `revalidate`.
2. `recommendations`: comprobar la amistad en el servidor **antes** de llamar al proveedor.
3. `health?deep=1`: exigir un secreto.
4. `cron/daily`: no revelar si `CRON_SECRET` está configurado.
5. `groups.ts:312`: usar `escapeLikePattern`.
6. `GroupFeed.tsx:178`: publicar a través de la API, con validación y rate limit.
7. `push/subscribe:86-91`: no borrar con service role las suscripciones de otra cuenta.
8. `.env.example`: quitar `NEXT_PUBLIC_TMDB_API_KEY` y `NEXT_PUBLIC_RAWG_KEY`.

## ✅ Fase 5 · Errores visibles — 5.1 #110 · 5.3 #111 · 5.4 #112 · 11-11-2026

- 5.1: deadline de 3,5 s para la página (15 s en el correo), timeout de 2,5 s por proveedor y 6 en paralelo; lo que no llega se marca como fallo parcial y no se guarda en caché.
- 5.2: sin cambios. En producción no hay ninguna fila de `media` sin póster y todos los hosts cargan. «Juegos» sale vacío porque RAWG está caído (Cloudflare 522), no por nuestro código.
- 5.3: la traducción funcionaba; fallaba el hero de Inicio, que ahora se traduce al idioma activo, y la caché se escribe siempre.
- 5.4: Inicio lee las columnas `progress_*`.

1. **Calendario** (6,6 s y fallo parcial): timeout por proveedor, consultas en paralelo y caché de unas 6 h.
2. **Pósters vacíos en Descubrir**: comprobar que se arreglan con 1.5; si no, script de relleno.
3. **Sinopsis en inglés con la UI en español**: revisar el fallback de `lib/translate/synopsis.ts`.
4. **Inicio dice a la vez «Continuando» y «Sin empezar»**: leer el estado de `progress_*` (ver fase 6).

Los filtros de la biblioteca **no van aquí**: pasan a la fase 8 (Q28).

## 🟨 Red de seguridad (en paralelo desde la fase 0) — 3 #113 · 4 #115 · 7 #114 · 11-11-2026

- 2: hecha el 11-11-2026 en Supabase local con Docker, unos 5 min; recuentos iguales a producción (detalle en `supabase/README.md`).
- 3: la integración corre en serie (los ficheros comparten usuarios) y el login reintenta ante el límite de Auth de `kultura-test`.
- 5: secretos `RAWG_API_KEY`, `COMICVINE_KEY` y `GOOGLE_BOOKS_KEY` puestos el 11-11-2026. El 12-11 seguía en rojo solo por caídas (RAWG, Jikan y ComicVine sin respuesta). Desde este PR una caída (tiempo agotado, red, 5xx, 429) deja un aviso y no falla; solo un contrato roto abre issue.
- 6: `npm audit fix` no arregla ninguna (12-11: solo sube versiones). `@sentry/nextjs` 11.12 quita las 4 de Sentry (`glob`/`minimatch`) — este PR. Quedan 6 moderadas de `typescript-eslint` (solo lint, sin arreglo publicado: sigue con `minimatch@^10`).

1. B1 hecho y comprobado.
2. **Prueba de restauración en un Supabase local (Docker)**, que se borra al terminar. **Nunca en `kultura-test`** (Q16). Apuntar la fecha y la duración.
3. Tests de integración y de RLS en cada PR que toque `supabase/migrations/**` o `src/app/api/**`. Si faltan los secretos, el job falla en vez de saltarse.
4. E2E en CI:
   - Chat, grupo y notificaciones, con un seed de dos usuarios.
   - Amistad: pedir, aceptar y bloquear.
   - Grupos: crear, invitar y unirse.
5. **Workflow «Contrato de proveedores»**, en rojo en `master` desde el 9-11 (Q19). Si es un fallo puntual del proveedor, volver a lanzarlo. Si es un cambio de su API, pasa a la fase 1.
6. `npm audit` (5 vulnerabilidades moderadas): aplicar los arreglos que no rompan nada. La subida a `@sentry/nextjs@11` se planifica aparte.
7. `next lint` está obsoleto: migrar a la CLI de ESLint.

---

## ✅ Fase 6 · Backend por módulos (un PR por módulo) — 1 a 3: base #118 · library #119 #120 · lists #121 · friends #122 · chat #123 · groups #124 · account/import #125 · settings #126 · 11-11-2026 · 4: chat #129 · descubrir #130 · franquicia #132 · timeouts #133 · 5: #134 · 6: #135 a #140 · 12-11-2026

Orden: `library` → `lists` → `friends` → `chat` → `groups` → `account/import` → `settings`. Hecho.

- Cambios de comportamiento: el usuario demo con un cuerpo inválido recibe 400/413 antes que 403; `?list` inválido en el export de Letterboxd da 400; `GET /api/settings` eliminado (sin uso).
- Cambio visible (#132): el aviso de progreso de «Añadir toda la franquicia» pasa a «Añadiendo N títulos…»; service worker en v10.

1. ✅ **zod** en todos los bodies y query params, con un único esquema para `mediaId`.
2. ✅ **Helpers** en `src/lib/api/route.ts`: `requireUser()`, `rateLimit()` (distribuido, con `clientIp()`), `parseBody()` (con tope de bytes), `parseQuery()`, `respond()` y `apiError()`.
3. ✅ **Lógica fuera de los handlers**, en `src/lib/<módulo>/service.ts` (devuelven `ServiceResult`).
4. ✅ **Rendimiento:**
   - ✅ N+1 en la lista de conversaciones: una sola consulta con embebidos — #129.
   - ✅ Descubrimiento de grupos paginado en SQL: RPC `discover_groups` (`20261231000003`, SECURITY INVOKER) — #130 · prod: 12-11-2026.
   - ✅ Endpoint bulk para añadir una franquicia: `POST /api/library/bulk`, solo inserta — #132.
   - ✅ Timeout y reintentos en el cliente de Anthropic (`lib/claude/client.ts`: 15 s / 30 s, 1 reintento) y en `og/brand.ts` (2,5 s, 1 reintento) — #133.
5. ✅ **Código muerto** borrado: `getPopularTV`, `getTrendingMovies`, `getMovieVideos`, `getPushConfig` y `components/library/EpisodeProgress.tsx` (con su test). `getSentGroupInvitations` y `updateLibrary` ya no existían; `addToLibrary` sigue en uso.
6. ✅ **Una sola fuente de verdad** (Q23; las seis banderas valen `1` en producción). Para cada par, tres PRs: leer solo de la nueva, dejar de escribir en la vieja y borrarla en una migración.
   - ✅ `rating10` sustituye a `score` — #135 · #136 · #137 (`20261231000004`) · prod: 12-11-2026.
   - ✅ Las columnas `progress_*` sustituyen al JSON `episode_progress` (fuera también `progress_updated_at` y el disparador `user_media_sync_progress`). Sin `PROGRESS_V2` se escriben solo `progress_season` y `progress_episode`; la API sigue aceptando y devolviendo `episodeProgress` — #138 · #139 · #140 (`20261231000005`) · prod: 12-11-2026.

## ✅ Fase 7 · Contrato de la API (junto a la fase 6) — #118 a #126 · 11-11-2026. Cliente: `apiFetch` lanza `ApiError`; service worker en v9

1. Formato único:
   - Errores: `{ error: { code, message?, field? } }`.
   - Éxito: `{ data }`.
   - Catálogo de códigos en `src/lib/api/errors.ts`.
2. Esquemas zod de respuesta en `src/lib/api/contracts/` y un test de contrato por endpoint.
3. **Sin doble formato** (Q26): cada PR de módulo cambia servidor y cliente a la vez y **sube la versión del service worker**.

## 🟨 Fase 9 · Una sola forma de pedir datos (solo la parte de datos, antes de la fase 8) — 2: plataformas #145 · chat leído #146 · muro del grupo #147 · 3: este PR · 12-11-2026

- Hecho: en el navegador Supabase ya solo hace `auth` y realtime (más el autor de cada mensaje o publicación nueva que llega por realtime).
- Pendiente de la regla 1: los `fetch` sueltos que quedan van a rutas que aún no usan el contrato `{ data }` / `{ error }` (Q26): `recommendations`, `search`, `popular-in-circle`, `genre-news`, `ai-recommendations`, `suggestions`, `users/search`, `email/preferences`, `discover` y `push/*`. Pasan a `apiFetch` cuando se sanee cada ruta. Las descargas (`account/export`, `letterboxd`) siguen con `fetch`: devuelven un archivo.

1. **Regla:**
   - Lectura inicial: componentes de servidor con Supabase.
   - Mutaciones: `fetch` a `/api/*` a través de un cliente tipado único (`src/lib/api/client.ts`).
2. ✅ Quitar las escrituras desde el Supabase del navegador en `GroupFeed`, `PlatformsSection` y `useAccountSettings` (salvo `auth`). En el navegador, Supabase queda solo para realtime.
3. ✅ `WelcomeFlow` y `AddFranchiseButton` usan los wrappers.

Los `loading.tsx` y el componente de error con reintento pasan a la fase 8 (Q32).

## 🟨 Fase 10 · Monitorización

1. ✅ Los 11 `error.tsx` de página llaman a `Sentry.captureException` (vía `ErrorState`, #149).
2. ✅ Los handlers que devolvían 500 sin registrar el error usan `log.error`. `api/search` deja de tragarse los errores (#150).
3. ✅ **Cada denuncia nueva se envía también a Sentry como aviso** (`report_received`, nivel warning, #151). El email sigue apagado: activarlo cuenta como función y va después del saneamiento (Q22). Con el correo apagado, `moderation_email_not_configured` ya no es un error en Sentry.
4. ⬜ `SENTRY_AUTH_TOKEN` para subir los mapas de código fuente (Q25). El código ya está listo (`next.config.mjs`); falta dar de alta `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` en Vercel (Production) y redesplegar. Lo hace el dueño.
5. 🟨 **Métricas base** para comparar antes y después. Volver a medirlas después de cada fase.

   | Métrica | Antes del saneamiento | 2026-11-13 (tras fases 1–7, 9 y 10.1–10.3) |
   |---|---|---|
   | TTFB de Inicio (`/es/home`, cuenta demo) | 1,2 s | 0,43–0,57 s en caliente; 1,1 s en frío |
   | Calendario (`/es/calendar`, cuenta demo, respuesta completa) | 6,6 s | 0,49–0,79 s (caché de proveedores de ~6 h) |
   | Tasa de 5xx por endpoint | — | ⬜ pendiente: la API de logs de Vercel daba 500 al medir |
   | Errores de Sentry por semana | — | ⬜ pendiente: sin acceso a Sentry desde aquí |

   Cómo se midió: `curl` contra producción, 5 peticiones seguidas por ruta, con la sesión de la cuenta demo (`POST /api/auth/demo`). La primera petición de cada serie es la fría.

## ⬜ Fase 8 · Rediseño total (con su propio plan; Q27, Q31–Q33)

- **Cuenta como función nueva:** solo empieza con la congelación levantada y después de las fases 6, 7 y 9. Va en su propia rama de trabajo, por pantallas y en PRs pequeños, sin mezclarse con arreglos.
- Antes de empezar se escribe **su propio plan**.
- **Absorbe todo lo de interfaz:**
  - Componentes base (botón, input, footer, póster).
  - Los 196 `style={{}}` y los tokens.
  - Partir `SettingsForm`, `ConversationClient`, `WelcomeFlow`, `ImportClient` y `ListDetail`.
  - Componentes que pueden ser de servidor.
  - Los filtros de la biblioteca.
  - `loading.tsx` en las páginas que no lo tienen.
  - Un componente común de error con reintento.
- **Hasta entonces, la interfaz solo se toca para arreglar errores.**

## ⬜ Fase 11 · Documentación

1. `README.md`:
   - Arquitectura.
   - Cómo arrancar en local.
   - Convenciones: contrato de la API, forma de pedir datos, migraciones (regla 5) y entornos (Preview → `kultura-test`).
2. `.env.example` completo:
   - `CRON_SECRET`, `REVALIDATE_SECRET`, `EMAIL_TOKEN_SECRET`, `SHARE_SECRET`, `INVITE_SECRET`, `RESEND_API_KEY`, `KV_REST_API_*` y `DEMO_USER_EMAIL`.
   - Las banderas.

   Cada variable con una línea que explique qué pasa si falta.
3. Registro de decisiones:
   - Arreglar en lugar de rehacer.
   - Borrado de cuenta y mensajes (Q6).
   - Tablas de caché sin clave foránea (Q15).
   - Fuentes únicas de puntuación y progreso (Q23).
   - Migraciones con fecha futura (Q13).
4. **Borrar el código de cada bandera en estado apagado.** Las seis banderas están a `1` en producción.

## 🟨 Fase 12 · Rigor (comprobaciones automáticas; después de la 10, antes de la 8) — 1: #154 #155 y este PR · 13-11-2026

Objetivo: que los fallos que hoy solo se ven revisando a mano los pare el CI o una alarma. Un PR por punto. Prioridad: 1, 2 y 6 primero.

1. ✅ **Migraciones comprobadas solas:**
   - El CI aplica todas las migraciones en un Supabase local, genera los tipos (`supabase gen types`) y falla si no coinciden con `src/types/supabase.ts` (#154; ya faltaban dos claves ajenas de `conversations`).
   - Una migración con `drop column` falla si alguna función todavía usa la columna, o si lleva CASCADE (las vistas y políticas ya bloquean el `drop`; los índices se borran con la columna) (#155).
   - Script que compara las migraciones aplicadas en producción y en `kultura-test` con los archivos del repo (`scripts/check-applied-migrations.mjs`, a mano). 13-11: producción tiene todas menos `push` y `push_throttle` (Q14); test, todas.
2. **Seguridad en el CI:**
   - `rls_audit()` y los avisos de Supabase hacen fallar el CI si aparece uno nuevo.
   - Las funciones SECURITY DEFINER que se pueden llamar desde la API (`can_read_list`, también sin sesión): quitar el permiso de ejecución o sacarlas del esquema expuesto.
   - Activar la protección contra contraseñas filtradas.
3. **Banderas con caducidad:** un archivo con cada bandera (dueño, fecha, estado en producción). El CI falla si una pasa de 60 días. Empezar por `PROGRESS_V2`.
4. **Confianza en el CI:**
   - Tests intermitentes (`friends`, `rls-policies`) en cuarentena con motivo y plazo, y arreglados.
   - eslint también en `tests/`, después de limpiar los errores actuales.
   - Cobertura mínima solo en `src/lib/library` y en las rutas de la API.
5. **Después de desplegar:**
   - Prueba rápida automática en producción: abrir la página, entrar con el usuario demo, cargar la biblioteca.
   - Alertas de Sentry por subida de errores en `/api/library` y `/api/progress` en la hora siguiente a desplegar (depende de la fase 10).
6. **Restauración probada:** workflow mensual que restaura la última copia en Docker y compara el número de filas por tabla.
7. **Proceso en el repo:**
   - Plantilla de PR con lista: ¿migración?, ¿aplicada en test?, ¿copia hecha?, ¿versión del SW?, ¿cómo se deshace?
   - Las reglas de cambios de esquema (patrón de 3 PRs y cuándo se pueden juntar los pasos) escritas en `CLAUDE.md`.
8. **Condiciones de los proveedores** (revisadas el 13-11-2026):
   - ✅ Logo de TMDB junto a su aviso (#157). Ya estaban el aviso de TMDB, el enlace a RAWG en cada página y el enlace a la fuente en cada ficha (también ComicVine).
   - ⬜ **TMDB no deja guardar sus datos más de 6 meses.** Hoy `media` (título, póster, fondo, sinopsis, metadatos) y `media_translations` (sinopsis traducidas, contenido derivado) no caducan nunca. Tarea periódica que vuelva a pedir a TMDB lo que tenga más de 6 meses y actualice `updated_at`; lo que TMDB ya no devuelva, se vacía (no se borra la fila: la usan las bibliotecas). Un PR.

---

## Fuera del saneamiento (después de levantar la congelación)

- Email: moderación y resumen semanal (Q22).
- Push: aplicar `push` y `push_throttle` y activar `PUSH_ENABLED` (Q14).
- Rediseño total: fase 8.
- **Cobrar exige licencias antes** (condiciones revisadas el 13-11-2026):
  - TMDB: sin uso comercial con la licencia gratuita (cobrar, webs con ingresos, recomendaciones y chatbots con sus datos). Pedir licencia comercial.
  - ComicVine: solo no comercial y sin plan de pago. Otra fuente o cómics fuera de lo de pago.
  - Google Books: no deja cobrar por la app sin permiso. Pedirlo o pasar a Open Library.
  - RAWG: gratis hasta 100.000 usuarios activos al mes, con enlace; confirmar con ellos el plan (el gratuito dice «no comercial»).
  - Jikan / MyAnimeList: sin revisar.

## Orden final

B1 + B2 → 0 → docs → `.gitattributes` → 1 → 2 → 3 → (4 ∥ 5 ∥ red de seguridad) → levantar la congelación → 6 + 7 → 9 → 10 → 12 (rigor) → 8 (rediseño) → 11
