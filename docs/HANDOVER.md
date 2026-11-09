# HANDOVER — última sesión (2026-11-09)

**Rama:** `fix/landing-hero-retoque` (desde master, sin commit). La v2 sigue tras `ui_v2`. Detalle: `docs/REDESIGN_AUDIT.md` §9–§12. Decisiones: D-V2a…m, D-H1, D-H2.

## Hecho
- **Héroe de producción retocado (D-H1):** la palabra va detrás del personaje cuando hay un umbral que recorta limpio (`cutThreshold`, `engine.ts`); si no, delante. Prototipos de portada abandonados. Las notas sin commit de `feat/v2-listas` (D-V2o) están en `git stash`. **D-H2:** `/es` sirve siempre ese héroe, también con la v2 (fuera el rewrite a `portada-v2`).
- **#90 fusionado:** portada rehecha, **Inicio** (`src/v2/home/`, D-V2j) y **Biblioteca** (`src/v2/library/`, D-V2l).
- **Descubrir** (`src/v2/discover/`, D-V2m): banda de formatos que tiñe la pantalla y pared de portadas. Revisada y corregida; **nota visual de Víctor pendiente**.
- **Interruptor:** el enlace `/api/ui-v2` guarda la cookie también sin sesión.
- **Fuente:** en v2 la Bricolage va con `swap` (D-V2k).

## Sin hacer (es lo más grande)
- **Resto de interiores:** tienen piel, no composición propia. **Siguiente: Listas.**
- **Sin ver:** search, lists, profile, settings, import, calendar, chat, groups, friends, notifications, suggestions, welcome, `u/*`, report, reset-password, email/*.
- **Sin piel:** best, legales, offline, series, anime (estáticas).
- `error.tsx` sigue v1 en todas; `loading.tsx`, también salvo en Biblioteca y Descubrir.

## Sin probar
Inicio, Biblioteca y Descubrir solo se han visto con Supabase simulado; Descubrir, además, con `/api/discover` simulado. Falta BD real y CUJ, proveedores reales, preview de Vercel, Safari, Firefox, táctil real, lector de pantalla real.

## Siguiente
1. Víctor mira Descubrir con `/api/ui-v2?v=1&next=/es/discover` y da nota contra los vetos.
2. Siguiente pantalla, mismo método: `src/v2/`, `if` en `page.tsx`, simulador de `tests/e2e/a11y/`, recorrido por el enlace del interruptor.

## Decide Víctor
- Portada girada de Inicio frente al veto de repetir composición.
- Títulos en inglés de AniList en la página en español.
- Licencias de imágenes (TMDB, AniList, Steam, Open Library).
- `CLAUDE.md` (Preferencias) sigue citando el plan §6: conviene actualizarlo.

## Ojo
- **Peso sobre el tope de 150 kB:** `/discover` 182 (178 antes), `/home` 171, `/library` 158, `/lists` 155. Reducir antes de `UI_V2_DEFAULT=1`.
- **`SearchBar` en v1:** una respuesta de sugerencias que llega tras Enter abre el desplegable sobre los resultados. En v2 lo evita `settleOnSubmit`; la v1 se deja igual a propósito.
- LCP móvil de la portada simulado 6,0 s (aviso). Medir en Vercel.
- `vitest`: 15 fallos heredados; `register-form` a veces falla por tiempo.
- Las pruebas de `page.tsx` deben simular `@/lib/ui-v2`, porque `cookies()` falla fuera de una petición.
- Fuera de git a propósito: `PLAN_ESTRATEGICO.md`, `docs/auditoria/`, `.lighthouseci/`, `.playwright-mcp/`, `.taste-skill/`, `.impeccable/`, `PROMPT_INICIO.txt`, snapshots de `tests/unit/catalogo`.
- Chat en móvil (v1): el pie legal entra en el scroll y se ve bajo el campo de escribir. Arreglar al rehacer el chat.
- `next build` y `next dev` chocan en `.next`. No pasar `next build` por `| head`.
- Pendiente de Víctor: backup (R10), rotar contraseña de BD y `SUPABASE_DB_URL`, copia de `kultura-backup.key`, entrevistas F1. Squash-merge solo con su OK.
