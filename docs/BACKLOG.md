# BACKLOG — KULTURA

> Una sola regla: **se trabaja de arriba a abajo. No se saltan tareas.**
> Si algo "parece más urgente", o es porque no entiendes la dependencia, o porque el orden está mal y hay que discutirlo (no saltárselo).
>
> Cada tarea tiene criterio binario de "hecho". No hay "en progreso" global — eso vive en `NOW.md`.

---

## BLOQUE A — Parar el sangrado (1–2 días reales)

Sin esto, todo lo demás se hace con la casa ardiendo.

- [x] **A1. Rotar credenciales Supabase comprometidas** ✅ (cerrada el 2026-05-01)
  Migración a sistema nuevo de Supabase API keys (`sb_publishable_*` + `sb_secret_*`). Legacy JWT-based keys deshabilitadas en el dashboard. App funcionando en local con las nuevas en `.env.local`. Vars actualizadas también en Vercel.

- [x] **A2. Verificar y reforzar `.gitignore` + ausencia de secretos en historial** ✅ (cerrada el 2026-05-01, verificación sin cambios)
  Confirmado que `.env.local` no está trackeado (`git ls-files .env.local` devuelve vacío). Falta: añadir `.claude/` a `.gitignore` (el directorio puede contener `settings.local.json` con info personal). Revisar si existe algún otro archivo con secretos en el repo.
  Hecho cuando: `.gitignore` incluye `.claude/`, y un `git grep -i "sb_secret_\|eyJhbGc" -- ':(exclude).env*'` no devuelve nada.

- [x] **A3. Rotar el resto de claves API por higiene** ✅ (cerrada el 2026-05-01)
  Aunque `TMDB_API_KEY`, `RAWG_API_KEY`, `GOOGLE_BOOKS_KEY`, `COMICVINE_KEY` y `ANTHROPIC_API_KEY` no aparecían en texto plano en el `settings.json` viejo, el archivo era una colección de comandos de debug. Por higiene: rotar todas. Para cada una: regenerar en su dashboard, actualizar `.env.local` local, actualizar Vercel.
  Hecho cuando: las 5 claves tienen valores nuevos en local + Vercel y la app sigue arrancando.

- [x] **A4. Sincronizar nombres de variables entre local y Vercel** ✅ (cerrada el 2026-05-01, ya unificado)
  En Vercel las claves son `TMDB_API_KEY`, `RAWG_API_KEY`, `GOOGLE_BOOKS_KEY` (sin `NEXT_PUBLIC_`). En `.env.local` puede que sigan con el prefijo viejo. Decidir nombres canónicos (server-only, sin `NEXT_PUBLIC_`) y unificar.
  Hecho cuando: `.env.local` y Vercel usan exactamente los mismos nombres y la app funciona en ambos entornos.

- [x] **A5. Versionar el estado actual del proyecto (commits temáticos + remoto GitHub)**✅ (cerrada el 2026-05-02).
 13 commits temáticos en 4 sesiones + reescritura de identidad + push a https://github.com/benevi/kultura (privado). Detalles en DONE.md. Working tree limpio, master en sync con origin.

- [ ] **A6. Auditoría de coherencia repo vs disco**
        Verificar que después de A5 no quedan archivos en disco que no estén
        trackeados (salvo los explícitamente ignorados por .gitignore). Si
        hay huérfanos, decidir uno por uno: stagear, ignorar, o borrar.
        Hecho cuando: `git status --short` solo lista archivos con cambios
        legítimos, sin "??" inesperados.

---

## BLOQUE B — Base reproducible (2–3 días)

Sin esto, cada cambio posterior es ruleta rusa.

- [x] **B1-A. Limpiar tests rotos huérfanos**✅ (cerrada el 2026-05-01)
  6 errores en `tests/` impiden `tsc --noEmit`: 3 tests de componentes Library inexistentes, 1 test de `@/lib/env` (módulo aún no creado, es E24), 2 mocks desactualizados en `queries.test.ts`.
  Hecho cuando: `tsc --noEmit` exit 0, `vitest run` exit 0, hay commit `[B1-A] Limpiar tests rotos`.

- [x] **B1-B. CI básico en GitHub Actions** ✅ (cerrada el 2026-05-02)
  El B1 original. Workflow con typecheck + tests unit + build.
  Depende de: B1-A.
   
- [x] **B1-C. Arreglar 4 tests fallando en register-form.test.tsx** ✅ (cerrada el 2026-05-02, absorbida por B1-B)
  mockRouterPush nunca se llama. Investigar: ¿mock router 
  mal? ¿signUp mock falta? ¿flujo del componente cambió?
  Hecho cuando: vitest run pasa los 4 tests de register-form.
  
- [x] **B2. Migraciones SQL versionadas** ✅ (cerrada el 2026-05-03)
  Baseline SQL recuperada vía `supabase db pull --schema public` tras reparar entrada huérfana de migración `20260502155455` (`supabase migration repair --status reverted`). Archivo: `supabase/migrations/20260502233945_remote_schema.sql` (~32 KB, 17 tablas, 49 RLS policies, 4 funciones trigger). Verificada contra `db_snapshot.txt` sin discrepancias. Sintaxis SQL validada con postgres puro (Plan B) — `supabase db reset` local quedó pendiente por degradación de Docker Desktop (ver B2-VERIFY).

- [x] **B2-DOC. Documentación de la baseline** ✅ (cerrada el 2026-05-03)
  Cubierta por `supabase/migrations/README.md` (cómo aplicar, política de migraciones futuras, advertencia sobre `db push` sobre la baseline) + tipos TypeScript completos en `src/types/supabase.ts` (interfaces `DbSuggestion`, `DbConversation`, `DbConversationMember`, `DbMessage`, `DbGroup`, `DbGroupMember`, `DbGroupPost` añadidas). NOTA: la actualización de los marcadores `[POR VERIFICAR EN B2]` en CLAUDE.md queda separada en B2-DOC-CLAUDE por discrepancia detectada en `group_members.role` (ver B2-DOC-CLAUDE).

- [x] **B2-DOC-CLAUDE. Actualizar CLAUDE.md con SQL canónico de las 7 tablas** ✅ (cerrada el 2026-05-03)
  CLAUDE.md actualizado en commit B2: marcadores `[POR VERIFICAR EN B2]` eliminados, `group_members.role` corregido a `'owner' | 'member'` (no existía `admin`), `users.bio` documentada, SQL de las 7 tablas confirmado contra `db_snapshot.txt`.

- [ ] **B2-VERIFY. Verificar `supabase db reset` en local**
  Ejecutar `supabase db reset` en entorno local y confirmar que el schema resultante es idéntico al de producción. Reintentar cuando Docker Desktop esté operativo. Bloqueo no afecta progreso del proyecto: SQL validado contra postgres puro sin errores reales, y schema vivo en remoto desde abril sin incidencias. Ejecutar `supabase start && supabase db reset` cuando Docker esté restaurado y verificar conteos: 17 tablas / ~49 policies / 4 funciones trigger.
  **Intento del 2026-05-03 bloqueado** por degradación de Docker Desktop (`input/output error` en blob storage de containerd, persistente tras restart).
  Hecho cuando: `supabase db reset` sale con exit 0 y un diff contra producción devuelve vacío.
  Depende de: B2 (✅).

- [x] **B4. Auditar y eliminar `kultura-backup-2026-05-01.zip`** ✅ (cerrada el 2026-05-03)
  Zip auditado en B3: 280.4 MB, 30876 archivos, incluía `kultura\.env.local` con credenciales reales y vigentes (idénticas al `.env.local` actual). Tras 6 verificaciones por el usuario (no OneDrive, no Google Drive, no compartido, no segunda máquina, no backup automático en la nube), confirmado que el zip nunca salió de la máquina. Decisión: NO rotar claves. Zip borrado por el usuario, carpeta temporal de auditoría eliminada.

---

## BLOQUE C — Que producción no sea una caja negra (3–4 días)

Sin esto, cuando algo falle en prod no te vas a enterar.

- [ ] **C1. Sentry integrado**
  `@sentry/nextjs` con DSN en env vars. Capturar errores de Route Handlers y componentes cliente.
  Hecho cuando: un `throw new Error("test")` en una ruta aparece en el dashboard de Sentry en <1 min.

