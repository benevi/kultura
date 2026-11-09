# HANDOVER — última sesión (2026-11-09)

**Rama:** `feat/v2-rediseno-integral`, PR #90 sin fusionar. Todo tras `ui_v2` (cookie o `UI_V2_DEFAULT=1`): sin él, la web sigue igual. Detalle: `docs/REDESIGN_AUDIT.md` §9 y §10. Decisiones: D-V2a…k.

## Hecho
- **Portada rehecha:** abanico + «Sigue por donde ibas», portadas dinámicas que rotan cada mes (D-V2h, D-V2i).
- **Inicio reconstruida** (`src/v2/home/`, D-V2j): «Por dónde vas», obra en curso grande y filas con +1. Revisión independiente hecha y corregida.
- **Fuente:** en v2 la Bricolage va con `swap`; con `optional` los títulos salían en Arial (D-V2k).

## Sin hacer (es lo más grande)
- **Resto de pantallas interiores:** tienen piel, no composición propia. **Siguiente: Biblioteca.**
- **Sin ver:** discover, search, library, lists, profile, settings, import, calendar, chat, groups, friends, notifications, suggestions, welcome, `u/*`, report, reset-password, email/*.
- **Sin piel:** best, legales, offline, series, anime (estáticas).

## Sin probar
Inicio solo se ha visto con Supabase simulado. Falta BD real y CUJ, preview de Vercel, secciones de Inicio con datos reales, Safari, Firefox, táctil real, lector de pantalla real.

## Siguiente
1. Víctor mira portada e Inicio con `ui_v2=1` y da nota contra los vetos.
2. Biblioteca, con el mismo método: pantalla en `src/v2/`, `if` en `page.tsx`, simulador de `tests/e2e/a11y/`.

## Decide Víctor
- Portada girada de Inicio frente al veto de repetir composición.
- Títulos en inglés de AniList en la página en español.
- La barra de progreso de la portada vuelve a 1 cada 10 unidades: es muestra, no porcentaje.
- Licencias de imágenes (TMDB, AniList, Steam, Open Library).
- `CLAUDE.md` (Preferencias) sigue citando el plan §6: conviene actualizarlo.

## Ojo
- **`/home` pesa 171 kB (tope 150):** ya eran 170 kB antes. `/lists`, 155 kB. Hay que reducirlo antes de `UI_V2_DEFAULT=1`.
- LCP móvil de la portada simulado 6,0 s (aviso, tope 2,5 s). Medir en Vercel.
- `vitest`: 15 fallos heredados; `register-form` a veces falla por tiempo.
- Las pruebas de `page.tsx` deben simular `@/lib/ui-v2`, porque `cookies()` falla fuera de una petición.
- Fuera de git a propósito: `PLAN_ESTRATEGICO.md`, `docs/auditoria/`, `.lighthouseci/`, `.playwright-mcp/`, `.taste-skill/`, `.impeccable/`, `PROMPT_INICIO.txt`, snapshots de `tests/unit/catalogo`.
- `next build` y `next dev` chocan en `.next`. No pasar `next build` por `| head`.
- Pendiente de Víctor: backup (R10), rotar contraseña de BD y `SUPABASE_DB_URL`, copia de `kultura-backup.key`, entrevistas F1.
- Squash-merge solo con su OK.
