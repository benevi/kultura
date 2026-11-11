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

## 🟨 Fase 2 · Seguridad en la base de datos (migración `20261230000001_harden_grants_and_policies`) — código y test: este PR · prod: pendiente

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
- Aplicada en `kultura-test` el 11-11-2026: `tests/integration/rls` (50) en verde, `fase2.test.ts` incluido. Producción: pendiente de copia manual y «sí».
- 1: los privilegios por defecto de `supabase_admin` no se pueden cambiar desde una migración. `authenticated` sigue recibiendo SELECT/INSERT/UPDATE/DELETE por defecto (la RLS decide); ver `supabase/migrations/README.md`.
- 2 y 11: las funciones SECURITY DEFINER que usan las políticas (`can_read_*`, `has_block_with`, `is_*`, `can_send_message`) necesitan EXECUTE para quien consulta: el aviso del linter sobre ellas es esperado. `is_group_owner` se deja igual (una política la llama con otro usuario).
- 3: `username_history` se conserva: un nombre antiguo sigue reservado (ya no redirige).
- 4: la API responde 403 `not_friends` si la base lo rechaza.
- La integración de CI no corre: faltan los secretos `SUPABASE_TEST_*` en GitHub. Añadirlos (Víctor) para que el cron semanal la ejecute. Al correrla a mano salió que `createGroup` de los tests fallaba con grupos privados (RETURNING antes del disparador); la app ya lo evitaba.

---

## ⬜ Fase 3 · Integridad e índices

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

---

## ⬜ Fase 4 · Seguridad en la API (en paralelo, requiere B2)

1. Usar `checkRateLimitDistributed`, ya con Redis, en `reports/public`, `ai-recommendations`, `recommendations`, `auth/demo` y `revalidate`.
2. `recommendations`: comprobar la amistad en el servidor **antes** de llamar al proveedor.
3. `health?deep=1`: exigir un secreto.
4. `cron/daily`: no revelar si `CRON_SECRET` está configurado.
5. `groups.ts:312`: usar `escapeLikePattern`.
6. `GroupFeed.tsx:178`: publicar a través de la API, con validación y rate limit.
7. `push/subscribe:86-91`: no borrar con service role las suscripciones de otra cuenta.
8. `.env.example`: quitar `NEXT_PUBLIC_TMDB_API_KEY` y `NEXT_PUBLIC_RAWG_KEY`.

## ⬜ Fase 5 · Errores visibles (en paralelo)

1. **Calendario** (6,6 s y fallo parcial): timeout por proveedor, consultas en paralelo y caché de unas 6 h.
2. **Pósters vacíos en Descubrir**: comprobar que se arreglan con 1.5; si no, script de relleno.
3. **Sinopsis en inglés con la UI en español**: revisar el fallback de `lib/translate/synopsis.ts`.
4. **Inicio dice a la vez «Continuando» y «Sin empezar»**: leer el estado de `progress_*` (ver fase 6).

Los filtros de la biblioteca **no van aquí**: pasan a la fase 8 (Q28).

## ⬜ Red de seguridad (en paralelo desde la fase 0)

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

## ⬜ Fase 6 · Backend por módulos (un PR por módulo)

Orden: `library` → `lists` → `friends` → `chat` → `groups` → `account/import` → `settings`.

1. **zod** en todos los bodies y query params, con un único esquema para `mediaId`.
2. **Helpers** en `src/lib/api/`: `requireUser()`, `rateLimit(req, key)` (con `clientIp()`) y `apiError(code, status)`.
3. **Sacar la lógica de los handlers** a `src/lib/<módulo>/service.ts`. Primero `lists/[id]` (separando invitaciones de añadir ítems), `account/import`, `library`, `friends` y `library/progress`.
4. **Rendimiento:**
   - N+1 en `api/chat/route.ts:67-81`.
   - Descubrimiento de grupos paginado en SQL.
   - Endpoint bulk para añadir una franquicia.
   - Timeout y reintentos en el cliente de Anthropic y en `og/brand.ts`.
5. **Código muerto:** `getPopularTV`, `getTrendingMovies`, `getMovieVideos`, `getSentGroupInvitations`, `getPushConfig`, `addToLibrary` / `updateLibrary` si solo los usan tests, y `components/library/EpisodeProgress.tsx`.
6. **Una sola fuente de verdad** (Q23; las seis banderas valen `1` en producción):
   - `rating10` sustituye a `score`.
   - Las columnas `progress_*` sustituyen al JSON `episode_progress`.

   Para cada par, tres PRs: primero leer solo de la nueva, después dejar de escribir en la vieja y por último borrarla en una migración.

## ⬜ Fase 7 · Contrato de la API (junto a la fase 6)

1. Formato único:
   - Errores: `{ error: { code, message?, field? } }`.
   - Éxito: `{ data }`.
   - Catálogo de códigos en `src/lib/api/errors.ts`.
2. Esquemas zod de respuesta en `src/lib/api/contracts/` y un test de contrato por endpoint.
3. **Sin doble formato** (Q26): cada PR de módulo cambia servidor y cliente a la vez y **sube la versión del service worker**.

## ⬜ Fase 9 · Una sola forma de pedir datos (solo la parte de datos, antes de la fase 8)

1. **Regla:**
   - Lectura inicial: componentes de servidor con Supabase.
   - Mutaciones: `fetch` a `/api/*` a través de un cliente tipado único (`src/lib/api/client.ts`).
2. Quitar las escrituras desde el Supabase del navegador en `GroupFeed`, `PlatformsSection` y `useAccountSettings` (salvo `auth`). En el navegador, Supabase queda solo para realtime.
3. `WelcomeFlow` y `AddFranchiseButton` usan los wrappers.

Los `loading.tsx` y el componente de error con reintento pasan a la fase 8 (Q32).

## ⬜ Fase 10 · Monitorización

1. Los 11 `error.tsx` de página llaman a `Sentry.captureException`.
2. Los 7 handlers que devuelven 500 sin registrar el error pasan a usar `log.error`. `api/search` deja de tragarse los errores.
3. **Cada denuncia nueva se envía también a Sentry como aviso.** El email sigue apagado: activarlo cuenta como función y va después del saneamiento (Q22).
4. `SENTRY_AUTH_TOKEN` para subir los mapas de código fuente (Q25), con el plugin de Sentry.
5. **Métricas base** para comparar antes y después:
   - TTFB de Inicio: 1,2 s.
   - Calendario: 6,6 s.
   - Tasa de 5xx por endpoint.
   - Errores de Sentry por semana.

   Volver a medirlas después de cada fase.

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

---

## Fuera del saneamiento (después de levantar la congelación)

- Email: moderación y resumen semanal (Q22).
- Push: aplicar `push` y `push_throttle` y activar `PUSH_ENABLED` (Q14).
- Rediseño total: fase 8.

## Orden final

B1 + B2 → 0 → docs → `.gitattributes` → 1 → 2 → 3 → (4 ∥ 5 ∥ red de seguridad) → levantar la congelación → 6 + 7 → 9 → 10 → 8 (rediseño) → 11