- [ ] **C2. Logger estructurado reemplaza `console.error`**
  `src/lib/logger.ts` con pino o similar. Reemplazar las 15 instancias de `console.error` documentadas en el audit.
  Hecho cuando: `grep -rn "console\." src/ --include="*.ts" --include="*.tsx"` devuelve 0 o solo casos justificados.

- [ ] **C3. Rate limiting → Vercel KV**
  Reemplazar el `Map` en memoria por `@vercel/kv`. Sliding window igual que ahora, pero distribuido.
  Hecho cuando: dos requests paralelos desde dos instancias diferentes de Vercel respetan el mismo contador.

- [x] **C4. Rate-limit en endpoints sin proteger** ✅ (cerrada el 2026-05-03)
  Aplicado `checkRateLimit` en 6 endpoints: `POST /api/chat` (10/h), `POST /api/chat/[id]` (10/min), `GET /api/chat/[id]` (60/min), `POST /api/groups` (5/h), `POST /api/suggestions` (3/h), `GET /api/users/search` (30/min). Sistema in-memory existente extendido con 6 nuevos presets en `LIMITS`. Tests: 6 nuevos en `tests/unit/rate-limit/rate-limit.test.ts` (18 total, 18 green). Todos devuelven 429 + `Retry-After`.

- [ ] **C5. Activar CSP en modo enforce mejorado**
  El CSP actual tiene `'unsafe-inline'` en script-src. Eliminar requires nonces (ver C7). Tras C7, pasar CSP a modo enforce sin `'unsafe-inline'` y verificar en producción que no hay regresiones.
  Depende de: C7.
  Hecho cuando: `Content-Security-Policy` en producción no contiene `'unsafe-inline'` y el sitio funciona.

- [ ] **C6. Auditar dominios externos en CSP y limpiar allowlist**
  El `img-src https:` actual permite cualquier dominio HTTPS para imágenes. Cuando se tenga tráfico real, revisar los logs/reports de CSP para confirmar qué dominios realmente se usan y reemplazar `https:` por una allowlist explícita. Prioridad baja.
  Hecho cuando: `img-src` no contiene `https:` genérico, sino dominios específicos verificados.

- [ ] **C7. Eliminar `'unsafe-inline'` de CSP script-src usando nonces**
  Next.js 14 permite nonces en CSP via middleware. Requiere generar un nonce por request en `middleware.ts` y pasarlo tanto al header CSP como al `<script>` de `_document`. Prioridad media, hacer antes de B6 (monetización).
  Hecho cuando: `Content-Security-Policy` no contiene `'unsafe-inline'` en `script-src`, `npm run build` pasa, y la app funciona sin errores de CSP en consola.

- [ ] **C8. Verificar periódicamente que Vercel sigue añadiendo HSTS**
  Vercel añade automáticamente `Strict-Transport-Security: max-age=63072000` (confirmado 2026-05-03). Si cambia el plan de Vercel, se migra de proveedor, o Vercel modifica su política, HSTS podría desaparecer. Chequear tras cualquier cambio de plan y como mínimo una vez al año.
  Hecho cuando: verificación manual en DevTools confirma presencia del header. Si desaparece, reactivar en `next.config.mjs` con `max-age=63072000; includeSubDomains; preload`.

---

## BLOQUE D — Legal mínimo (2 días)

Bloqueante si tienes o quieres usuarios EU.

- [ ] **D1. Política de privacidad + Términos**
  Páginas estáticas en `/[locale]/privacy` y `/[locale]/terms`. Enlazadas desde footer.
  Hecho cuando: ambas páginas existen en es y en, y el footer las enlaza.

- [ ] **D2. Endpoint de eliminación de cuenta**
  `DELETE /api/account` que borre al usuario actual. Cascades en DB ya existen (verificar).
  Hecho cuando: un usuario puede eliminar su cuenta desde settings y desaparece de todas las tablas.

- [ ] **D3. Exportación de datos básica**
  `GET /api/account/export` que devuelva JSON con toda la data del usuario.
  Hecho cuando: el endpoint responde con library + lists + friendships del usuario autenticado.

---

## BLOQUE E — Mejoras de calidad (opcional para MVP)

No bloqueantes. Atacar solo después de A–D.

- [ ] **E1.** `generateMetadata()` en páginas de contenido — `/media/[type]/[id]`, `/profile/[username]`, `/lists/[id]`.
- [ ] **E2.** Error Boundaries en secciones principales.
- [ ] **E3.** Paginación verificada en todas las queries de listado.
- [ ] **E4.** Tests de componentes React con `@testing-library/react`.
- [ ] **E5.** E2E ampliado — library add, recomendación user-to-user, crear lista.
- [ ] **E6.** ComicVine implementado — `/api/comics/route.ts` + `lib/api/comicvine.ts`.
- [ ] **E7.** OAuth Google vía Supabase Auth.
- [ ] **E8.** Recuperación de contraseña personalizada.
- [ ] **E9.** Form fields con id/name (warning visto en consola — accesibilidad).
- [ ] **E10. Evaluar 3 APIs alternativas de libros**
  Motivación: Google Books + Open Library devuelven pocos resultados o de baja calidad para títulos en español que no son bestsellers. Probar Hardcover (GraphQL, gratuito con cuenta), ISBNdb (REST, free tier 1 req/s), y Open Library standalone (gratis, sin key) con un set fijo de 10 queries reales que actualmente fallan o dan resultados pobres. Comparar: cobertura de resultados, calidad de metadatos en español, calidad de portadas, límites de rate.
  Hecho cuando: existe `docs/decisions/books-api.md` con (a) las 10 queries de prueba, (b) tabla comparativa, (c) decisión razonada, (d) API elegida.

- [ ] **E11. Migrar `lib/api/googlebooks.ts` → API decidida en E10**
  Implementar el adapter nuevo con la misma firma que `lib/api/googlebooks.ts` actual. El `normalizer` no debería cambiar (todo termina en `MediaItem`). Mantener Open Library como fallback solo si la nueva API tiene huecos detectados en E10. Actualizar tests de contrato.
  Hecho cuando: búsqueda de libros y detalle funcionan con la nueva API, las 10 queries de E10 dan mejores resultados que antes, y los tests de contrato pasan en verde.
  Depende de: E10.

- [ ] **E12. Activar `forceConsistentCasingInFileNames` en tsconfig.json**
  Previene la clase de bug detectada en B1-B (`Button.tsx` vs import `button`). Windows oculta colisiones case-only que Linux CI sí ve. Con esta flag, `tsc --noEmit` las caza en local.
  Hecho cuando: `tsconfig.json` tiene `"forceConsistentCasingInFileNames": true` en `compilerOptions`, `npm run type-check` pasa en verde, hay commit `[E12] ...`.

- [ ] **E13. Auditoría de colisiones case-only en el repo entero**
  Limpieza de pasado (E12 previene futuro). Ejecutar `git ls-files | sort -f | uniq -di` y resolver cualquier colisión que aparezca. Si no hay ninguna, cerrar la tarea con el output vacío como prueba.
  Hecho cuando: `git ls-files | sort -f | uniq -di` devuelve vacío, hay commit `[E13] ...` (aunque sea solo de cierre documental si no había colisiones reales).
  Depende de: E12 (orden lógico, no técnico — E12 evita que reaparezcan tras limpiar).

- [ ] **E14. Reportar bug a Supabase CLI: `db dump --dry-run` imprime credenciales en stdout**
  Durante B2 se detectó que `supabase db dump --dry-run` (o variante similar) imprime la cadena de conexión incluyendo la service role key en stdout. Esto es un bug de seguridad en la CLI de Supabase. Redactar y enviar un issue al repo `supabase/cli` con reproducción mínima y output censurado.
  Hecho cuando: issue abierto en github.com/supabase/cli con enlace documentado aquí.

- [ ] **E15. Eliminar código muerto**
  - `src/lib/api/openlibrary.ts` — no usado por `searchAll` (Open Library figura como fallback documentado pero el adapter actual no se invoca desde el flujo de búsqueda; verificar antes de borrar).
  - `src/components/lists/` — carpeta vacía; los componentes reales viven en `src/components/social/`.
  - `tests/_pending/` — si tras B3 sigue sin desbloquearse, mover a `_archive` o borrar.
  Hecho cuando: las 3 rutas no existen o se documenta por qué se conservan.

