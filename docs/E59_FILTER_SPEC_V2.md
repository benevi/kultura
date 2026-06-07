# E59 — Spec filtros Descubrir V2 (rediseño desde mockup)
Sustituye E59_FILTER_SPEC. Mockup = fuente de verdad. Política A: pares sin dato en la API se OCULTAN. "nunca trigger que mienta" sigue vigente. "Todos" agregado entra.

## Barra (layout)
- Fila TIPO: label "TIPO" + chips grandes redondeados, single-select. Orden: Todos, Películas, Series, Anime, Libros, Manga, Videojuegos, Cómics.
- Fila FILTROS: label "FILTROS" + filtros como trigger-pill con chevron; TODOS abren Popover (NINGUNO inline) + "Ordenar: <valor>" pill alineado a la derecha (ml-auto).
- La barra ocupa su alto; el grid fluye debajo SIN solapamiento.

## Tipos (value→label)
all→Todos, movie→Películas, tv→Series, anime→Anime, book→Libros, manga→Manga, game→Videojuegos, comic→Cómics.

## Matriz (filtros por tipo, en orden; 5 sin-dato ya excluidos)
all: genero, anio, valoracion, plataforma
movie: genero, anio, valoracion, duracion, plataforma, idioma
tv: genero, anio, valoracion, estado, temporadas, plataforma, idioma
anime: genero, anio, valoracion, demografia, estado, idioma
manga: genero, anio, valoracion, demografia, estado, volumenes, idioma
book: genero, anio, editorial, formato, idioma
game: plataforma, genero, modojuego, anio, valoracion, duracionmedia, estado
comic: genero, anio, editorial, volumenes, idioma
(ordenar = aparte, derecha, en todos.)

> Divergencia R2 (datos): comic NO renderiza `genero`. ComicVine no expone género en issues y no hay catálogo en comicvine-maps. Política "nunca trigger que mienta" prevalece sobre el mockup en esta única celda. Reintroducir si aparece fuente de género para cómics.

## Soporte backend
NATIVO: valoracion(movie/tv/anime/manga), duracion(movie), estado(tv/anime/manga), plataforma, genero, anio, idioma, demografia, formato-ebook(book).
POST-FILTER (overfetch, caveat paginación E79): valoracion(game=metacritic), temporadas(tv=metadata.seasons, R4c-2), volumenes(manga=metadata.volumes; comic=count_of_issues del volumen vía el batch /volumes/ existente, R4c-2 — corrige la nota anterior que lo daba por hecho, era falso/QA), modojuego(game tags), duracionmedia(game playtime), estado(game tag Early Access), editorial(book=substring de publisher, R4c-2; comic=substring de publisher resuelto), formato-físico(book degradado).
OCULTOS (política A): valoracion×book, valoracion×comic, estado×book, estado×comic, temporadas×anime.

## Opciones + kind (labels ES del mockup; values estables)
genero (multi, searchable "Buscar género…"): catálogo POR TIPO (usar *-maps existentes).
anio (single): 2026,2025,2024,2023,2020s,2010s,2000s,Clásicos. Buckets relativos al año actual (4 años+3 décadas+classic). values: YYYY | "2020s" | "2010s" | "2000s" | "classic".
valoracion (single): 9→"9+ Excepcional",8→"8+ Muy buena",7→"7+ Buena",6→"6+ Aceptable".
plataforma (multi): streaming(movie/tv/all): Netflix,HBO Max,Prime Video,Disney+,Apple TV+. game: PC,PS5,Xbox Series,Switch,Móvil. values=IDs/slugs de los maps.
duracion (movie, single): <90 min,90–120 min,120–150 min,>150 min.
idioma (multi): Español,Inglés,Japonés (VO),Coreano,Francés. values ISO: es,en,ja,ko,fr.
estado (multi, POR TIPO solo lo soportado): tv/anime: En emisión,Finalizada,Próximamente. manga: En curso,Finalizada,Pausado,Discontinuada,Próximamente. game(post): Early Access,Lanzado.
temporadas (tv, single, POST): 1,2–3,4–6,7+.
demografia (anime/manga, multi): Shonen,Seinen,Shojo,Josei,Kodomo.
volumenes (manga/comic, single, POST): 1 tomo,2–5,6–20,20+.
editorial (book/comic, multi, searchable "Buscar editorial…", POST): Planeta,Norma,Ivrea,Panini,Salamandra,Image,SM (ajustable por tipo).
formato (book, multi): Físico(degradado),Digital,Audiolibro.
modojuego (game, multi, POST/tag): 1 jugador,Multijugador,Cooperativo,Online.
duracionmedia (game, single, POST): <10 h,10–30 h,30–60 h,60+ h.
ordenar (single, derecha): Popularidad,Mejor valorados,Más recientes,A — Z. values: popularity,rating,recent,title_az.

## "Todos" agregado
fetch Promise.allSettled sobre 7 familias → merge MediaItem[] → orden global real para rating/recent/title_az; popularity=interleave proxy. overfetch+sort+slice, totalPages estimado. Filtros: solo genero,anio,valoracion,plataforma (plataforma solo afecta movie/tv/game). Errores parcial-ok.

## kind model (FilterBar v3)
TODO Popover. kinds: single (single-select), multi (checkboxes), searchable (multi+buscador). sort=single variante etiquetada a la derecha. Se elimina render inline.

## i18n
labels ES = objetivo; values=slugs/IDs estables. Paridad EN en R6.
