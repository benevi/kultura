# BACKLOG â€” KULTURA

> Una sola regla: **se trabaja de arriba a abajo. No se saltan tareas.**
> Si algo "parece mÃ¡s urgente", o es porque no entiendes la dependencia, o porque el orden estÃ¡ mal y hay que discutirlo (no saltÃ¡rselo).
>
> Cada tarea tiene criterio binario de "hecho". No hay "en progreso" global â€” eso vive en `NOW.md`.

---

## BLOQUE A â€” Parar el sangrado (1â€“2 dÃ­as reales)

Sin esto, todo lo demÃ¡s se hace con la casa ardiendo.

- [x] **A1. Rotar credenciales Supabase comprometidas** âœ… (cerrada el 2026-05-01)
  MigraciÃ³n a sistema nuevo de Supabase API keys (`sb_publishable_*` + `sb_secret_*`). Legacy JWT-based keys deshabilitadas en el dashboard. App funcionando en local con las nuevas en `.env.local`. Vars actualizadas tambiÃ©n en Vercel.

- [x] **A2. Verificar y reforzar `.gitignore` + ausencia de secretos en historial** âœ… (cerrada el 2026-05-01, verificaciÃ³n sin cambios)
  Confirmado que `.env.local` no estÃ¡ trackeado (`git ls-files .env.local` devuelve vacÃ­o). Falta: aÃ±adir `.claude/` a `.gitignore` (el directorio puede contener `settings.local.json` con info personal). Revisar si existe algÃºn otro archivo con secretos en el repo.
  Hecho cuando: `.gitignore` incluye `.claude/`, y un `git grep -i "sb_secret_\|eyJhbGc" -- ':(exclude).env*'` no devuelve nada.

- [x] **A3. Rotar el resto de claves API por higiene** âœ… (cerrada el 2026-05-01)
  Aunque `TMDB_API_KEY`, `RAWG_API_KEY`, `GOOGLE_BOOKS_KEY`, `COMICVINE_KEY` y `ANTHROPIC_API_KEY` no aparecÃ­an en texto plano en el `settings.json` viejo, el archivo era una colecciÃ³n de comandos de debug. Por higiene: rotar todas. Para cada una: regenerar en su dashboard, actualizar `.env.local` local, actualizar Vercel.
  Hecho cuando: las 5 claves tienen valores nuevos en local + Vercel y la app sigue arrancando.

- [x] **A4. Sincronizar nombres de variables entre local y Vercel** âœ… (cerrada el 2026-05-01, ya unificado)
  En Vercel las claves son `TMDB_API_KEY`, `RAWG_API_KEY`, `GOOGLE_BOOKS_KEY` (sin `NEXT_PUBLIC_`). En `.env.local` puede que sigan con el prefijo viejo. Decidir nombres canÃ³nicos (server-only, sin `NEXT_PUBLIC_`) y unificar.
  Hecho cuando: `.env.local` y Vercel usan exactamente los mismos nombres y la app funciona en ambos entornos.

- [x] **A5. Versionar el estado actual del proyecto (commits temÃ¡ticos + remoto GitHub)**âœ… (cerrada el 2026-05-02).
 13 commits temÃ¡ticos en 4 sesiones + reescritura de identidad + push a https://github.com/benevi/kultura (privado). Detalles en DONE.md. Working tree limpio, master en sync con origin.

- [ ] **A6. AuditorÃ­a de coherencia repo vs disco**
        Verificar que despuÃ©s de A5 no quedan archivos en disco que no estÃ©n
        trackeados (salvo los explÃ­citamente ignorados por .gitignore). Si
        hay huÃ©rfanos, decidir uno por uno: stagear, ignorar, o borrar.
        Hecho cuando: `git status --short` solo lista archivos con cambios
        legÃ­timos, sin "??" inesperados.

---

## BLOQUE B â€” Base reproducible (2â€“3 dÃ­as)

Sin esto, cada cambio posterior es ruleta rusa.

- [x] **B1-A. Limpiar tests rotos huÃ©rfanos**âœ… (cerrada el 2026-05-01)
  6 errores en `tests/` impiden `tsc --noEmit`: 3 tests de componentes Library inexistentes, 1 test de `@/lib/env` (mÃ³dulo aÃºn no creado, es E24), 2 mocks desactualizados en `queries.test.ts`.
  Hecho cuando: `tsc --noEmit` exit 0, `vitest run` exit 0, hay commit `[B1-A] Limpiar tests rotos`.

- [x] **B1-B. CI bÃ¡sico en GitHub Actions** âœ… (cerrada el 2026-05-02)
  El B1 original. Workflow con typecheck + tests unit + build.
  Depende de: B1-A.
   
- [x] **B1-C. Arreglar 4 tests fallando en register-form.test.tsx** âœ… (cerrada el 2026-05-02, absorbida por B1-B)
  mockRouterPush nunca se llama. Investigar: Â¿mock router 
  mal? Â¿signUp mock falta? Â¿flujo del componente cambiÃ³?
  Hecho cuando: vitest run pasa los 4 tests de register-form.
  
- [x] **B2. Migraciones SQL versionadas** âœ… (cerrada el 2026-05-03)
  Baseline SQL recuperada vÃ­a `supabase db pull --schema public` tras reparar entrada huÃ©rfana de migraciÃ³n `20260502155455` (`supabase migration repair --status reverted`). Archivo: `supabase/migrations/20260502233945_remote_schema.sql` (~32 KB, 17 tablas, 49 RLS policies, 4 funciones trigger). Verificada contra `db_snapshot.txt` sin discrepancias. Sintaxis SQL validada con postgres puro (Plan B) â€” `supabase db reset` local quedÃ³ pendiente por degradaciÃ³n de Docker Desktop (ver B2-VERIFY).

- [x] **B2-DOC. DocumentaciÃ³n de la baseline** âœ… (cerrada el 2026-05-03)
  Cubierta por `supabase/migrations/README.md` (cÃ³mo aplicar, polÃ­tica de migraciones futuras, advertencia sobre `db push` sobre la baseline) + tipos TypeScript completos en `src/types/supabase.ts` (interfaces `DbSuggestion`, `DbConversation`, `DbConversationMember`, `DbMessage`, `DbGroup`, `DbGroupMember`, `DbGroupPost` aÃ±adidas). NOTA: la actualizaciÃ³n de los marcadores `[POR VERIFICAR EN B2]` en CLAUDE.md queda separada en B2-DOC-CLAUDE por discrepancia detectada en `group_members.role` (ver B2-DOC-CLAUDE).

- [x] **B2-DOC-CLAUDE. Actualizar CLAUDE.md con SQL canÃ³nico de las 7 tablas** âœ… (cerrada el 2026-05-03)
  CLAUDE.md actualizado en commit B2: marcadores `[POR VERIFICAR EN B2]` eliminados, `group_members.role` corregido a `'owner' | 'member'` (no existÃ­a `admin`), `users.bio` documentada, SQL de las 7 tablas confirmado contra `db_snapshot.txt`.