- [ ] **E16. Deduplicar tipo `EpisodeProgress`**
  Definido dos veces con la misma forma: `src/types/library.ts:17-20` y `src/types/user.ts:35-38`. Dejar una única definición y reexportar desde el otro módulo si hace falta para no romper imports.
  Hecho cuando: `grep -rn "EpisodeProgress" src/types/` muestra una sola declaración y `npm run type-check` pasa.

- [x] **E17. Tipar las 7 tablas faltantes en `src/types/supabase.ts`** ✅ (cerrada el 2026-05-03)
  Añadidas interfaces `DbSuggestion`, `DbConversation`, `DbConversationMember`, `DbMessage`, `DbGroup`, `DbGroupMember`, `DbGroupPost` derivadas del SQL canónico (`supabase/migrations/20260502233945_remote_schema.sql`) + entradas correspondientes en el mapa `Database`. `npm run type-check` pasa. Refactor de los `as unknown as Array<{...}>` ad-hoc → E19.

- [ ] **E18. Reemplazar `console.error` por logger estructurado**
  17 instancias listadas en `ESTADO_PROYECTO.md` §15.8. Cross-link con C2 (logger estructurado): esta tarea es la migración mecánica de los call-sites una vez C2 introduce `src/lib/logger.ts`.
  Depende de: C2.
  Hecho cuando: `grep -rn "console\." src/ --include="*.ts" --include="*.tsx"` devuelve 0 o solo casos justificados, y `npm run lint` pasa.

- [ ] **E19. Eliminar casts `as unknown as Array<{...}>` repetidos**
  Una vez E17 introduce los tipos completos, los casts de `groups/route.ts`, `chat/route.ts`, etc. dejan de hacer falta. Limpiar y dejar tipado idiomático Supabase.
  Depende de: E17.
  Hecho cuando: `grep -rn "as unknown as" src/` devuelve 0 (o solo casos justificados con comentario).

- [ ] **E20. Migrar inputs de `LoginPage.tsx` a componente `<Input>`**
  Coherencia con el resto del proyecto: `src/app/[locale]/login/LoginPage.tsx:303-372` usa `<input>` raw en lugar del componente `<Input>` de `src/components/ui/`.
  Hecho cuando: el archivo no contiene `<input` y la pantalla de login sigue funcionando (manual + e2e auth.spec).

- [ ] **E21. Endpoint `DELETE /api/groups/[id]` y endpoint para `group_posts`**
  Actualmente: no hay endpoint para eliminar grupos (solo crear/listar/join/leave) y los posts de grupo se insertan cliente-direct vía RLS. Crear `DELETE /api/groups/[id]` (solo `owner`) y `POST /api/groups/[id]/posts` (solo miembros). Aplicar rate-limit de C4 cuando se haga.
  Hecho cuando: ambos endpoints existen, validan rol/membership server-side, y hay tests de integración mínimos.

- [x] **E22. (CERRADA 2026-05-31, absorbida por E45-b)** **Página `/groups` con listado público de grupos**
  Hoy solo existe `/groups/[id]`. Sin listado, los grupos son invisibles para no-miembros (ver `ESTADO_PROYECTO.md` §18.3). Crear `src/app/[locale]/(app)/groups/page.tsx` con listado básico (paginado, filtro por nombre).
  Hecho cuando: la ruta `/[locale]/groups` renderiza grupos visibles y enlaza a `/groups/[id]`.

- [ ] **E23. Unificar policies duplicadas en `users`**
  Hay dos policies UPDATE casi-idénticas con el mismo predicate (`auth.uid() = id`): `users can update own profile` y `users_update_own`. Ruido en la capa de seguridad. Eliminar una de las dos creando una migración nueva (`supabase migration new dedupe_users_update_policies`). Prioridad baja, hacer antes de producción real.
  Hecho cuando: `pg_policies WHERE tablename='users' AND cmd='UPDATE'` devuelve exactamente 1 fila y hay commit con migración.

- [x] **E24. Validación de env vars al startup**
  `src/lib/env.ts` con Zod que valide todas las env vars requeridas. Importar en `app/layout.tsx`.
  Hecho cuando: arrancar sin `ANTHROPIC_API_KEY` falla con mensaje claro en startup, no en primera request.

- [x] **E25. Refactorizar specs E2E de `discover-pagination`** ✅ (cerrada el 2026-05-14, B3.5h-AUDIT-E2E-4)
  Añadido `login()` en `beforeEach` de `tests/e2e/b3_5e_safety_net/discover-pagination.spec.ts`. Los 4 tests (anime, manga, paginación, movie-control) pasaron de ROJO-POR-REDIRECT a evaluables. Resultado: todos verdes con API real de Jikan/TMDB. 8 corridas (chromium + mobile) → verde. Comentario erróneo ("NO requiere credenciales") corregido en el spec.

- [x] **E26. Reforzar selector del picker en `chat-send.spec.ts`** ✅ (cerrada el 2026-05-13, commit 17290c6)
  `data-testid="friend-picker-item"` añadido a `ChatClient.tsx`. Selector en `chat-send.spec.ts` reemplazado por `getByTestId('friend-picker-item').first()`. Chat-send pasó de failed→passed en E2E run.

- [ ] **E27. Auditar policies RLS por recursión potencial**
  Durante B3.5c-3 se destaparon 3 capas de RLS rotas en `conversation_members` que emergieron secuencialmente al arreglar la anterior. Patrón a buscar: policies con `WITH CHECK` o `qual` que consulten la propia tabla. Tablas a revisar: `messages`, `group_members`, `group_posts`, `friendships`, `list_members`, `list_items`. Esta tarea es el contenido del bloque B3.5g-AUDIT-RLS y se ejecutará como sprint completo (no como E-task suelta).
  Hecho cuando: cada policy de las 17 tablas está clasificada (segura / recursiva / dudosa) y las recursivas han sido refactorizadas con SECURITY DEFINER functions o reescritas para evitar self-reference.
  Depende de: nada. Promovido a bloque B3.5g.

- [ ] **E28. Reforzar red de seguridad E2E con sesión real (no service_role)**
  El seed actual (`scripts/seed-test.mjs`) usa service_role y bypassa RLS. Por eso B3.5c-3 tuvo bugs de RLS verdes en tests pero rojos en uso real. Pensar en seedar parte vía API con login real, o añadir un nivel de tests E2E que ejerciten flujos críticos con sesión auth válida (no service_role).
  Hecho cuando: existe al menos un spec E2E que ejecuta INSERT/UPDATE/DELETE como usuario autenticado real y verifica que las RLS no bloquean falsamente operaciones legítimas (regresión de bug 1).

- [x] **E29. Defensa null-safety en `discover/page.tsx`** ✅ (cerrada 2026-05-27, commits 389d99f+445dcc3+93db7c5+fe4f3f1)
  Causa real: Jikan 429 tragado por catch genérico + posible data: null sin guard. Fix: JikanError(.status), guard Array.isArray en anime/manga, guard totalItems books, catch distingue 429→"rate-limit" / resto→"generic", banner muestra mensaje específico. fetchDiscoverData extraída a lib/api/discover.ts (testeable). 521/58 green.

- [ ] **E30. CSP en development debe permitir `'unsafe-eval'`**
  El CSP actual es el mismo en dev y prod, y rompe HMR de React Refresh en development (requiere `unsafe-eval`). Patrón a aplicar en `next.config.mjs`:
```js
  const isDev = process.env.NODE_ENV !== 'production';
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";  // pendiente quitar 'unsafe-inline' en C7
```
  Hecho cuando: `npm run dev` no muestra warnings de CSP por `unsafe-eval`, y `npm run build` + producción mantienen el CSP estricto sin `unsafe-eval`.

- [ ] **E31. Documentar workaround swap `.env.local` en `docs/B3_5e_TEST_ENV.md`**
  La verificación manual contra kultura-test se hace vía swap del archivo `.env.local` (NO con `NODE_ENV=test` + `npm run dev`, que rompe HMR por CSP). Documentar el procedimiento exacto: backup → reemplazar URLs/keys → `npm run dev` normal → restaurar al terminar. Tras cerrar E30 este workaround puede simplificarse a un `npm run dev:test` limpio.
  Hecho cuando: `docs/B3_5e_TEST_ENV.md` contiene la sección "Verificación manual contra kultura-test" con comandos PowerShell paso a paso y la nota sobre simplificación post-E30.

