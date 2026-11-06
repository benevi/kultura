# HANDOVER — última sesión (2026-11-06)

**Fase:** F0 (`PLAN_ESTRATEGICO.md` §7.3). **Rama:** `refactor/f0-limpieza` (PR abierto, sin merge).

## Hecho en esta sesión
- Entregable: **PR de limpieza de F0** (`[refactor]`/`[chore]`, sin cambios de comportamiento con el esquema de producción; regla 8, §7.5). Solo toca `src/lib`, `src/app/api` y los tests correspondientes.
- Un único `isNotMigrated` en `src/lib/supabase/not-migrated.ts`. Se borran los 13 conjuntos locales; `account-state.ts` lo reexporta solo para la UI vieja.
- Se retira la tolerancia a migraciones ya aplicadas en producción: biblioteca, diario, progreso, listas, ajustes, cuenta, email, moderación, analítica, IA y compartir. Se quitan 27 tests que solo probaban «migración sin aplicar» (lista en el PR).
- Se **queda** la tolerancia de push (`lib/push/dispatch.ts`, `api/push/*`) y la de `api/account/export/collect.ts`: `push.sql` y `push_throttle.sql` no están en producción.
- `import 'server-only'` en `src/lib/supabase/admin.ts`.
- Fuera `three` y `@types/three` (nada los importaba). El lockfile se editó a mano porque npm 11 borraba `next-intl/node_modules/@swc/helpers`.
- Fuera `GeistVF.woff` y `GeistMonoVF.woff` (van dentro del commit 1, no en uno aparte).

## Verificación
- Producción, consulta de catálogo de solo lectura (con OK de Víctor): 29 de 31 migraciones aplicadas, pero el historial solo registra 7. Evidencia en `04_DECISIONES` R9.
- `tsc` limpio; `next lint` limpio. `vitest` en Windows: los mismos 16 fallos conocidos (barras `\`, CRLF) y ninguno nuevo.
- Tamaño JS: el build local cambió entre el antes y el después porque `node_modules` cambió (reinstalación). La comparación buena es la del build de CI del PR frente a `master`.
- Revisión independiente: ver `04_DECISIONES` §4. CI (`cuj`, Lighthouse, Linux): ver el PR.

## Pendiente / ojo
- **R9:** no ejecutar `supabase db push` contra producción hasta reparar el historial. Las 2 migraciones de push las aplica Víctor después de probarlas en test.
- Siguiente PR posible: quitar las banderas de dos caminos (`RATING_SCALE_10`, `PROGRESS_V2`…). Necesita sus valores en Vercel.
- Vestigios que se van con la UI vieja: la reexportación de `isNotMigrated`, `migrated: true` y `progressV2Active()`.
- Restaurar los 3 snapshots CRLF de `tests/unit/catalogo/__snapshots__` después de `vitest` en Windows.
- Squash-merge: solo con OK de Víctor.