- [ ] **B2-VERIFY. Verificar `supabase db reset` en local**
  Ejecutar `supabase db reset` en entorno local y confirmar que el schema resultante es idÃ©ntico al de producciÃ³n. Reintentar cuando Docker Desktop estÃ© operativo. Bloqueo no afecta progreso del proyecto: SQL validado contra postgres puro sin errores reales, y schema vivo en remoto desde abril sin incidencias. Ejecutar `supabase start && supabase db reset` cuando Docker estÃ© restaurado y verificar conteos: 17 tablas / ~49 policies / 4 funciones trigger.
  **Intento del 2026-05-03 bloqueado** por degradaciÃ³n de Docker Desktop (`input/output error` en blob storage de containerd, persistente tras restart).
  Hecho cuando: `supabase db reset` sale con exit 0 y un diff contra producciÃ³n devuelve vacÃ­o.
  Depende de: B2 (âœ…).

- [x] **B4. Auditar y eliminar `kultura-backup-2026-05-01.zip`** âœ… (cerrada el 2026-05-03)
  Zip auditado en B3: 280.4 MB, 30876 archivos, incluÃ­a `kultura\.env.local` con credenciales reales y vigentes (idÃ©nticas al `.env.local` actual). Tras 6 verificaciones por el usuario (no OneDrive, no Google Drive, no compartido, no segunda mÃ¡quina, no backup automÃ¡tico en la nube), confirmado que el zip nunca saliÃ³ de la mÃ¡quina. DecisiÃ³n: NO rotar claves. Zip borrado por el usuario, carpeta temporal de auditorÃ­a eliminada.

---

## BLOQUE C â€” Que producciÃ³n no sea una caja negra (3â€“4 dÃ­as)

Sin esto, cuando algo falle en prod no te vas a enterar.

- [ ] **C1. Sentry integrado**
  `@sentry/nextjs` con DSN en env vars. Capturar errores de Route Handlers y componentes cliente.
  Hecho cuando: un `throw new Error("test")` en una ruta aparece en el dashboard de Sentry en <1 min.

- [ ] **C2. Logger estructurado reemplaza `console.error`**
  `src/lib/logger.ts` con pino o similar. Reemplazar las 15 instancias de `console.error` documentadas en el audit.
  Hecho cuando: `grep -rn "console\." src/ --include="*.ts" --include="*.tsx"` devuelve 0 o solo casos justificados.

- [ ] **C3. Rate limiting â†’ Vercel KV**
  Reemplazar el `Map` en memoria por `@vercel/kv`. Sliding window igual que ahora, pero distribuido.
  Hecho cuando: dos requests paralelos desde dos instancias diferentes de Vercel respetan el mismo contador.

- [x] **C4. Rate-limit en endpoints sin proteger** âœ… (cerrada el 2026-05-03)
  Aplicado `checkRateLimit` en 6 endpoints: `POST /api/chat` (10/h), `POST /api/chat/[id]` (10/min), `GET /api/chat/[id]` (60/min), `POST /api/groups` (5/h), `POST /api/suggestions` (3/h), `GET /api/users/search` (30/min). Sistema in-memory existente extendido con 6 nuevos presets en `LIMITS`. Tests: 6 nuevos en `tests/unit/rate-limit/rate-limit.test.ts` (18 total, 18 green). Todos devuelven 429 + `Retry-After`.

- [ ] **C5. Activar CSP en modo enforce mejorado**
  El CSP actual tiene `'unsafe-inline'` en script-src. Eliminar requires nonces (ver C7). Tras C7, pasar CSP a modo enforce sin `'unsafe-inline'` y verificar en producciÃ³n que no hay regresiones.
  Depende de: C7.
  Hecho cuando: `Content-Security-Policy` en producciÃ³n no contiene `'unsafe-inline'` y el sitio funciona.

- [ ] **C6. Auditar dominios externos en CSP y limpiar allowlist**
  El `img-src https:` actual permite cualquier dominio HTTPS para imÃ¡genes. Cuando se tenga trÃ¡fico real, revisar los logs/reports de CSP para confirmar quÃ© dominios realmente se usan y reemplazar `https:` por una allowlist explÃ­cita. Prioridad baja.
  Hecho cuando: `img-src` no contiene `https:` genÃ©rico, sino dominios especÃ­ficos verificados.

- [ ] **C7. Eliminar `'unsafe-inline'` de CSP script-src usando nonces**
  Next.js 14 permite nonces en CSP via middleware. Requiere generar un nonce por request en `middleware.ts` y pasarlo tanto al header CSP como al `<script>` de `_document`. Prioridad media, hacer antes de B6 (monetizaciÃ³n).
  Hecho cuando: `Content-Security-Policy` no contiene `'unsafe-inline'` en `script-src`, `npm run build` pasa, y la app funciona sin errores de CSP en consola.

- [ ] **C8. Verificar periÃ³dicamente que Vercel sigue aÃ±adiendo HSTS**
  Vercel aÃ±ade automÃ¡ticamente `Strict-Transport-Security: max-age=63072000` (confirmado 2026-05-03). Si cambia el plan de Vercel, se migra de proveedor, o Vercel modifica su polÃ­tica, HSTS podrÃ­a desaparecer. Chequear tras cualquier cambio de plan y como mÃ­nimo una vez al aÃ±o.
  Hecho cuando: verificaciÃ³n manual en DevTools confirma presencia del header. Si desaparece, reactivar en `next.config.mjs` con `max-age=63072000; includeSubDomains; preload`.

---

## BLOQUE D â€” Legal mÃ­nimo (2 dÃ­as)

Bloqueante si tienes o quieres usuarios EU.

- [ ] **D1. PolÃ­tica de privacidad + TÃ©rminos**
  PÃ¡ginas estÃ¡ticas en `/[locale]/privacy` y `/[locale]/terms`. Enlazadas desde footer.
  Hecho cuando: ambas pÃ¡ginas existen en es y en, y el footer las enlaza.

- [ ] **D2. Endpoint de eliminaciÃ³n de cuenta**
  `DELETE /api/account` que borre al usuario actual. Cascades en DB ya existen (verificar).
  Hecho cuando: un usuario puede eliminar su cuenta desde settings y desaparece de todas las tablas.

- [ ] **D3. ExportaciÃ³n de datos bÃ¡sica**
  `GET /api/account/export` que devuelva JSON con toda la data del usuario.
  Hecho cuando: el endpoint responde con library + lists + friendships del usuario autenticado.

---

## BLOQUE E â€” Mejoras de calidad (opcional para MVP)

No bloqueantes. Atacar solo despuÃ©s de Aâ€“D.

