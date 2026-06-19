# DONE

Log de tareas cerradas. Formato: `fecha | id | commit corto | nota si aplica`.

No se edita a mano durante el día. Solo se añade una línea al terminar cada tarea.

---

2026-06-19 | E90 | (este commit) | **Navegación móvil incompleta: faltan friends, lists, suggestions.** Paso 0 (READ-ONLY): `BottomNav` (`md:hidden`) definía 5 items (home·discover·chat·library·groups), `NavLinks` desktop 8 (incluye friends·lists·suggestions). Listas DUPLICADAS, no compartidas (dos arrays, dos archivos, iconos propios); `friends` omitido por entry ausente — no por `.slice()`/límite ni condicional de viewport (solo CSS `md:hidden`/`hidden md:flex`). Fix: (1) `BottomNav.tsx` += `{key:'friends',href:'/friends',icon:Users2}` antes de groups → 6 items; import `Users2` de lucide-react (groups conserva `Users`, distintos); key i18n `nav.friends` reusada (ya en es/en, no duplicada); href `/friends` + `Link` de `@/i18n/navigation` (locale-aware, mismo patrón que NavLinks). (2) `AvatarDropdown.tsx` += `lists` (`/lists`) y `suggestions` (`/suggestions`) como Links arriba (antes de profile) con separador `border-t`, reusando hrefs/keys i18n de NavLinks (sin iconos, igual que profile/settings ya existentes); sin test propio (no había). Test `BottomNav.test.tsx` actualizado (estaba stale: mockeaba lucide sin `Users2` y asertaba "5 items"): mock `Users2`, map i18n `friends:'Amigos'`, "6 items" + assert Amigos, nuevo test href `/friends`. Viewport ~360px/6 = 60px por celda: sin clipping (no overflow-hidden ni truncate); "Mi biblioteca" (label más largo, 10px) puede envolver a 2 líneas en pantallas muy estrechas (labels NO se pierden, fila más alta) → reportado, no forzado. tsc 0, lint 0 (2 warnings preexistentes ajenos en SearchResults), vitest **1169 passed** (1168 base + 1 test nuevo) `--no-file-parallelism`. BACKLOG E91 anotado (search oculto en móvil: `AuthHeader` link `/search` es `hidden md:flex` → móvil sin buscador salvo URL). NO pusheado al cerrar.

---

2026-06-17 | E79 slice 1c (E89) | (este commit) | **Cap totalPages al tope servible del proveedor.** Paso 0 (topes por proveedor): TMDB movie/tv hard cap 500 (documentado) pero `total_pages` crudo llega a 57464 → la UI numerada (slice 1b) ofrecía una "última página" = totalPages que disparaba un 4xx de TMDB → `fetchErrorKind="generic"` → banner rojo falso "No se pudo cargar". book ya capado a 50 (Open Library); comic `ceil(total/20)` es el total real navegable; Jikan `last_visible_page` YA es el tope real del proveedor; RAWG sin tope duro documentado (deep pages devuelven vacío pero sin constante fiable que capar) → dejado, anotado; agregado `all` usa `ceil(merged.length/20)` ya acotado por el pool real traído (no inflado por TMDB) → sin cambio. Fix en `discover.ts`: const `TMDB_MAX_PAGES=500`; movie/tv/default capan `totalPages=Math.min(res.total_pages,500)` y `hasMore=page<totalPages` (el cap gobierna también el gate → page 500 ya no ofrece "siguiente"). Hardening fuera de rango: `page>500` → return `{items:[], totalPages:500, hasMore:false, fetchErrorKind:null}` ANTES de llamar a TMDB → página vacía sin el 4xx, distinguiendo página fuera de rango (escrita a mano / salto de la UI numerada) de fallo de red real (sin banner rojo). Tests: +6 en discover.test (cap movie/tv a 500, no infla <500, page 500→hasMore false, page>500→vacío sin error + sin llamada API en movie y tv). tsc 0, lint 0 (2 warnings preexistentes ajenos en SearchResults), vitest **1168 passed** (`--no-file-parallelism`). El caso de SALTOS arbitrarios a páginas muy filtradas (back-fill/cursor) sigue en E79 slice 2. NO pusheado al cerrar (este commit lo sube).

---

2026-06-16 | E79 slice 1b | (este commit) | **Paginación numerada con elipsis (UI).** `Pagination.tsx` rediseñada de prev/next a ventana numerada: `« Anterior [1] … [c-1] [c] [c+1] … [N] Siguiente »`. `buildPageWindow(current, total)` fija siempre primera (1) y última (N) + `current±1` en un `Set`, ordena, e inserta sentinela `ELLIPSIS` donde el salto entre números consecutivos es >1; ventana estrecha (1 vecino/lado → ≤7 entradas) mobile-first, no desborda en viewport angosto. Botones cuadrados `min-w-10 h-10` (tap ≥40px), `rounded-md`, foco/hover DS; texto "Anterior/Siguiente" se oculta `<sm` dejando solo `«`/`»`. Activo: `bg-accent text-white border-accent` (VARIABLE de acento del DS — hoy rojo legacy, la misma del resto de la app; NO hex hardcodeado; futura migración → E82) + `aria-current="page"`; inactivos `border-border bg-transparent` con hover. **El gate de "siguiente" SIGUE en `!hasMore` (slice 1), NO vuelve a `totalPages`.** `totalPages` (campo de `DiscoverResult` que slice 1 dejó de consumir en cliente) restaurado en `DiscoverClient`: nuevo estado `totalPages`, set en then/catch del fetch, pasado como prop a `Pagination` solo para pintar la ventana. i18n: claves nuevas `discover.paginationLabel` + `discover.pageN` (`Página {n}`/`Page {n}`) en es+en (paridad); `previous`/`next`/`page` reusados. a11y: `nav role="navigation"` con `aria-label`, `aria-label="Página N"` por número, elipsis `aria-hidden`. Tests: `pagination.test.tsx` reescrito por completo (nav etiquetado, render de números, ventana+elipsis = 2 saltos→2 elipsis, sin-saltos lista todas, activo `aria-current`, anterior disabled p1 / habilitado >1, siguiente disabled `!hasMore` incluso con `totalPages>currentPage`, click número→`onPageChange(n)`, click prev/next→±1). tsc 0, lint 0 (2 warnings preexistentes ajenos en SearchResults), vitest **1162 passed** (`--no-file-parallelism`). BACKLOG E79 slice 2 anotado con caso nuevo: saltos arbitrarios de la UI numerada → página lejana muy filtrada cae corta/vacía (back-fill/cursor). NO pusheado al cerrar (este commit lo sube).

---

2026-06-16 | E79 slice 1 | (commit anterior) | **Paginación Descubrir — "has-next": elimina páginas cortas/vacías por post-filtros.** Paso 0 (inventario READ-ONLY): por familia (movie/tv/anime/manga/book/game) 1 request/carga sin overfetch; `comic` pide 100 y tira ~80 (`.slice(0,20)`); agregado `all` re-fetcha page 1 de las 7 familias en cada página (peor caso). El bug: `totalPages` se computaba siempre PRE-post-filtro (temporadas/volumenes/game-suite/NSFW recortan items DESPUÉS), así que `Pagination` (que ya era prev/next, sin números) deshabilitaba "next" antes de tiempo y mostraba un "of Y" inflado → páginas finales cortas o vacías. Diseño: evaluados A1 "has-next" (no fiarse de totalPages; gate por si la FUENTE cruda tiene más) vs A2 "back-fill" (pedir páginas siguientes hasta juntar 20). Elegido **A1**: el componente ya era prev/next → coste mínimo; A2 añade requests no acotados + estado de cursor para preservar números que el componente ni muestra. Implementación: campo aditivo `DiscoverResult.hasMore` = `page < providerTotalPages` por familia (reusa el total del proveedor ya computado: `res.total_pages` movie/tv, `last_visible_page` anime/manga, `ceil(numFound/20)` cap 50 book, `ceil(total/20)` comic, `ceil(count/20)` game); error→false. Agregado `all`: `hasMore = page*20 < merged.length` (hay más en el pool ya traído; profundizar = slice 2). `Pagination.tsx`: prop `totalPages`→`hasMore`, gate `currentPage>=totalPages`→`!hasMore`, label "page X of Y"→"page X". `DiscoverClient`: estado `totalPages`→`hasMore`, gate de barra `totalPages>1`→`hasMore||currentPage>1` (permite retroceder desde última corta). i18n: clave huérfana `discover.of` eliminada en es+en (paridad mantenida). Tests: `+10` en discover.test (hasMore por las 7 familias en el límite + error→false + CASO CLAVE hasMore sobre count de fuente, no items servidos + `all` pool 35), `pagination.test` reescrito a hasMore (incl. next disabled en última fuente con currentPage bajo + prev activo), `discover-route.test`/`aggregate.test` mocks += hasMore, e2e `discover-pagination.spec` mock += hasMore + nuevo test "página filtrada vacía no bloquea next; siguiente trae resultados". tsc 0, lint 0 (2 warnings preexistentes ajenos en SearchResults), vitest **1157 passed** (`--no-file-parallelism`). Slice 2 pendiente (cachear pool agregado `all` + comic, profundizar paginación real). NO pusheado al cerrar (este commit lo sube).

---