- [x] **E32. Bug `findOrCreateUser` no idempotente para password** ✅ (cerrada el 2026-05-11, hash 0bc9b4c)
  `scripts/seed-test.mjs` decía ser idempotente pero no actualizaba la password si el usuario ya existía — solo retornaba el `id`. Si la pass cambiaba en `.env.local`, el seed no la reconciliaba. Fix: `findOrCreateUser` ahora llama `auth.admin.updateUserById` con la password de `.env.local` cuando el usuario existe.

- [ ] **E33. Documentar convención de comillas en `.env*` para credenciales con caracteres especiales**
  Node con `--env-file` (Node 20+) trata `#` como inicio de comentario y trunca silenciosamente. Bug visto en sesión 5: password `SeS1*WiZY7JES^HETQi%e#rf` (24 chars) se leía como `SeS1*WiZY7JES^HETQi%e` (21 chars). Solución: envolver SIEMPRE entre comillas dobles cualquier credencial generada que pueda contener `#`, `$`, espacios u otros caracteres conflictivos. Documentar en `docs/B3_5e_TEST_ENV.md` y/o en `CLAUDE.md` sección env vars.
  Hecho cuando: la convención está documentada en al menos uno de esos dos archivos, con ejemplo del bug y la forma correcta.

- [ ] **E34. Documentar política de acceso a `reports`**
  La tabla tiene RLS habilitado con solo INSERT policy; SELECT/UPDATE/DELETE solo accesibles via `service_role`. Decidir si: (a) se mantiene así con documentación explícita en un comentario SQL, (b) se añade una policy SELECT restringida (ej. solo el reporter ve sus propios reports), o (c) se construye un panel de admin que use service_role. Hallazgo de B3.5g-AUDIT-RLS-1 (sección 6).
  Hecho cuando: existe documentación explícita de la decisión (comentario SQL en la migration o entrada en `docs/`) o se ha añadido la policy SELECT decidida.

- [ ] **E35. Normalizar `roles={public}` → `{authenticated}` en ~30 policies**
  Las policies funcionan correctamente porque los predicados `auth.uid() = ...` filtran a anon, pero el alcance declarado es subóptimo y ensucia auditorías futuras. Cambio cosmético, sin riesgo funcional. Aplicar via migration única que regenere las ~30 policies con `TO authenticated` explícito. Hallazgo de B3.5g-AUDIT-RLS-1 (sección 6).
  Hecho cuando: `SELECT count(*) FROM pg_policies WHERE schemaname='public' AND roles='{public}'` devuelve 0 (o solo las policies donde `public` es realmente intencional).

- [ ] **E36. Rediseño defensivo de `conversations` INSERT**
  El endurecimiento aplicado en B3.5g-AUDIT-RLS-2 (Tarea 2) es defensa básica (`auth.uid() IS NOT NULL`). Una policy más estricta requiere: (a) añadir columna `created_by` a `conversations`, (b) trigger `AFTER INSERT` que añada al creador a `conversation_members`, (c) policy `WITH CHECK (created_by = auth.uid())`. Patrón paralelo a `handle_new_group`. Prioridad baja porque el Route Handler ya valida el flujo.
  Hecho cuando: `conversations` tiene columna `created_by`, trigger correspondiente, y policy `WITH CHECK (created_by = auth.uid())`. Tests E2E de chat siguen en verde.

- [x] **E37** — Puerto hardcodeado en `tests/e2e/auth.spec.ts`. `localhost:3001` hardcodeado
  mientras `playwright.config.ts` configura `baseURL: http://localhost:3000`. Corregido en
  B3.5g-AUDIT-RLS-2-E2E sustituyendo `const BASE = "http://localhost:3001"` por `const BASE = ""`,
  usando el `baseURL` de Playwright. ✅ Cerrada en este bloque. Auditar otros specs en busca del
  mismo patrón (`grep -r "localhost:" tests/e2e/`).

- [ ] **E38** — Playwright debería cargar `.env.test.local` automáticamente. El workaround
  actual (merge manual en `playwright.config.ts` `webServer.env`) funciona pero es frágil —
  si el archivo no existe, Playwright corre contra producción sin advertir. Solución de raíz:
  `globalSetup` que valide presencia de `.env.test.local` antes de arrancar, o `dotenv-cli`
  en el script `test:e2e` de `package.json`. Prioridad media — el flujo actual funciona.

- [x] **E39** ✅ (cerrada el 2026-05-13, commit 54d183f) — `reuseExistingServer: !process.env.CI` → `false`. Puerto cambiado a `:3001` (webServer + baseURL + _helpers.ts `BASE`). Dev en `:3000` y Playwright en `:3001` sin conflicto.

- [x] **E40** ✅ CERRADA en B3.5h-AUDIT-E2E-5 (2026-05-14). Fix: desactivar "Confirm email" en Dashboard de kultura-test (Authentication → Sign In / Providers → Email). signUp ahora auto-confirma → `data.session` no-nulo → redirect a `/home`. 34/34 verdes (chromium + mobile). El spec no necesitó cambios — la lógica dual ya cubría ambas ramas. Ver `docs/TEST_EXCEPTIONS.md` y `docs/SUPABASE_TEST_SETUP.md`.

- [x] **E41** — BLOQUEADO-DOCUMENTADO (commit 7107cab, 2026-05-13). `page.route()` solo intercepta requests del browser; las llamadas a Jikan/TMDB son server-side en RSC, invisibles para Playwright. Mock requeriría mover fetches a Route Handlers. Documentado en header del spec. Añadir E41-redesign como tarea futura separada.

- [x] **E42** ✅ (cerrada el 2026-05-13, commit 22c2ee3) — `const BASE = ""` eliminada y usos `${BASE}/...` → `/...` en `auth.spec.ts`.

- [x] **E43** ✅ (cerrada el 2026-05-13, commit 51ddcc0) — 5 ocurrencias OR+.first() eliminadas: chat-send L24 (quitado .first()), L37 (OR→input[type=text] directo), L41 (OR→getByRole single), discover-pagination L75 (OR→getByTestId pagination-next; data-testid añadido a Pagination.tsx), language-switch L31-33 (OR→aria-label selector directo).

- [ ] **E44** — Vercel auto-promote desactivado: producción requiere promoción
  manual. Detectado en sesión 8 al verificar deploy post-handover_7.
  Investigar si es setting de proyecto (toggle) o política del plan Hobby.
  Refuerza importancia de regla 11 (verificar Current, no solo Ready).