- [ ] **E1.** `generateMetadata()` en pÃ¡ginas de contenido â€” `/media/[type]/[id]`, `/profile/[username]`, `/lists/[id]`.
- [ ] **E2.** Error Boundaries en secciones principales.
- [ ] **E3.** PaginaciÃ³n verificada en todas las queries de listado.
- [ ] **E4.** Tests de componentes React con `@testing-library/react`.
- [ ] **E5.** E2E ampliado â€” library add, recomendaciÃ³n user-to-user, crear lista.
- [ ] **E6.** ComicVine implementado â€” `/api/comics/route.ts` + `lib/api/comicvine.ts`.
- [ ] **E7.** OAuth Google vÃ­a Supabase Auth.
- [ ] **E8.** RecuperaciÃ³n de contraseÃ±a personalizada.
- [ ] **E9.** Form fields con id/name (warning visto en consola â€” accesibilidad).
- [ ] **E10. Evaluar 3 APIs alternativas de libros**
  MotivaciÃ³n: Google Books + Open Library devuelven pocos resultados o de baja calidad para tÃ­tulos en espaÃ±ol que no son bestsellers. Probar Hardcover (GraphQL, gratuito con cuenta), ISBNdb (REST, free tier 1 req/s), y Open Library standalone (gratis, sin key) con un set fijo de 10 queries reales que actualmente fallan o dan resultados pobres. Comparar: cobertura de resultados, calidad de metadatos en espaÃ±ol, calidad de portadas, lÃ­mites de rate.
  Hecho cuando: existe `docs/decisions/books-api.md` con (a) las 10 queries de prueba, (b) tabla comparativa, (c) decisiÃ³n razonada, (d) API elegida.

- [ ] **E11. Migrar `lib/api/googlebooks.ts` â†’ API decidida en E10**
  Implementar el adapter nuevo con la misma firma que `lib/api/googlebooks.ts` actual. El `normalizer` no deberÃ­a cambiar (todo termina en `MediaItem`). Mantener Open Library como fallback solo si la nueva API tiene huecos detectados en E10. Actualizar tests de contrato.
  Hecho cuando: bÃºsqueda de libros y detalle funcionan con la nueva API, las 10 queries de E10 dan mejores resultados que antes, y los tests de contrato pasan en verde.
  Depende de: E10.

- [ ] **E12. Activar `forceConsistentCasingInFileNames` en tsconfig.json**
  Previene la clase de bug detectada en B1-B (`Button.tsx` vs import `button`). Windows oculta colisiones case-only que Linux CI sÃ­ ve. Con esta flag, `tsc --noEmit` las caza en local.
  Hecho cuando: `tsconfig.json` tiene `"forceConsistentCasingInFileNames": true` en `compilerOptions`, `npm run type-check` pasa en verde, hay commit `[E12] ...`.

- [ ] **E13. AuditorÃ­a de colisiones case-only en el repo entero**
  Limpieza de pasado (E12 previene futuro). Ejecutar `git ls-files | sort -f | uniq -di` y resolver cualquier colisiÃ³n que aparezca. Si no hay ninguna, cerrar la tarea con el output vacÃ­o como prueba.
  Hecho cuando: `git ls-files | sort -f | uniq -di` devuelve vacÃ­o, hay commit `[E13] ...` (aunque sea solo de cierre documental si no habÃ­a colisiones reales).
  Depende de: E12 (orden lÃ³gico, no tÃ©cnico â€” E12 evita que reaparezcan tras limpiar).

- [ ] **E14. Reportar bug a Supabase CLI: `db dump --dry-run` imprime credenciales en stdout**
  Durante B2 se detectÃ³ que `supabase db dump --dry-run` (o variante similar) imprime la cadena de conexiÃ³n incluyendo la service role key en stdout. Esto es un bug de seguridad en la CLI de Supabase. Redactar y enviar un issue al repo `supabase/cli` con reproducciÃ³n mÃ­nima y output censurado.
  Hecho cuando: issue abierto en github.com/supabase/cli con enlace documentado aquÃ­.

- [ ] **E15. Eliminar cÃ³digo muerto**
  - `src/lib/api/openlibrary.ts` â€” no usado por `searchAll` (Open Library figura como fallback documentado pero el adapter actual no se invoca desde el flujo de bÃºsqueda; verificar antes de borrar).
  - `src/components/lists/` â€” carpeta vacÃ­a; los componentes reales viven en `src/components/social/`.
  - `tests/_pending/` â€” si tras B3 sigue sin desbloquearse, mover a `_archive` o borrar.
  Hecho cuando: las 3 rutas no existen o se documenta por quÃ© se conservan.

- [ ] **E16. Deduplicar tipo `EpisodeProgress`**
  Definido dos veces con la misma forma: `src/types/library.ts:17-20` y `src/types/user.ts:35-38`. Dejar una Ãºnica definiciÃ³n y reexportar desde el otro mÃ³dulo si hace falta para no romper imports.
  Hecho cuando: `grep -rn "EpisodeProgress" src/types/` muestra una sola declaraciÃ³n y `npm run type-check` pasa.

- [x] **E17. Tipar las 7 tablas faltantes en `src/types/supabase.ts`** âœ… (cerrada el 2026-05-03)
  AÃ±adidas interfaces `DbSuggestion`, `DbConversation`, `DbConversationMember`, `DbMessage`, `DbGroup`, `DbGroupMember`, `DbGroupPost` derivadas del SQL canÃ³nico (`supabase/migrations/20260502233945_remote_schema.sql`) + entradas correspondientes en el mapa `Database`. `npm run type-check` pasa. Refactor de los `as unknown as Array<{...}>` ad-hoc â†’ E19.

- [ ] **E18. Reemplazar `console.error` por logger estructurado**
  17 instancias listadas en `ESTADO_PROYECTO.md` Â§15.8. Cross-link con C2 (logger estructurado): esta tarea es la migraciÃ³n mecÃ¡nica de los call-sites una vez C2 introduce `src/lib/logger.ts`.
  Depende de: C2.
  Hecho cuando: `grep -rn "console\." src/ --include="*.ts" --include="*.tsx"` devuelve 0 o solo casos justificados, y `npm run lint` pasa.

- [ ] **E19. Eliminar casts `as unknown as Array<{...}>` repetidos**
  Una vez E17 introduce los tipos completos, los casts de `groups/route.ts`, `chat/route.ts`, etc. dejan de hacer falta. Limpiar y dejar tipado idiomÃ¡tico Supabase.
  Depende de: E17.
  Hecho cuando: `grep -rn "as unknown as" src/` devuelve 0 (o solo casos justificados con comentario).

- [ ] **E20. Migrar inputs de `LoginPage.tsx` a componente `<Input>`**
  Coherencia con el resto del proyecto: `src/app/[locale]/login/LoginPage.tsx:303-372` usa `<input>` raw en lugar del componente `<Input>` de `src/components/ui/`.
  Hecho cuando: el archivo no contiene `<input` y la pantalla de login sigue funcionando (manual + e2e auth.spec).

- [ ] **E21. Endpoint `DELETE /api/groups/[id]` y endpoint para `group_posts`**
  Actualmente: no hay endpoint para eliminar grupos (solo crear/listar/join/leave) y los posts de grupo se insertan cliente-direct vÃ­a RLS. Crear `DELETE /api/groups/[id]` (solo `owner`) y `POST /api/groups/[id]/posts` (solo miembros). Aplicar rate-limit de C4 cuando se haga.
  Hecho cuando: ambos endpoints existen, validan rol/membership server-side, y hay tests de integraciÃ³n mÃ­nimos.

