# Matriz de trazabilidad (Fase A)

> **Qué es esto.** El inventario de TODO lo que la documentación debe explicar. Cada fila es un
> elemento que tiene que aparecer en algún capítulo. En la Fase C, un script comprobará que no
> queda ninguna fila huérfana: así garantizamos que no se pierde información.
>
> Generado por `scripts/docs/build-trazabilidad.py` — no editar a mano; reejecutar el script.
> La columna *Capítulo* es una **propuesta automática** (por palabras clave); se revisa en la Fase B.
> `11 + ?` = va seguro al capítulo 11 (historia); el capítulo temático está por asignar.

## Resumen de fuentes

| Fuente | Cantidad |
|---|---|
| Commits en git | 386 (2026-04-12 → 2026-09-13) |
| Commits con ID de tarea | 290 |
| Commits sin ID (merges, docs sueltos…) | 96 |
| Tareas / épicas distintas (ID raíz) | 153 |
| Docs de proceso borrados en `ab8eb4e` (recuperables) | 76 |
| Endpoints de API (`route.ts`) | 25 |
| Páginas (`page.tsx`) | 21 |
| Migraciones SQL | 13 |
| Tablas creadas en migraciones | 18 |
| Módulos `src/lib` | 45 |
| Componentes `src/components` | 67 |
| Ficheros de test | 119 |

**Hueco conocido:** entre el 2026-04-12 (SPEC-001…007) y el 2026-05-02 casi no hay commits; ese
periodo solo está contado en `ESTADO_PROYECTO.md`, `_archive/AUDIT_2026-04-23.md` y los
`agents-old/` — el capítulo 11 debe reconstruirlo desde ahí.

## A. Tareas y épicas

Estado: según BACKLOG/DONE antiguos. *Fuentes*: dónde aparece. *Commits*: nº y rango de fechas.