- [x] **E45. Grupos: flujo de descubrimiento + RLS de join + visibilidad/invitaciones** — ✅ CERRADA COMPLETA 2026-06-04

  **Estado (2026-06-04):** E45-a ✅, E45-b ✅, E45-c ✅, E45-d ✅. **E45 cerrada completa.** E45-a CERRADA (RLS self-join + feedback UI; commit 37e38a6). E45-b CERRADA (descubrimiento + pagina /groups con tabs + DiscoverGroupsClient + GroupCard + refactor FriendsClient + nav; commits 2ef43f7, a96f8a2, da4a902, 1251994; engloba y cierra E22). E45-c CERRADA 2026-06-01 (is_public + RLS + discover filtra privados + UI; commit 759c1b3). E45-d CERRADA 2026-06-04 (d.1 backend commit 410340c + d.2 UI commit d96e40f).

  **Flujo roto detectado (diagnóstico GRUPOS-DIAG, 2026-05-23):** El módulo de grupos
  existe estructuralmente (tablas, endpoint, UI de detalle) pero es inaccesible como
  producto: no hay forma de encontrar grupos, y el mecanismo de unión está además bloqueado
  a nivel de RLS.

  **Qué existe hoy:**
  - Tablas: `groups` (id, owner_id, name, description, cover_color) y `group_members`
    (group_id, user_id, role ∈ {owner, member}, joined_at). Sin columna de visibilidad
    (`is_public`, `privacy`, etc.) ni tabla de invitaciones.
  - Rutas UI: solo `src/app/[locale]/(app)/groups/[id]/page.tsx` (detalle). No existe
    `groups/page.tsx` (listado/búsqueda). Registrado parcialmente en E22.
  - Creación: formulario inline en `FriendsClient.tsx` (pantalla Amigos), llama a
    `POST /api/groups`.
  - Endpoint join/leave: `POST /api/groups/[id]/join` — lógica correcta (toggle member
    ↔ leave, bloquea owner-leave), pero usa `createClient()` autenticado, por lo que
    está sujeto a RLS.
  - `GET /api/groups`: devuelve solo los grupos del usuario autenticado (no listado global).

  **Qué falta / bugs:**
  - a. **RLS bloqueante (bug real):** `group_members` INSERT tiene una única policy
    `"Group owners can manage members"` — solo permite al owner insertar filas. No existe
    policy de self-join (`user_id = auth.uid()`). Consecuencia: `POST /api/groups/[id]/join`
    falla con error 500 para cualquier usuario no-owner porque la INSERT queda bloqueada
    por RLS. El join no funciona aunque llegues por URL directa.
  - b. **Descubrimiento:** no hay ruta `/groups` ni buscador. Los grupos son invisibles
    salvo que conozcas el UUID. (Solapamiento con E22, que solo contempla el listado UI
    pero no el bug de RLS ni el modelo de visibilidad.)
  - c. **Modelo de visibilidad:** la tabla `groups` no tiene columna de visibilidad
    (`is_public` / `privacy`). Todos los grupos son implícitamente "abiertos" pero
    inaccesibles. No existe modelo de invitaciones (ninguna tabla).

  **Sub-piezas para cuando se planifique:**
  - [x] E45-a: Migración que añade policy RLS de self-join en `group_members` (fix bloqueante,
    pequeño, independiente). ✅ CERRADA 2026-05-31 (commit 37e38a6) — policy `"Users can join groups"`
    `WITH CHECK (user_id = auth.uid() AND role = 'member')` + JoinGroupButton toast + test.
  - [x] E45-b (CERRADA 2026-05-31): Página `/groups` con listado/búsqueda (engloba E22; E22 puede cerrarse al
    completar esto).
  - [x] E45-c (CERRADA 2026-06-01): `is_public boolean default true` en `groups` + RLS
    (función `SECURITY DEFINER` `is_group_member`, sin recursión) + discover filtra privados +
    UI toggle crear / badge privado / join condicional (`showJoin = isMember || isOwner || isPublic`) +
    propagación `isPublic` + i18n. Privados solo admiten miembros vía owner hasta E45-d. Commit 759c1b3.
  - [x] E45-d (CERRADA 2026-06-04): Tabla `group_invitations` + flujo de invitación (enviar / aceptar / rechazar).
    d.1 backend (migración `20260601000002_group_invitations.sql` + RLS + trigger accept→alta + enum `group_invite` + endpoints; commit 410340c, +23 tests). d.2 UI (InviteButton owner-gated + InviteFriendsModal + branch `group_invite` en NotificationsList con Aceptar PATCH / Rechazar DELETE + `router.refresh()` + i18n es/en; commit d96e40f, +17 tests). vitest 639 passed.

  No planificar aún. Solo backlog.

- [ ] **E46. Migrar MediaCard al sistema de diseño**

- [x] **E47. Listas: UI para añadir títulos a una lista (endpoint ya existe)** ✅ (cerrada el 2026-05-29)

  **Diagnóstico LISTAS-ADD-DIAG (2026-05-25):** El endpoint `POST /api/lists/[id]` existe y
  funciona correctamente (acepta `{ mediaId, mediaCache? }`, llama `canEditList`, inserta en
  `list_items`). La RLS de INSERT es correcta: permite owner + miembros de listas colaborativas.
  El flujo NO existe en la UI: ni `ListDetail.tsx` ni `MediaDetail.tsx` ni `MediaCard.tsx`
  tienen ningún botón/acción de "añadir a lista". Tampoco existen claves i18n para ello.

  **Veredicto:** (B) backend completo sin UI.

  **Qué falta:**
  - CTA en `MediaDetail.tsx` (ficha de título): botón "Añadir a lista" que abra un selector
    de listas del usuario compatibles por `media_type`. Llamada a `POST /api/lists/[id]` con
    `mediaCache` para garantizar el upsert en tabla `media`.
  - CTA alternativo / adicional en `ListDetail.tsx`: botón en el header o en el estado vacío
    que abra buscador de títulos y los añada directamente desde la lista.
  - Claves i18n: `lists.addItem`, `lists.addToList`, `lists.selectList`, etc.

  Hecho cuando: desde la ficha de un título autenticado se puede añadir a una lista propia
  y el ítem aparece en `/lists/[id]` sin necesidad de ir al detalle de la lista primero.

- [ ] **E48. Notificaciones: mejoras DS aplazadas**
  Sub-piezas (sin priorizar):
  (a) `loading.tsx` — skeleton para estado de carga (actualmente no existe en `/notifications`).
  (b) Acción primaria en empty state (DS §7) — añadir botón verde que lleve a Descubrir o Amigos.
  (c) Cablear `markOneRead` — función huérfana en `notifications.ts:66`, sin caller en la UI.
  (d) Paginación — hoy límite duro de 50 resultados en `getNotifications`; añadir cursor-pagination.

- [ ] **E49. (reservado)**

- [ ] **E50. Notificaciones: estado no-leído efímero por `markAllRead` en carga**

  **Hallazgo (sesión 2026-05-26):** El fondo verde (`accent-positive/5`) del estado
  no-leído está correctamente aplicado en el DS visual. El problema es de producto:
  `markAllRead` (en `src/lib/social/notifications.ts`) se llama al montar la página
  `/notifications`, lo que marca todas las notifs como leídas antes de que el usuario
  las vea. El efecto visual del estado no-leído es por tanto efímero (apenas perceptible
  en la primera carga) y en la práctica invisible.

  **No es un bug de migración visual** — el token y el color están bien aplicados.
  Es un bug de flujo de producto.

  **Flujo afectado:** `src/lib/social/notifications.ts` (`markAllRead`) +
  página `src/app/[locale]/(app)/notifications/` (caller de `markAllRead` en montaje).

  **Arreglo futuro (fuera del carril visual):** retrasar `markAllRead` usando una de
  estas estrategias: (a) retardo temporal tras render inicial, (b) marcar leído por
  interacción explícita (clic / hover), (c) marcar al salir de la pantalla
  (`IntersectionObserver` o `beforeunload`). Ninguna de las tres requiere cambios de
  diseño ni de tokens.

  Sin priorizar. No atacar hasta decidir estrategia de producto.

- [x] **E51. Validación en cliente + mensajes específicos en SuggestionsForm**

  **Hallazgo (diagnóstico SUGERENCIAS-400, 2026-05-26):** El 400 en `POST /api/suggestions`
  es validación Zod esperada y correcta — `description.min(10)` rechaza inputs cortos como
  `"nynf"` (4 chars). No hay bug de payload ni rate-limit. La UX es pobre:

  - `SuggestionsForm.tsx:87` — `subject` solo tiene `maxLength={120}` + `required`, sin `minLength={3}`.
  - `SuggestionsForm.tsx:99` — `description` solo tiene `maxLength={2000}` + `required`, sin `minLength={10}`.
  - Sin validación Zod en cliente: cualquier entrada de 1 char se envía al servidor y falla.
  - `route.ts:33` devuelve `{ error: 'Invalid data' }` genérico (sin detalle por campo).
  - `SuggestionsForm.tsx:23` ignora el body del 400; muestra siempre `t('error')` fijo.

  **Qué falta:**
  - Añadir `minLength={3}` a `subject` y `minLength={10}` a `description` (o validación Zod en cliente).
  - Mostrar conteo/feedback por campo cuando la longitud no alcanza el mínimo.
  - Opcional: que el servidor devuelva los errores de Zod por campo (`parsed.error.flatten()`).

  Hecho cuando: enviar `description` de 4 chars muestra error inline antes de hacer fetch,
  y el form no puede enviarse con datos que fallen la validación del servidor.

- [x] **E52. Silent fail duplicado en ChatClient + ConversationClient** — `.catch(() => setLoading(false))` en ambos archivos traga el error de carga y deja pantalla vacía sin feedback al usuario. Mejora funcional, no bug de migración.

  **CERRADA (2026-06-06):** state `loadError` en ambos componentes; carga extraída a fn `useCallback` que en el catch hace `setLoadError(true)` además de `setLoading(false)`. El render distingue 3 estados: cargando, error de carga (mensaje i18n `chat.loadError` + botón `chat.retry` que rellama la carga), y vacío real (placeholder existente `noConversations`/`messagePlaceholder`). 2 claves nuevas es/en, paridad 473=473. tsc 0, lint 0, vitest 639 passed.

  **Nota de re-etiquetado (2026-06-06):** el commit `9cc9b37` (2026-06-05) NO era este silent fail — era el doble render del mensaje optimista en `ConversationClient`. Ese trabajo es ahora **E72** (cerrada, ver DONE). E52 era y sigue siendo el silent fail de carga, cerrado hoy.