- [x] **E22. (CERRADA 2026-05-31, absorbida por E45-b)** **PÃ¡gina `/groups` con listado pÃºblico de grupos**
  Hoy solo existe `/groups/[id]`. Sin listado, los grupos son invisibles para no-miembros (ver `ESTADO_PROYECTO.md` Â§18.3). Crear `src/app/[locale]/(app)/groups/page.tsx` con listado bÃ¡sico (paginado, filtro por nombre).
  Hecho cuando: la ruta `/[locale]/groups` renderiza grupos visibles y enlaza a `/groups/[id]`.

- [ ] **E23. Unificar policies duplicadas en `users`**
  Hay dos policies UPDATE casi-idÃ©nticas con el mismo predicate (`auth.uid() = id`): `users can update own profile` y `users_update_own`. Ruido en la capa de seguridad. Eliminar una de las dos creando una migraciÃ³n nueva (`supabase migration new dedupe_users_update_policies`). Prioridad baja, hacer antes de producciÃ³n real.
  Hecho cuando: `pg_policies WHERE tablename='users' AND cmd='UPDATE'` devuelve exactamente 1 fila y hay commit con migraciÃ³n.

- [ ] **E24. ValidaciÃ³n de env vars al startup**
  `src/lib/env.ts` con Zod que valide todas las env vars requeridas. Importar en `app/layout.tsx`.
  Hecho cuando: arrancar sin `ANTHROPIC_API_KEY` falla con mensaje claro en startup, no en primera request.

- [x] **E25. Refactorizar specs E2E de `discover-pagination`** âœ… (cerrada el 2026-05-14, B3.5h-AUDIT-E2E-4)
  AÃ±adido `login()` en `beforeEach` de `tests/e2e/b3_5e_safety_net/discover-pagination.spec.ts`. Los 4 tests (anime, manga, paginaciÃ³n, movie-control) pasaron de ROJO-POR-REDIRECT a evaluables. Resultado: todos verdes con API real de Jikan/TMDB. 8 corridas (chromium + mobile) â†’ verde. Comentario errÃ³neo ("NO requiere credenciales") corregido en el spec.

- [x] **E26. Reforzar selector del picker en `chat-send.spec.ts`** âœ… (cerrada el 2026-05-13, commit 17290c6)
  `data-testid="friend-picker-item"` aÃ±adido a `ChatClient.tsx`. Selector en `chat-send.spec.ts` reemplazado por `getByTestId('friend-picker-item').first()`. Chat-send pasÃ³ de failedâ†’passed en E2E run.

- [ ] **E27. Auditar policies RLS por recursiÃ³n potencial**
  Durante B3.5c-3 se destaparon 3 capas de RLS rotas en `conversation_members` que emergieron secuencialmente al arreglar la anterior. PatrÃ³n a buscar: policies con `WITH CHECK` o `qual` que consulten la propia tabla. Tablas a revisar: `messages`, `group_members`, `group_posts`, `friendships`, `list_members`, `list_items`. Esta tarea es el contenido del bloque B3.5g-AUDIT-RLS y se ejecutarÃ¡ como sprint completo (no como E-task suelta).
  Hecho cuando: cada policy de las 17 tablas estÃ¡ clasificada (segura / recursiva / dudosa) y las recursivas han sido refactorizadas con SECURITY DEFINER functions o reescritas para evitar self-reference.
  Depende de: nada. Promovido a bloque B3.5g.

- [ ] **E28. Reforzar red de seguridad E2E con sesiÃ³n real (no service_role)**
  El seed actual (`scripts/seed-test.mjs`) usa service_role y bypassa RLS. Por eso B3.5c-3 tuvo bugs de RLS verdes en tests pero rojos en uso real. Pensar en seedar parte vÃ­a API con login real, o aÃ±adir un nivel de tests E2E que ejerciten flujos crÃ­ticos con sesiÃ³n auth vÃ¡lida (no service_role).
  Hecho cuando: existe al menos un spec E2E que ejecuta INSERT/UPDATE/DELETE como usuario autenticado real y verifica que las RLS no bloquean falsamente operaciones legÃ­timas (regresiÃ³n de bug 1).

- [x] **E29. Defensa null-safety en `discover/page.tsx`** âœ… (cerrada 2026-05-27, commits 389d99f+445dcc3+93db7c5+fe4f3f1)
  Causa real: Jikan 429 tragado por catch genÃ©rico + posible data: null sin guard. Fix: JikanError(.status), guard Array.isArray en anime/manga, guard totalItems books, catch distingue 429â†’"rate-limit" / restoâ†’"generic", banner muestra mensaje especÃ­fico. fetchDiscoverData extraÃ­da a lib/api/discover.ts (testeable). 521/58 green.

- [ ] **E30. CSP en development debe permitir `'unsafe-eval'`**
  El CSP actual es el mismo en dev y prod, y rompe HMR de React Refresh en development (requiere `unsafe-eval`). PatrÃ³n a aplicar en `next.config.mjs`:
```js
  const isDev = process.env.NODE_ENV !== 'production';
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";  // pendiente quitar 'unsafe-inline' en C7
```
  Hecho cuando: `npm run dev` no muestra warnings de CSP por `unsafe-eval`, y `npm run build` + producciÃ³n mantienen el CSP estricto sin `unsafe-eval`.

- [ ] **E31. Documentar workaround swap `.env.local` en `docs/B3_5e_TEST_ENV.md`**
  La verificaciÃ³n manual contra kultura-test se hace vÃ­a swap del archivo `.env.local` (NO con `NODE_ENV=test` + `npm run dev`, que rompe HMR por CSP). Documentar el procedimiento exacto: backup â†’ reemplazar URLs/keys â†’ `npm run dev` normal â†’ restaurar al terminar. Tras cerrar E30 este workaround puede simplificarse a un `npm run dev:test` limpio.
  Hecho cuando: `docs/B3_5e_TEST_ENV.md` contiene la secciÃ³n "VerificaciÃ³n manual contra kultura-test" con comandos PowerShell paso a paso y la nota sobre simplificaciÃ³n post-E30.

- [x] **E32. Bug `findOrCreateUser` no idempotente para password** âœ… (cerrada el 2026-05-11, hash 0bc9b4c)
  `scripts/seed-test.mjs` decÃ­a ser idempotente pero no actualizaba la password si el usuario ya existÃ­a â€” solo retornaba el `id`. Si la pass cambiaba en `.env.local`, el seed no la reconciliaba. Fix: `findOrCreateUser` ahora llama `auth.admin.updateUserById` con la password de `.env.local` cuando el usuario existe.

- [ ] **E33. Documentar convenciÃ³n de comillas en `.env*` para credenciales con caracteres especiales**
  Node con `--env-file` (Node 20+) trata `#` como inicio de comentario y trunca silenciosamente. Bug visto en sesiÃ³n 5: password `SeS1*WiZY7JES^HETQi%e#rf` (24 chars) se leÃ­a como `SeS1*WiZY7JES^HETQi%e` (21 chars). SoluciÃ³n: envolver SIEMPRE entre comillas dobles cualquier credencial generada que pueda contener `#`, `$`, espacios u otros caracteres conflictivos. Documentar en `docs/B3_5e_TEST_ENV.md` y/o en `CLAUDE.md` secciÃ³n env vars.
  Hecho cuando: la convenciÃ³n estÃ¡ documentada en al menos uno de esos dos archivos, con ejemplo del bug y la forma correcta.