| ID | Título | Estado | Fuentes | Commits | Fechas | Capítulo |
|---|---|---|---|---|---|---|
| A1 | Rotar credenciales Supabase comprometidas | hecha | BACKLOG, DONE | 0 | — | 11 + 05 |
| A2 | Verificar y reforzar .gitignore + ausencia de secretos en historial | hecha | BACKLOG, DONE | 0 | — | 11 + 09 |
| A3 | Rotar el resto de claves API por higiene | hecha | BACKLOG, DONE | 0 | — | 11 + ? |
| A4 | Sincronizar nombres de variables entre local y Vercel | hecha | BACKLOG, DONE | 0 | — | 11 + 09 |
| A5 | Versionar el estado actual del proyecto (commits temáticos + remoto GitHub) | hecha | BACKLOG, DONE, git | 14 | 2026-05-01 → 2026-05-02 | 11 + ? |
| A6 | Auditoría de coherencia repo vs disco | pendiente | BACKLOG | 0 | — | 11 + ? |
| AUDIT-FIX | Batch de correcciones de una auditoría read-only (seguridad/funcionalidad/diseño/higiene). | hecha | DONE | 0 | — | 11 + 05 |
| B1 | Limpiar tests rotos huérfanos | hecha | BACKLOG, DONE, git | 10 | 2026-05-01 → 2026-05-03 | 11 + 08 |
| B2 | Migraciones SQL versionadas | hecha | BACKLOG, DONE, git | 1 | 2026-05-03 → 2026-05-03 | 11 + 04 |
| B3 | next.config.mjs actualizado: añadidos Strict-Transport-Security: max-age=31536000 (con | hecha | DONE, git | 2 | 2026-05-03 → 2026-05-03 | 11 + 05 |
| B3.5a | docs: auditoría funcional UI/UX por código  | — | git | 1 | 2026-05-03 → 2026-05-03 | 11 + 07 |
| B3.5c | docs: diagnóstico de los 6 bugs detectados en B3.5b | — | git | 22 | 2026-05-06 → 2026-05-12 | 11 + ? |
| B3.5d | docs: diagnóstico estructural del código  | — | git | 1 | 2026-05-04 → 2026-05-04 | 11 + ? |
| B3.5e | tests: red de seguridad para flujos rotos | — | git | 8 | 2026-05-04 → 2026-05-05 | 11 + 05 |
| B3.5f | Fila "Pendientes" + empty state en /profile/[username]. Status enum pending confirmado.  | hecha | DONE, git | 57 | 2026-05-20 → 2026-05-27 | 11 + ? |
| B3.5g | docs: inventario RLS — crear docs/RLS_AUDIT.md | — | git | 8 | 2026-05-12 → 2026-05-12 | 11 + 05 |
| B3.5h | Sub-saga E2E completa: 34/34 passed. E40 resuelto via Dashboard kultura-test (Confirm emai | hecha | DONE, git | 20 | 2026-05-13 → 2026-05-14 | 11 + 08 |
| B4 | Auditar y eliminar kultura-backup-2026-05-01.zip | hecha | BACKLOG, DONE, git | 1 | 2026-05-03 → 2026-05-03 | 11 + ? |
| C1 | Sentry integrado | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-09-11 → 2026-09-11 | 11 + 09 |
| C2 | Logger estructurado reemplaza console.error | hecha | BACKLOG, DONE, NOW | 0 | — | 11 + 09 |
| C3 | Rate limiting → Vercel KV | pendiente | BACKLOG | 0 | — | 11 + 05 |
| C4 | Rate-limit en endpoints sin proteger | hecha | BACKLOG, DONE, git | 1 | 2026-05-03 → 2026-05-03 | 11 + 05 |
| C5 | Activar CSP en modo enforce mejorado | hecha | BACKLOG, DONE, NOW | 0 | — | 11 + 05 |
| C6 | Auditar dominios externos en CSP y limpiar allowlist | pendiente | BACKLOG | 0 | — | 11 + 05 |
| C7 | Eliminar 'unsafe-inline' de CSP script-src usando nonces | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-09-11 → 2026-09-11 | 11 + 05 |
| C8 | Verificar periódicamente que Vercel sigue añadiendo HSTS | pendiente | BACKLOG | 0 | — | 11 + 05 |
| D1 | Política de privacidad + Términos | hecha | BACKLOG, DONE, NOW, git | 2 | 2026-07-07 → 2026-09-11 | 11 + 05 |
| D2 | Endpoint de eliminación de cuenta | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-09-11 → 2026-09-11 | 11 + 05 |
| D3 | Exportación de datos básica | hecha | BACKLOG, DONE, NOW | 0 | — | 11 + 05 |
| E1 | generateMetadata() en páginas de contenido — /media/[type]/[id], /profile/[username] | pendiente | BACKLOG | 0 | — | 11 + ? |
| E2 | Error Boundaries en secciones principales. | pendiente | BACKLOG | 0 | — | 11 + ? |
| E3 | Paginación verificada en todas las queries de listado. | pendiente | BACKLOG | 0 | — | 11 + 06 |
| E4 | Tests de componentes React con @testing-library/react. | pendiente | BACKLOG | 0 | — | 11 + 08 |
| E5 | E2E ampliado — library add, recomendación user-to-user, crear lista. | pendiente | BACKLOG | 0 | — | 11 + 08 |
| E6 | ComicVine implementado — /api/comics/route.ts + lib/api/comicvine.ts. | pendiente | BACKLOG | 0 | — | 11 + 06 |
| E7 | OAuth Google vía Supabase Auth. | pendiente | BACKLOG | 0 | — | 11 + ? |
| E8 | Recuperación de contraseña personalizada. | pendiente | BACKLOG | 0 | — | 11 + ? |
| E9 | Form fields con id/name (warning visto en consola — accesibilidad). | pendiente | BACKLOG | 0 | — | 11 + ? |
| E10 | Evaluar 3 APIs alternativas de libros | pendiente | BACKLOG | 0 | — | 11 + 06 |
| E11 | Migrar lib/api/googlebooks.ts → API decidida en E10 | pendiente | BACKLOG | 0 | — | 11 + ? |
| E12 | Activar forceConsistentCasingInFileNames en tsconfig.json | pendiente | BACKLOG | 0 | — | 11 + ? |
| E13 | Auditoría de colisiones case-only en el repo entero | pendiente | BACKLOG | 0 | — | 11 + ? |
| E14 | Reportar bug a Supabase CLI: db dump --dry-run imprime credenciales en stdout | pendiente | BACKLOG | 0 | — | 11 + 05 |
| E15 | Eliminar código muerto | pendiente | BACKLOG | 0 | — | 11 + ? |
| E16 | Deduplicar tipo EpisodeProgress | pendiente | BACKLOG | 0 | — | 11 + ? |
| E17 | Tipar las 7 tablas faltantes en src/types/supabase.ts | hecha | BACKLOG, DONE, git | 1 | 2026-05-03 → 2026-05-03 | 11 + 04 |
| E18 | Reemplazar console.error por logger estructurado | pendiente | BACKLOG | 0 | — | 11 + 09 |
| E19 | Eliminar casts as unknown as Array<{...}> repetidos | pendiente | BACKLOG | 0 | — | 11 + ? |
| E20 | Migrar inputs de LoginPage.tsx a componente <Input> | pendiente | BACKLOG | 0 | — | 11 + ? |
| E21 | Endpoint DELETE /api/groups/[id] y endpoint para group_posts | pendiente | BACKLOG | 0 | — | 11 + ? |
| E22 | (CERRADA 2026-05-31, absorbida por E45-b) Página /groups con listado público de grupos | hecha | BACKLOG | 0 | — | 11 + 01 |
| E23 | Unificar policies duplicadas en users | pendiente | BACKLOG | 0 | — | 11 + 05 |
| E24 | Validación de env vars al startup | hecha | BACKLOG, DONE, NOW, git | 2 | 2026-06-16 → 2026-06-16 | 11 + 09 |
| E25 | Refactorizar specs E2E de discover-pagination | hecha | BACKLOG | 0 | — | 11 + 06 |
| E26 | Reforzar selector del picker en chat-send.spec.ts | hecha | BACKLOG | 0 | — | 11 + 01 |
| E27 | Auditar policies RLS por recursión potencial | pendiente | BACKLOG | 0 | — | 11 + 05 |
| E28 | Reforzar red de seguridad E2E con sesión real (no service_role) | pendiente | BACKLOG | 0 | — | 11 + 05 |
| E29 | Defensa null-safety en discover/page.tsx | hecha | BACKLOG, DONE, git | 3 | 2026-05-27 → 2026-05-27 | 11 + 06 |
| E30 | CSP en development debe permitir 'unsafe-eval' | pendiente | BACKLOG | 0 | — | 11 + 05 |
| E31 | Documentar workaround swap .env.local en docs/B3_5e_TEST_ENV.md | pendiente | BACKLOG | 0 | — | 11 + 09 |
| E32 | Bug findOrCreateUser no idempotente para password | hecha | BACKLOG | 0 | — | 11 + ? |
| E33 | Documentar convención de comillas en .env para credenciales con caracteres especiales | pendiente | BACKLOG | 0 | — | 11 + 05 |
| E34 | Documentar política de acceso a reports | pendiente | BACKLOG | 0 | — | 11 + ? |
| E35 | Normalizar roles={public} → {authenticated} en ~30 policies | pendiente | BACKLOG | 0 | — | 11 + 05 |
| E36 | Rediseño defensivo de conversations INSERT | hecha | BACKLOG, DONE | 0 | — | 11 + ? |
| E37 | — Puerto hardcodeado en tests/e2e/auth.spec.ts. localhost:3001 hardcodeado | hecha | BACKLOG | 0 | — | 11 + 08 |
| E38 | — Playwright debería cargar .env.test.local automáticamente. El workaround | pendiente | BACKLOG | 0 | — | 11 + 08 |
| E39 |  | hecha | BACKLOG | 0 | — | 11 + ? |
| E40 | CERRADA en B3.5h-AUDIT-E2E-5 (2026-05-14). Fix: desactivar "Confirm email" en Dashboard de | hecha | BACKLOG | 0 | — | 11 + 08 |
| E41 | — BLOQUEADO-DOCUMENTADO (commit 7107cab, 2026-05-13). page.route() solo intercepta reque | hecha | BACKLOG | 0 | — | 11 + ? |
| E42 |  | hecha | BACKLOG | 0 | — | 11 + ? |
| E43 |  | hecha | BACKLOG | 0 | — | 11 + ? |
| E44 | — Vercel auto-promote desactivado: producción requiere promoción | pendiente | BACKLOG | 0 | — | 11 + 09 |
| E45 | Grupos: flujo de descubrimiento + RLS de join + visibilidad/invitaciones —  CERRADA COMPLE | hecha | BACKLOG, DONE, NOW, git | 10 | 2026-05-31 → 2026-06-04 | 11 + 05 |
| E46 | Migrar MediaCard al sistema de diseño | pendiente | BACKLOG | 0 | — | 11 + 07 |
| E47 | Listas: UI para añadir títulos a una lista (endpoint ya existe) | hecha | BACKLOG, DONE, git | 8 | 2026-05-28 → 2026-05-29 | 11 + 07 |
| E48 | Notificaciones: mejoras DS aplazadas | pendiente | BACKLOG | 0 | — | 11 + 01 |
| E49 | (reservado) | pendiente | BACKLOG, git | 1 | 2026-05-25 → 2026-05-25 | 11 + ? |
| E50 | Notificaciones: estado no-leído efímero por markAllRead en carga | pendiente | BACKLOG, git | 1 | 2026-05-26 → 2026-05-26 | 11 + 01 |
| E51 | Validación en cliente + mensajes específicos en SuggestionsForm | hecha | BACKLOG, DONE, NOW, git | 3 | 2026-05-26 → 2026-06-05 | 11 + ? |
| E52 | Silent fail duplicado en ChatClient + ConversationClient — .catch(() => setLoading(false) | hecha | BACKLOG, DONE, NOW, git | 5 | 2026-05-26 → 2026-06-06 | 11 + ? |
| E53 | String hardcodeado sin i18n en ChatClient — ${conversations.length} conversaciones no pa | hecha | BACKLOG, NOW, git | 3 | 2026-05-26 → 2026-06-05 | 11 + ? |
| E54 | Chat: cifrado de extremo a extremo (E2EE) — DECISIÓN DE ARQUITECTURA | pendiente | BACKLOG, git | 1 | 2026-05-26 → 2026-05-26 | 11 + 01 |
| E55 | KButton: active:scale(0.98) no implementado  CERRADA en B3.5f-3 (nivel mínimo) | hecha | BACKLOG | 0 | — | 11 + ? |
| E56 | Faltan loading.tsx en rutas principales — solo /profile tiene skeleton de carga. | pendiente | BACKLOG, git | 1 | 2026-05-26 → 2026-05-26 | 11 + ? |
| E57 | prefers-reduced-motion no implementado  CERRADA en B3.5f-3 (nivel mínimo) | hecha | BACKLOG | 0 | — | 11 + ? |
| E58 | RecommendModal + Toast: migrar tokens legacy al DS | pendiente | BACKLOG, git | 1 | 2026-05-27 → 2026-05-27 | 11 + 07 |
| E59 | (CERRADA 2026-06-11) Rediseño del filtro Descubrir (FilterBar) — visual/UX | hecha | BACKLOG, DONE, NOW, git | 37 | 2026-05-27 → 2026-06-11 | 11 + 06 |
| E60 | Decisión de producto: scope de Discover/Books (idioma) | pendiente | BACKLOG, git | 1 | 2026-05-27 → 2026-05-27 | 11 + 06 |
| E61 | (CERRADA 2026-06-01 — NO-VULN, mal diagnosticada) ~~Seguridad: DELETE /api/lists/[id] by | hecha | BACKLOG, DONE | 0 | — | 11 + 05 |
| E62 | Patrón transversal: mutaciones optimistas sin verificar res.ok (barrido ListDetail hec | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-06-05 → 2026-06-05 | 11 + ? |
| E63 | ListsClient.tsx descarta el setter de useState | hecha | BACKLOG, NOW, git | 1 | 2026-06-05 → 2026-06-05 | 11 + ? |
| E64 | Seguridad/visual: RecommendModal usa colores hardcodeados (viola DS) | hecha | BACKLOG, NOW, git | 1 | 2026-06-05 → 2026-06-05 | 11 + 05 |
| E65 | Listas: UI para borrar una lista (endpoint ya existe) | hecha | BACKLOG, git | 2 | 2026-05-31 → 2026-05-31 | 11 + 07 |
| E66 | — AiRecommendations: carátula + navegación a ficha | hecha | BACKLOG, git | 11 | 2026-05-31 → 2026-05-31 | 11 + 07 |
| E67 | Flaky test por test pollution en suite completa | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-06-05 → 2026-06-05 | 11 + 08 |
| E70 | Drop RPC zombi public.get_discoverable_groups(...) en DB prod | hecha | BACKLOG, git | 1 | 2026-05-31 → 2026-05-31 | 11 + 04 |
| E71 | (CERRADA 2026-06-01) DELETE /api/lists/[id] no verifica count tras borrar item | hecha | BACKLOG, DONE, git | 1 | 2026-06-01 → 2026-06-01 | 11 + ? |
| E72 | 639 passed | hecha | DONE, NOW, git | 1 | 2026-06-06 → 2026-06-06 | 11 + ? |
| E73 | solo en tokens dañados | hecha | DONE, NOW, git | 2 | 2026-06-06 → 2026-06-06 | 11 + 07 |
| E74 | Grupos no aparecen en móvil (fuego funcional) | hecha | BACKLOG, DONE, NOW, git | 4 | 2026-06-06 → 2026-06-06 | 11 + 01 |
| E75 | Botón cambio de idioma: mejora visual | pendiente | BACKLOG | 0 | — | 11 + 07 |
| E76 | Foto de perfil: mejora visual | pendiente | BACKLOG | 0 | — | 11 + 07 |
| E77 | Botón editar perfil: mejora visual | pendiente | BACKLOG | 0 | — | 11 + 07 |
| E78 | Iconos genéricos: sustituir por set característico | pendiente | BACKLOG | 0 | — | 11 + ? |
| E79 | Paginación: mejora (UX) — _slice 1 hecho, slice 2 pendiente_ | hecha | BACKLOG, DONE, NOW, git | 4 | 2026-06-16 → 2026-07-16 | 11 + 06 |
| E80 | Ranking por estrellas (votación interna) | pendiente | BACKLOG | 0 | — | 11 + ? |
| E81 | Mejora de autenticación (técnico) | pendiente | BACKLOG | 0 | — | 11 + ? |
| E82 | Migrar acento legacy rojo #E82020 → verde app-wide | pendiente | BACKLOG, git | 1 | 2026-06-07 → 2026-06-07 | 11 + ? |
| E83 | (CERRADA 2026-06-07 — commit edca570) Entrega de notificaciones rota a nivel global. no | hecha | BACKLOG, DONE, NOW, git | 2 | 2026-06-07 → 2026-06-07 | 11 + 01 |
| E84a | cliente Open Library + normalizer para libros (aditivo, sin cablear) | — | git | 1 | 2026-06-10 → 2026-06-10 | 11 + 06 |
| E84b | Migrar libros a Open Library en discover | — | git | 1 | 2026-06-10 → 2026-06-10 | 11 + 06 |
| E84c | Retirar Google Books: libros 100% Open Library | — | git | 1 | 2026-06-10 → 2026-06-10 | 11 + 06 |
| E86 | Filtro NSFW global (diseño B). | hecha | DONE, NOW, git | 1 | 2026-06-14 → 2026-06-14 | 11 + 06 |
| E87 | Blacklist editoriales adultas ComicVine (caso Comic Bavel / Bunendo). | hecha | DONE, git | 1 | 2026-06-14 → 2026-06-14 | 11 + 06 |
| E88 | (CERRADA 2026-07-07 — commit e893c60) Filtro de valoración (9+) no filtra | hecha | BACKLOG, git | 2 | 2026-07-07 → 2026-07-16 | 11 + 06 |
| E90 | (CERRADA 2026-06-19) Navegación móvil incompleta: faltan friends, lists, suggestions. Bot | hecha | BACKLOG, DONE, NOW, git | 3 | 2026-06-19 → 2026-06-19 | 11 + 07 |
| E91 | (RESUELTO 2026-06-19 vía E90-amp) Search oculto en móvil. El acceso de búsqueda era hidde | hecha | BACKLOG | 0 | — | 11 + ? |
| E92 | (CERRADA 2026-07-09) Grid Descubrir: mínimo 2 columnas en móvil. El skeleton (línea 368) y | hecha | BACKLOG, DONE, git | 1 | 2026-07-09 → 2026-07-09 | 11 + 06 |
| E93 | (CERRADA 2026-07-16 — commit 49f3dd2) DMs solo entre amigos. Hallazgo S6 (auditoría 2026 | hecha | BACKLOG, DONE, NOW, git | 2 | 2026-07-09 → 2026-07-16 | 11 + 01 |
| E94 | (a) Suelo de votos en Descubrir. buildTmdbDiscoverParams (tmdb-maps.ts) añade vote_co | pendiente | BACKLOG, git | 1 | 2026-07-16 → 2026-07-16 | 11 + 06 |
| E95 | without_keywords TMDB (softcore residual con muchos votos). Evaluar si tras E94 sigue co | pendiente | BACKLOG | 0 | — | 11 + 06 |
| E96 | (CERRADO 2026-07-16, commit 7553ef1) Chat realtime — mensajes entrantes sin recargar (Supa | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-07-16 → 2026-07-16 | 11 + 01 |
| E97 | Unificar vars legacy NEXT_PUBLIC_TMDB_API_KEY / NEXT_PUBLIC_RAWG_KEY con los nombres c | pendiente | BACKLOG | 0 | — | 11 + ? |
| E98 | Sincronizar CLAUDE.md con codigo real. Tres afirmaciones de CLAUDE.md contradicen al repo  | pendiente | BACKLOG, git | 1 | 2026-07-16 → 2026-07-16 | 11 + 06 |
| E99 | Rate-limit ausente en PATCH/DELETE /api/friends y DELETE /api/library | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-09-11 → 2026-09-11 | 11 + 05 |
| E100 | components/ui/button.tsx: foco de teclado usa tokens shadcn muertos (ring-ring, ring- | hecha | BACKLOG, DONE, git | 1 | 2026-09-12 → 2026-09-12 | 11 + 07 |
| E-AI-GEMINI | Migrar recomendaciones IA de Anthropic (Claude claude-sonnet-4-6) a Google Gemini (@goo | hecha | DONE | 0 | — | 11 + 06 |
| F0 | Concepto visual — 3 pantallas clave — _en curso, v2 aprobada_ | pendiente | BACKLOG, NOW | 0 | — | 11 + 07 |
| F1 | Sistema tipográfico — _cerrada 2026-09-11, commit 8f1e5ce_ | hecha | BACKLOG, DONE, NOW, git | 2 | 2026-07-07 → 2026-09-11 | 11 + ? |
| F1b | Sistema de iconos propio (sustituye lucide-react) — _cerrada 2026-09-11_ | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-09-11 → 2026-09-11 | 11 + ? |
| F2 | Resolver acento legacy rojo (#E82020) dentro del nuevo sistema de color — _cerrada 2026- | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-09-11 → 2026-09-11 | 11 + ? |
| F3 | Rediseño de MediaCard y grids de Descubrir/Home — _partida en F3a/F3b (2026-09-11): tare | pendiente | BACKLOG, NOW, git | 1 | 2026-07-07 → 2026-07-07 | 11 + 06 |
| F3a | Sistema de match score real (sin llamadas a LLM por card) — _cerrada 2026-09-11, commit 6 | hecha | BACKLOG, DONE, NOW, git | 2 | 2026-09-11 → 2026-09-12 | 11 + 06 |
| F3b | Rediseño de MediaCard + grid bento de Descubrir/Home — _cerrada 2026-09-11_ | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-09-11 → 2026-09-11 | 11 + 06 |
| F4 | Rediseño de ficha de Media (/media/[type]/[id]) — _cerrada 2026-09-12_ | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-09-12 → 2026-09-12 | 11 + ? |
| F5 | Auditoría de accesibilidad post-rediseño — _cerrada 2026-09-12_ | hecha | BACKLOG, DONE, NOW, git | 1 | 2026-09-12 → 2026-09-12 | 11 + ? |
| F6 | Logotipo de marca propio (sustituye el texto plano "KULTURA") — _cerrada 2026-09-12, commi | hecha | BACKLOG, DONE, git | 1 | 2026-09-12 → 2026-09-12 | 11 + ? |
| F7 | Paleta multicolor de acentos decorativos (tokens DS) — _cerrada 2026-09-12, commit dfedce | hecha | BACKLOG, DONE, git | 1 | 2026-09-12 → 2026-09-12 | 11 + 07 |
| F8 | Mood-chips en Descubrir/Home ("🍿 Para maratonear", "😭 Para llorar a moco tendido", etc.) | pendiente | BACKLOG | 0 | — | 11 + 06 |
| F9 | Gamificación (racha de días activos, "🔥 12 días") | pendiente | BACKLOG | 0 | — | 11 + ? |
| G1 | Discover: barra de búsqueda + pills de tipo con más peso visual — _cerrada 2026-09-12, com | hecha | BACKLOG, DONE, git | 1 | 2026-09-12 → 2026-09-12 | 11 + 06 |
| G2 | Navegación desktop (NavLinks) con el mismo peso visual que la navegación móvil — _cerrad | hecha | BACKLOG, DONE, git | 1 | 2026-09-12 → 2026-09-12 | 11 + 07 |
| H1 | Limpieza de residuos: Google Books retirado + CLAUDE.md al dia | — | git | 1 | 2026-07-07 → 2026-07-07 | 11 + 06 |
| SPEC-001 | chore(setup): inicializa proyecto KULTURA — SPEC-001 | — | git | 1 | 2026-04-12 → 2026-04-12 | 11 + ? |
| SPEC-002 | feat(db-agent): esquema inicial, RLS y trigger — SPEC-002 | — | git | 1 | 2026-04-12 → 2026-04-12 | 11 + 05 |
| SPEC-003 | feat(auth-agent): clientes Supabase y middleware de sesión — SPEC-003 | — | git | 1 | 2026-04-12 → 2026-04-12 | 11 + ? |
| SPEC-004 | feat(api-agent): tipos TypeScript compartidos — SPEC-004 | — | git | 1 | 2026-04-12 → 2026-04-12 | 11 + ? |
| SPEC-005 | feat(i18n-agent): mensajes completos para Fase 1 y helper de errores auth — SPEC-005 | — | git | 1 | 2026-04-12 → 2026-04-12 | 11 + ? |
| SPEC-006 | feat(ui-agent): componentes UI base — SPEC-006 | — | git | 1 | 2026-04-12 → 2026-04-12 | 11 + 07 |
| SPEC-007 | feat(auth-agent): páginas login/registro/recuperación — SPEC-007 | — | git | 1 | 2026-04-12 → 2026-04-12 | 11 + ? |
| api | Fix conversación POST 500 + recursión RLS conversation_members. Cerrado en B3.5c-3-FIX2/FI | hecha | DONE | 0 | — | 11 + 05 |
| chat 500) | Fix conversación POST 500 + recursión RLS conversation_members. Cerrado en B3.5c-3-FIX2/FI | hecha | DONE | 0 | — | 11 + 05 |

## B. Commits sin ID de tarea

Se cubren en el capítulo 11 (historia) por fecha. Los merges de PR marcan hitos.

| Commit | Fecha | Autor | Mensaje |
|---|---|---|---|
| `7d9e252` | 2026-04-12 | benevi | Initial commit from Create Next App |
| `9fbaf68` | 2026-05-02 | benevi | docs: cerrar A5 (push a github.com/benevi/kultura) + abrir B1-B (CI) |
| `4b70f5a` | 2026-05-02 | benevi | [session] cierre sesión 2026-05-02 con B2 incompleto |
| `a5a3bff` | 2026-05-03 | benevi | chore(gitignore): ignore Supabase CLI caches (.branches/, db_snapshot.txt) |
| `b9e941f` | 2026-05-03 | benevi | docs(backlog): rename B3 (env vars Zod) to E24 to avoid sprint collision |
| `3d35842` | 2026-05-03 | benevi | docs: cerrar B3 en NOW/DONE y añadir regla 11 sobre verificación post-deploy |
| `bf02262` | 2026-05-04 | benevi | docs: sincronizar NOW/DONE tras B3, B3.5a, B3.5b, B3.5d |
| `5c9c23f` | 2026-05-23 | benevi | [GRUPOS-DIAG] docs: registrar hallazgo de flujo de grupos en BACKLOG |
| `50d62a6` | 2026-05-25 | benevi | [LISTAS-ADD-DIAG] docs: registrar flujo de añadir títulos a listas en BACKLOG |
| `4a3f71f` | 2026-05-26 | benevi | docs: fix hash B3.5f-2h-CHAT en DONE |
| `59701e7` | 2026-05-28 | benevi | [docs] backlog: registrar E61/E62/E63 (hallazgos Fase 0 E47) |
| `b87f6a1` | 2026-05-29 | benevi | [docs] backlog: reordenar E-tasks y reubicar E52-E58 a Bloque E |
| `45159df` | 2026-05-29 | benevi | [docs] backlog: registrar E64 y E65 (hallazgos de E47) |
| `241d4fe` | 2026-05-30 | benevi | [E-AI-GEMINI] migrar recomendaciones IA de Anthropic a Google Gemini (free tier) |
| `61288e5` | 2026-05-30 | benevi | [E-AI-GEMINI] docs: cerrar tarea (DONE + NOW) |
| `2293709` | 2026-05-30 | benevi | [fix] pasar cliente supabase a getAiRecommendations para evitar pérdida de contexto auth en producción |
| `e8e652f` | 2026-05-30 | benevi | [fix] usar gemini-2.0-flash (free tier 1500 req/dia, sin truncado) |
| `cefe91e` | 2026-05-30 | benevi | [fix] revertir a Anthropic SDK (claude-haiku-4-5, fiable y económico) |
| `614d17e` | 2026-05-30 | benevi | [docs] CLAUDE.md: revertir referencias Gemini → Anthropic |
| `c39879c` | 2026-05-30 | benevi | [docs] backlog: registrar E66 (AiRecommendations carátula + navegación) |
| `646bf45` | 2026-05-30 | benevi | [docs] done: cerrar diagnóstico ai-recommendations |
| `3218c07` | 2026-05-31 | benevi | [docs] cerrar E66 (DONE+BACKLOG+NOW), registrar E66-COMIC-FICHA |
| `5652c94` | 2026-05-31 | benevi | [docs] anadir ROADMAP.md; ignorar logs temporales |
| `9e5af44` | 2026-05-31 | benevi | [docs] cerrar E45 (grupos: RLS auto-join + feedback) |
| `35d35b4` | 2026-05-31 | benevi | [docs] cerrar E45-b (discover groups + nav) |
| `5c646f0` | 2026-05-31 | benevi | [docs] backlog: E70 drop RPC zombi discover; obsoletar E68 |
| `4c3bebd` | 2026-05-31 | benevi | [docs] cerrar E65 |
| `22e2ee2` | 2026-06-01 | benevi | [docs] cerrar E61 (no-vuln) + abrir E71 |
| `4026d76` | 2026-06-01 | benevi | [docs] cerrar E71 |
| `db5ac20` | 2026-06-01 | benevi | [docs] cerrar E45-c |
| `859fc63` | 2026-06-01 | benevi | [docs] E45-d.1 backend cerrado, d.2 UI pendiente |
| `dfb9339` | 2026-06-04 | benevi | [docs] cerrar E45-d.2 + E45 completo |
| `0e691e5` | 2026-06-05 | benevi | docs: cerrar E62/E63/E64 (NOW/DONE/BACKLOG) |
| `04a6f2f` | 2026-06-05 | benevi | cerrar E67 en NOW/DONE/BACKLOG |
| `51ab7de` | 2026-06-10 | benevi | [chore] Bump test deps por incompatibilidad runner |
| `85f3567` | 2026-07-07 | benevi | [SEC-FIX] S1 open redirect callback + S2 rate-limit 3 endpoints + S3 bloquear /dev en prod |
| `1d94fbd` | 2026-07-07 | benevi | [docs] Cerrar AUDIT-FIX + E88 en NOW/DONE/BACKLOG |
| `660191e` | 2026-07-16 | benevi | [docs] Registrar E96 (chat realtime) y E79-s3 (páginas cortas post-filtro) en BACKLOG |
| `d0a0ff7` | 2026-07-16 | benevi | [docs] Cerrar E79-s2 y E93 (validados en prod): BACKLOG [x] + DONE + NOW |
| `6a48027` | 2026-07-16 | benevi | [docs] Cerrar E96 (validado en dev): BACKLOG [x] + DONE + NOW |
| `8d12ac1` | 2026-07-16 | benevi | [DOSSIER] Esqueleto: 17 capitulos + README indice + img/ |
| `066c0bc` | 2026-07-16 | benevi | [DOSSIER] 00-RESUMEN-EJECUTIVO |
| `cf20d15` | 2026-07-16 | benevi | [HOUSEKEEPING] Doc BD dev (test, no prod), .env.example, Node >=22, E97 a BACKLOG |
| `0bccb80` | 2026-09-11 | benevi | [HOUSEKEEPING] .gitignore: vercel link anadio patron .env* (redundante con .env*.local, inofensivo) |
| `bad3b9f` | 2026-09-11 | Claude | [docs] Cerrar C7/C5 (CSP nonces): BACKLOG [x] + DONE + NOW + BLOCKERS(C3) |
| `6abbefe` | 2026-09-11 | Claude | [docs] Cerrar D1/D2/D3 (legal + eliminación/exportación de cuenta): Bloque D completo |
| `ec9dcb0` | 2026-09-11 | Claude | [docs] Bloque F: registrar pivote a dirección Gen Z (F0 v2) y regla de marca propia |
| `d818019` | 2026-09-11 | Claude | [docs] Bloque F: ampliar regla de marca propia a toda la iconografía de UI |
| `83f531c` | 2026-09-11 | Claude | [docs] Bloque F: registrar F1b (sustituir lucide-react por iconos propios) |
| `8bbe284` | 2026-09-11 | Claude | [docs] Cerrar F1/F1b: tipografía + iconos propios |
| `4eea271` | 2026-09-11 | Claude | [docs] Cerrar F2: acento legacy rojo resuelto |
| `7f29994` | 2026-09-11 | Claude | [docs] Cerrar F3a: sistema de match score real, abrir F3b |
| `bdb9e4a` | 2026-09-11 | Claude | [docs] Cerrar F3b: grid bento + MediaCard restyle, abrir F4 |
| `5e9acc9` | 2026-09-11 | Claude | [HOTFIX] Timeout en getUser() del middleware para evitar 504 global |
| `323fc66` | 2026-09-11 | Claude | [HOTFIX] Timeout en getUser() del middleware para evitar 504 global |
| `4052897` | 2026-09-11 | benevi | Add initial screenshot assets for registration and landing pages |
| `20b26f4` | 2026-09-12 | benevi | Merge branch 'master' of https://github.com/benevi/kultura |
| `0d68660` | 2026-09-12 | benevi | Implement timeout for getUser() in middleware to prevent global 504 errors. This fix uses Promise.race with a  |
| `f8085ef` | 2026-09-12 | benevi | Merge PR #2: Bloque C/D (hardening + legal) + Bloque F (identidad Gen Z) |
| `a14368e` | 2026-09-12 | Claude | [docs] Cerrar F3a-FIX, registrar F6-F9 (piezas del mockup F0 pendientes), retomar F4 |
| `9a3c349` | 2026-09-12 | benevi | Merge pull request #3 from benevi/claude/revision-exhaustiva-proyecto-4mcw94 |
| `8310290` | 2026-09-12 | Claude | [CLAUDE.md] Gobierno del proyecto: autonomía real hacia el objetivo de calidad |
| `60b9ad6` | 2026-09-12 | Claude | [docs] Cerrar F4, registrar nuevo gobierno de NOW.md, abrir F5 |
| `1caa42f` | 2026-09-12 | Claude | Merge branch 'worktree-agent-ade392e578a1a2377' into claude/revision-exhaustiva-proyecto-4mcw94 |
| `eee5e93` | 2026-09-12 | Claude | [docs] Consolidar Bloque F (F4-F7 fusionados y verificados), preparar release |
| `7f9a1e9` | 2026-09-12 | Claude | [docs] Registrar cierre de E100, pausar para revision del usuario |
| `05b9cbe` | 2026-09-12 | benevi | Merge pull request #4 from benevi/claude/revision-exhaustiva-proyecto-4mcw94 |
| `6b7e2db` | 2026-09-12 | Claude | [docs] Abrir Bloque G tras verificacion de produccion por el usuario |
| `1e42a68` | 2026-09-12 | Claude | Merge branch 'worktree-agent-a18decabf909735eb' into claude/revision-exhaustiva-proyecto-4mcw94 |
| `31b50bd` | 2026-09-12 | Claude | Merge branch 'worktree-agent-a8bc92ec146b49b6a' into claude/revision-exhaustiva-proyecto-4mcw94 |
| `2adb380` | 2026-09-12 | Claude | [docs] G1/G2 fusionados y verificados, PR #5 abierta, pausa para feedback |
| `5ab215f` | 2026-09-12 | Claude | [FIX] Match score siempre 0%: media.metadata.genres nunca se cacheaba |
| `ab8eb4e` | 2026-09-12 | Claude | [cleanup] Eliminar toda la documentacion/specs de proceso (decision del usuario) |
| `8b4dbab` | 2026-09-12 | Claude | [cleanup] Eliminar archivos y rutas obsoletas (screenshots, sandbox, tests deshabilitados) |
| `22500d2` | 2026-09-12 | Claude | [design] Nuevo criterio de diseño como fuente de verdad (tokens F0 v2) |
| `27c8d1f` | 2026-09-12 | Claude | [design] Re-skin de tokens a la paleta OKLCH real de F0 v2 |
| `42f36dd` | 2026-09-12 | Claude | [design] Discover: bento grid F0 (rotación + gradiente radial) |
| `8d77309` | 2026-09-12 | Claude | Merge Discover F0 bento grid (rotación + gradiente radial) |
| `410b298` | 2026-09-12 | Claude | [design] Home: acabado visual F0 (hero, avatars, rows) |
| `19a0c90` | 2026-09-12 | Claude | Merge Home F0 visual pass (hero, AI badge, filas, KButton pill) |
| `1226f2a` | 2026-09-12 | Claude | [design] MediaDetail: acabado visual F0 (badge colgante, dos columnas, trailer) |
| `986472d` | 2026-09-12 | Claude | Merge MediaDetail F0 visual pass (badge colgante, dos columnas, trailer) |
| `29aa523` | 2026-09-12 | Claude | [docs] Añadir instrucciones operativas y actualizar estado de migración |
| `ebede67` | 2026-09-12 | Claude | [design] Library + Search: acabado visual F0 |
| `fdaeb33` | 2026-09-12 | Claude | [design] Chat + Notifications + Profile: acabado visual F0 |
| `901427b` | 2026-09-12 | Claude | Merge Library + Search F0 visual pass |
| `ac89f06` | 2026-09-12 | Claude | Merge Chat + Notifications + Profile F0 visual pass |
| `d4e4f22` | 2026-09-12 | Claude | [design] Lists + ListDetail + Settings + Suggestions: acabado visual F0 |
| `ec9f96e` | 2026-09-12 | Claude | Merge Lists + ListDetail + Settings + Suggestions F0 visual pass |
| `69e9a73` | 2026-09-12 | Claude | [design] Landing + Login: acabado visual F0 |
| `ea99a79` | 2026-09-12 | Claude | Merge Landing + Login F0 visual pass |
| `4f41206` | 2026-09-12 | Claude | [design] Friends + Groups + GroupDetail: acabado visual F0 |
| `a4d13b3` | 2026-09-12 | Claude | Merge Friends + Groups + GroupDetail F0 visual pass |
| `99034cd` | 2026-09-12 | Claude | [fix] Revertir cambios sin uso real y token duplicado del merge de Friends/Groups |
| `30ddf33` | 2026-09-12 | Claude | [design] Redacción exhaustiva del Sistema de diseño en CLAUDE.md |
| `aec92e3` | 2026-09-13 | benevi | Merge pull request #5 from benevi/claude/revision-exhaustiva-proyecto-4mcw94 |

## C. Documentación de proceso borrada (fuente, recuperable con `git show ab8eb4e^:<ruta>`)

| Fichero | Líneas | Capítulo(s) |
|---|---|---|
| `AUDIT.md` | 27 | 13 |
| `CLAUDE.md` | 330 | 07, 12 |
| `ESTADO_PROYECTO.md` | 1245 | 11 |
| `docs/B3_5c_BUGS.md` | 348 | 13 |
| `docs/B3_5e_TEST_ENV.md` | 190 | 08 |
| `docs/B3_DEPLOY_PLAN.md` | 102 | 09 |
| `docs/BACKLOG.md` | 748 | 11, 13, anexo |
| `docs/BLOCKERS.md` | 13 | 11, 13, anexo |
| `docs/DEBUG_PRINCIPLES.md` | 47 | 12, 15 |
| `docs/DESIGN_SYSTEM.md` | 202 | 07 |
| `docs/DONE.md` | 625 | 11, 13, anexo |
| `docs/DOSSIER/00-RESUMEN-EJECUTIVO.md` | 92 | estructura (se reaprovecha) |
| `docs/DOSSIER/01-VISION-Y-PRODUCTO.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/02-ARQUITECTURA.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/03-ESTRUCTURA-DEL-CODIGO.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/04-MODELO-DE-DATOS.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/05-SEGURIDAD.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/06-INTEGRACIONES-EXTERNAS.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/06b-API-INTERNA.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/07-DISENO-Y-UI.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/08-CALIDAD-Y-TESTS.md` | 5 | 08 |
| `docs/DOSSIER/09-INFRA-Y-DESPLIEGUE.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/10-GUIA-DE-ARRANQUE.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/11-HISTORIA-DEL-PROYECTO.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/12-METODOLOGIA.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/13-ESTADO-Y-DEUDA.md` | 5 | 11 |
| `docs/DOSSIER/14-GLOSARIO.md` | 5 | estructura (se reaprovecha) |
| `docs/DOSSIER/99-PENDIENTE-CAPTURAS.md` | 13 | estructura (se reaprovecha) |
| `docs/DOSSIER/README.md` | 44 | estructura (se reaprovecha) |
| `docs/E2E_AUDIT.md` | 609 | 08 |
| `docs/E2E_AUDIT_3.md` | 288 | 08 |
| `docs/E59_FILTER_SPEC.md` | 309 | 06, 06b |
| `docs/E59_FILTER_SPEC_V2.md` | 54 | 06, 06b |
| `docs/NOW.md` | 112 | 11, 13, anexo |
| `docs/RLS_AUDIT.md` | 364 | 04, 05 |
| `docs/ROADMAP.md` | 93 | 11 |
| `docs/SESSION_2026-05-02.md` | 37 | 11 |
| `docs/STRUCTURAL_AUDIT.md` | 332 | 03, 13 |
| `docs/SUPABASE_TEST_SETUP.md` | 64 | 08 |
| `docs/TEST_EXCEPTIONS.md` | 37 | 08 |
| `docs/UI_AUDIT.md` | 331 | 07 |
| `docs/_archive/AUDIT_2026-04-23.md` | 398 | 11 |
| `docs/_archive/agents-old/ai-agent/PLAN.md` | 16 | 11 |
| `docs/_archive/agents-old/ai-agent/PROGRESS.md` | 19 | 11 |
| `docs/_archive/agents-old/ai-agent/PROMPTS.md` | 85 | 11 |
| `docs/_archive/agents-old/api-agent/APIS.md` | 157 | 06, 06b |
| `docs/_archive/agents-old/api-agent/PLAN.md` | 16 | 06, 06b |
| `docs/_archive/agents-old/api-agent/PROGRESS.md` | 19 | 06, 06b |
| `docs/_archive/agents-old/auth-agent/PLAN.md` | 16 | 11 |
| `docs/_archive/agents-old/auth-agent/PROGRESS.md` | 19 | 11 |
| `docs/_archive/agents-old/db-agent/PLAN.md` | 16 | 04, 05 |
| `docs/_archive/agents-old/db-agent/PROGRESS.md` | 19 | 04, 05 |
| `docs/_archive/agents-old/db-agent/SCHEMA.md` | 139 | 04, 05 |
| `docs/_archive/agents-old/db-agent/SPEC.md` | 50 | 04, 05 |
| `docs/_archive/agents-old/gate-keeper/AUDIT_LOG.md` | 25 | 12, 15 |
| `docs/_archive/agents-old/gate-keeper/CHECKLISTS.md` | 123 | 12, 15 |
| `docs/_archive/agents-old/gate-keeper/FASE-6-ANALISIS.md` | 139 | 12, 15 |
| `docs/_archive/agents-old/i18n-agent/PLAN.md` | 16 | 11 |
| `docs/_archive/agents-old/i18n-agent/PROGRESS.md` | 19 | 11 |
| `docs/_archive/agents-old/layout-agent/PLAN.md` | 16 | 07 |
| `docs/_archive/agents-old/layout-agent/PROGRESS.md` | 19 | 07 |
| `docs/_archive/agents-old/library-agent/PLAN.md` | 16 | 11 |
| `docs/_archive/agents-old/library-agent/PROGRESS.md` | 19 | 11 |
| `docs/_archive/agents-old/orchestrator/BLOCKERS.md` | 86 | 11 |
| `docs/_archive/agents-old/orchestrator/DECISIONS.md` | 73 | 12, 15 |
| `docs/_archive/agents-old/orchestrator/FASE-1-ANALISIS.md` | 140 | 11 |
| `docs/_archive/agents-old/orchestrator/FASE-2-ANALISIS.md` | 248 | 11 |
| `docs/_archive/agents-old/orchestrator/FASE-3-ANALISIS.md` | 177 | 11 |
| `docs/_archive/agents-old/orchestrator/FASE-4-ANALISIS.md` | 181 | 11 |
| `docs/_archive/agents-old/orchestrator/FASE-5-ANALISIS.md` | 173 | 11 |
| `docs/_archive/agents-old/orchestrator/PHASES.md` | 91 | 12, 15 |
| `docs/_archive/agents-old/social-agent/PLAN.md` | 16 | 11 |
| `docs/_archive/agents-old/social-agent/PROGRESS.md` | 19 | 11 |
| `docs/_archive/agents-old/ui-agent/COMPONENTS.md` | 68 | 07 |
| `docs/_archive/agents-old/ui-agent/PLAN.md` | 16 | 07 |
| `docs/_archive/agents-old/ui-agent/PROGRESS.md` | 19 | 07 |

## D. Código

### D1. Endpoints de API → capítulo 06b

| Ruta | Fichero |
|---|---|
| `/api/account/export` | `src/app/api/account/export/route.ts` |
| `/api/account` | `src/app/api/account/route.ts` |
| `/api/ai-recommendations` | `src/app/api/ai-recommendations/route.ts` |
| `/api/auth/callback` | `src/app/api/auth/callback/route.ts` |
| `/api/chat/[id]` | `src/app/api/chat/[id]/route.ts` |
| `/api/chat` | `src/app/api/chat/route.ts` |
| `/api/discover` | `src/app/api/discover/route.ts` |
| `/api/friends` | `src/app/api/friends/route.ts` |
| `/api/genre-news` | `src/app/api/genre-news/route.ts` |
| `/api/groups/[id]/invitations` | `src/app/api/groups/[id]/invitations/route.ts` |
| `/api/groups/[id]/join` | `src/app/api/groups/[id]/join/route.ts` |
| `/api/groups/discover` | `src/app/api/groups/discover/route.ts` |
| `/api/groups/invitations/[invitationId]` | `src/app/api/groups/invitations/[invitationId]/route.ts` |
| `/api/groups` | `src/app/api/groups/route.ts` |
| `/api/library` | `src/app/api/library/route.ts` |
| `/api/lists/[id]` | `src/app/api/lists/[id]/route.ts` |
| `/api/lists` | `src/app/api/lists/route.ts` |
| `/api/notifications` | `src/app/api/notifications/route.ts` |
| `/api/popular-in-circle` | `src/app/api/popular-in-circle/route.ts` |
| `/api/recommendations` | `src/app/api/recommendations/route.ts` |
| `/api/reports` | `src/app/api/reports/route.ts` |
| `/api/search` | `src/app/api/search/route.ts` |
| `/api/settings` | `src/app/api/settings/route.ts` |
| `/api/suggestions` | `src/app/api/suggestions/route.ts` |
| `/api/users/search` | `src/app/api/users/search/route.ts` |

### D2. Páginas → capítulos 01 y 07

| Ruta | Fichero |
|---|---|
| `/[locale]/chat/[id]` | `src/app/[locale]/(app)/chat/[id]/page.tsx` |
| `/[locale]/chat` | `src/app/[locale]/(app)/chat/page.tsx` |
| `/[locale]/discover` | `src/app/[locale]/(app)/discover/page.tsx` |
| `/[locale]/friends` | `src/app/[locale]/(app)/friends/page.tsx` |
| `/[locale]/groups/[id]` | `src/app/[locale]/(app)/groups/[id]/page.tsx` |
| `/[locale]/groups` | `src/app/[locale]/(app)/groups/page.tsx` |
| `/[locale]/home` | `src/app/[locale]/(app)/home/page.tsx` |
| `/[locale]/library` | `src/app/[locale]/(app)/library/page.tsx` |
| `/[locale]/lists/[id]` | `src/app/[locale]/(app)/lists/[id]/page.tsx` |
| `/[locale]/lists` | `src/app/[locale]/(app)/lists/page.tsx` |
| `/[locale]/media/[type]/[id]` | `src/app/[locale]/(app)/media/[type]/[id]/page.tsx` |
| `/[locale]/notifications` | `src/app/[locale]/(app)/notifications/page.tsx` |
| `/[locale]/profile/[username]` | `src/app/[locale]/(app)/profile/[username]/page.tsx` |
| `/[locale]/search` | `src/app/[locale]/(app)/search/page.tsx` |
| `/[locale]/settings` | `src/app/[locale]/(app)/settings/page.tsx` |
| `/[locale]/suggestions` | `src/app/[locale]/(app)/suggestions/page.tsx` |
| `/[locale]/[...rest]` | `src/app/[locale]/[...rest]/page.tsx` |
| `/[locale]/login` | `src/app/[locale]/login/page.tsx` |
| `/[locale]` | `src/app/[locale]/page.tsx` |
| `/[locale]/privacy` | `src/app/[locale]/privacy/page.tsx` |
| `/[locale]/terms` | `src/app/[locale]/terms/page.tsx` |

### D3. Migraciones → capítulo 04

- `supabase/migrations/20260502233945_remote_schema.sql`
- `supabase/migrations/20260506000001_fix_conversation_members_policy.sql`
- `supabase/migrations/20260506000002_fix_conversation_members_recursion.sql`
- `supabase/migrations/20260506000003_fix_conversation_members_select_recursion.sql`
- `supabase/migrations/20260512183131_dedupe_users_update_policies.sql`
- `supabase/migrations/20260512183147_harden_conversations_insert_policy.sql`
- `supabase/migrations/20260520000001_rpc_create_conversation_with_members.sql`
- `supabase/migrations/20260531000001_fix_group_members_self_join.sql`
- `supabase/migrations/20260531180450_rpc_discover_groups.sql`
- `supabase/migrations/20260531201838_drop_rpc_discover_groups.sql`
- `supabase/migrations/20260601000001_add_group_visibility.sql`
- `supabase/migrations/20260601000002_group_invitations.sql`
- `supabase/migrations/20260716000001_dm_only_between_friends.sql`

### D4. Tablas (creadas en migraciones) → capítulo 04

`conversation_members`, `conversations`, `friendships`, `group_invitations`, `group_members`, `group_posts`, `groups`, `list_items`, `list_members`, `lists`, `media`, `messages`, `notifications`, `recommendations`, `reports`, `suggestions`, `user_media`, `users`


### D5. Módulos `src/lib` → capítulos 02, 03, 06

- `src/lib/api/aggregate.ts`
- `src/lib/api/books-maps.ts`
- `src/lib/api/comicvine-maps.ts`
- `src/lib/api/comicvine.ts`
- `src/lib/api/discover-params.ts`
- `src/lib/api/discover.ts`
- `src/lib/api/genre-news.ts`
- `src/lib/api/jikan-maps.ts`
- `src/lib/api/jikan.ts`
- `src/lib/api/mangadex.ts`
- `src/lib/api/normalizer.ts`
- `src/lib/api/nsfw-filter.ts`
- `src/lib/api/openlibrary.ts`
- `src/lib/api/rawg-maps.ts`
- `src/lib/api/rawg.ts`
- `src/lib/api/search.ts`
- `src/lib/api/tmdb-maps.ts`
- `src/lib/api/tmdb.ts`
- `src/lib/api/valoracion.ts`
- `src/lib/claude/recommendations.ts`
- `src/lib/constants/avatarColors.ts`
- `src/lib/csp.ts`
- `src/lib/design/f0-tokens.ts`
- `src/lib/discover/filter-options.ts`
- `src/lib/discover/type-filters.ts`
- `src/lib/env.ts`
- `src/lib/library/actions.ts`
- `src/lib/library/queries.ts`
- `src/lib/library/stats.ts`
- `src/lib/logger.ts`
- `src/lib/rate-limit.ts`
- `src/lib/recommendations/match-score.ts`
- `src/lib/social/actions.ts`
- `src/lib/social/circle.ts`
- `src/lib/social/feed.ts`
- `src/lib/social/friends.ts`
- `src/lib/social/groups.ts`
- `src/lib/social/lists.ts`
- `src/lib/social/notifications.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/utils/auth-errors.ts`
- `src/lib/utils/index.ts`
- `src/lib/utils/safe-redirect.ts`

### D6. Componentes → capítulo 07

- `src/components/home/AiRecommendations.tsx`
- `src/components/home/GenreNews.tsx`
- `src/components/home/HeroSection.tsx`
- `src/components/home/MediaRow.tsx`
- `src/components/home/PopularInCircle.tsx`
- `src/components/icons/index.tsx`
- `src/components/layout/AppFooter.tsx`
- `src/components/layout/AuthHeader.tsx`
- `src/components/layout/AvatarDropdown.tsx`
- `src/components/layout/BottomNav.tsx`
- `src/components/layout/ErrorState.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/LanguageSwitcher.tsx`
- `src/components/layout/Logo.tsx`
- `src/components/layout/NavLinks.tsx`
- `src/components/layout/UnreadChatProvider.tsx`
- `src/components/legal/LegalDocument.tsx`
- `src/components/library/EpisodeProgress.tsx`
- `src/components/library/LibraryAction.tsx`
- `src/components/library/LibraryStatusModal.tsx`
- `src/components/media/MediaCard.tsx`
- `src/components/media/MediaDetail.tsx`
- `src/components/media/MediaGrid.tsx`
- `src/components/media/StreamingProviders.tsx`
- `src/components/media/SynopsisSection.tsx`
- `src/components/media/TrailerEmbed.tsx`
- `src/components/profile/ProfileBio.tsx`
- `src/components/profile/ProfileGenres.tsx`
- `src/components/profile/ProfileHeader.tsx`
- `src/components/profile/ProfileStats.tsx`
- `src/components/search/SearchBar.tsx`
- `src/components/search/SearchFilters.tsx`
- `src/components/search/SearchResults.tsx`
- `src/components/social/AddToListButton.tsx`
- `src/components/social/CreateGroupForm.tsx`
- `src/components/social/CreateListModal.tsx`
- `src/components/social/FriendCard.tsx`
- `src/components/social/FriendshipButton.tsx`
- `src/components/social/GroupCard.tsx`
- `src/components/social/InviteFriendsModal.tsx`
- `src/components/social/ListCard.tsx`
- `src/components/social/RecommendButton.tsx`
- `src/components/social/RecommendModal.tsx`
- `src/components/social/ReportButton.tsx`
- `src/components/ui/Avatar.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/ConfirmModal.tsx`
- `src/components/ui/ContentCard.tsx`
- `src/components/ui/FilterBar.tsx`
- `src/components/ui/FilterChip.tsx`
- `src/components/ui/KButton.tsx`
- `src/components/ui/KInput.tsx`
- `src/components/ui/MoreSheet.tsx`
- `src/components/ui/NotFoundContent.tsx`
- `src/components/ui/Pagination.tsx`
- `src/components/ui/Popover.tsx`
- `src/components/ui/SegmentedControl.tsx`
- `src/components/ui/Select.tsx`
- `src/components/ui/Spinner.tsx`
- `src/components/ui/StarRating.tsx`
- `src/components/ui/StatusSelector.tsx`
- `src/components/ui/TabButton.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/ToastProvider.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`

### D7. Tests → capítulo 08

| Carpeta | Ficheros |
|---|---|
| `tests/contract/jikan.contract.test.ts` | 1 |
| `tests/contract/mangadex.contract.test.ts` | 1 |
| `tests/contract/rawg.contract.test.ts` | 1 |
| `tests/contract/tmdb.contract.test.ts` | 1 |
| `tests/e2e/auth.spec.ts` | 1 |
| `tests/e2e/b3_5e_safety_net` | 6 |
| `tests/integration/auth` | 1 |
| `tests/integration/db` | 4 |
| `tests/unit/ai` | 2 |
| `tests/unit/api` | 17 |
| `tests/unit/app` | 2 |
| `tests/unit/claude` | 1 |
| `tests/unit/components` | 45 |
| `tests/unit/discover` | 2 |
| `tests/unit/error-boundaries` | 1 |
| `tests/unit/hooks` | 1 |
| `tests/unit/i18n` | 1 |
| `tests/unit/lib` | 4 |
| `tests/unit/library` | 4 |
| `tests/unit/pages` | 1 |
| `tests/unit/rate-limit` | 1 |
| `tests/unit/recommendations` | 1 |
| `tests/unit/security` | 2 |
| `tests/unit/settings` | 2 |
| `tests/unit/social` | 14 |
| `tests/unit/types` | 1 |
| `tests/unit/utils` | 1 |
