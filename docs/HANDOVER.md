# HANDOVER — última sesión (2026-11-06)

**Fase:** F0 (`PLAN_ESTRATEGICO.md` §7.3). **Rama:** `refactor/f0-rescate` (PR abierto, sin merge).

## Hecho en esta sesión
- Entregable: **PR de rescate de F0** (`[refactor]`, sin cambios de comportamiento; regla 8, §7.5). Mapa completo en `docs/RESCATE_F0.md`.
- 10 `.ts` de `src/app/[locale]` → `src/lib/{auth,supabase,recommendations,home,discover,share,import,platforms}` y `src/hooks/useFilterGroups.ts`. `discover-config` partido: lógica a `src/lib/discover/`, iconos y esqueleto viejos a `src/components/discover/discover-icons.ts`. `share/route.ts` se queda (route handler).
- 4 módulos de `@/app/api` que usaba la UI → `src/lib/account/{identity,account-state}.ts`, `src/lib/social/{lists-shared,reports}.ts`. Sin reexportes en las rutas viejas; `vi.mock` reapuntados.
- Hooks: `src/hooks/useAuthFlow.ts` (de `LoginPage`) y `src/hooks/useAccountSettings.ts` (de `SettingsForm`), generados moviendo líneas tal cual; los componentes solo pintan.
- `docs/RESCATE_F0.md` §3–§4: destino de los 36 tests `.ts` que importan UI (23 conservar, 5 reapuntados, 1 mixto, 3 rehacer con v2, 4 candidatos a 2.º rescate) y de los 13 `design|visual` (10 rehacer, 3 retirar; decide F2 paso 5). No se borra nada.

## Verificación
- `tsc` limpio; `next lint` limpio.
- `vitest` en Windows: mismos 16 fallos que `master` (rutas con `\`, CRLF), 4630 tests en ambos; ninguno nuevo.
- Revisión independiente (subagente Opus): 1 grave (`schema-drift` citaba la ruta vieja como texto) y 2 menores, corregidos. Registro en `04_DECISIONES` §4.
- CI (`cuj`, Lighthouse, tests en Linux): ver el PR.

## Pendiente / ojo
- Al correr `vitest` en Windows se reescriben 3 snapshots de `tests/unit/catalogo/__snapshots__` solo por CRLF: restaurarlos con `git checkout` antes de hacer commit.
- 2.º rescate candidato (no hecho): lógica dentro de `src/components` (`landing/engine`, `pwa/install-policy`, `pwa/sw-register`, `pwa/share-target`).
- Para v2: `useAccountSettings` usa `useToastContext`; `useFilterGroups` usa `discover-icons` (UI vieja).
- Siguiente PR de F0: limpieza (`isNotMigrated` único, `server-only` en `admin.ts`, quitar `three` y Geist).
- Squash-merge: solo con OK de Víctor.
