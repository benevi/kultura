# NOW
> Una sola tarea activa.

## Estado

E83 → ✅ **CERRADA 2026-06-07** (commit código `edca570`). Entrega de notificaciones rota a nivel global: `notifications` tiene RLS habilitado con solo policies SELECT/UPDATE, **sin INSERT** → todo insert vía cliente anon (sesión de usuario) era denegado por default-deny. Los 3 tipos (`recommendation`, `list_invite`, `group_invite`) insertaban best-effort sin error-check → fallo silencioso: invitaciones/recos creadas pero notif nunca llegaba al destinatario. Fix opción B: nuevo `src/lib/supabase/admin.ts` (`createAdminClient()` service-role, bypassa RLS, key sin `NEXT_PUBLIC_`, throw si falta) usado en los 3 inserts + `console.error('[E83] notif insert failed', …)` (ya no mudo); la operación principal no falla si la notif falla. `.env.test.local` += `SUPABASE_SERVICE_ROLE_KEY` (valor de kultura-test, gitignored) para E2E. tsc 0, lint 0, vitest **765 passed** (761+3 migradas+1 regresión).

E59 → ✅ **CERRADA 2026-06-11** (commit final R6 `d080690`). Rediseño completo del filtro Descubrir entregado en sub-pasos R0→R6: nueva `FilterBar` v3.1 (trigger-pills + Popover Radix, acento verde DS), `TYPE_FILTERS` como fuente de verdad de triggers por tipo (política A), filtros nativos + post-filtros server-side (R4), modo `type=all` con badge por card (R5), e i18n de labels vía namespace `discoverFilters` (R6) con value=slug intacto en URL. tsc 0, lint 0, vitest 1126 passed, Playwright 16/16 (es+en), smoke con capturas. Deuda separada del acento rojo legacy fuera de FilterBar → E82.

E74 → ✅ **CERRADA 2026-06-06** (commit código `f353b13`). Grupos inalcanzables en móvil: `BottomNav` (`md:hidden`) no incluía `/groups`; desktop sí. Sustituido ítem `profile` por `groups` (icono lucide `Users`, label `nav.groups` ya existente). Perfil sigue accesible en móvil vía `AvatarDropdown` del header (`sticky`, sin gate de viewport). Prop `username` eliminada + caller `(app)/layout.tsx` y test unit actualizados. lint 0, tsc 0, vitest 639 passed.

E73 → ✅ **CERRADA 2026-06-06** (commit `642a56c`). Fix encoding de `docs/BACKLOG.md`: mojibake por doble-encode CP1252→UTF-8 revertido solo en tokens dañados (478 revertidos, 0 leads `ÃÂâ` restantes), BOM+CRLF preservados, conteos post-fix validados contra el audit. Era deuda de documentación, no de código; sin hook (repo sin pre-commit).

E51 → ✅ **CERRADA 2026-06-05** (commit código `4ce64d4`). Validación cliente + errores granulares en `SuggestionsForm`: `trim()` + rechazo pre-fetch si subject<3/description<10 (`errorTooShort`), 429 → `errorRateLimit`, state `errorKey` + `t(errorKey)`. 2 claves nuevas en namespace `suggestions` es/en. Paridad i18n 471=471. tsc 0, lint 0, vitest 639 passed.

E72 → ✅ **CERRADA 2026-06-05** (commit código `9cc9b37`, re-etiquetada 2026-06-06). Fix doble render del mensaje optimista en `ConversationClient` (reconciliar `temp-*` con UUID real en respuesta POST + handler realtime). Antes etiquetada E52 por error; era trabajo distinto. tsc 0, lint 0, vitest 639 passed.

E52 → ✅ **CERRADA 2026-06-06** (commit código `589b870`). Silent fail real de carga: `.catch(() => setLoading(false))` en `ChatClient` y `ConversationClient` tragaba el error de fetch → pantalla vacía sin feedback. Fix: state `loadError`, carga en `useCallback`, render distingue cargando / error (i18n `loadError` + botón `retry`) / vacío real. 2 claves nuevas chat es/en, paridad 473=473. tsc 0, lint 0, vitest 639 passed.

E53 → ✅ **CERRADA 2026-06-05** (commit código `6cb9c36`). i18n del contador de conversaciones: string hardcodeado `${conversations.length} conversaciones` en `ChatClient.tsx:80` → `t('conversationCount', { count })`. Nueva clave `chat.conversationCount` con plural ICU en es/en (paridad 14=14 en namespace chat). tsc 0, lint 0, vitest 639 passed.

E67 → ✅ **CERRADA 2026-06-05** (commit código `6d30a42`). Test pollution fix: split del bloque parser de `tests/unit/ai/ai-recommendations.test.ts` a `tests/unit/ai/recommendations-parser.test.ts` (carga el módulo REAL, sin mock de `@/lib/claude/recommendations`), fixtures anidadas reales para `getLibraryContext`. tsc 0, lint 0, vitest **639 passed**, determinista en shuffle seeds 12345 (antes 5 fail) y 99999.

E62/E63/E64 → ✅ **CERRADAS 2026-06-05** (commit código `47becaf`). Tres fixes de deuda: E62 `res.ok` en las 3 mutaciones de `ListDetail` (cerrada completa, era el único archivo afectado según Fase 0), E63 `useState` muerto en `ListsClient` + `router.refresh()` en `CreateListModal`, E64 tokens DS en `RecommendModal`. tsc 0, lint 0, vitest 639 passed.

E45 → ✅ **CERRADO COMPLETO 2026-06-04** (a✅ b✅ c✅ d✅). E45-d cerrado: d.1 backend (commit 410340c) + d.2 UI (commit d96e40f). Invitaciones a grupos funcionando end-to-end: owner invita amigos vía modal, invitee acepta/rechaza desde notificaciones, trigger da el alta. vitest 639 passed, i18n paridad 465=465.

## Tarea activa

**BATCH-PUSH — push del batch completo + validación en preview de Vercel.**

### Qué cambia
- `git push origin master` del batch acumulado en local (~23 commits sin subir, hasta `d080690` E59-R6 incluido). No hay cambios de código nuevos: es operación de release.
- Tras el push, Vercel genera un deployment de preview (o promueve según config). Validar el deploy ejecutando la regla #11 de CLAUDE.md: no basta con headers/status/logs verdes — abrir la app desplegada y usar las secciones críticas.

### Cómo sé que funciona
1. `git push` sin error; `git log origin/master..master` **vacío** (todo subido).
2. Confirmar hash de `origin/master` == hash local de `master`.
3. Vercel: deployment con estado **Ready** (sin fallo de build).
4. Validación funcional (regla #11) sobre la URL del deploy: auth (login), Descubrir (los filtros R6 rediseñados — abrir popovers, comprobar labels traducidos es/en, badge en `type=all`), biblioteca, feed/grupos, chat, perfil. Reportar cualquier fallo visual o sección faltante aunque build+tests estén verdes.

### Archivos que toco
- Ninguno de código (operación git/deploy). Si la validación destapa un bug → regla de emergencia: `{ID}-FIX` en NOW, arreglar, verificar, retomar.

### Cuándo paro
- `origin/master..master` vacío + deploy Ready + validación funcional pasada (o bug reportado). Parar y esperar confirmación del usuario antes de la siguiente tarea del BACKLOG.

Nota: smoke test manual de la ruta crítica E45-d se saltó por decisión del usuario (requería 2 cuentas logueadas + verificación del trigger en Supabase prod). Pendiente como validación funcional post-deploy (regla #11 CLAUDE.md) si se quiere confirmar en prod.
