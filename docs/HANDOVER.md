# HANDOVER — última sesión (2026-11-06)

**Fase:** F0 (`PLAN_ESTRATEGICO.md` §7.3). **Rama:** `docs/f0-funciones-v2` (sin push, sin PR).

## Hecho
- Las 8 decisiones de §12 registradas en `docs/04_DECISIONES_Y_RIESGOS.md` §1 (D1–D8) + riesgos R1–R7.
- Entregable: `docs/FUNCIONES_V2.md`, inventario del alcance v2.0 desde el código: 13 flujos, aparcados v2.1, transversales, 51 rutas de API con flujo dueño, 11 `.ts` de lógica a rescatar, huecos de los 8 CUJ, `isNotMigrated`.
- Las 5 dudas del inventario resueltas (D-I1…D-I5 en `04_DECISIONES` §1b).
- Comprobación: las 37 `page.tsx` y las 51 `route.ts` aparecen exactamente una vez en las tablas (script de cruce, `bad=0`).
- Revisión independiente del inventario lanzada (regla 2); su resultado va en el siguiente commit o en la próxima sesión.

## Estado del repo
- `master` al día con `origin/master` el 2026-11-06.
- Sin seguimiento en git: `docs/PLAN_ESTRATEGICO.md`, `docs/auditoria/`, `PROMPT_INICIO.txt`, `prototipos/`. Si `docs/` es la fuente de verdad (D8), hay que añadir los dos primeros (pendiente de OK de Víctor).
- Rama `feat/login-el-hueco` (`225a9be`) aparcada (R6); sus cambios sin commit se descartaron.

## Pendiente de Víctor (paneles)
- Crear proyecto «KULTURA 2.0» en claude.ai (D8).
- Consulta escrita a TMDB y ComicVine sobre donaciones (D4).
- Reabrir dominio antes de F1/F4 (D3, R1).
- Web Analytics + Speed Insights, reactivar `kultura-test`, custodia de la clave `age` (§7.3).

## Siguiente entregable propuesto (uno)
Interruptor `ui_v2` probado en `/es/lists` (§7.3): conmutador por `page.tsx`, cookie `ui_v2` vía `/api/ui-v2`, variable `UI_V2_DEFAULT`, pantallas nuevas en `src/v2/`. Modelo: Fable 5.1 / Opus 5.5 (interruptor de UI).
Alternativa: red de pruebas con BD real (8 CUJ, Supabase local en CI).
