# HANDOVER — última sesión (2026-11-09)

**Rama:** `feat/v2-rediseno-integral`, PR #90 sin fusionar. Todo tras `ui_v2` (cookie o `UI_V2_DEFAULT=1`): sin él, la web sigue igual. Detalle: `docs/REDESIGN_AUDIT.md` §9. Decisiones: D-V2a…h.

## Hecho
- **Portada rehecha** tras «duele a la vista»: abanico + «Sigue por donde ibas» (B + A, D-V2h). Sin WebGL.
- **Portadas dinámicas:** series, películas, anime y manga vivos; juegos, libros y cómics de listas revisadas. Todas rotan cada mes.
- Revisión independiente hecha; importantes corregidos (`04_DECISIONES` §4).

## Sin hacer (es lo más grande)
- **Las pantallas interiores no están rediseñadas**: tienen piel, no composición propia. El master prompt pide todas.
- **Sin ver:** home, discover, search, library, lists, profile, settings, import, calendar, chat, groups, friends, notifications, suggestions, welcome, `u/*`, report, reset-password, email/*.
- **Sin piel:** best, legales, offline, series, anime (estáticas).

## Sin probar
Preview de Vercel, CUJ con BD real, Safari, Firefox, táctil real, lector de pantalla real, fallo real de proveedores.

## Siguiente
1. Víctor mira la portada con `ui_v2=1` y da nota contra los vetos.
2. Con su sesión, reconstruir las pantallas interiores una a una (home y biblioteca primero).

## Decide Víctor
- Manga en tendencia sin revisión humana (solo filtro de géneros y nota): ¿lista negra o lista revisada?
- Títulos en inglés de AniList en la página en español.
- La barra de progreso vuelve a 1 cada 10 unidades: es muestra, no porcentaje.
- Licencias de imágenes (TMDB, AniList, Steam, Open Library).
- `CLAUDE.md` (Preferencias) sigue citando el plan §6: conviene actualizarlo.

## Ojo
- LCP móvil simulado 6,0 s (aviso, tope 2,5 s). Medir en Vercel antes de tocar más.
- `/es` v2: 144 KB de JS de 150 KB.
- `vitest`: 15 fallos heredados; `register-form` a veces falla por tiempo.
- Fuera de git a propósito: `PLAN_ESTRATEGICO.md`, `docs/auditoria/`, `.lighthouseci/`, `.playwright-mcp/`, `.taste-skill/`, `.impeccable/`, `PROMPT_INICIO.txt`, snapshots de `tests/unit/catalogo`.
- `next build` y `next dev` chocan en `.next`. No pasar `next build` por `| head`: deja `.next` corrupto.
- Pendiente de Víctor: backup (R10), rotar contraseña de BD y `SUPABASE_DB_URL` (se pegó en una sesión), copia de `kultura-backup.key`, entrevistas F1.
- Squash-merge solo con su OK.