- [ ] **E34. Documentar polÃ­tica de acceso a `reports`**
  La tabla tiene RLS habilitado con solo INSERT policy; SELECT/UPDATE/DELETE solo accesibles via `service_role`. Decidir si: (a) se mantiene asÃ­ con documentaciÃ³n explÃ­cita en un comentario SQL, (b) se aÃ±ade una policy SELECT restringida (ej. solo el reporter ve sus propios reports), o (c) se construye un panel de admin que use service_role. Hallazgo de B3.5g-AUDIT-RLS-1 (secciÃ³n 6).
  Hecho cuando: existe documentaciÃ³n explÃ­cita de la decisiÃ³n (comentario SQL en la migration o entrada en `docs/`) o se ha aÃ±adido la policy SELECT decidida.

- [ ] **E35. Normalizar `roles={public}` â†’ `{authenticated}` en ~30 policies**
  Las policies funcionan correctamente porque los predicados `auth.uid() = ...` filtran a anon, pero el alcance declarado es subÃ³ptimo y ensucia auditorÃ­as futuras. Cambio cosmÃ©tico, sin riesgo funcional. Aplicar via migration Ãºnica que regenere las ~30 policies con `TO authenticated` explÃ­cito. Hallazgo de B3.5g-AUDIT-RLS-1 (secciÃ³n 6).
  Hecho cuando: `SELECT count(*) FROM pg_policies WHERE schemaname='public' AND roles='{public}'` devuelve 0 (o solo las policies donde `public` es realmente intencional).

- [ ] **E36. RediseÃ±o defensivo de `conversations` INSERT**
  El endurecimiento aplicado en B3.5g-AUDIT-RLS-2 (Tarea 2) es defensa bÃ¡sica (`auth.uid() IS NOT NULL`). Una policy mÃ¡s estricta requiere: (a) aÃ±adir columna `created_by` a `conversations`, (b) trigger `AFTER INSERT` que aÃ±ada al creador a `conversation_members`, (c) policy `WITH CHECK (created_by = auth.uid())`. PatrÃ³n paralelo a `handle_new_group`. Prioridad baja porque el Route Handler ya valida el flujo.
  Hecho cuando: `conversations` tiene columna `created_by`, trigger correspondiente, y policy `WITH CHECK (created_by = auth.uid())`. Tests E2E de chat siguen en verde.

- [x] **E37** â€” Puerto hardcodeado en `tests/e2e/auth.spec.ts`. `localhost:3001` hardcodeado
  mientras `playwright.config.ts` configura `baseURL: http://localhost:3000`. Corregido en
  B3.5g-AUDIT-RLS-2-E2E sustituyendo `const BASE = "http://localhost:3001"` por `const BASE = ""`,
  usando el `baseURL` de Playwright. âœ… Cerrada en este bloque. Auditar otros specs en busca del
  mismo patrÃ³n (`grep -r "localhost:" tests/e2e/`).

- [ ] **E38** â€” Playwright deberÃ­a cargar `.env.test.local` automÃ¡ticamente. El workaround
  actual (merge manual en `playwright.config.ts` `webServer.env`) funciona pero es frÃ¡gil â€”
  si el archivo no existe, Playwright corre contra producciÃ³n sin advertir. SoluciÃ³n de raÃ­z:
  `globalSetup` que valide presencia de `.env.test.local` antes de arrancar, o `dotenv-cli`
  en el script `test:e2e` de `package.json`. Prioridad media â€” el flujo actual funciona.

- [x] **E39** âœ… (cerrada el 2026-05-13, commit 54d183f) â€” `reuseExistingServer: !process.env.CI` â†’ `false`. Puerto cambiado a `:3001` (webServer + baseURL + _helpers.ts `BASE`). Dev en `:3000` y Playwright en `:3001` sin conflicto.

- [x] **E40** âœ… CERRADA en B3.5h-AUDIT-E2E-5 (2026-05-14). Fix: desactivar "Confirm email" en Dashboard de kultura-test (Authentication â†’ Sign In / Providers â†’ Email). signUp ahora auto-confirma â†’ `data.session` no-nulo â†’ redirect a `/home`. 34/34 verdes (chromium + mobile). El spec no necesitÃ³ cambios â€” la lÃ³gica dual ya cubrÃ­a ambas ramas. Ver `docs/TEST_EXCEPTIONS.md` y `docs/SUPABASE_TEST_SETUP.md`.

- [x] **E41** â€” BLOQUEADO-DOCUMENTADO (commit 7107cab, 2026-05-13). `page.route()` solo intercepta requests del browser; las llamadas a Jikan/TMDB son server-side en RSC, invisibles para Playwright. Mock requerirÃ­a mover fetches a Route Handlers. Documentado en header del spec. AÃ±adir E41-redesign como tarea futura separada.

- [x] **E42** âœ… (cerrada el 2026-05-13, commit 22c2ee3) â€” `const BASE = ""` eliminada y usos `${BASE}/...` â†’ `/...` en `auth.spec.ts`.

- [x] **E43** âœ… (cerrada el 2026-05-13, commit 51ddcc0) â€” 5 ocurrencias OR+.first() eliminadas: chat-send L24 (quitado .first()), L37 (ORâ†’input[type=text] directo), L41 (ORâ†’getByRole single), discover-pagination L75 (ORâ†’getByTestId pagination-next; data-testid aÃ±adido a Pagination.tsx), language-switch L31-33 (ORâ†’aria-label selector directo).

- [ ] **E44** â€” Vercel auto-promote desactivado: producciÃ³n requiere promociÃ³n
  manual. Detectado en sesiÃ³n 8 al verificar deploy post-handover_7.
  Investigar si es setting de proyecto (toggle) o polÃ­tica del plan Hobby.
  Refuerza importancia de regla 11 (verificar Current, no solo Ready).

