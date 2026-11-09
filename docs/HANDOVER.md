# HANDOVER — última sesión (2026-11-09)

**Rama:** `feat/v2-rediseno-integral`, PR #90 sin fusionar. Todo tras `ui_v2` (cookie o `UI_V2_DEFAULT=1`): sin él, la web sigue igual. Detalle: `docs/REDESIGN_AUDIT.md` §9–§11. Decisiones: D-V2a…l.

## Hecho
- **Portada rehecha:** abanico + «Sigue por donde ibas», portadas dinámicas que rotan cada mes (D-V2h, D-V2i).
- **Inicio** (`src/v2/home/`, D-V2j) y **Biblioteca** (`src/v2/library/`, D-V2l): pantallas propias, revisadas y corregidas.
- **Interruptor:** el enlace `/api/ui-v2` guarda la cookie también sin sesión; antes, tras el login se aterrizaba en la vieja.
- **Fuente:** en v2 la Bricolage va con `swap`; con `optional` los títulos salían en Arial (D-V2k).

## Sin hacer (es lo más grande)
- **Resto de interiores:** tienen piel, no composición propia. **Siguiente: Descubrir o Listas.**
- **Sin ver:** discover, search, lists, profile, settings, import, calendar, chat, groups, friends, notifications, suggestions, welcome, `u/*`, report, reset-password, email/*.
- **Sin piel:** best, legales, offline, series, anime (estáticas).
- `error.tsx` sigue v1 en todas; `loading.tsx`, también salvo en Biblioteca.

## Sin probar
Inicio y Biblioteca solo se han visto con Supabase simulado. Falta BD real y CUJ, preview de Vercel, Safari, Firefox, táctil real, lector de pantalla real.

## Siguiente
1. Víctor mira portada, Inicio y Biblioteca con `ui_v2=1` y da nota contra los vetos.
2. Siguiente pantalla, mismo método: `src/v2/`, `if` en `page.tsx`, simulador de `tests/e2e/a11y/`, recorrido por el enlace del interruptor.

## Decide Víctor
- Portada girada de Inicio frente al veto de repetir composición.
- Abandonada en blanco y negro, sin etiqueta: ¿basta? (D-V2l)
- Títulos en inglés de AniList en la página en español.
- Licencias de imágenes (TMDB, AniList, Steam, Open Library).
- `CLAUDE.md` (Preferencias) sigue citando el plan §6: conviene actualizarlo.

## Ojo
- **Peso sobre el tope de 150 kB:** `/home` 171, `/library` 158 (154 antes), `/lists` 155. Reducir antes de `UI_V2_DEFAULT=1`.
- LCP móvil de la portada simulado 6,0 s (aviso). Medir en Vercel.
- `vitest`: 15 fallos heredados; `register-form` a veces falla por tiempo.
- Las pruebas de `page.tsx` deben simular `@/lib/ui-v2`, porque `cookies()` falla fuera de una petición.
- Fuera de git a propósito: `PLAN_ESTRATEGICO.md`, `docs/auditoria/`, `.lighthouseci/`, `.playwright-mcp/`, `.taste-skill/`, `.impeccable/`, `PROMPT_INICIO.txt`, snapshots de `tests/unit/catalogo`.
- `next build` y `next dev` chocan en `.next`. No pasar `next build` por `| head`.
- Pendiente de Víctor: backup (R10), rotar contraseña de BD y `SUPABASE_DB_URL`, copia de `kultura-backup.key`, entrevistas F1. Squash-merge solo con su OK.