2026-06-16 | E24 | (este commit) | **Validación de env con Zod + fail-fast.** Paso 0 (inventario READ-ONLY): 6 vars de app dispersas en `process.env.X!` (silencioso → `undefined` a runtime, fallo opaco lejos del arranque), sin punto central ni `.env.example`. Paso 1: nuevo `src/lib/env.ts` con `publicSchema` (acceso LITERAL var a var para que Next inline en bundle: `NEXT_PUBLIC_SUPABASE_URL` url, `_ANON_KEY` min(1), `NEXT_PUBLIC_SITE_URL` url optional) y `serverSchema` (`SUPABASE_SERVICE_ROLE_KEY`/`TMDB_API_KEY`/`RAWG_API_KEY` min(1); `ANTHROPIC_API_KEY` startsWith('sk-ant-').optional(); `COMICVINE_KEY` min(1).optional()). Opcionales con `preprocess(emptyToUndefined)` para tratar `""` como ausente. `publicEnv` se evalúa eager al importar (validación build/cliente); `env` (server) es un Proxy lazy+memoizado → la validación corre en runtime, NUNCA en import de build (no rompe build de Vercel). Error lista cada var que falla con su motivo. Nuevo `instrumentation.ts` (raíz; `instrumentationHook` ya estable en Next 14.2.35, sin flag) → `register()` corre `parseServerEnv()` fail-fast solo en runtime `nodejs`. Refactor consumidores a usar el módulo (sin `process.env.X!`): tmdb, rawg, supabase client/server/admin, middleware; graceful preservado en Anthropic (degrada a `[]`) y ComicVine (throw lazy en `getKey()`). Vars de test (`SUPABASE_TEST_*`, `TEST_USER_*`) NO en el schema de app. Tests: `tests/unit/lib/env.test.ts` (5: schema válido pasa, opcionales válidas, falta var crítica → error nombra var, varias faltan → las lista todas, formato ANTHROPIC inválido → error). `tests/setup.ts` += defaults dummy de env (`??=`) para que los módulos que importan `@/lib/env` validen al cargar. Dos tests de recomendaciones actualizados a `sk-ant-test-key` (la nueva validación de formato rechaza `test-key`). tsc 0, lint 0, vitest **1146 passed** (1141 base + 5), `--no-file-parallelism` para evitar el flake preexistente de 401-timeout bajo carga. NO pusheado (validación manual del usuario).

---

2026-06-14 | E87 | 19f50c6 | **Blacklist editoriales adultas ComicVine (caso Comic Bavel / Bunendo).** Paso 0 (inventario READ-ONLY contra la API real): "Comic Bavel #135" se colaba en Descubrir→Cómics; su volumen (4050-88907) tiene publisher **Bunendo** (id 7358), editorial japonesa de ero-manga ausente de toda blacklist. Dump crudo de volume + issue + publisher confirmó que ComicVine **no expone ningún campo de rating/maturity/age** en ningún recurso (único match del regex era el objeto `image`, falso positivo; corroborado vía docs). → única vía sistémica = blacklist por editorial. Paso 1: 8 editoriales japonesas de ero-manga añadidas a `ADULT_PUBLISHERS` en `comicvine.ts` (NO a `MANGA_PUBLISHERS`: sus nombres no matchean las grandes japonesas), nombres exactos verificados uno a uno contra el endpoint `/publishers/` de ComicVine + inspección de sus volúmenes para descartar falsos positivos: **Bunendo** (Comic Bavel), **Wani Magazine** ("various ero-manga and art books"), **Akaneshinsha** ("various adult manga brands"), **Sanwa Publishing** (Sanwa Publishing Company Ltd. — "adult manga titles"), **Coremagazine** (Comic Hotmilk), **Kasakura** (Kasakura Shuppansha), **Mediax** (Honey Dip), **Hit Publishing** (Comic Aun). Excluida pese a salir en el barrido por NO ser adulta: **Million Publishing** (publica Transformers). Matching sin cambios: `isAdultPublisher` ya usa `lc.includes(p)` (substring case-insensitive) → la entrada corta "Bunendo"/"Sanwa Publishing"/"Kasakura" captura el nombre completo del publisher. Tests: bloque de asserts sobre las 8 entradas nuevas + caso integración "Comic Bavel #135" (vol 88907, publisher Bunendo) filtrado mientras un cómic occidental sobrevive. tsc 0, lint 0 (archivos tocados), vitest **1141 passed** (1138 base + 3), sin flaky. NO pusheado (validación manual del usuario).

---