- [~] **E45. Grupos: flujo de descubrimiento + RLS de join + visibilidad/invitaciones**

  **Estado (2026-05-31):** E45-a CERRADA (RLS self-join + feedback UI; commit 37e38a6). E45-b CERRADA (descubrimiento + pagina /groups con tabs + DiscoverGroupsClient + GroupCard + refactor FriendsClient + nav; commits 2ef43f7, a96f8a2, da4a902, 1251994; engloba y cierra E22). E45-c (visibilidad is_public) y E45-d (invitaciones) siguen abiertas.

  **Flujo roto detectado (diagnÃ³stico GRUPOS-DIAG, 2026-05-23):** El mÃ³dulo de grupos
  existe estructuralmente (tablas, endpoint, UI de detalle) pero es inaccesible como
  producto: no hay forma de encontrar grupos, y el mecanismo de uniÃ³n estÃ¡ ademÃ¡s bloqueado
  a nivel de RLS.

  **QuÃ© existe hoy:**
  - Tablas: `groups` (id, owner_id, name, description, cover_color) y `group_members`
    (group_id, user_id, role âˆˆ {owner, member}, joined_at). Sin columna de visibilidad
    (`is_public`, `privacy`, etc.) ni tabla de invitaciones.
  - Rutas UI: solo `src/app/[locale]/(app)/groups/[id]/page.tsx` (detalle). No existe
    `groups/page.tsx` (listado/bÃºsqueda). Registrado parcialmente en E22.
  - CreaciÃ³n: formulario inline en `FriendsClient.tsx` (pantalla Amigos), llama a
    `POST /api/groups`.
  - Endpoint join/leave: `POST /api/groups/[id]/join` â€” lÃ³gica correcta (toggle member
    â†” leave, bloquea owner-leave), pero usa `createClient()` autenticado, por lo que
    estÃ¡ sujeto a RLS.
  - `GET /api/groups`: devuelve solo los grupos del usuario autenticado (no listado global).

  **QuÃ© falta / bugs:**
  - a. **RLS bloqueante (bug real):** `group_members` INSERT tiene una Ãºnica policy
    `"Group owners can manage members"` â€” solo permite al owner insertar filas. No existe
    policy de self-join (`user_id = auth.uid()`). Consecuencia: `POST /api/groups/[id]/join`
    falla con error 500 para cualquier usuario no-owner porque la INSERT queda bloqueada
    por RLS. El join no funciona aunque llegues por URL directa.
  - b. **Descubrimiento:** no hay ruta `/groups` ni buscador. Los grupos son invisibles
    salvo que conozcas el UUID. (Solapamiento con E22, que solo contempla el listado UI
    pero no el bug de RLS ni el modelo de visibilidad.)
  - c. **Modelo de visibilidad:** la tabla `groups` no tiene columna de visibilidad
    (`is_public` / `privacy`). Todos los grupos son implÃ­citamente "abiertos" pero
    inaccesibles. No existe modelo de invitaciones (ninguna tabla).

  **Sub-piezas para cuando se planifique:**
  - [x] E45-a: MigraciÃ³n que aÃ±ade policy RLS de self-join en `group_members` (fix bloqueante,
    pequeÃ±o, independiente). ✅ CERRADA 2026-05-31 (commit 37e38a6) — policy `"Users can join groups"`
    `WITH CHECK (user_id = auth.uid() AND role = 'member')` + JoinGroupButton toast + test.
  - [x] E45-b (CERRADA 2026-05-31): PÃ¡gina `/groups` con listado/bÃºsqueda (engloba E22; E22 puede cerrarse al
    completar esto).
  - E45-c: Columna `is_public boolean default true` en `groups` + policy RLS que filtre
    grupos privados en SELECT; ajuste UI en detalle y listado.
  - E45-d: Tabla `group_invitations` + flujo de invitaciÃ³n (enviar / aceptar / rechazar).

  No planificar aÃºn. Solo backlog.

- [ ] **E46. Migrar MediaCard al sistema de diseÃ±o**

- [x] **E47. Listas: UI para aÃ±adir tÃ­tulos a una lista (endpoint ya existe)** âœ… (cerrada el 2026-05-29)

  **DiagnÃ³stico LISTAS-ADD-DIAG (2026-05-25):** El endpoint `POST /api/lists/[id]` existe y
  funciona correctamente (acepta `{ mediaId, mediaCache? }`, llama `canEditList`, inserta en
  `list_items`). La RLS de INSERT es correcta: permite owner + miembros de listas colaborativas.
  El flujo NO existe en la UI: ni `ListDetail.tsx` ni `MediaDetail.tsx` ni `MediaCard.tsx`
  tienen ningÃºn botÃ³n/acciÃ³n de "aÃ±adir a lista". Tampoco existen claves i18n para ello.

  **Veredicto:** (B) backend completo sin UI.

  **QuÃ© falta:**
  - CTA en `MediaDetail.tsx` (ficha de tÃ­tulo): botÃ³n "AÃ±adir a lista" que abra un selector
    de listas del usuario compatibles por `media_type`. Llamada a `POST /api/lists/[id]` con
    `mediaCache` para garantizar el upsert en tabla `media`.
  - CTA alternativo / adicional en `ListDetail.tsx`: botÃ³n en el header o en el estado vacÃ­o
    que abra buscador de tÃ­tulos y los aÃ±ada directamente desde la lista.
  - Claves i18n: `lists.addItem`, `lists.addToList`, `lists.selectList`, etc.

  Hecho cuando: desde la ficha de un tÃ­tulo autenticado se puede aÃ±adir a una lista propia
  y el Ã­tem aparece en `/lists/[id]` sin necesidad de ir al detalle de la lista primero.

- [ ] **E48. Notificaciones: mejoras DS aplazadas**
  Sub-piezas (sin priorizar):
  (a) `loading.tsx` â€” skeleton para estado de carga (actualmente no existe en `/notifications`).
  (b) AcciÃ³n primaria en empty state (DS Â§7) â€” aÃ±adir botÃ³n verde que lleve a Descubrir o Amigos.
  (c) Cablear `markOneRead` â€” funciÃ³n huÃ©rfana en `notifications.ts:66`, sin caller en la UI.
  (d) PaginaciÃ³n â€” hoy lÃ­mite duro de 50 resultados en `getNotifications`; aÃ±adir cursor-pagination.

- [ ] **E49. (reservado)**

- [ ] **E50. Notificaciones: estado no-leÃ­do efÃ­mero por `markAllRead` en carga**

  **Hallazgo (sesiÃ³n 2026-05-26):** El fondo verde (`accent-positive/5`) del estado
  no-leÃ­do estÃ¡ correctamente aplicado en el DS visual. El problema es de producto:
  `markAllRead` (en `src/lib/social/notifications.ts`) se llama al montar la pÃ¡gina
  `/notifications`, lo que marca todas las notifs como leÃ­das antes de que el usuario
  las vea. El efecto visual del estado no-leÃ­do es por tanto efÃ­mero (apenas perceptible
  en la primera carga) y en la prÃ¡ctica invisible.

  **No es un bug de migraciÃ³n visual** â€” el token y el color estÃ¡n bien aplicados.
  Es un bug de flujo de producto.

  **Flujo afectado:** `src/lib/social/notifications.ts` (`markAllRead`) +
  pÃ¡gina `src/app/[locale]/(app)/notifications/` (caller de `markAllRead` en montaje).

  **Arreglo futuro (fuera del carril visual):** retrasar `markAllRead` usando una de
  estas estrategias: (a) retardo temporal tras render inicial, (b) marcar leÃ­do por
  interacciÃ³n explÃ­cita (clic / hover), (c) marcar al salir de la pantalla
  (`IntersectionObserver` o `beforeunload`). Ninguna de las tres requiere cambios de
  diseÃ±o ni de tokens.

  Sin priorizar. No atacar hasta decidir estrategia de producto.

