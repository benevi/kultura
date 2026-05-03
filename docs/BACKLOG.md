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
  6 errores en `tests/` impiden `tsc --noEmit`: 3 tests de componentes Library inexistentes, 1 test de `@/lib/env` (módulo aún no creado, es B3), 2 mocks desactualizados en `queries.test.ts`.
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

- [ ] **B3. Validación de env vars al startup**
  `src/lib/env.ts` con Zod que valide todas las env vars requeridas. Importar en `app/layout.tsx`.
  Hecho cuando: arrancar sin `ANTHROPIC_API_KEY` falla con mensaje claro en startup, no en primera request.

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

- [ ] **E22. Página `/groups` con listado público de grupos**
  Hoy solo existe `/groups/[id]`. Sin listado, los grupos son invisibles para no-miembros (ver `ESTADO_PROYECTO.md` §18.3). Crear `src/app/[locale]/(app)/groups/page.tsx` con listado básico (paginado, filtro por nombre).
  Hecho cuando: la ruta `/[locale]/groups` renderiza grupos visibles y enlaza a `/groups/[id]`.

- [ ] **E23. Unificar policies duplicadas en `users`**
  Hay dos policies UPDATE casi-idénticas con el mismo predicate (`auth.uid() = id`): `users can update own profile` y `users_update_own`. Ruido en la capa de seguridad. Eliminar una de las dos creando una migración nueva (`supabase migration new dedupe_users_update_policies`). Prioridad baja, hacer antes de producción real.
  Hecho cuando: `pg_policies WHERE tablename='users' AND cmd='UPDATE'` devuelve exactamente 1 fila y hay commit con migración.

---

## BLOQUE F — Monetización (fase aparte)

Esto NO se hace hasta tener A–D cerrado y haber validado con usuarios reales que hay demanda. Si no, es premature optimization.

- [ ] F1. Definir modelo: freemium (biblioteca limitada) + premium (IA ilimitada).
- [ ] F2. Schema `subscriptions` + `usage_logs`.
- [ ] F3. Stripe integrado.
- [ ] F4. Middleware de plan en endpoints de IA.
- [ ] F5. Dashboard admin con métricas básicas.

---

## Reglas de uso

1. **Una tarea activa máximo.** Si estás trabajando en A2, no abres A3. Si surge algo de A3 que bloquea A2, lo anotas en el propio A2 pero no cambias de tarea.
2. **El criterio "hecho" es binario.** Si no puedes ejecutar un comando o señalar un resultado observable, la tarea no está bien definida — repártela.
3. **Lo que no está aquí, no existe.** Si Claude Code te sugiere "aprovecho y refactorizo X", la respuesta es no. Si realmente hace falta, va al backlog, no al sprint actual.
4. **Aprobación por bloque, no por tarea.** Apruebas el bloque A entero al empezarlo. Dentro del bloque, las tareas se encadenan sin pedir permiso por cada una. Solo se pide confirmación al cerrar bloque.
5. **Revisión del backlog: cada viernes.** 15 min. Reordenar si hace falta, añadir lo nuevo. No durante la semana.