- [x] **E53. String hardcodeado sin i18n en ChatClient** — `${conversations.length} conversaciones` no pasa por `t()`. Fix: añadir clave `chat.conversationCount` (con plural forms) a `messages/es.json` y `messages/en.json` y usar `t('conversationCount', { count })`.

- [ ] **E54. Chat: cifrado de extremo a extremo (E2EE) — DECISIÓN DE ARQUITECTURA**

  Hoy los mensajes se guardan en texto plano en Supabase (`messages.content text not null`).
  E2EE implica cambios de calado que afectan al producto completo:

  **Impacto técnico:**
  - Cifrado en cliente: elegir protocolo/librería (Signal, libsodium, etc.).
  - Gestión de claves por usuario: derivación, almacenamiento local, pérdida de dispositivo,
    acceso multi-dispositivo, recuperación (sin clave no hay recuperación posible).
  - Rotura de funciones que leen el contenido del servidor:
    - Preview "Tú: …" en lista de conversaciones (lee `messages.content` server-side).
    - Políticas RLS sobre texto plano (dejan de proteger contenido, solo metadata).
    - Supabase Realtime sobre filas con texto cifrado (entrega ciega, sin semántica).
    - Búsqueda de mensajes (imposible sin índice server-side o arquitectura adicional).

  **Antes de cualquier implementación se requiere un bloque de diseño propio:**
  - Elección de protocolo y librería (con análisis de madurez, mantenimiento, tamaño bundle).
  - Decisión sobre qué se sacrifica del producto actual (preview, búsqueda, Realtime con semántica).
  - Modelo de recuperación de claves (o documentar que no existe).
  - Migración de mensajes existentes (imposible → asumir brecha, o borrar y empezar).

  **No atacar en caliente. Sin priorizar. No planificar hasta cerrar D (Legal mínimo)
  y tener usuarios reales que lo demanden.**

  Hecho cuando: existe `docs/decisions/e2ee-chat.md` con protocolo elegido, tabla de
  sacrificios de producto, modelo de claves, y plan de migración — antes de escribir
  una sola línea de código.

- [x] **E55. KButton: active:scale(0.98) no implementado** ✅ CERRADA en B3.5f-3 (nivel mínimo)

  DS §5 especificaba `active:scale(0.98)` en botones pero `KButton.tsx` no lo tenía. Añadido `active:scale-[0.98]` en variantes `primary` y `secondary`. 506/57 green.

- [ ] **E56. Faltan loading.tsx en rutas principales** — solo `/profile` tiene skeleton de carga.

  Rutas sin `loading.tsx`: home, discover, search, library, media/[type]/[id], friends, notifications, settings, chat, groups/[id], lists/[id]. Causa: Sprint B3.5f migró el DS pero no añadió loading skeletons.

  **Prioridad:** media. Sin loading.tsx, Next.js muestra página en blanco durante SSR. No es bug funcional pero degrada UX en conexiones lentas.

  Hecho cuando: las rutas principales tienen `loading.tsx` con skeleton coherente al DS (surface-default, animate-pulse).

  **Nota:** nivel medio de B3.5f-3. No tocar hasta confirmar con el usuario.

- [x] **E57. prefers-reduced-motion no implementado** ✅ CERRADA en B3.5f-3 (nivel mínimo)

  WCAG 2.1 §2.3.3. `globals.css` ahora neutraliza `transition-duration` y `animation-duration` a `0.01ms` globalmente bajo `@media (prefers-reduced-motion: reduce)`.

- [ ] **E58. RecommendModal + Toast: migrar tokens legacy al DS**

  `RecommendModal` usa `bg-surface`, `border-border`, `text-text`; `Toast` usa `bg-surface2`, `border-border`, `text-accent`. Mismo patrón legacy ya visto y migrado en Chat/Notif. Migrar a tokens canónicos del DESIGN_SYSTEM.md. Sin priorizar.

- [x] **E59. (CERRADA 2026-06-11) Rediseño del filtro Descubrir (FilterBar) — visual/UX**

  Rediseño completo entregado en sub-pasos R0→R6 (commit final R6 `d080690`):
  - R0–R3: nueva `FilterBar` v3.1 (trigger-pills + Popover Radix, kinds single/multi/searchable,
    icono lucide por filtro, variante sort "Ordenar: <valor>", tokens DS acento verde). Barra
    Descubrir 2 filas (TIPO/FILTROS) sticky. `TYPE_FILTERS` central como fuente de verdad de
    triggers visibles por tipo (política A: triggers sin dato en la API se ocultan).
  - R4: filtros nativos + post-filtros server-side (valoracion, temporadas, volumenes, modojuego,
    duracionmedia, estado game) en los builders de cada API.
  - R5: modo "all" (agregado de las 7 familias) con badge de tipo por card.
  - R6: i18n de labels (trigger + opciones + badge) vía namespace `discoverFilters`; value=slug
    canónico intacto en URL, solo el label se traduce (fallback `humanizeSlug`).

  Hecho: filtro rediseñado y validado en móvil+desktop (Playwright 16/16 es+en), 0 tokens legacy
  en `FilterBar`, labels i18n es/en con paridad. Deuda separada del acento rojo legacy en otros
  consumidores → **E82** (BACKLOG).

- [ ] **E60. Decisión de producto: scope de Discover/Books (idioma)**

  `src/lib/api/googlebooks.ts:56` aplica `langRestrict: "es"`, lo que reduce drásticamente
  `totalItems` y agrava el bug de paginación de books (totalPages inflados o erróneos cuando
  hay pocos resultados en español). Es una decisión de producto: ¿Discover de libros
  español-céntrico (consistente con i18n del proyecto) o global?

  Aplica también a otras APIs si tienen restricción regional similar.

  Sin priorizar. No tocar `langRestrict` hasta tomar la decisión.

- [x] **E61. (CERRADA 2026-06-01 — NO-VULN, mal diagnosticada)** ~~Seguridad: `DELETE /api/lists/[id]` bypassa RLS con service-role~~
  Fase 0 (chat actual) desmontó el diagnóstico de E47: el handler usa `createClient()` (anon + sesión, server.ts:15-17), NO service-role — no existe service-role en runtime (único uso: scripts/seed-test.mjs). La RLS de `list_items` DELETE (`list_items_delete_adder_or_owner`, migración L743-745) restringe a `added_by = auth.uid() OR owner` y SÍ se aplica al ir con sesión. Un colaborador que intenta borrar item de otro → 0 filas afectadas, sin escalada. `canEditList` es defensa-en-capa, no la única barrera. Residuo cosmético (no seguridad) → E71.

- [x] **E62. Patrón transversal: mutaciones optimistas sin verificar `res.ok`** (barrido `ListDetail` hecho — era el único archivo afectado según Fase 0)

  Casos confirmados: `ListDetail.tsx` `handleRemoveItem` (línea 37) y `handleInvite`
  (línea 53). Si el server responde 403 o 500, el cambio queda aplicado en la UI sin
  revertir. Mismo patrón sospechado en E51 (Sugerencias) y E52 (Chat), ya registrados.
  Acción sugerida: barrido del repo buscando `await fetch(` en client components sin
  chequeo posterior de `res.ok` en mutaciones (POST/PATCH/DELETE). Documentar lista de
  archivos afectados antes de fixear.

- [x] **E63. `ListsClient.tsx` descarta el setter de `useState`**

  Línea 16: `const [lists] = useState<List[]>(initialLists)`. Sin setter, la nueva lista
  creada via `CreateListModal` solo aparece tras full navigation. Fix: `const [lists,
  setLists] = useState(...)` y pasar `setLists` (o callback `onCreated`) a
  `CreateListModal` para actualizar el grid tras crear.

- [x] **E64. Seguridad/visual: RecommendModal usa colores hardcodeados (viola DS)**

  Descubierto en Fase 0 de E47. `RecommendModal` usa `text-green-400` y `text-red-400`
  hardcodeados en lugar de tokens DS (`accent-positive`, `accent-danger`). El componente
  nuevo `AddToListButton` creado en E47 NO replica este patrón — usa tokens y
  `useToastContext` correctamente. Esta E-task cubre la migración del `RecommendModal`
  existente.

  Toca: `src/components/social/RecommendModal.tsx`.

  Solapamiento parcial con E58 (RecommendModal + Toast). Considerar unificar al
  planificar.