- [ ] **E51. ValidaciÃ³n en cliente + mensajes especÃ­ficos en SuggestionsForm**

  **Hallazgo (diagnÃ³stico SUGERENCIAS-400, 2026-05-26):** El 400 en `POST /api/suggestions`
  es validaciÃ³n Zod esperada y correcta â€” `description.min(10)` rechaza inputs cortos como
  `"nynf"` (4 chars). No hay bug de payload ni rate-limit. La UX es pobre:

  - `SuggestionsForm.tsx:87` â€” `subject` solo tiene `maxLength={120}` + `required`, sin `minLength={3}`.
  - `SuggestionsForm.tsx:99` â€” `description` solo tiene `maxLength={2000}` + `required`, sin `minLength={10}`.
  - Sin validaciÃ³n Zod en cliente: cualquier entrada de 1 char se envÃ­a al servidor y falla.
  - `route.ts:33` devuelve `{ error: 'Invalid data' }` genÃ©rico (sin detalle por campo).
  - `SuggestionsForm.tsx:23` ignora el body del 400; muestra siempre `t('error')` fijo.

  **QuÃ© falta:**
  - AÃ±adir `minLength={3}` a `subject` y `minLength={10}` a `description` (o validaciÃ³n Zod en cliente).
  - Mostrar conteo/feedback por campo cuando la longitud no alcanza el mÃ­nimo.
  - Opcional: que el servidor devuelva los errores de Zod por campo (`parsed.error.flatten()`).

  Hecho cuando: enviar `description` de 4 chars muestra error inline antes de hacer fetch,
  y el form no puede enviarse con datos que fallen la validaciÃ³n del servidor.

- [ ] **E52. Silent fail duplicado en ChatClient + ConversationClient** â€” `.catch(() => setLoading(false))` en ambos archivos traga el error de carga y deja pantalla vacÃ­a sin feedback al usuario. Mejora funcional, no bug de migraciÃ³n. Fix futuro debe aÃ±adir el test que lo detecta (TDD retrospectivo) antes de cambiar el handler.

- [ ] **E53. String hardcodeado sin i18n en ChatClient** â€” `${conversations.length} conversaciones` no pasa por `t()`. Fix: aÃ±adir clave `chat.conversationCount` (con plural forms) a `messages/es.json` y `messages/en.json` y usar `t('conversationCount', { count })`.

- [ ] **E54. Chat: cifrado de extremo a extremo (E2EE) â€” DECISIÃ“N DE ARQUITECTURA**

  Hoy los mensajes se guardan en texto plano en Supabase (`messages.content text not null`).
  E2EE implica cambios de calado que afectan al producto completo:

  **Impacto tÃ©cnico:**
  - Cifrado en cliente: elegir protocolo/librerÃ­a (Signal, libsodium, etc.).
  - GestiÃ³n de claves por usuario: derivaciÃ³n, almacenamiento local, pÃ©rdida de dispositivo,
    acceso multi-dispositivo, recuperaciÃ³n (sin clave no hay recuperaciÃ³n posible).
  - Rotura de funciones que leen el contenido del servidor:
    - Preview "TÃº: â€¦" en lista de conversaciones (lee `messages.content` server-side).
    - PolÃ­ticas RLS sobre texto plano (dejan de proteger contenido, solo metadata).
    - Supabase Realtime sobre filas con texto cifrado (entrega ciega, sin semÃ¡ntica).
    - BÃºsqueda de mensajes (imposible sin Ã­ndice server-side o arquitectura adicional).

  **Antes de cualquier implementaciÃ³n se requiere un bloque de diseÃ±o propio:**
  - ElecciÃ³n de protocolo y librerÃ­a (con anÃ¡lisis de madurez, mantenimiento, tamaÃ±o bundle).
  - DecisiÃ³n sobre quÃ© se sacrifica del producto actual (preview, bÃºsqueda, Realtime con semÃ¡ntica).
  - Modelo de recuperaciÃ³n de claves (o documentar que no existe).
  - MigraciÃ³n de mensajes existentes (imposible â†’ asumir brecha, o borrar y empezar).

  **No atacar en caliente. Sin priorizar. No planificar hasta cerrar D (Legal mÃ­nimo)
  y tener usuarios reales que lo demanden.**

  Hecho cuando: existe `docs/decisions/e2ee-chat.md` con protocolo elegido, tabla de
  sacrificios de producto, modelo de claves, y plan de migraciÃ³n â€” antes de escribir
  una sola lÃ­nea de cÃ³digo.

- [x] **E55. KButton: active:scale(0.98) no implementado** âœ… CERRADA en B3.5f-3 (nivel mÃ­nimo)

  DS Â§5 especificaba `active:scale(0.98)` en botones pero `KButton.tsx` no lo tenÃ­a. AÃ±adido `active:scale-[0.98]` en variantes `primary` y `secondary`. 506/57 green.

- [ ] **E56. Faltan loading.tsx en rutas principales** â€” solo `/profile` tiene skeleton de carga.

  Rutas sin `loading.tsx`: home, discover, search, library, media/[type]/[id], friends, notifications, settings, chat, groups/[id], lists/[id]. Causa: Sprint B3.5f migrÃ³ el DS pero no aÃ±adiÃ³ loading skeletons.

  **Prioridad:** media. Sin loading.tsx, Next.js muestra pÃ¡gina en blanco durante SSR. No es bug funcional pero degrada UX en conexiones lentas.

  Hecho cuando: las rutas principales tienen `loading.tsx` con skeleton coherente al DS (surface-default, animate-pulse).

  **Nota:** nivel medio de B3.5f-3. No tocar hasta confirmar con el usuario.

- [x] **E57. prefers-reduced-motion no implementado** âœ… CERRADA en B3.5f-3 (nivel mÃ­nimo)

  WCAG 2.1 Â§2.3.3. `globals.css` ahora neutraliza `transition-duration` y `animation-duration` a `0.01ms` globalmente bajo `@media (prefers-reduced-motion: reduce)`.

- [ ] **E58. RecommendModal + Toast: migrar tokens legacy al DS**

  `RecommendModal` usa `bg-surface`, `border-border`, `text-text`; `Toast` usa `bg-surface2`, `border-border`, `text-accent`. Mismo patrÃ³n legacy ya visto y migrado en Chat/Notif. Migrar a tokens canÃ³nicos del DESIGN_SYSTEM.md. Sin priorizar.

- [ ] **E59. FilterBar: migrar chips de filtro al DS**

  Chips de filtro en `FilterBar` usan tokens legacy:
  - **Activo:** `bg-accent-subtle text-accent border-accent` (rojo legacy `#E82020`) â†’ debe ser verde `accent-positive` (tokens DS).
  - **Inactivo:** `bg-surface2 text-muted border-border` â†’ reemplazar por tokens DS canÃ³nicos.

  Componente COMPARTIDO (Discover, Search, Library) â€” migrar con verificaciÃ³n de las 3 pantallas.
  Sin priorizar.

  Hecho cuando: 0 tokens legacy en `FilterBar`, chips activos usan `accent-positive`, inactivos usan tokens DS, y las 3 pantallas no presentan regresiones visuales.

