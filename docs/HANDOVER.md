# HANDOVER — última sesión (2026-11-09)

**Rama:** `feat/v2-rediseno-integral`. Todo tras `ui_v2` (cookie o `UI_V2_DEFAULT=1`): sin él, la web sigue igual. Detalle: `docs/REDESIGN_AUDIT.md`. Decisiones: D-V2a…g.

## Hecho
- Dirección «Láminas», elegida por Víctor («Fusions»), sin que haya visto aún el resultado.
- **Portada reconstruida** (`/es`, `/en`) con motor WebGL propio y póster como alternativa.
- **Piel común** en todas las rutas dinámicas (`V2Scope`, `skin.css`). Acceso y ficha con ajustes propios y captura.
- Revisión independiente hecha; graves corregidos (`04_DECISIONES` §4).

## Sin hacer (es lo más grande)
- **Las pantallas interiores no están rediseñadas**: tienen piel, no composición propia. El master prompt pide todas.
- **Sin ver:** home, discover, search, library, lists, profile, settings, import, calendar, chat, groups, friends, notifications, suggestions, welcome, `u/*`, report, reset-password, email/*. Exigen sesión o no se capturaron.
- **Sin piel:** best, legales, offline, series, anime (estáticas).

## Sin probar
Preview de Vercel (caché de `/es`: `x-vercel-cache` y ETag con y sin cookie), CUJ con BD real, Safari, Firefox, dispositivos físicos, fps medidos, Lighthouse tras los últimos arreglos.

## Siguiente
1. Víctor mira la preview del PR con `ui_v2=1` y da nota contra los vetos.
2. Con su sesión, verificar las pantallas interiores y reconstruirlas una a una (home y biblioteca primero).

## Decide Víctor
- La portada usa una obra real con episodio fijo como muestra (`+1` no guarda nada). ¿Se queda?
- Franja negra opaca del marcador: corta el objeto 3D al hacer scroll parcial. Se dejó por legibilidad.
- `CLAUDE.md` (Preferencias) sigue citando Bricolage/chaflán y el plan §6: conviene actualizarlo.

## Ojo
- `vitest`: 15 fallos heredados, ninguno de esta rama; `register-form` a veces falla por tiempo.
- `/es` v2 148.365 B de 153.600: poco margen. Nada de GSAP/Three sin medir.
- Fuera de git a propósito: `PLAN_ESTRATEGICO.md`, `docs/auditoria/`, `.lighthouseci/`, `.playwright-mcp/`, `.taste-skill/`, `PROMPT_INICIO.txt`, snapshots de `tests/unit/catalogo` (solo finales de línea).
- `next build` y `next dev` chocan en `.next`.
- Pendiente de Víctor: backup de hoy (R10), rotar contraseña de BD y `SUPABASE_DB_URL` (se pegó en una sesión), copia de `kultura-backup.key`, entrevistas F1.
- Squash-merge solo con su OK.