- [x] **E65. Listas: UI para borrar una lista (endpoint ya existe)**

  Descubierto en verificación visual de E47. El endpoint `DELETE /api/lists` existe y
  funciona (solo owner). El usuario reporta que NO hay botón ni acción en `/lists` ni
  `/lists/[id]` para borrar una lista. Mismo patrón que tenía E47 antes de cerrarse:
  backend completo sin UI.

  Qué falta: botón en `ListCard` o en header de `ListDetail` (con confirmación) + claves
  i18n (`lists.delete`, `lists.deleteConfirm`, `lists.deleted`).

  Hecho cuando: desde `/lists` o `/lists/[id]`, el owner puede borrar su lista con
  confirmación y desaparece del grid.

- [x] **E66** — AiRecommendations: carátula + navegación a ficha ✅ (cerrada el 2026-05-31, fe15a2d)
    533/59 green. Comic resuelve carátula pero su ficha aún no existe → ver E66-COMIC-FICHA.
- [x] **E66-COMIC-FICHA** — Ficha de cómic vía ComicVine (detail)
    536 green. getComic + VALID_TYPES + page.tsx comic branch.
- [x] **E66-COMIC-OCCIDENTAL** — Discover cómic: filtrar publishers occidentales vía batch volumes ✅ (cerrada el 2026-05-31, 4e6e803)
    544 green. resolveVolumePublishers (batch /volumes/ + cache) + WESTERN_PUBLISHERS/isWesternPublisher + getRecentComics limit=100 filtra a occidentales.

- [x] **E67. Flaky test por test pollution en suite completa** ✅ (cerrada 2026-06-05, código `6d30a42`)
  Síntoma: fallos esporádicos en `vitest run` según el orden de ejecución (mocks compartidos entre archivos). Fuente: el bloque parser de `tests/unit/ai/ai-recommendations.test.ts` mezclaba `vi.mock('@/lib/claude/recommendations')` (mockeaba el módulo bajo test) con `vi.doMock`/`vi.doUnmock` del SDK y Supabase en el mismo archivo, dejando estado de mock contaminado según el orden. Fix (Opción 1): split del bloque parser a `tests/unit/ai/recommendations-parser.test.ts` SIN mock del módulo (carga el real), con fixtures anidadas `{ status, score, media }` reales que espera `getLibraryContext`, `searchByType` hoisted y `vi.resetModules()` en beforeEach (mismo patrón que `claude/recommendations.test.ts`). Asserts reescritos contra el resultado real del parser (no `undefined`).
  Verificado: `npm test` 639 passed; `--sequence.shuffle --sequence.seed 12345` 639 passed (antes 5 fail); `--sequence.seed 99999` 639 passed.

- [~] **E68. (OBSOLETA 2026-05-31) Tests de integración real para RPC `get_discoverable_groups`**
  Obsoletada por el hotfix de E45 (commit 2d11228): el descubrimiento ya no usa la RPC `get_discoverable_groups` sino queries directas (la RPC quedaba cacheada en el schema de PostgREST). Sin RPC en el flujo, no hay nada que cubrir con tests de integración. La RPC zombi se elimina en E70.
  ~~Hoy el RPC solo está cubierto por tests unitarios con el cliente Supabase mockeado (`tests/unit/social/discover-route.test.ts`). Faltan tests de integración contra DB real (kultura-test) que ejerciten los boundaries de `p_size`: 10/11 (small↔medium) y 50/51 (medium↔large), además de scope joined/unjoined y paginación limit/offset reales.~~

- [x] **E70. Drop RPC zombi `public.get_discoverable_groups(...)` en DB prod**
  Tras el hotfix de E45 (commit 2d11228) el descubrimiento de grupos usa queries directas en vez de la RPC (la RPC quedaba cacheada en el schema de PostgREST y devolvía resultados obsoletos). La función `public.get_discoverable_groups(text, text, text, integer, integer)` queda sin uso en el código. Eliminarla con `DROP FUNCTION` cuando se haga limpieza de DB, en una migración nueva (`supabase migration new drop_rpc_discover_groups`).
  Hecho cuando: `DROP FUNCTION IF EXISTS public.get_discoverable_groups(text, text, text, integer, integer);` aplicado en prod vía migración versionada, `NOTIFY pgrst, 'reload schema'`, y `\df public.get_discoverable_groups` en prod no devuelve filas.
  Cerrada 2026-05-31: migración `20260531201838_drop_rpc_discover_groups.sql` (drop versionado + reload schema). Migración vieja `20260531180450` queda como histórico DEPRECATED. Grep confirma 0 referencias a la RPC en `src/` (solo 2 comentarios mencionando el nombre). Drop en prod ejecutado manualmente.

- [x] **E71. (CERRADA 2026-06-01) `DELETE /api/lists/[id]` no verifica `count` tras borrar item**
  Fix: `.delete({ count: 'exact' })` + `if (count === 0)` → 404, mirror exacto del patrón de `/api/library` DELETE. El check `canEditList` (403) y la rama de borrar lista entera quedaron intactos. +5 tests en `tests/unit/social/lists-id-route.test.ts` (401/400/403/404/200). tsc 0, lint 0, **589 passed** (584→589).
  Toca: `src/app/api/lists/[id]/route.ts` DELETE handler.
  ~~Hallazgo Fase 0 E61. El handler hace `.delete().eq('id',itemId).eq('list_id',listId)` y devuelve `{ok:true}` sin comprobar filas afectadas. Si la RLS filtra (item de otro colaborador) borra 0 filas pero responde 200. Patrón correcto ya existe en `/api/library` (usa `count` → 404). Fix: añadir `{ count: 'exact' }` o verificar resultado y devolver 404 si 0 filas. No es seguridad (RLS ya protege), es feedback.~~

- [x] **E74. Grupos no aparecen en móvil (fuego funcional)**
  Síntoma en prod: el módulo de grupos de amigos no se muestra en viewport móvil (sí en desktop, presumiblemente). Posible problema responsive/layout o query/render condicionado por breakpoint, NO necesariamente el RLS de E45 (ya cerrado).
  Fase 0 obligatoria: reproducir en móvil y aislar si es CSS/responsive, datos, o render.
  Hecho cuando: grupos visibles y operativos en móvil.

- [ ] **E75. Botón cambio de idioma: mejora visual**
  Mejorar la presentación visual del selector de idioma (estética, no la lógica i18n, que ya funciona).
  Hecho cuando: botón alineado al DS, legible y con estado claro.

- [ ] **E76. Foto de perfil: mejora visual**
  Mejorar la visual de la foto de perfil (encuadre/recorte/placeholder/estados).
  Hecho cuando: avatar consistente con el DS en sus estados.

- [ ] **E77. Botón editar perfil: mejora visual**
  Mejorar la visual del botón de editar perfil.
  Hecho cuando: botón al DS, jerarquía/affordance claros.

- [ ] **E78. Iconos genéricos: sustituir por set característico**
  Los iconos actuales son demasiado genéricos; sustituir por un set más característico/coherente. Definir set en Fase 0.
  Hecho cuando: iconografía coherente aplicada en las vistas clave.