- [ ] **E60. DecisiÃ³n de producto: scope de Discover/Books (idioma)**

  `src/lib/api/googlebooks.ts:56` aplica `langRestrict: "es"`, lo que reduce drÃ¡sticamente
  `totalItems` y agrava el bug de paginaciÃ³n de books (totalPages inflados o errÃ³neos cuando
  hay pocos resultados en espaÃ±ol). Es una decisiÃ³n de producto: Â¿Discover de libros
  espaÃ±ol-cÃ©ntrico (consistente con i18n del proyecto) o global?

  Aplica tambiÃ©n a otras APIs si tienen restricciÃ³n regional similar.

  Sin priorizar. No tocar `langRestrict` hasta tomar la decisiÃ³n.

- [ ] **E61. Seguridad: `DELETE /api/lists/[id]` bypassa RLS con service-role**

  Descubierto en Fase 0 de E47. El endpoint usa service-role client y solo comprueba
  `canEditList`, por lo que un colaborador puede borrar items aÃ±adidos por otros
  colaboradores ignorando la RLS real (`added_by OR owner`).
  Toca: `src/app/api/lists/[id]/route.ts` (handler DELETE).
  Riesgo: seguridad (privilege escalation entre colaboradores).

- [ ] **E62. PatrÃ³n transversal: mutaciones optimistas sin verificar `res.ok`**

  Casos confirmados: `ListDetail.tsx` `handleRemoveItem` (lÃ­nea 37) y `handleInvite`
  (lÃ­nea 53). Si el server responde 403 o 500, el cambio queda aplicado en la UI sin
  revertir. Mismo patrÃ³n sospechado en E51 (Sugerencias) y E52 (Chat), ya registrados.
  AcciÃ³n sugerida: barrido del repo buscando `await fetch(` en client components sin
  chequeo posterior de `res.ok` en mutaciones (POST/PATCH/DELETE). Documentar lista de
  archivos afectados antes de fixear.

- [ ] **E63. `ListsClient.tsx` descarta el setter de `useState`**

  LÃ­nea 16: `const [lists] = useState<List[]>(initialLists)`. Sin setter, la nueva lista
  creada via `CreateListModal` solo aparece tras full navigation. Fix: `const [lists,
  setLists] = useState(...)` y pasar `setLists` (o callback `onCreated`) a
  `CreateListModal` para actualizar el grid tras crear.

- [ ] **E64. Seguridad/visual: RecommendModal usa colores hardcodeados (viola DS)**

  Descubierto en Fase 0 de E47. `RecommendModal` usa `text-green-400` y `text-red-400`
  hardcodeados en lugar de tokens DS (`accent-positive`, `accent-danger`). El componente
  nuevo `AddToListButton` creado en E47 NO replica este patrÃ³n â€” usa tokens y
  `useToastContext` correctamente. Esta E-task cubre la migraciÃ³n del `RecommendModal`
  existente.

  Toca: `src/components/social/RecommendModal.tsx`.

  Solapamiento parcial con E58 (RecommendModal + Toast). Considerar unificar al
  planificar.

- [x] **E65. Listas: UI para borrar una lista (endpoint ya existe)**

  Descubierto en verificaciÃ³n visual de E47. El endpoint `DELETE /api/lists` existe y
  funciona (solo owner). El usuario reporta que NO hay botÃ³n ni acciÃ³n en `/lists` ni
  `/lists/[id]` para borrar una lista. Mismo patrÃ³n que tenÃ­a E47 antes de cerrarse:
  backend completo sin UI.

  QuÃ© falta: botÃ³n en `ListCard` o en header de `ListDetail` (con confirmaciÃ³n) + claves
  i18n (`lists.delete`, `lists.deleteConfirm`, `lists.deleted`).

  Hecho cuando: desde `/lists` o `/lists/[id]`, el owner puede borrar su lista con
  confirmaciÃ³n y desaparece del grid.

- [x] **E66** — AiRecommendations: carátula + navegación a ficha ✅ (cerrada el 2026-05-31, fe15a2d)
    533/59 green. Comic resuelve carátula pero su ficha aún no existe → ver E66-COMIC-FICHA.
- [x] **E66-COMIC-FICHA** — Ficha de cómic vía ComicVine (detail)
    536 green. getComic + VALID_TYPES + page.tsx comic branch.
- [x] **E66-COMIC-OCCIDENTAL** — Discover cómic: filtrar publishers occidentales vía batch volumes ✅ (cerrada el 2026-05-31, 4e6e803)
    544 green. resolveVolumePublishers (batch /volumes/ + cache) + WESTERN_PUBLISHERS/isWesternPublisher + getRecentComics limit=100 filtra a occidentales.

- [ ] **E67. Flaky test `tests/unit/library/route.test.ts` (401 no autenticado)**
  Falla esporádicamente en la suite completa (`vitest run`) pero pasa siempre aislado (`vitest run tests/unit/library/route.test.ts` → 8/8 verde). Síntoma de test pollution / estado de mock compartido entre archivos (orden de ejecución, `global.fetch` o mocks de Supabase no reseteados). Detectado durante E45-b (commit da4a902): 1 fallo en primera corrida, 571/571 en re-corrida.
  Hecho cuando: el test pasa de forma determinista en 5 corridas consecutivas de la suite completa, o se identifica y corrige la fuente de contaminación (mock sin `vi.clearAllMocks`/`resetModules`).

- [~] **E68. (OBSOLETA 2026-05-31) Tests de integración real para RPC `get_discoverable_groups`**
  Obsoletada por el hotfix de E45 (commit 2d11228): el descubrimiento ya no usa la RPC `get_discoverable_groups` sino queries directas (la RPC quedaba cacheada en el schema de PostgREST). Sin RPC en el flujo, no hay nada que cubrir con tests de integración. La RPC zombi se elimina en E70.
  ~~Hoy el RPC solo está cubierto por tests unitarios con el cliente Supabase mockeado (`tests/unit/social/discover-route.test.ts`). Faltan tests de integración contra DB real (kultura-test) que ejerciten los boundaries de `p_size`: 10/11 (small↔medium) y 50/51 (medium↔large), además de scope joined/unjoined y paginación limit/offset reales.~~

- [x] **E70. Drop RPC zombi `public.get_discoverable_groups(...)` en DB prod**
  Tras el hotfix de E45 (commit 2d11228) el descubrimiento de grupos usa queries directas en vez de la RPC (la RPC quedaba cacheada en el schema de PostgREST y devolvía resultados obsoletos). La función `public.get_discoverable_groups(text, text, text, integer, integer)` queda sin uso en el código. Eliminarla con `DROP FUNCTION` cuando se haga limpieza de DB, en una migración nueva (`supabase migration new drop_rpc_discover_groups`).
  Hecho cuando: `DROP FUNCTION IF EXISTS public.get_discoverable_groups(text, text, text, integer, integer);` aplicado en prod vía migración versionada, `NOTIFY pgrst, 'reload schema'`, y `\df public.get_discoverable_groups` en prod no devuelve filas.
  Cerrada 2026-05-31: migración `20260531201838_drop_rpc_discover_groups.sql` (drop versionado + reload schema). Migración vieja `20260531180450` queda como histórico DEPRECATED. Grep confirma 0 referencias a la RPC en `src/` (solo 2 comentarios mencionando el nombre). Drop en prod ejecutado manualmente.
