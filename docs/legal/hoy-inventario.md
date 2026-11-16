# Inventario de portadas «hoy» (fase 8 · D-HOY-1)

Medido el 16-11-2026 en producción con [`hoy-inventario.sql`](hoy-inventario.sql) (solo agregados). Plan: `docs/PLAN_FASE8.md` §9.1–9.2.

## Por proveedor

| Proveedor | Host | Ruta en 2D | Títulos únicos | Entradas de biblioteca |
|---|---|---|---|---|
| TMDB | `image.tmdb.org` | directo | 34 | 51 |
| RAWG | `media.rawg.io` | directo | 13 | 15 |
| MangaDex | `uploads.mangadex.org` | optimizador | 12 | 15 |
| AniList | `s4.anilist.co` | directo | 12 | 14 |
| Open Library | `covers.openlibrary.org` | directo | 12 | 14 |
| ComicVine | `comicvine.gamespot.com` | optimizador | 12 | 14 |
| Google Books | `books.google.com` | directo | 1 | 1 |
| **Total** | | | **96** | **124** |

En 2D pasan por el optimizador 24 de 96 títulos (25 %) y 29 de 124 entradas (23 %). No hay portadas de Steam, MyAnimeList ni otros hosts guardadas en `media` (Steam sale en la landing y en las capturas de la ficha, no como portada guardada).

## Dónde se usa `/_next/image` (código, 16-11-2026)

| Sitio | Archivo | Qué pasa por el optimizador |
|---|---|---|
| Portadas en 2D | `src/components/media/PosterImage.tsx` → `posterLoader` (`src/lib/images/poster-url.ts`) | MangaDex (miniatura 256/512), ComicVine, Steam, `myanimelist.net` y cualquier host sin regla. TMDB, RAWG, AniList, Open Library, `cdn.myanimelist.net` y Google Books van directos |
| `/best` | `src/lib/best/poster.ts` (`bestPosterLoader`) | AniList; el resto, como en 2D |
| Galería 3D de la landing | `src/lib/landing/immersive.ts` (`textureUrl`) | **Todas** las portadas de la galería (WebGL necesita mismo origen o CORS) |
| Capturas de Steam en la ficha | `src/components/media/SteamSection.tsx` | `next/image` **sin `loader`**: siempre optimizador |
| Avatar | `src/components/ui/Avatar.tsx` | `next/image` sin `loader`, pero hoy ninguna llamada le pasa `src` (solo iniciales o personaje): sin efecto |

Componentes `next/image` sin `loader`: `SteamSection.tsx` y `Avatar.tsx`. No hay `unoptimized` ni `images.loaderFile`.

Las imágenes OG (`opengraph-image.tsx` de `[locale]`, `best`, `login`, `u/[username]` y `u/[username]/r/…`) las descarga el servidor y las incrusta en la imagen generada, que Vercel guarda en caché.

## Diferencias con la tabla §9.1 del plan

- **Landing:** la galería 3D manda todas sus portadas por el optimizador. La tabla no lo recogía.
- **TMDB:** nunca va al optimizador. Si la ruta no encaja, `posterLoader` devuelve la URL tal cual (directo), no `/_next/image`.
- **Caché:** `minimumCacheTTL` es de 7 días y es un **mínimo**. Vercel puede guardar la copia más tiempo si el proveedor lo indica. `/privacy` dice «copia temporal en caché, que caduca sola» (#173).

## Landing: copia propia y mapas de profundidad (encontrado el 16-11-2026)

- `.github/workflows/landing-media.yml` → `scripts/landing-media/build.py`, cada lunes desde el 4-11-2026. Descarga pósters y fondos de TMDB (tamaño `original`), Steam y MangaDex; los recorta a vertical y los recodifica. Calcula su mapa de profundidad con `depth-anything/Depth-Anything-V2-Base-hf` y sube imagen y mapa al bucket **público** `landing` de Supabase, con su fila en `landing_media`.
- Producción, 16-11-2026: 54 objetos en el bucket y 27 filas, 13 activas.
- Respaldo en el repo: `public/landing/fallback/`, 14 imágenes y 14 mapas (semana del 2-11-2026).
- Es **copia propia y derivado** sobre portadas de terceros, lo que §9.5 bloquea hasta G0. Víctor decide el 16-11-2026 **pausar la tarea** (sin `schedule`; queda el lanzamiento a mano). La landing sigue con la última semana activa. Lo ya guardado se queda y va al encargo legal: P1 (¿es aceptable?), P2 (recorte y recodificación) y P4 (profundidad).
- El modelo Base de Depth Anything V2 tiene licencia CC BY-NC 4.0 (no comercial; ficha de Hugging Face, comprobada el 16-11-2026); la variante Small es Apache 2.0. §9.8 ya pide solo Small: si se reanuda la tarea, cambiar de modelo.