- [ ] **E79. Paginación: mejora (UX)** — _slice 1 hecho, slice 2 pendiente_
  Mejora de paginación, distinta de E3 (verify-queries) y E48d (notif-cursor). Alcance: Descubrir (overfetch + páginas cortas/vacías por post-filtros).
  - [x] **slice 1 — has-next** (2026-06-16): `DiscoverResult.hasMore` (campo aditivo) = `page < providerTotalPages` por familia; agregado `all` = `page*20 < merged.length`. `Pagination` gatea "next" por `!hasMore` (ya no por `totalPages`, que sigue inflado por los post-filtros) y muestra "page X" sin el "of Y" mentiroso. Elimina páginas cortas/vacías que deshabilitaban "next" antes de tiempo. tsc 0, lint 0, vitest 1157 passed.
  - [x] **slice 1b — paginación numerada (UI)** (2026-06-16): `Pagination` rediseñada de prev/next a ventana numerada con elipsis (« Anterior [1] … [c-1] [c] [c+1] … [N] Siguiente »). `totalPages` restaurado en `DiscoverClient` (estado + prop) para pintar N; el gate de "siguiente" SIGUE en `hasMore` (no en `totalPages`). Activo con `bg-accent` (var DS legacy) + `aria-current="page"`; i18n `paginationLabel`/`pageN` (es+en). a11y: nav role, aria-labels por botón. Tests reescritos (ventana+elipsis, activo, gates, click→onPageChange(n)).
  - [x] **slice 1c — cap totalPages al tope del proveedor (E89)** (2026-06-17): TMDB reporta `total_pages` enorme (hasta 57464) pero la API solo SIRVE 500 → la "última página" de la UI numerada devolvía 4xx → banner rojo falso. `TMDB_MAX_PAGES=500`: movie/tv/default capan `totalPages=min(total_pages,500)` y `hasMore` se gobierna contra el cap. Hardening: `page>500` (escrita a mano / salto) → vacío sin llamada API y SIN banner de error (`fetchErrorKind:null`), distinguiendo página fuera de rango de fallo de red real. Topes confirmados: book ya cap 50, comic `ceil(total/20)` real, Jikan `last_visible_page` ya es tope real, RAWG sin tope duro documentado → dejado; agregado `all` ya acotado por pool real (no inflado por TMDB). +6 tests E89. tsc 0, lint 0, vitest 1168 passed.
  - [ ] **slice 2 — cachear pool + profundizar + saltos arbitrarios** (pendiente): cachear el pool del agregado `all` (hoy re-fetcha page 1 de las 7 familias en cada página) y el overfetch de `comic` (pide 100, tira ~80); profundizar la paginación real más allá del pool ya traído (back-fill / cursor por familia para no truncar la profundidad navegable). **NUEVO (por slice 1b):** la UI numerada permite SALTOS arbitrarios (clic directo a página N lejana) → cubrir el caso "salto a página muy filtrada cae corta/vacía": con post-filtros agresivos, una página intermedia/alta puede devolver pocos o cero items aunque `hasMore` siga true → back-fill/cursor debe garantizar páginas llenas (o señalar el final real) en saltos no contiguos.
  Hecho cuando: paginación consistente y performante en Descubrir sin re-fetch redundante del pool.

- [ ] **E80. Ranking por estrellas (votación interna)**
  Sistema de valoración interna por estrellas y ranking derivado. Diseño pendiente en Fase 0: modelo de datos, RLS, dónde se vota/muestra.
  Hecho cuando: usuarios pueden votar y ver ranking.

- [ ] **E81. Mejora de autenticación (técnico)**
  Endurecer/mejorar el flujo de auth, distinto de E7 (OAuth), E8 (pwd-reset), E20 (Input). Alcance a concretar en Fase 0.
  Hecho cuando: a definir según alcance.

- [ ] **E82. Migrar acento legacy rojo `#E82020` → verde app-wide**
  F4 (E59) solo migró `FilterBar`. Queda el acento rojo legacy en 15+ consumidores: `button`, `Badge`, `Toast`, `Select`, `Spinner`, `StarRating`, `StatusSelector`, `MediaDetail`, `SynopsisSection`, `RecommendModal`, `SearchFilters`, `SearchResults`, `SearchBar`, `GroupFeed`, `JoinGroupButton`. Migrar todos a verde (`accent-positive` / tokens DS canónicos).
  Hecho cuando: 0 ocurrencias de `#E82020` (y aliases legacy `text-accent`/`bg-accent` rojos) en los consumidores listados, sin regresiones visuales.

- [x] **E83. (CERRADA 2026-06-07 — commit `edca570`)** Entrega de notificaciones rota a nivel global. `notifications` con RLS habilitado y sin policy INSERT → todo insert vía cliente anon era denegado (default-deny); los 3 tipos (`recommendation`, `list_invite`, `group_invite`) insertaban best-effort sin error-check → fallo mudo, la notif nunca llegaba. Fix: `src/lib/supabase/admin.ts` (`createAdminClient()` service-role, bypassa RLS) en los 3 inserts + `console.error` en fallo; operación principal no falla si la notif falla. `.env.test.local` += `SUPABASE_SERVICE_ROLE_KEY` (kultura-test, gitignored). tsc 0, lint 0, vitest 765 passed. Detalle en DONE.md.

- [x] **E88. (CERRADA 2026-07-07 — commit `e893c60`) Filtro de valoración (9+) no filtra**
  Diagnóstico: la lógica del filtro **es correcta**. La UI emite `paramKey: 'rating'` (`type-filters` VALORACION) y el backend lo mapea a `vote_average.gte` (TMDB movie/tv) / `min_score` (Jikan anime/manga) / post-filtro metacritic (game); el `sort` NO lo pisa. La repro usaba `valoracion=9` en la URL a mano — param inexistente para el backend (que solo leía `rating`), ignorado en silencio → salían títulos <9. Fix de robustez: `parseDiscoverParams` acepta `rating` **o** el alias `valoracion` (rating manda) para que una URL con el nombre natural ES no falle mudo; sin cambio para la UI. +5 tests de regresión (`tests/unit/discover/valoracion-filter.test.ts`). tsc 0, discover suite 128 passed.

- [x] **E90. (CERRADA 2026-06-19) Navegación móvil incompleta: faltan friends, lists, suggestions.** `BottomNav` (`md:hidden`) tenía 5 items (home·discover·chat·library·groups) sin `friends`; `NavLinks` desktop sí lo incluye. Listas duplicadas (no compartidas): friends omitido por entry ausente, no por slice/límite ni condicional de viewport. Fix: (1) `BottomNav` += `{key:'friends',href:'/friends',icon:Users2}` antes de groups (6 items finales), import `Users2` de lucide-react (groups mantiene `Users`), key i18n `nav.friends` reusada; (2) `AvatarDropdown` += `lists` y `suggestions` (Links arriba, antes de profile, con separador) reusando hrefs/keys de `NavLinks`. Test `BottomNav.test.tsx` actualizado (mock `Users2` + map `friends`, "6 items", nuevo test href `/friends`). tsc 0, lint 0, vitest 1169 passed. Detalle en DONE.md.
  **AMPLIADA 2026-06-19 (reparto A, sheet "Más"):** reorganizada la nav móvil sin desbordar (resuelve también E91). `BottomNav` reducido a 5 (home·discover·chat·library·**Más**); friends y groups SALEN de la barra. Nuevo `src/components/ui/MoreSheet.tsx` (bottom-sheet casero patrón ConfirmModal: overlay `bg-black/60`, panel `fixed bottom-0` slide-up, grabber, `role=dialog`/`aria-modal`, Esc + click-fuera cierran, foco al panel; deuda menor sin focus-trap completo, anotada) con 5 items i18n-aware: friends·groups·lists·suggestions·**search**. `BottomNav` ahora union type `href XOR onClick`; "Más" es `<button>` que abre el sheet (activo = `sheetOpen`, no pathname). `AvatarDropdown` REVERTIDO: quitados lists+suggestions+separador → vuelve a profile·settings·signOut. i18n `nav.more` (es "Más"/en "More"). Tests: `BottomNav.test.tsx` reescrito (5+Más, "Más" es button, sheet abre/cierra, accent activo), nuevo `MoreSheet.test.tsx` (8). tsc 0, lint 0, vitest **1180 passed** `--no-file-parallelism`. Detalle en DONE.md.

- [x] **E92. (CERRADA 2026-07-09) Grid Descubrir: mínimo 2 columnas en móvil.** El skeleton (línea 368) y el grid de resultados (`MediaGrid` className, línea 381) de `DiscoverClient.tsx` arrancaban en `grid-cols-1` en móvil (<640px) → 1 card por fila. Fix: `grid-cols-1 sm:grid-cols-2` → `grid-cols-2` en ambos; md/lg/xl sin cambio. `loading.tsx` no tocado (E56). tsc 0, lint 0, vitest 1193 passed. Detalle en DONE.md.

- [x] **E91. (RESUELTO 2026-06-19 vía E90-amp)** Search oculto en móvil. El acceso de búsqueda era `hidden md:flex` en `AuthHeader` → móvil sin buscador salvo URL manual. Resuelto al ampliar E90: `search` (`/search`, lupa) es ahora una entry del bottom-sheet "Más" de `BottomNav`. Móvil llega a `/search` sin teclear la URL. Sin desbordar la barra (search vive en el sheet, no en las 5 celdas). Detalle en DONE.md (E90-amp).