2026-06-14 | E86 | 89e77c9 | **Filtro NSFW global (diseño B).** Capa nativa + post-filtro compartido en `fetchDiscoverData`. Nativo: TMDB `include_adult=false` explícito en `discoverMovies`/`discoverTV`; Jikan `sfw=true` añadido a `getPopularAnime`/`getPopularManga` (cerraba el hueco de la rama sin filtros, donde `discoverAnime`/`discoverManga` ya lo ponían); RAWG `exclude_tags=nsfw,adult,hentai,sexual-content,porn` en `buildRawgDiscoverParams` **y** `getPopularGames` (slugs verificados contra `/api/tags` de RAWG: todos existen con games_count>0). Post-filtro: nuevo `src/lib/api/nsfw-filter.ts` con `filterNSFW(items)` aplicado como último paso antes del return en `fetchDiscoverData` → cubre las 7 familias; el agregado `type=all` retorna antes vía `fetchAggregateData` pero cada familia que combina pasa por el mismo pipeline → ya filtrada. Matching anti-falsos-positivos: catálogo `NSFW_GENRES_LC` (porn/porno/hentai/erotica/erotic/nsfw/xxx/smut/**adult**) por igualdad EXACTA de slug normalizado en `genres`; catálogo `NSFW_TERMS_LC` (igual **sin** "adult" + "explicit sex") por word-boundary regex (`\b`, case-insensitive) en title+synopsis, más match aparte de `+18`/`18+`. **Decisión "adult" (documentada):** filtra como género/tag exacto pero NO en texto libre — riesgo de falsos positivos ("Young Adult", "Adult Swim", "adult contemporary"); cubierto por tests. Hallazgo del smoke: el caso reportado "Charlie (Hazbin Hotel) mega porn pack 1" **no** está tag-eado NSFW en RAWG → el `exclude_tags` nativo NO lo elimina; lo captura el post-filtro por `\bporn\b` en el título (verificado contra la API real + test). tsc 0, lint 0, vitest **1138 passed** (1 fail aislado en `library/route.test.ts`: timeout 401 flaky bajo carga del suite completo, pasa en aislado, preexistente y ajeno a E86).

---

2026-06-11 | E59 | d080690 (R6, final) | **Rediseño completo del filtro Descubrir (FilterBar), sub-pasos R0→R6.** R0–R3: `FilterBar` v3.1 reescrita — trigger-pills sobre `Popover` (Radix), tres `kind` (single con deselección / multi checkboxes / searchable con buscador), icono lucide por filtro, variante `sort` que renderiza "Ordenar: <valor>", `align:'end'` empuja sort a la derecha; todos los tokens del DS con acento verde (`accent-positive`). Barra Descubrir reorganizada en 2 filas etiquetadas (TIPO / FILTROS) sticky bajo el header. `src/lib/discover/type-filters.ts` como fuente de verdad única: `TYPE_ORDER` (incl. agregado "all") + `TYPE_FILTERS` (triggers visibles por tipo, política A = par sin dato en la API se oculta, "nunca un trigger que mienta"). `src/lib/discover/filter-options.ts` deriva opciones `{value,label}` con `value` = slug canónico importado de los `*-maps` (sin duplicar catálogos). R4: builders por API aplican filtros nativos (TMDB vote_average/with_status, Jikan min_score/status, RAWG ordering) y post-filtros server-side (valoracion game vía metacritic, temporadas×tv, volumenes×manga, modojuego/duracionmedia/estado×game) con overfetch+re-paginación. R5: modo `type=all` (merge de las 7 familias en `/api/discover?type=all`) pintado como grid normal con badge de tipo por card (`showType`). R6: i18n de labels (commit `d080690`) — namespace nuevo `discoverFilters` (trigger.\<key\>, options.\<key\>.\<slug\> plano por slug en genre, typeBadge singular); DiscoverClient traduce trigger/opción vía `t.has()` con fallback `humanizeSlug` (platform/editorial/genre sin clave caen al fallback; year mantiene buckets, classic vía `filters.classic`); `MediaCard` migra `TYPE_LABEL` hardcode → `discoverFilters.typeBadge`. **value = slug canónico NUNCA se toca, solo el label visible.** `FilterBar` + empty-state + badge con `data-testid` estables (`filter-trigger-*`, `filter-opt-*`, `discover-empty`, `media-type-badge`). E2E: `discover-filters.spec.ts` nuevo (type=all interleave+badge localizado, book genre+year con slug intacto en URL, labels trigger/opción difieren es↔en); `discover-pagination.spec.ts` migrado de selector frágil `text=/sin resultados/` → testid `discover-empty`. Mocks unit actualizados (`.has` en DiscoverClient, `next-intl` typeBadge en MediaCard/MediaGrid). Recordatorio respetado: valoracion sigue oculto en book (política A) — no reactivado. Verificado: tsc 0, lint 0 (solo warnings preexistentes en `SearchResults`), vitest **1126 passed**, Playwright **16/16** (es+en, desktop+Mobile Chrome), smoke es/en con capturas (`Género`/`Ordenar: Popularidad` vs `Genre`/`Sort: Popularity`, sin slugs crudos). Deuda separada: acento rojo legacy en 15+ consumidores fuera de FilterBar → **E82** en BACKLOG.

---

2026-06-07 | E83 | edca570 | Entrega de notificaciones rota a nivel global (no solo invitaciones de grupo). Diagnóstico: tabla `notifications` con RLS habilitado y solo policies `notifications_select_own` (SELECT) + `notifications_update_own` (UPDATE) — **sin policy INSERT**. RLS es default-deny → todo `insert` vía cliente anon (server.ts, anon key + sesión) era rechazado. Los 3 sitios que crean notif (`POST /api/recommendations`, `POST /api/lists/[id]` rama invite-member, `POST /api/groups/[id]/invitations`) insertaban best-effort **sin** comprobar `error` → fallo mudo: la reco/invitación se creaba pero la notif nunca llegaba al destinatario (probablemente ninguna notif funcionó nunca por esta vía). `friend_request` no genera notif (ni existe el tipo). Fix (opción B de 3 evaluadas — A: INSERT policy compleja; C: trigger SECURITY DEFINER): nuevo `src/lib/supabase/admin.ts` con `createAdminClient()` (`@supabase/supabase-js`, `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `auth:{persistSession:false,autoRefreshToken:false}`, throw claro si falta la key, key **sin** `NEXT_PUBLIC_` → no se filtra a cliente). Los 3 inserts migrados anon→admin (bypassa RLS) + `if (notifErr) console.error('[E83] notif insert failed', {type, notifErr})`; la operación principal sigue devolviendo 201 si la notif falla (ya no es mudo). Sin `import 'server-only'` (no instalado como módulo top-level, solo anidado en `next/`; rompía jsdom en vitest) — protección real = ausencia de `NEXT_PUBLIC_`. Tests: mockeado `@/lib/supabase/admin` en los 2 test files afectados, 3 asserts happy-path migradas a verificar el admin insert + 1 test de regresión (notif error → logueado pero 201). No hay schema global de env (Zod) — nada que ampliar. `.env.test.local` (gitignored, no en commit) += `SUPABASE_SERVICE_ROLE_KEY` con el valor de `SUPABASE_TEST_SERVICE_ROLE_KEY` de kultura-test (antes la service-role de prod se filtraba contra la URL de test en E2E). tsc 0, lint 0, vitest **765 passed** (761 base + 3 migradas + 1 regresión). Pendiente fuera de alcance: verificar `SUPABASE_SERVICE_ROLE_KEY` seteada en Vercel para que las notifs funcionen en prod (regla #11).

---

2026-06-06 | E74 | f353b13 | Grupos inalcanzables en móvil. `BottomNav` (nav móvil, `md:hidden`) tenía 5 ítems hardcodeados (home/discover/chat/library/profile) **sin** entrada a `/groups`; el desktop `NavLinks` sí la tenía → único punto de acceso a grupos en móvil ausente (la página `/groups` renderiza bien, no era CSS ni datos: era falta de enlace de navegación). Fix: sustituido ítem `profile` por `groups` en `BottomNav` (icono lucide `Users`, label `nav.groups` ya existente, sin tocar messages). Perfil sigue accesible en móvil vía `AvatarDropdown` del `AuthHeader` (`sticky`, sin gate de viewport → presente en todos los breakpoints). Prop `username` de `BottomNav` eliminada (solo la usaba el href de profile); caller en `(app)/layout.tsx` actualizado a `<BottomNav />`. Test unit `BottomNav.test.tsx` actualizado al nuevo contrato (mock `Users`, assert href `/groups`). lint 0 err (2 warnings preexistentes en `SearchResults`), tsc 0, vitest **639 passed**.

---

2026-06-06 | E73 | 642a56c | Fix encoding `docs/BACKLOG.md`. El archivo tenía mojibake por doble-encode (UTF-8 original re-decodificado como CP1252 y re-guardado): `Ã³`→`ó`, `Ã­`→`í`, `Ã¡`→`á`, `â€”`→`—`, `âœ…`→`✅`, etc. Daño uniforme en tipo (un solo CP1252→UTF-8 doble-encode, sin U+FFFD lossy) pero parcial en alcance: convivían copias rotas y limpias del mismo carácter (p.ej. `ó` 142 rotas + 32 limpias), por lo que un re-encode plano habría doble-corrompido lo ya limpio. Solución: reversión byte a byte CP1252→UTF-8 **solo en tokens dañados** (run de chars ≥0x80, máx 3 bytes, exigiendo decode a 1 codepoint limpio). 478 tokens revertidos, 0 leads `ÃÂâ` restantes, re-read UTF-8 OK. BOM (EF BB BF) y CRLF (563 líneas, 0 lone-LF) preservados. Validado: conteos post-fix cuadran con suma roto+limpio del audit. Diff 246+/246−, único archivo. (No hubo hook lint/tsc/vitest: el repo no tiene pre-commit configurado.)

---

2026-06-06 | E52 | 589b870 | Silent fail en carga de Chat. `ChatClient` y `ConversationClient` hacían `.catch(() => setLoading(false))`, tragando el error de fetch y dejando pantalla vacía indistinguible de "sin datos". Fix (mismo patrón en ambos): nuevo state `loadError`, carga extraída a fn `useCallback` (`loadConversations`/`loadMessages`) que resetea `loading=true`+`loadError=false` y en el catch hace `setLoadError(true)`; render distingue 3 estados — `loading` → spinner, `loadError` → mensaje i18n + botón reintentar que rellama la fn de carga, vacío real (`messages/conversations.length===0`) → placeholder existente (`noConversations`/`messagePlaceholder`). 2 claves nuevas en namespace `chat` es/en (`loadError`, `retry`). Paridad i18n 473=473. tsc 0, lint 0, vitest **639 passed**.

2026-06-05 | E51 | 4ce64d4 | Validación cliente + errores granulares en `SuggestionsForm`. `handleSubmit` ahora hace `trim()` de subject/description y rechaza pre-fetch si `subject<3` o `description<10` (`errorTooShort`); el body envía los valores ya trimmeados; `!res.ok` distingue 429 (`errorRateLimit`) del resto (`error`). Nuevo state `errorKey`; el render de error muestra `t(errorKey)` en vez de `t('error')` fijo. Dos claves nuevas en namespace `suggestions` de es/en. Paridad i18n 471=471 (suggestions 19=19). tsc 0, lint 0 (solo warnings pre-existentes en `SearchResults`), vitest **639 passed**.

---

2026-06-05 | E72 | 9cc9b37 | Fix del doble render del mensaje optimista en `ConversationClient` (el síntoma "duplicado"). Causa: optimistic add usaba `id = temp-{Date.now()}` que nunca coincide con el UUID real, el dedup por id del handler realtime fallaba y el mensaje aparecía dos veces (temp + realtime). Fix A: tras `res.ok` se parsea el body del POST (`{ message }`, shape `id/content/sender_id/created_at`, mapeado a `Message` con `users: null`) y se reemplaza el temp por el real. Fix B: el handler realtime, si `sender_id === currentUserId`, busca un `temp-*` con mismo `content` y lo reemplaza en vez de añadir (cubre la race realtime-antes-de-POST). Idempotente en ambos órdenes. `currentUserId` añadido a deps del useEffect. tsc 0, lint 0, vitest **639 passed**. (Re-etiquetada 2026-06-06: este commit era el doble render, no el silent fail de carga del backlog. El silent fail real es E52, ahora cerrada por separado.)

---

2026-06-05 | E67 | 6d30a42 | Test pollution fix (Opción 1). Split del bloque parser de `tests/unit/ai/ai-recommendations.test.ts` a su propio archivo `tests/unit/ai/recommendations-parser.test.ts`. La causa del flake: el archivo original mezclaba `vi.mock('@/lib/claude/recommendations')` (que mockeaba el módulo bajo test, para el bloque GET de la ruta) con `vi.doMock`/`vi.doUnmock` del SDK Anthropic + Supabase en el bloque parser → estado de mock contaminado según orden de ejecución (5 fail con seed 12345). El bloque GET se queda en el archivo original (sigue necesitando el mock del módulo). El bloque parser se va al archivo nuevo SIN ese mock → carga el módulo REAL, con cobertura real del parsing. Fixtures `LIBRARY_ITEMS` reescritas a la forma anidada `{ status, score, media: { title, type, year } }` que espera `getLibraryContext` (recommendations.ts:96-103), no la plana anterior. `searchByType` hoisted + `vi.resetModules()` en beforeEach (patrón de `claude/recommendations.test.ts`). Asserts reescritos contra el resultado real (p.ej. type inválido → `result.map(r=>r.type)` = `['movie']`; year 1700/string → `undefined`, 2010 → conservado). tsc 0, lint 0 (solo warnings pre-existentes en `SearchResults`), vitest **639 passed** (sin cambio neto: 5 tests del bloque → 5 tests en el archivo nuevo). Determinista en shuffle seeds 12345 y 99999 (antes 5 fail con 12345).

---

2026-06-05 | E62 E63 E64 | 47becaf | **E62** `ListDetail.tsx`: `handleRemoveItem`/`handleInvite`/`handleRemoveMember` ahora chequean `res.ok` tras el `await fetch`; si falla (403/500), muestran error inline (`actionError`, mismo patrón que `handleDeleteList`/`deleteError`) y NO mutan `items`/`members`. Barrido Fase 0: `ListDetail` era el único client component con mutaciones optimistas sin chequeo → **E62 cerrada completa**. +keys `lists.{removeError,inviteError,removeMemberError}` es/en (paridad). **E63** `ListsClient.tsx`: eliminado `useState` muerto (sin setter), usa `initialLists` renombrado a `lists`; `CreateListModal` añade `router.refresh()` tras `router.push` para invalidar Router Cache (lista nueva visible al volver a `/lists`). **E64** `RecommendModal.tsx`: `text-green-400`→`text-success`, `text-red-400`→`text-danger` (tokens DS). tsc 0, lint 0 (solo warnings pre-existentes en `SearchResults`), vitest **639 passed**.

---

2026-06-04 | E45-d.2 | d96e40f | UI invitaciones a grupos. `InviteButton` (owner-gated en `groups/[id]/page.tsx`, junto a `JoinGroupButton`) abre `InviteFriendsModal` (tokens DS, mirror de CreateListModal): `GET /api/groups/[id]/invitations` lista amigos invitables, `POST {inviteeId}` invita, comprueba `res.ok`, toast éxito/error, estado vacío, quita al invitado de la lista. `NotificationsList` branch `group_invite`: texto "{from} te invitó al grupo {name}" + botones Aceptar (`PATCH /api/groups/invitations/[id]`) / Rechazar (`DELETE …`), `res.ok` + `router.refresh()` (Router Cache Next 14) → badge unread baja. Se reusó el endpoint GET existente (no se creó ruta nueva). i18n es/en paridad exacta (465=465): `groups.{invite,inviteFriends,noInvitableFriends,inviteSent,inviteError}` + `notifications.{groupInvite,accept,reject,inviteAccepted,inviteRejected,inviteActionError}` + `privateHint` reescrito ("el propietario invita a sus amigos"). +17 tests. tsc 0, lint 0, vitest **639 passed** (622→639). **Cierra E45-d y con ello E45 completo** (a✅ b✅ c✅ d✅). Smoke test manual saltado por decisión del usuario (requería 2 cuentas + verificación de trigger en prod).

---

2026-06-01 | E71 | (código + docs en 2 commits) | `DELETE /api/lists/[id]` (handler item): `.delete({ count: 'exact' })` + `if (count === 0)` → 404 `Not found`, mirror exacto del patrón de `/api/library` DELETE. Borrar item inexistente ahora devuelve 404 en vez de 200 `{ok:true}`. `canEditList` (403) y rama de borrar lista entera intactos. +5 tests en `tests/unit/social/lists-id-route.test.ts` (401/400/403/404/200). tsc 0, lint 0, vitest **589 passed** (584→589, +5). Cierre del residuo cosmético de E61. No es seguridad (RLS `list_items_delete_adder_or_owner` ya protege), es feedback al cliente.

---

2026-06-01 | E61 | (sin commit de código — solo docs) | Auditoría Fase 0: NO-VULN. `DELETE /api/lists/[id]` usa `createClient()` (anon+sesión), no service-role; RLS `list_items_delete_adder_or_owner` sí aplica. Diagnóstico de E47 era incorrecto. Residuo cosmético (no verifica filas afectadas) → E71.

---

## E65 — Refrescar /lists tras borrar lista (2026-05-31)

Commit: be2f08c

`router.refresh()` añadido tras `router.push('/lists')` en `handleDeleteList` (`src/app/[locale]/(app)/lists/[id]/ListDetail.tsx`). Invalida el Router Cache → re-fetch del Server Component de `/lists`, la lista borrada desaparece sin recarga manual. Opción A (client-side) elegida; opción B (`revalidatePath` server-side en el endpoint DELETE) descartada por innecesaria. lint/tsc verdes, vitest 584 passed.

## E70 — Drop RPC zombi get_discoverable_groups (2026-05-31)

Migración `20260531201838_drop_rpc_discover_groups.sql`: `DROP FUNCTION IF EXISTS public.get_discoverable_groups(text, text, text, integer, integer)` + `NOTIFY pgrst, 'reload schema'`. RPC muerta desde el hotfix de E45-b (discover usa queries directas en `src/lib/social/groups.ts`). Migración vieja `20260531180450_rpc_discover_groups.sql` se conserva como histórico DEPRECATED. Grep: 0 referencias a la RPC en `src/` (solo 2 comentarios). Drop en prod ejecutado manualmente. lint/tsc/vitest verdes (576 passed).

## E45 — Grupos: RLS auto-join + feedback UI (2026-05-31)

Commit: 37e38a6

- Migration `20260531000001_fix_group_members_self_join.sql`: policy `"Users can join groups"` en `group_members` INSERT — `WITH CHECK (user_id = auth.uid() AND role = 'member')`. Desbloquea `POST /api/groups/[id]/join` para no-owners (antes 500 por RLS: solo existía `"Group owners can manage members"`). Sub-pieza E45-a del backlog. E45-b/c/d (descubrimiento, visibilidad, invitaciones) siguen abiertas.
- `JoinGroupButton.tsx`: toast de error en `!res.ok` (antes el fallo de join era silencioso).
- i18n: `friends.joinGroupError` en es/en.
- Test: `tests/unit/social/groups-join-route.test.ts` cubre join/leave/401/404/owner-400.

## E45-b — Grupos: descubrimiento + página /groups + nav (2026-05-31)

Commits: 2ef43f7 (RPC+endpoint), a96f8a2 (página+componentes), da4a902 (refactor FriendsClient), 1251994 (nav).

- **RPC + endpoint** (2ef43f7): `get_discoverable_groups(p_q, p_scope, p_size, p_limit, p_offset)` + `GET /api/groups/discover` (Zod, rate-limit, mapeo a `DiscoverGroup`). `getDiscoverableGroups` en `src/lib/social/groups.ts`.
- **Página /groups** (a96f8a2): `groups/page.tsx` (Server Component, `getUserGroups`), `GroupsClient.tsx` (tabs "Mis grupos" / "Descubrir"), `DiscoverGroupsClient.tsx` (search debounce 400ms manual + FilterBar scope/size + grid + paginación "Cargar más" LIMIT 50/offset). Componentes extraídos: `ui/TabButton.tsx` (compartido Friends+Groups), `social/CreateGroupForm.tsx` (reutilizable, antes inline en Friends), `social/GroupCard.tsx` (avatar color, nombre, desc, memberCount plural ICU, badge isMember). Mapeo UI→API: chips "Ya soy miembro"/"No soy miembro" → scope joined/unjoined. i18n es/en (groups.* + filters.scope/size + nav.groups). Tests: `DiscoverGroupsClient.test.tsx`, `GroupsClient.test.tsx`.
- **Refactor FriendsClient** (da4a902): eliminado tab grupos + estado/lógica de grupos; Friends queda como vista única (share → search → pending → lista) + link a /groups. −188/+90.
- **Nav** (1251994): `/groups` añadido a `NavLinks.tsx` tras `/friends` (social), key `nav.groups` es/en.
- Cierra E22 (página /groups con listado). Engloba el listado/búsqueda. tsc 0, lint 0, **571 passed**.

## E45-c — Grupos: visibilidad is_public + UI (2026-06-01)

Commit código: 759c1b3.

- **DB/RLS** (migraciones previas E45-c): columna `is_public boolean default true` en `groups`. RLS SELECT filtra privados a no-miembros vía función `SECURITY DEFINER` `is_group_member` (evita recursión de la policy sobre `group_members`). `getDiscoverableGroups` filtra `is_public = true` explícito.
- **Propagación `isPublic`** (759c1b3): `Group` interface + `mapGroup` + selects de `getUserGroups`/`getGroupById` en `src/lib/social/groups.ts`.
- **UI crear** (`CreateGroupForm.tsx`): toggle segmentado Público/Privado (default público, tokens DS `accent-positive`/`on-accent-positive`, `role=group` + `aria-pressed`), envía `is_public` en POST, hint privado cierto al estado actual ("no aparece en Descubrir, el propietario añade miembros").
- **UI detalle** (`groups/[id]/page.tsx`): badge "Privado" (`Badge variant=muted`) junto al nombre si `!isPublic`; `showJoin = isMember || isOwner || isPublic` oculta el botón unirse a no-miembros de grupos privados (evita 403/RLS confuso).
- i18n es/en: `groups.{visibility,public,private,privateHint,privateBadge}`. Test nuevo `CreateGroupForm.test.tsx` (3: is_public default true, private→false, visibilidad del hint).
- Privados solo admiten miembros vía owner hasta E45-d (invitaciones). tsc 0, lint 0, **599 passed**.

## E66 — Discover cómic: filtrar publishers occidentales (2026-05-31)

Commit: 4e6e803

- `resolveVolumePublishers(volumeIds)` en `src/lib/api/comicvine.ts`: batch GET `/volumes/?filter=id:{a|b|c}&field_list=id,publisher&limit=100`. El objeto `volume` inline de `/issues/` NO trae publisher (diagnóstico previo confirmado), así que se resuelve aparte. Cache module-level `Map<volumeId,string>` — la relación volumen→editorial es inmutable, solo se piden los ids no cacheados.
- `WESTERN_PUBLISHERS` (15 editoriales) + `isWesternPublisher(name)`: lista blanca, match case-insensitive por substring.
- `getRecentComics(page)`: ahora `limit=100` (offset `(page-1)*100`) para compensar el filtrado — el feed `cover_date:desc` viene saturado de manga. Tras el fetch: extrae volumeIds únicos → `resolveVolumePublishers` → filtra a occidentales → normaliza hasta 20. `total` mantiene `number_of_total_results`.
- `ComicVineIssue.volume` ampliado con `id?: number` en `src/types/media.ts`.
- Tests: `tests/unit/api/comicvine.test.ts` — filtrado occidental vs manga, cap 20, cache no re-fetchea, field_list correcto. tsc 0, lint 0 errores, **544 passed** (536→544).

## E66-COMIC-FICHA — Ficha de cómic vía ComicVine detail (2026-05-31)

Commit: c89c5d0

- `getComic(externalId)` en `src/lib/api/comicvine.ts`: GET `/issue/4000-{id}/` (prefijo de tipo 4000), mismo patrón auth/User-Agent que `searchComics`; lanza si `results` es null.
- `page.tsx`: `comic` añadido a `VALID_TYPES`; ramas comic en `generateMetadata` y `MediaDetailPage` → `getComic` + `normalizeComic`. Sin trailerKey/providers (undefined OK).
- Tests: `tests/unit/api/comicvine.test.ts` (happy path + results null + HTTP !ok). 533→536 passed.

## E66 — AiRecommendations: carátula + navegación a ficha (2026-05-31)

Commit: fe15a2d
- `AiRec` ampliado con `id?`, `posterUrl?`, `mediaUrl?`; `PROMPT_VERSION` v2→v3 (invalida cache vieja).
- `resolveMediaRefs` resuelve cada rec vía `searchByType(searchQuery, type)` tras parsear Claude; un fallo de búsqueda no tumba el resto (Promise.all + try/catch por item).
- Handler ComicVine nuevo: `src/lib/api/comicvine.ts` (`searchComics`, server-only, COMICVINE_KEY) + `normalizeComic` en normalizer + `ComicVineIssue`/`ComicVineSearchResponse` en types. `searchByType` case `comic` deja de devolver `[]`.
- `AiRecommendations.tsx`: href usa `mediaUrl` (fallback `/search?q=`), carátula `<img object-cover>` si hay `posterUrl` (fallback iniciales).
- `mediaUrl` para `comic` queda undefined a propósito (ficha `/media/comic/{id}` aún no existe — ver E66-COMIC-FICHA en BACKLOG).
- Verde: tsc 0, vitest 533/533, lint 0 errores.

## ai-recommendations — Diagnóstico + migración a Anthropic Haiku (2026-05-30)

Commits: 241d4fe, 61288e5, 2293709, cefe91e, [hash-CLAUDE.md], c39879c
- Diagnóstico: endpoint funcionaba, problema era pérdida de contexto auth Supabase en prod
- Fix: pasar supabaseClient desde route.ts a getAiRecommendations → getLibraryContext
- Migración fallida a Gemini (rate limits, truncado de respuesta) → revertido a Anthropic
- Modelo: claude-haiku-4-5 (económico, fiable)
- E66 registrada: carátula + navegación a ficha (pendiente)
- Verificado en local y producción: 5 recomendaciones reales generadas ✅

2026-05-29 | E47 | b64680c, 7e77796, 6d8d8d1, 5bf789b, 049c061, 540d0e7, bec8bc4 | Listas: añadir/quitar título (alcance ampliado vs BACKLOG original). Backend (POST/DELETE /api/lists/[id]) ya completo desde antes. Frontend nuevo: GET /api/lists con filtro `mediaType`, componente `AddToListButton` con modal y filtrado por `media_type` en cliente, integrado en `MediaDetail`, CTA en estado vacío de `ListDetail`. Quitar título ya existía vía botón ✕ en `ListDetail` y se mantuvo verificado. Verificado visualmente por el usuario (escenarios 1/2/3, Regla 11). 530/59 tests verdes. Registro previo de hallazgos en 59701e7 (E61/E62/E63 abiertos por Fase 0 de E47). Alcance ampliado: BACKLOG decía "añadir títulos"; se cubrió añadir + quitar.

---

2026-05-30 | E-AI-GEMINI | 241d4fe | Migrar recomendaciones IA de Anthropic (Claude `claude-sonnet-4-6`) a Google Gemini (`@google/genai` ^2.7.0, modelo `gemini-2.5-flash`, free tier). Motivo: coste. Cambios: quitar `@anthropic-ai/sdk` + añadir `@google/genai` (package.json/lock); `recommendations.ts` import + `new GoogleGenAI({apiKey})` + `models.generateContent({model,contents,config:{maxOutputTokens,systemInstruction}})` + `response.text`, env `ANTHROPIC_API_KEY`→`GEMINI_API_KEY`, comentarios; `route.ts` comentario cabecera; 2 tests re-mockeados a `@google/genai` (forma respuesta `{text}`); CLAUDE.md (Stack, tabla APIs, Env vars, Reglas 1/1b). Firma pública de `getAiRecommendations` intacta → sin cambios en consumidores. `.env.local` con `GEMINI_API_KEY=` (no en git, lo rellena el usuario). tsc EXIT 0, lint 0 errores, 530/59 tests verdes. Hallazgos abiertos: 2 refs ANTHROPIC stale en BACKLOG (líneas 22, 210, tareas no relacionadas) y `ANTHROPIC_API_KEY` aún en `.env.local` — fuera de alcance.

---

2026-05-01 | A1 | (sin commit, trabajo de dashboards) | Migración a sistema nuevo de Supabase API keys (`sb_publishable_*` + `sb_secret_*`). Legacy JWT keys deshabilitadas. App verificada en local + Vercel actualizado.
2026-05-23 | B3.5f-2g-2 | 19a82af | Fila "Pendientes" + empty state en /profile/[username]. Status enum `pending` confirmado. 506 tests green.
2026-05-23 | B3.5f-2h-AMIGOS | 6eccb5a | Pantalla Amigos migrada al DS. FriendCard Button→KButton (primary/secondary/danger), FriendsClient raw buttons→KButton, todos los tokens legacy neutralizados. 506 tests green.
2026-05-25 | B3.5f-2h-LISTAS | 535e726 | Listas migrada al DS. 5 archivos: tokens legacy→canónicos, Button→KButton, accent→accent-positive/danger, badge "Colaborativa" i18n en SC, empty state /lists/[id] con emoji 📋, 0 alias legacy en scope. E46 creada en BACKLOG (MediaCard pendiente). 506/57 green.
2026-05-26 | B3.5f-2h-SUGERENCIAS | 388c8fc | Sugerencias migrada al DS. 2 archivos: tokens legacy→canónicos, button submit→KButton primary, chips rounded-lg→rounded-pill, inputs rounded-lg→rounded-button, text-red-400→text-accent-danger, rounded-xl→rounded-modal, hover:bg-accent-hover→hover:brightness-110 vía KButton. 506/57 green.
2026-05-26 | B3.5f-3 nivel mínimo | 17d7186 + 63e76be | Tokens movimiento (--duration-fast/base/slow + --ease-standard), prefers-reduced-motion WCAG global, active:scale-[0.98] confirmado en KButton (E55 cerrada), FilterBar duration-base explícito, DS §8 especificado. E56 en BACKLOG. E57 cerrada. 506/57 green.
2026-05-27 | B3.5f-4 + E29 | 128990c E60 docs / 389d99f JikanError / 445dcc3 guards fix / 93db7c5 i18n / fe4f3f1 tests | JikanError(.status), guard null-data anime/manga, guard totalItems books, catch 429→rate-limit, fetchErrorKind, fetchDiscoverData extraída a lib/api/discover.ts. 521/58 green. E29 CERRADA.
2026-05-26 | B3.5f-3 nivel medio | 714ffb6 + c537376 + 4cabe88 | Modales (LibraryStatusModal, RecommendModal, CreateListModal): fade+scale entrada @keyframes modal-in/backdrop-in --duration-slow/--ease-standard. Salida diferida (no existe closing-state; reescritura arriesgada). loading.tsx en home/discover/library (E56 cerrada): animate-pulse coherente con layout real, tokens DS. Toast: slide-in/out @keyframes toast-in/out --duration-base, exit state local en SingleToast sin tocar API. FilterChip: active:scale-[0.97]. Tests Toast actualizados (timing +150ms). 506/57 green.
2026-05-26 | B3.5f-2h-CHAT | 8af552f | Chat migrada al DS. 2 archivos: ChatClient.tsx + ConversationClient.tsx. bg-surface→bg-surface-default, bg-surface2→bg-surface-elevated, border-border→border-surface-border, divide-border→divide-surface-border, text-text→text-text-primary, text-muted→text-text-secondary, bg-accent→bg-accent-positive, text-white(acento)→text-on-accent-positive, hover:bg-accent-hover→hover:opacity-90, hover:bg-surface2→hover:bg-surface-elevated, focus:ring-accent→focus:ring-accent-positive, placeholder-muted→placeholder-text-tertiary. hover:text-accent(username link)→hover:text-accent-info (enlace=azul, regla dura). rounded-xl(paneles)→rounded-[8px], rounded-lg(friend-picker items)→rounded-[10px]. "+ Nueva conversación" → KButton primary sm. Botón enviar circular: swap manual (no KButton). rounded-2xl burbujas, rounded-full input/botón: intactos. Lógica Realtime, fetch, optimistic update: intactos. E52+E53 en BACKLOG. 506/57 green.
2026-05-25 | B3.5f-2h-NOTIF | b40c518 | Notificaciones migrada al DS. 2 archivos: bg-surface→bg-surface-default, border-border→border-surface-border, divide-border→divide-surface-border, text-text→text-text-primary, text-muted→text-text-tertiary, hover:text-accent→hover:text-accent-info (enlaces azules DS §1), Sparkles text-accent→text-accent-info, bg-accent/5→bg-accent-positive/5 (fondo no-leída). i18n completo (sin literales sueltos). 506/57 green. E48 en BACKLOG. 5 archivos: tokens legacy→canónicos, Button→KButton, accent→accent-positive/danger, badge "Colaborativa" i18n en SC, empty state /lists/[id] con emoji 📋, 0 alias legacy en scope. E46 creada en BACKLOG (MediaCard pendiente). 506/57 green.

---

2026-05-01 | A2 | (sin commit, verificación) | .gitignore ya contenía `.claude/` (línea 42). 4 checks pasan: .claude/ ignorado, no trackeado, sin secretos en archivos trackeados, sin tokens en historial git.

---

2026-05-01 | A3 | (sin commit, dashboards externos) | Rotadas claves de Anthropic, TMDB, RAWG, Google Books y ComicVine. Valores nuevos en .env.local + Vercel. App verificada con npm run dev: TMDB/RAWG/Books/Anthropic OK.

---

2026-05-01 | A4 | (sin commit, verificación) | Diagnóstico: código y .env.local ya estaban unificados sin NEXT_PUBLIC_ para claves server-only (4/4 leídas correctamente: TMDB, RAWG, GOOGLE_BOOKS, ANTHROPIC). COMICVINE_KEY existe en env pero no se lee en src/ porque la integración no está implementada (E6).

---

 2026-05-01 | B1-A | a519684 | Limpiar tests huérfanos (3 tests sobre componentes 
       inexistentes borrados, 1 test de @/lib/env movido a _pending) + sincronizar 
       mock de queries.test.ts con .order(). Descubierto: 4 tests pre-existentes 
       fallando en register-form (no relacionados con B1-A).

---

2026-05-02 | B1-B+B1-C | 6f987bc | CI verde en GitHub Actions (lint, typecheck, test, build). Fixes en camino: Node 24 (lock file mismatch), button.tsx case-sensitivity (Linux CI), signOut mock faltante en register-form tests. B1-C absorbida.

---

2026-05-02 | A5 | 0986cec (HEAD post-rewrite) | Versionar estado del proyecto en 13 commits temáticos (A5.1→A5.13) + reescritura de identidad de los 22 commits (placeholder → benevi <victor_franco@hotmail.es>) + push a https://github.com/benevi/kultura (privado). 14 commits totales en master, ~14K líneas netas, 0 errores nuevos de TypeScript, working tree vacío. Hashes finales de cada subtarea: A5.1 4227f4d, A5.2 58798fb, A5.2-bis 7d90197, A5.3 4e49b6c, A5.4 496f315, A5.5 7e16206, A5.6 56753a4, A5.7 10068be, A5.8 424525d, A5.9 7d3bb23, A5.10 28570b2, A5.11 7e30637, A5.12 ec0f403, A5.13 0986cec. Decisiones: A5.10 absorbió refactor cn + 3 consumidores (Button, MediaCard, MediaGrid) por atomicidad; supabase/.temp/ ignorado en .gitignore; docs/_archive/ preservado como referencia histórica.

---

2026-05-03 | B2 | (pendiente de commit) | Baseline SQL versionada recuperada en `supabase/migrations/20260502233945_remote_schema.sql` (~32 KB, 17 tablas, 49 RLS policies, 4 funciones trigger). Camino: actualizar Supabase CLI 2.78.1 → 2.95.4, re-link al proyecto `app movies` (ref `zfrbyphzvfuvejdwjfea`), `supabase migration repair --status reverted 20260502155455` para limpiar entrada huérfana del intento fallido del 2026-05-02, `supabase db pull --schema public` exitoso. Verificación contra `db_snapshot.txt` (7 secciones) sin discrepancias. Verificación de reproducibilidad con postgres puro (Plan B): SQL sintácticamente válido, todas las DDLs principales aplican sin error real. Verificación con stack Supabase completo (`supabase db reset` local) bloqueada por degradación de Docker Desktop (`input/output error` persistente tras restart) → queda en B2-VERIFY.

---

2026-05-03 | B2-DOC | (pendiente de commit) | `supabase/migrations/README.md` creado (cómo aplicar baseline, política de migraciones, advertencia de no-`db push` sobre baseline). Tipos completos en `src/types/supabase.ts` para las 7 tablas previamente sin tipar. Marcadores `[POR VERIFICAR EN B2]` en CLAUDE.md NO actualizados — discrepancia detectada en `group_members.role` (real: `'owner' | 'member'`; CLAUDE.md inferido: `'owner' | 'admin' | 'member'`); decisión separada en B2-DOC-CLAUDE.

---

2026-05-03 | E17 | (pendiente de commit) | Añadidas interfaces `DbSuggestion`, `DbConversation`, `DbConversationMember`, `DbMessage`, `DbGroup`, `DbGroupMember`, `DbGroupPost` en `src/types/supabase.ts` + entradas en mapa `Database`. `npm run type-check` exit 0. Refactor de los `as unknown as Array<{...}>` ad-hoc queda en E19.

---

2026-05-03 | B2-DOC-CLAUDE | (pendiente de commit, absorbida en commit B2) | CLAUDE.md actualizado con SQL canónico confirmado: marcadores `[POR VERIFICAR EN B2]` eliminados, `group_members.role` corregido a `'owner' | 'member'` (rol `admin` no existe en CHECK constraint), `users.bio` documentada (columna existía en BD pero no en docs), cuerpos de las 4 funciones trigger confirmados y documentados.

---

2026-05-03 | B4 | (sin commit — operación fuera del repo) | Zip `kultura-backup-2026-05-01.zip` (280.4 MB, 30876 archivos) auditado en sesión B3. Contenía `kultura\.env.local` con credenciales reales y vigentes idénticas al `.env.local` actual. Tras verificación de 6 puntos por el usuario (no OneDrive, no Google Drive, no compartido, no segunda máquina, no backup automático en la nube), confirmado que el zip nunca salió de la máquina. Decisión: NO rotar claves. Zip borrado por el usuario con `Remove-Item -Force`. Carpeta temporal de auditoría `C:\temp\kultura-zip-audit` eliminada.

---

2026-05-03 | C4 | (pendiente de commit) | Rate-limit aplicado en 6 endpoints sin proteger: `POST /api/chat` (10/h), `POST /api/chat/[id]` (10/min), `GET /api/chat/[id]` (60/min), `POST /api/groups` (5/h), `POST /api/suggestions` (3/h), `GET /api/users/search` (30/min). `LIMITS` en `src/lib/rate-limit.ts` extendido con 6 nuevos presets. 6 tests nuevos añadidos en `tests/unit/rate-limit/rate-limit.test.ts` (18 total, todos green). Todos los endpoints devuelven HTTP 429 + `Retry-After` al superar cuota.

---

2026-05-03 | B3-headers | (pendiente de commit) | `next.config.mjs` actualizado: añadidos `Strict-Transport-Security: max-age=31536000` (conservador, verificar si Vercel ya lo añade) y `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`. CSP enforce existente sin cambios. Auditoría de dominios externos: sin gaps detectados (APIs externas son server-side, no browser-fetch). `npm run build` ✅, `tsc --noEmit` ✅, `vitest run` 493/493 ✅.

---

## B3 — Hardening de seguridad básico (cerrado 2026-05-03)

- Rate-limit añadido a 6 endpoints (4 planificados + 2 detectados durante implementación): POST /api/chat, POST /api/chat/[id], GET /api/chat/[id], POST /api/groups, POST /api/suggestions, GET /api/users/search.
- Headers de seguridad: Permissions-Policy añadido en next.config.mjs. HSTS gestionado por Vercel (verificado, no se duplica). CSP enforce ya existía con 'unsafe-inline' (ver C5/C7).
- Auditoría de zip backup: limpia, borrado.
- Documentos generados: docs/B3_DEPLOY_PLAN.md.
- BACKLOG: cerradas B4-zip y C4. Añadidas C5, C6, C7, C8.
- Tests: 487 → 493 (+6 tests del rate-limit).
- Commits: 224dcac, 03e4c29, b9e941f.
- Verificación post-deploy: headers OK, consola limpia, sin warnings CSP.
- Hallazgo colateral: app en estado funcionalmente incompleta a nivel UI/UX (no causado por B3; preexistente). Motiva el sprint B3.5.

---

## B3.5a — Auditoría UI/UX por código (cerrado 2026-05-03)

- Inventario sistemático de 17 rutas, 49 componentes, 19 endpoints.
- 0 endpoints huérfanos, 0 llamadas huérfanas.
- 18 strings hardcodeados en español detectados en 4 componentes de Home.
- Hallazgo: chat, lists y suggestions no enlazados desde NavLinks ni BottomNav.
- Documento: docs/UI_AUDIT.md (commit 9f4e1f5).

---

## B3.5b — Verificación visual del usuario (cerrado 2026-05-04)

- Pase visual por los hallazgos de B3.5a + componentes "necesita verificación".
- 5 flujos rotos en runtime: chat (POST 500), GroupFeed, /en/home (switcher no cambia idioma), /notifications, paginación de Discover.
- 2 flujos OK: settings, library (con nota de mejorar filtros).
- Hallazgos anotados en la sección "Recomendaciones" de docs/UI_AUDIT.md.

---

## B3.5e-1 — Proyecto Supabase de test aprovisionado (cerrado 2026-05-05)

- Proyecto `kultura-test` (ref: `xqvicvypoxxfbezqnkwr`) configurado como entorno aislado de tests.
- Baseline `20260502233945_remote_schema.sql` aplicada vía `supabase db push --db-url` (Opción A, sin desvincular producción). Verificada: 17 tablas / 49 RLS policies / 4 trigger functions / RLS 17/17.
- `vitest.integration.config.ts` corregido: añadido `loadEnv` de Vite para que `.env.local` se cargue en tests de integración (bug pre-existente).
- Tests de integración: `supabase-clients` 4/4 verde. `friends`, `rls-policies`, `library-upsert`, `trigger` fallan por falta de usuarios pre-creados — esperado (B3.5e-2).
- Hallazgo: Supabase rechaza dominio `@kultura.test` en signUp (`email_address_invalid`). Resolver en B3.5e-2 usando `@example.com` o configurando el proyecto de test.
- Documentación: `docs/B3_5e_TEST_ENV.md` creado, `CLAUDE.md` actualizado con `SUPABASE_TEST_SERVICE_ROLE_KEY`.

---

## B3.5d — Diagnóstico estructural (cerrado 2026-05-04)

- Auditoría de coherencia interna del código en 10 áreas.
- Veredicto: 🟡 base sólida con 2 inconsistencias reales (validación heterogénea + tests con cobertura cero en flujos críticos UI).
- Lo que está bien: cliente Supabase, auth+RLS, server/client components, manejo de errores HTTP, rate limiting, tests de integración DB.
- Lo que falta: tests E2E de UI (0 escritos), src/lib/social/groups.ts (no existe; lists.ts sí), normalización de validación, error handling en GroupFeed/ConversationClient.
- Documento: docs/STRUCTURAL_AUDIT.md.
- Recomendación adoptada por el usuario: meter B3.5e (red de seguridad) antes de los fixes en B3.5c-1.

---

2026-05-05 [B3.5e-2] Script de seed automatizado para tests E2E — a32c19d

---

2026-05-05 [B3.5e-3-local] Specs E2E ejecutados en local; 0/9 verdes esperados, 0/9 rojos esperados — bloqueado por H1 (login vs prod Supabase) y H3 (discover vacío globalmente). 2 fixes mecánicos: loadEnvConfig en playwright.config.ts + playwright artifacts en .gitignore — 7f9479a

2026-05-05 [B3.5e-3-local-FIX] Doble env para E2E (NEXT_PUBLIC_SUPABASE_* → kultura-test) + 3 fixes mecánicos de tests. Resultado: bug 1 (chat) ROJO-ESPERADO; bugs 3/4/5 VERDE-INESPERADO; bug 6 (discover) H3 pendiente diagnóstico — a9a8651

---

2026-05-06 [B3.5c-1] Diagnóstico de los 6 bugs detectados en B3.5b — 359d0dd

---

2026-05-06 [B3.5c-2] UX mecánico: navegación + i18n Home + comic oculto — 3067802

---

2026-05-06 [B3.5c-3] Fixes bugs 1,4,5,6 + refuerzo tests E2E — 232ef07

---

2026-05-06 [B3.5c-3-CLOSE] Cierre B3.5c-3: i18n banner + migration prod + 3 verdes E2E + 2 deudas spec → BACKLOG (E25, E26) — 72ce003

---

2026-05-07 [B3.5c-3-FIX2] Fix recursión RLS conversation_members + limpieza diagnóstico — 3703fe4

---

2026-05-07 [B3.5c-3-FIX3] Fix recursión policy SELECT conversation_members — 92aa455

---

2026-05-11 [B3.5c-3-FIX4] Fix idempotencia password en seed-test.mjs (findOrCreateUser sincroniza con .env.local) — 0bc9b4c

---

2026-05-11 [B3.5c-3-CLOSE-FINAL] Cierre definitivo B3.5c-3 tras sub-saga FIX2/FIX3/FIX4 + verificación manual exitosa kultura-test. Bugs 1,4,5,6 cerrados. Deuda E27-E33 anotada en BACKLOG. Próximo: B3.5g-AUDIT-RLS-1 — e4589a8

---

2026-05-12 [B3.5g-AUDIT-RLS-1] AUDIT-1 cerrado: 46🟢 / 3🟡 / 0🔴, refactor planificado en AUDIT-2 (dedup users UPDATE + evaluar conversations INSERT) — 02ab06c

---

2026-05-12 [B3.5g-AUDIT-RLS-2] db: dedupe users UPDATE + harden conversations INSERT — ef0d1d9

---

2026-05-12 [B3.5g-AUDIT-RLS-2] docs: E34-E36 en BACKLOG, NOW como TBD, DONE actualizado — 541a3b2

---

2026-05-12 [B3.5g-AUDIT-RLS-2-E2E] test(e2e): E37 cerrada — port hardcodeado en auth.spec.ts sustituido por baseURL de Playwright — f7e15be

---

2026-05-12 [B3.5g-AUDIT-RLS-2-E2E] docs: E37✅ E38/E39/E40 anotadas, cierre AUDIT-2 con hallazgos colaterales. auth.spec.ts verde (18/18). chat-send.spec.ts falla en selector E26 (preexistente), no en INSERT de conversación — NO es regresión de AUDIT-2. E39 prioridad ALTA para B3.5h-AUDIT-E2E — 281cd12

---

### B3.5h-AUDIT-E2E-1 — ✅ DONE

**Commits:**
- 723a91b — `[B3.5h-AUDIT-E2E-1] docs: inventario E2E — crear docs/E2E_AUDIT.md`
- 9da3552 — `[B3.5h-AUDIT-E2E-1] docs: actualizar NOW, BACKLOG, DONE tras AUDIT-E2E-1`

**Output:** `docs/E2E_AUDIT.md`.

**Métrica clave:**
- 6 specs auditados, 17 declaraciones `test(...)` (34 corridas chromium+mobile).
- 🟢 2 specs / 8 tests verdes (47% red E2E sólida).
- 🟡 3 specs / 8 tests con sospecha.
- 🔴 1 spec / 1 test falso verde estructural confirmado.
- ⚪ 0.

**Hallazgos críticos:**
- **E40 confirmado** (`auth.spec.ts:81`): assert OR de 3 ramas donde
  `/correo/i` coincide siempre con texto del formulario. Falso verde.
- **E39 confirmado** (`playwright.config.ts:50`): `reuseExistingServer:
  !process.env.CI` permite bypass de `webServer.env` por dev server
  externo. Recomendación audit: opción (b) puerto `:3001`.
- **E26 sin resolver** (`chat-send.spec.ts:27`): selector frágil
  confirmado, propuesta `data-testid="friend-picker-item"`.

**Hallazgos colaterales:** E41, E42, E43, E44 añadidos a BACKLOG.

**Próximo:** B3.5h-AUDIT-E2E-2 con orden propuesto en NOW.

---

### B3.5h-AUDIT-E2E-3 — ✅ DONE

**Commits:**
- 0514c72 — `[B3.5h-AUDIT-E2E-3] docs: diagnostico de rojos persistentes — crear docs/E2E_AUDIT_3.md`
- b8d94e0 — `[B3.5h-AUDIT-E2E-3] docs: actualizar NOW, BACKLOG, DONE tras AUDIT-E2E-3`

**Output:** `docs/E2E_AUDIT_3.md`.

**Métricas E2E:**
- Baseline: 24 passed / 10 failed (confirmado — coincide con expectativa).
- Rojos diagnosticados: 10 / 10.
- Causas raíz distintas: 2.

**Causa E40 (2 corridas):** `supabase.auth.signUp({ email: "test_<ts>@kultura-test.dev" })` retorna error. El componente entra por el path `if (error)` → `form.error` set → formulario permanece visible sin mensaje de éxito ni redirect. Causa probable: dominio `@kultura-test.dev` rechazado por Supabase (H-E40-B, requiere verificación en Dashboard por el humano). Fix propuesto: cambiar `auth.spec.ts:3` a `@example.com`.

**Causa DISC (8 corridas):** `/es/discover` está dentro del route group `(app)`. El layout `(app)/layout.tsx:13` redirige a `/login` si no hay sesión. El spec de discover navega sin login previo → redirect → página de login renderizada → cero cards → todos los asserts fallan. E41 (Jikan RSC mock no viable) sigue en BACKLOG pero NO es la causa del rojo actual. Fix propuesto: añadir `login()` en `beforeEach` del spec (ya documentado en E25).

**Hallazgos colaterales:**
- Nota en DONE.md de AUDIT-E2E-2 sobre TMDB/discover era incorrecta (hipótesis de API keys, no verificada con page snapshot).
- `discover-pagination.spec.ts:11` tenía comentario erróneo ("NO requiere credenciales: /discover es pública") — la ruta está protegida por auth desde el inicio.
- Verificación de H-E40-B requiere acción del humano en Dashboard de Supabase kultura-test.

---

### B3.5h-AUDIT-E2E-2 — ✅ DONE

**Commits:**
- 54d183f — `[B3.5h-AUDIT-E2E-2] test(e2e): aislar webServer de Playwright en puerto :3001 (E39)`
- 17290c6 — `[B3.5h-AUDIT-E2E-2] test(e2e): data-testid estable en picker de amigos (E26)`
- eba7afa — `[B3.5h-AUDIT-E2E-2] test(e2e): assert real en successful registration (E40)`
- 51ddcc0 — `[B3.5h-AUDIT-E2E-2] test(e2e): eliminar antipatron OR+.first() en specs (E43)`
- 7107cab — `[B3.5h-AUDIT-E2E-2] test(e2e): documentar bloqueante E41 (Jikan mock no viable via page.route RSC)`
- 22c2ee3 — `[B3.5h-AUDIT-E2E-2] test(e2e): limpiar BASE redundante en auth.spec.ts (E42)`

**Métricas E2E:**
- Antes: 24 passed / 10 failed
- Después: 24 passed / 10 failed (mismo count, distinta composición)
- `chat-send` pasó de FAILED → PASSED (+1 test real verde)
- `auth.spec.ts` "successful registration" pasó de VERDE-FALSO → ROJO-REAL (falso verde eliminado)
- `discover-pagination` sigue fallando — causa raíz: APIs externas (TMDB/Jikan) se llaman server-side en RSC, no mockeable con `page.route()`

**Hallazgos / Discrepancias:**
- E41 bloqueado: `page.route()` intercepta solo browser requests; Jikan/TMDB son server-side. Fix real requiere mover fetches a Route Handlers. Documentado en spec.
- E40 ahora falla "legítimamente": kultura-test Supabase rechaza o no auto-loguea el registro con email `@kultura-test.dev`. El test detecta el fallo real en lugar de enmascararlo.
- `discover-pagination` falla incluyendo "tab movie" (TMDB): indica que las API keys de TMDB están presentes en `process.env` del proceso Playwright (heredadas de `.env.local`) pero el server de test las usa. El fallo es de los resultados (grid vacío), posiblemente por configuración del proyecto test o TMDB rate-limit en `:3001`.

**Próximo:** Decidir entre B3.5e-3-prod, B4, E41-redesign, o E44 (ver NOW.md). Pendiente: promoción manual del deploy a Production: Current (E44 vigente).

---

### B3.5h-AUDIT-E2E-4 — ✅ DONE

**Fecha:** 2026-05-14

**Commits:** 8f35bb2 (specs), 88f0d99 (docs)

**Métricas E2E:**
- Antes: 24 passed / 10 failed
- Después: **32 passed / 2 failed**
- 8 rojos de discover-pagination → verdes (Fix H2)
- 2 rojos de successful registration → rojo legítimo documentado (Caso C)

**Fix H2 — RESUELTO:**
`tests/e2e/b3_5e_safety_net/discover-pagination.spec.ts`: añadido `import { login }` + `test.beforeEach(login)`. La ruta `/discover` está dentro del route group `(app)` cuyo layout redirige a `/login` sin sesión — el spec nunca había autenticado. Comentario erróneo ("NO requiere credenciales") corregido. Helper `login()` reutilizado de `_helpers.ts` (ya existía). E25 cerrada.

**Fix H1 — PARCIAL / CASO C:**
`auth.spec.ts:3`: dominio `@kultura-test.dev` → `@example.com` (Supabase ya acepta el email). Test de registro usa email único por ejecución (`test_reg_${Date.now()}_${random}@example.com`). Aun así, el test falla: rate-limit global de Supabase kultura-test (free tier) activa en suite paralela — "Demasiados intentos" incluso con email nuevo y único. Los fixes están aplicados correctamente; la inestabilidad es del entorno, no del código. E40 permanece abierto con opciones de fix definitivo documentadas en `docs/TEST_EXCEPTIONS.md`.

**Paso 0 (verificación H1):**
La hipótesis del plan (email `test-user-a@example.com` duplicado en `auth.users`) no aplicaba: el spec usa `TEST_EMAIL` generado dinámico con `Date.now()`, no `TEST_USER_EMAIL`. La causa raíz real era el dominio `@kultura-test.dev` rechazado + rate-limit global (descubierto tras el fix del dominio).

**Documentos creados:**
- `docs/TEST_EXCEPTIONS.md` — E40 documentado como rojo legítimo con opciones de fix definitivo.

**Discrepancias / hallazgos:**
- El plan asumía verificación psql de `TEST_USER_EMAIL` en `auth.users` (hipótesis: email duplicado). La causa real era dominio rechazado + rate-limit global. Se reportó antes de ejecutar — humano confirmó proceder con fix directo.
- Rate-limit de Supabase free tier es global por IP/proyecto en suite paralela. Email único no es suficiente cuando hay múltiples signUps en poco tiempo.
- Auth Logs de kultura-test no fueron verificados en Dashboard (no se tuvo acceso en este bloque). Si el humano los revisa, podría confirmar el rate-limit y ajustar el límite desde Dashboard → Authentication → Rate Limits.

---

### B3.5h-AUDIT-E2E-5 — ✅ DONE

**Fecha:** 2026-05-14

**Commits:** b49e09b (test/docs E40), 1f5cfda (docs NOW/BACKLOG/SUPABASE_TEST_SETUP)

**Métricas E2E:**

- Antes: 32 passed / 2 failed
- Después: **34 passed / 0 failed**
- E40 (successful registration × chromium + mobile) → verdes

**Fix E40 — RESUELTO:**
Acción humana en Dashboard de kultura-test: Authentication → Sign In / Providers → Email → "Confirm email" desactivado. `supabase.auth.signUp()` ahora devuelve `data.session` no-nulo → `router.push('/home')`. El rate-limit de 2 emails/h del plan free deja de aplicar porque ya no se emiten emails de confirmación.

**Refactor de specs — NO necesario:**
Paso 0 confirmó que ambas validaciones de error (`mismatched passwords`, `short password`) son 100% client-side (`validate()` en `handleSubmit` antes de llamar a Supabase). Los tests ya hacen click en submit pero nunca llegan a la red — correctos. El spec de `successful registration` ya tenía lógica dual (waitForURL /home + fallback "Revisa tu correo") — funcionó sin cambios.

**Discrepancias / hallazgos:**

- El spec no necesitó ningún cambio de código. El fix fue 100% config de Dashboard.
- Sub-saga E2E (AUDIT-E2E-1 → AUDIT-E2E-5) cerrada.

**Documentos creados/actualizados:**

- `docs/SUPABASE_TEST_SETUP.md` — nuevo: config de kultura-test que vive solo en Dashboard.
- `docs/TEST_EXCEPTIONS.md` — E40 marcado RESUELTO con hash b49e09b.
- `docs/BACKLOG.md` — E40 marcada [x].
- `docs/NOW.md` — B3.5h-AUDIT-E2E-5 cerrado, opciones siguientes listadas.

---

2026-05-20 | B3.5h-AUDIT-E2E-5 | 1f5cfda | Sub-saga E2E completa: 34/34 passed. E40 resuelto via Dashboard kultura-test (Confirm email desactivado). NOW.md actualizado a B3.5f-1.

---

2026-05-20 | E36 (fix /api/chat 500) | absorbido en B3.5c-3 | Fix conversación POST 500 + recursión RLS conversation_members. Cerrado en B3.5c-3-FIX2/FIX3. Ver commits 3703fe4, 92aa455.

---
- [B3.5f-1] Sistema de diseño base: tokens semánticos (surface/text/accent), 
  fuentes Space Grotesk + Inter (next/font), 4 componentes core 
  (ContentCard, KButton, FilterChip, KInput), página /dev. 
  Commits: 0386cea, f6ca683, 0554db7, + FIX2 estilos. Verificado visualmente.
- [B3.5f-FIX] Reconciliación migraciones: CLI re-vinculada a producción, 
  20260520000001 registrada en schema_migrations de prod, NOTIFY pgrst añadido.
2026-05-20 | B3.5f-2a | 31d510c | Migración Home a tokens semánticos + estados vacíos. HeroSection, MediaRow, AiRecommendations, PopularInCircle migrados. KButton en CTAs. Iconos + mensajes + acción verde en cada estado vacío.
2026-05-20 | B3.5f-2a-FIX | 06a65c9 | Chrome de marca migrado: wordmark verde, badge notif verde, BottomNav activo verde, Avatar fallback surface-elevated. Home auto-create default #6FCF97.

2026-05-20 | B3.5f-2a-FIX-2 | 1de8010 | BottomNav y AuthHeader: cristal eliminado, fondo bg-surface-default opaco, borde border-surface-border. Rojo ya migrado en 06a65c9.

2026-05-22 | B3.5f-2b | d2ca0c2 | Library migrada a tokens semánticos. FilterChip reemplaza FilterBar legacy. Estados vacíos (biblioteca total + filtro activo) con icono + título + subtítulo + KButton verde. LibraryAction statusColors a tokens. LibraryStatusModal → KButton + KInput. EpisodeProgress → focus-visible:ring-accent-positive. Test badge /green/ → /accent-positive/. Claves i18n empty.hint + empty.filteredHint añadidas (es/en).

2026-05-22 | B3.5f-2b-FIX-chrome | 7458dd0 | Rojo legacy residual en chrome migrado a verde: (a) Avatar fallback: LEGACY_RED #E82020 remapeado a var(--accent-positive) en Avatar.tsx (el valor real viene de DB/trigger — el default prop no bastaba). (b) NavLinks puntito activo: bg-accent (rojo legacy) → bg-accent-positive. Bonus: AppFooter hover:text-accent → hover:text-accent-positive; Header.tsx wordmark text-accent → text-accent-positive. Test nuevo: remap de #E82020 a --accent-positive. Vitest 500/500.

2026-05-22 | B3.5f-2c | 476d279 | Login/Auth migrado al sistema de diseño. Wordmark verde (text-accent-positive). Botones → KButton (loading prop añadida). Inputs → KInput (focus verde, error --accent-danger). Tabs → bg-accent-positive activo. Forgot-password → text-text-secondary. Errores semánticos → bg-accent-danger/10 text-accent-danger. Superficies → bg-surface-elevated + rounded-modal + border-surface-border. Button/input legacy retirados del scope de /login. Vitest 500/500.

2026-05-22 | B3.5f-2d | e2cf606 + f06ff9c | Settings migrada al sistema de diseño. Chore (e2cf606): 6 tests de KButton.loading añadidos (506 total). Feat (f06ff9c): Button → KButton, Input → KInput, tabs idioma → bg-accent-positive + rounded-pill, zona de peligro → surface-default neutro sin rojo hardcoded, avatar ring → ring-accent-positive, secciones → rounded-modal + border-surface-border. Vitest 506/506.

2026-05-22 | B3.5f-2e | 9b6c70e | Landing pública y header público migrados al sistema de diseño. Botones hero/CTA (×3) Button legacy → KButton primary/secondary (verde marca). Botón "Registrarse" header → KButton primary. Botón "Iniciar sesión" header → KButton secondary. 4 iconos features text-accent (rojo) → text-accent-positive (verde). Wordmark ya era text-accent-positive, no tocado. Landing es estática (sin formularios). Vitest 506/506.

2026-05-22 | B3.5f-DEBUG-DOC | 5d6443a | docs/DEBUG_PRINCIPLES.md creado (4 principios de depuración destilados de ~13 ocurrencias reales). Regla 12 añadida en CLAUDE.md enlazando el doc. Sin cambios de código, sin lint/tsc/vitest necesarios.

2026-05-22 | B3.5f-2f | 007b7db | Error boundaries + páginas de error unificadas al design system. 11 error.tsx → wrappers finos sobre ErrorState.tsx (KButton secondary, verde, sin rojo legacy). not-found.tsx creado ([locale] level, i18n es/en). global-error.tsx creado (root, autosuficiente, inline styles con tokens). --primary no tocada. Vitest 506/506.

2026-05-22 | B3.5f-2f-FIX | cc60bc3 | Causa raíz: not-found.tsx de 2f vivía solo en [locale]/ — nunca se disparaba para rutas inexistentes porque Next.js App Router busca not-found.tsx en el segmento raíz, no en [locale]/. Fix mínimo: (1) src/app/[locale]/[...rest]/page.tsx catch-all llama notFound() → dispara [locale]/not-found.tsx para /es/asdfgh. (2) src/app/not-found.tsx raíz para /asdfgh (sin locale). (3) NotFoundContent.tsx componente compartido para no duplicar markup. globals.css importado en root layout.tsx. Verificado: /es/asdfgh y /asdfgh → 404 de marca. Vitest 506/506.

2026-05-23 | B3.5f-2g | 87beaf0 + 2e0a2c0 + 391145c + c4c227e | Profile (/profile/[username]) migrado al design system. Commits: (87beaf0) ProfileBio: bg-accent/ring-accent → accent-positive, botones Guardar/Cancelar → KButton; ProfileHeader: bg-surface/text-text/border-border → tokens canónicos, borde añadido; ProfileStats: bg-surface2 → surface-elevated, text-muted → text-secondary/tertiary; ProfileGenres: ídem; page.tsx: link "Editar perfil" → KButton asChild secondary; FriendshipButton: Button legacy → KButton, red-400 → accent-danger (semántico destructivo); ReportButton: Button legacy → KButton, bg-bg → surface-base, ring-accent → ring-accent-positive, red-400 → accent-danger, label prop eliminado, strings → useTranslations('report'). (2e0a2c0) loading.tsx: skeleton completo (header card, 2 filas media, stats grid, chips géneros). (391145c) feat(i18n): namespace 'report' en es.json + en.json con paridad (label/prompt/placeholder/error/cancel/submit/sent). (c4c227e) test: ProfileGenres test bg-surface2 → bg-surface-elevated. Verificado con Playwright: perfil propio (Editar perfil KButton visible, 0 bg-accent E82020, 0 bg-surface2), bio edit (Save=bg-accent-positive), perfil ajeno (FriendshipButton + ReportButton visibles, dialog bg-surface-base), not-found (404 página de marca), color audit (0 elementos con computed E82020). Vitest 506/506.

---

## B3.5f-4 — Discover: hardening funcional + migración visual (COMPLETO) ✅

**Fecha cierre:** 2026-05-27

**Fase A — Hardening funcional (commits: 914436c, 4eafd0e, 128990c, 389d99f, 445dcc3, 93db7c5, fe4f3f1):**
- `JikanError` tipado con `.status` para distinguir 429 de errores genéricos.
- Guards `Array.isArray` en datos anime/manga; guard `totalItems` en books.
- `catch` distingue 429 → banner `"rate-limit"` vs resto → banner `"generic"`.
- `fetchDiscoverData` extraída a `lib/api/discover.ts` (testeable, desacoplada del RSC).
- i18n: clave `errors.rateLimit` añadida en `es.json` + `en.json`.
- E29 (TypeError anime/manga en Discover): **CERRADA**. Ver entrada E29 en BACKLOG.
- 521 tests / 58 archivos — verdes.

**Fase B — Migración visual al DS (commits: 94d9870, 38cd520):**
- Banner de error: tokens legacy → `accent-danger` (rojo semántico DS).
- `DiscoverClient`: tokens legacy → `accent-info` (azul semántico DS).
- `MediaGrid` ya migrado al DS (hallazgo: no requería cambios).

**Hashes en orden:** 914436c · 4eafd0e · 128990c · 389d99f · 445dcc3 · 93db7c5 · fe4f3f1 · e962be0 · 94d9870 · 38cd520
