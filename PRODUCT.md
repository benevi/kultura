# Product

<!-- impeccable:product-schema 1 -->

Confirmado por Víctor el 2026-11-08 (entrevista de `impeccable init`). Lo que viene de otra fuente lo indica.

## Platform

web

## Users
Fan de varios formatos: sigue a la vez series, películas, anime, manga, libros, cómics y juegos, y quiere llevarlo todo en un solo sitio. Vive en España y usa la web en español.

Sus momentos de uso (del brief aprobado, `docs/02_DISEÑO_BRIEF.md` §A.1):
- en el móvil, al acabar un episodio o capítulo: «¿por dónde iba?» y marcarlo;
- en el escritorio: importar, ordenar y hacer listas.

Su perfil y sus listas se pueden compartir, pero no son el motivo principal para entrar.

## Product Purpose
Llevar al día todo lo que ves, lees y juegas, y saber exactamente por dónde vas en cada cosa.

## Positioning
Las cuatro cosas juntas, que ningún competidor (TV Time, Letterboxd, FilmAffinity, Trakt) puede decir a la vez:
- **7 formatos juntos** en una misma web: películas, series, anime, manga, libros, cómics y juegos.
- **En español de verdad:** pensada desde España, no traducida.
- **Tus datos son tuyos:** importas y exportas todo; si la web cierra, no pierdes nada.
- **Control unidad a unidad:** sabes por qué episodio, capítulo o página vas.

## Operating Context
Datos de progreso reales por formato: «T2 E5», «cap. 112», «p. 240», «12 h». Portadas reales de TMDB, AniList, MangaDex, Open Library, Comic Vine y RAWG/Steam (rutas en `src/`).

## Capabilities and Constraints
- Next.js 15, React 19, next-intl (es/en), Supabase, Vercel Hobby. Textos en `messages/{es,en}.json`.
- Del `CLAUDE.md` del repo: WCAG 2.2 AA, JS inicial ≤ 150 KB por ruta, CLS ≤ 0,05, y funciona sin WebGL y con `prefers-reduced-motion`. Víctor no lo marcó en la entrevista como compromiso de marca, pero sigue siendo puerta del repo.
- **Decisión abierta:** el plan (§5.1), D-F1d y D-F2a fijan la cuña «series y películas ES» y el titular «Tus series, al día.». Este usuario principal hace del pack lo principal y choca con ambos. Se registra en `docs/04_DECISIONES_Y_RIESGOS.md` y lo decide Víctor.

## Brand Commitments
- Nada de dinero en la web: ni precios, ni «gratis», ni donaciones en la portada.
- Sin cifras sin fuente y sin hablar de IA.
- El material visual son portadas reales; sin ilustraciones ni 3D generado.
- Nombre: Kultura. Tono: `docs/VOZ.md`.

## Evidence on Hand
Sin testimonios ni cifras de usuarios publicables. Evidencia de mercado en `docs/04_DECISIONES_Y_RIESGOS.md`; entrevistas de F1 pendientes.
