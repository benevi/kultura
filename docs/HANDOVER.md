# HANDOVER — última sesión (2026-11-09)

**Rama:** `feat/v2-listas`, PR sin fusionar. Todo tras `ui_v2` (cookie o `UI_V2_DEFAULT=1`): sin él, la web sigue igual. Detalle: `docs/REDESIGN_AUDIT.md` §9–§13. Decisiones: D-V2a…n.

## Hecho
- **#90 y #91 fusionados:** portada rehecha, **Inicio** (D-V2j), **Biblioteca** (D-V2l) y **Descubrir** (D-V2m; **nota visual de Víctor pendiente**).
- **Listas** (`src/v2/lists/`, D-V2n): índice de baldas con lomos de portada y detalle en dos columnas. Revisada y corregida; **nota visual de Víctor pendiente**.

## Sin hacer (es lo más grande)
- **Resto de interiores:** tienen piel, no composición propia. **Siguiente: Perfil.**
- **Sin ver:** search, profile, settings, import, calendar, chat, groups, friends, notifications, suggestions, welcome, `u/*`, report, reset-password, email/*.
- **Sin piel:** best, legales, offline, series, anime (estáticas).
- `error.tsx` sigue v1 en todas; `loading.tsx`, también salvo en Biblioteca, Descubrir y Listas. `/u/*/l/*` (lista pública) sigue v1.

## Sin probar
Inicio, Biblioteca, Descubrir y Listas solo se han visto con Supabase simulado; Descubrir, además, con `/api/discover` simulado. Falta BD real y CUJ, proveedores reales, preview de Vercel, Safari, Firefox, táctil real, lector de pantalla real.

## Siguiente
1. Víctor mira Listas con `/api/ui-v2?v=1&next=/es/lists` y Descubrir con `/api/ui-v2?v=1&next=/es/discover`, y da nota contra los vetos.
2. Siguiente pantalla, mismo método: `src/v2/`, `if` en `page.tsx`, simulador de `tests/e2e/a11y/`, recorrido por el enlace del interruptor.

## Decide Víctor
- Portada girada de Inicio frente al veto de repetir composición.
- Títulos en inglés de AniList en la página en español.
- Licencias de imágenes (TMDB, AniList, Steam, Open Library).
- `CLAUDE.md` (Preferencias) sigue citando el plan §6: conviene actualizarlo.
- Salir de la v2: el marcador de `/lists` tenía el único enlace a `/api/ui-v2?v=0`. ¿Hace falta uno visible mientras dure la prueba?

## Ojo
- **Peso sobre el tope de 150 kB:** `/discover` 182 (178 antes), `/home` 171, `/library` 158, `/lists` 158 y `/lists/[id]` 177. Reducir antes de `UI_V2_DEFAULT=1`.
- **`SearchBar` en v1:** una respuesta de sugerencias que llega tras Enter abre el desplegable sobre los resultados. En v2 lo evita `settleOnSubmit`; la v1 se deja igual a propósito.
- LCP móvil de la portada simulado 6,0 s (aviso). Medir en Vercel.
- `vitest`: 15 fallos heredados; `register-form` a veces falla por tiempo.
- Las pruebas de `page.tsx` deben simular `@/lib/ui-v2`, porque `cookies()` falla fuera de una petición.
- Fuera de git a propósito: `PLAN_ESTRATEGICO.md`, `docs/auditoria/`, `.lighthouseci/`, `.playwright-mcp/`, `.taste-skill/`, `.impeccable/`, `PROMPT_INICIO.txt`, snapshots de `tests/unit/catalogo`.
- Chat en móvil (v1): el pie legal entra en el scroll y se ve bajo el campo de escribir. Arreglar al rehacer el chat.
- El pie de la app a veces entra tarde en la primera carga (CLS 0,06–0,07 a 768, visto en Biblioteca y en Listas, intermitente). Es del armazón, no de las pantallas.
- `next/dynamic` necesita un `<Suspense>` propio al abrirse por una acción: sin él, la página perdía el foco (D-V2n).
- `next build` y `next dev` chocan en `.next`. No pasar `next build` por `| head`.
- Pendiente de Víctor: backup (R10), rotar contraseña de BD y `SUPABASE_DB_URL`, copia de `kultura-backup.key`, entrevistas F1. Squash-merge solo con su OK.
