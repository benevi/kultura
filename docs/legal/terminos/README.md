# Términos de los proveedores (fase 8 · M1)

Plan: `docs/PLAN_FASE8.md` §5 (v4) y §9.4 de la v3. Leídos el **17-11-2026**. Atribución puesta al día con la fase 8.1 (#216–#219). Próxima revisión: **mayo de 2027** (cada 6 meses).

> No es asesoría legal. Es un resumen de lo que dicen las páginas, para el encargo legal (G0) y para `provider_art_policy` (8A.2).

## Cómo se guarda la copia fechada

- El repo es público y los términos tienen derechos de autor. Por eso no se copia el texto entero: se guarda la URL, la fecha impresa, la fecha de lectura y una **instantánea de la Wayback Machine** (archive.org). Es una copia fechada, independiente y verificable.
- Cada fila resume solo lo que afecta a KULTURA: uso comercial, atribución, caché, derivados y enlace directo a imágenes.
- Estado `[V-2026-11-17]`: leído en la página oficial ese día. `[PV]`: pendiente de verificar (página no legible o cláusula no encontrada).

## Matriz por proveedor

| Proveedor | Cómo lo usa KULTURA | Uso comercial | Atribución | Caché | Derivados (redimensionar, OG, KTX2, profundidad) | Estado |
|---|---|---|---|---|---|---|
| TMDB | API oficial; portadas directas. **F5 (fase 8.5):** imágenes apaisadas sin rótulo (`include_image_language=null`) en la cabecera de la ficha «Sala» de esa obra: carga directa de `image.tmdb.org`, sin optimizador ni copia; recorte y velo solo en CSS. En la ficha de un anime cruzado por Wikidata, segunda línea de fuente «Imagen, tráiler y disponibilidad: TMDB» | Solo no comercial; lo comercial necesita un acuerdo aparte | Logo + aviso de no respaldo (§3). **Cumplido** | Máximo 6 meses (§1.C) | Prohibido hacer derivados del contenido (§1.C). La OG compuesta roza esto. Recortar y velar en CSS no compone una imagen nueva (revisión F5, 24-11-2026) | [V-2026-11-24] |
| RAWG | API oficial; portadas directas | Gratis hasta 20.000 peticiones al mes y 100.000 usuarios al mes (§8.2.1). La tabla de precios dice «no comercial» | Fuente + enlace activo en cada página con sus datos (§8.2.1). **Cumplido en el pie** | No la regula | Prohíbe reproducir o redistribuir sin permiso (§6.2) | [V-2026-11-17] |
| ComicVine | API oficial; **siempre por el optimizador** | Solo no comercial | Enlace a Comic Vine en las páginas con sus datos. **Cumplido en el pie** (#216) | Recomienda cachear las respuestas; sin plazo | Prohíbe reproducir los datos en otra forma | Página de la API [V-2026-11-17]; términos de Fandom [PV] (403) |
| Steam | `store.steampowered.com/api/appdetails`; capturas por el optimizador; landing | La Web API es gratuita para uso personal del usuario final | Sin afiliación aparente; enlaces sin `nofollow` (§3, §5). **Cumplido en el pie** | Sin plazo; borrar al terminar (§11) | No hay cláusula. Las cápsulas son de cada estudio | Términos de la Web API [V-2026-11-17]; `appdetails` no está en la Web API documentada [PV] |
| AniList | API GraphQL; portadas directas; `/best` por el optimizador | Gratis si no comercial o con menos de 150 $ al mes de ingresos | No se exige (solo reglas de nombre) | Prohíbe usarla como almacén y la recogida masiva | Sin cláusula | [V-2026-11-17] |
| MangaDex | API oficial; **siempre por el optimizador** | Solo sin anuncios ni servicios de pago | Obligatorio citar a MangaDex. **Cumplido en el pie** (texto) | Sin cláusula | Sin cláusula. Portadas subidas por usuarios: procedencia incierta (P7) | Docs de la API [V-2026-11-17]; términos del sitio [PV] (desafío anti-bots) |
| MyAnimeList (vía Jikan) | **Retirado en la fase 8.1** (#217): ninguna llamada a `api.jikan.moe` ni portadas de `cdn.myanimelist.net`. Producción no tenía ningún id suyo. Queda solo importar la lista que el usuario exporta de MAL y sube él mismo; los títulos se buscan en AniList | — | Ya no es fuente de datos: fuera del pie, de `/privacy` y de `/terms` (#219) | — | — | Acuerdo de API y términos del sitio [V-2026-11-17], por si se vuelve a usar |
| Open Library | API + Covers API; portadas directas | No es infraestructura comercial; uso personal sin problema | De cortesía (no obligatoria). Nombrado en el pie | Por ISBN: 100 peticiones cada 5 min; nada de descargas masivas | Sin cláusula; las portadas son de las editoriales | [V-2026-11-17] (archive.org, en navegador) |
| Google Books | Books API; portadas directas | Sin cobrar a los usuarios sin acuerdo (Books API §1) | Logo «Powered by Google» junto a los resultados y enlace a cada libro (normas de marca). **Cumplido** (#218): logo y enlace en la ficha; logo en los resultados de búsqueda que vienen de Google. Las tarjetas enlazan a la ficha, no a Google Libros. El logo no puede compartir página con logos de buscadores competidores (el pie lleva el de TMDB, que no lo es) | No más de lo que diga `Cache-Control` (Google APIs §5(e)(1)) | Prohíbe modificar o hacer derivados (§5(e)(2)) | [V-2026-11-17]; `Cache-Control` de las miniaturas [PV] |
| JustWatch (vía TMDB) | Proveedores de TMDB, «Dónde ver» | Lo rige el acuerdo de TMDB | Atribuir los datos a JustWatch. **Cumplido** (texto + enlace) | 6 meses (TMDB §1.C) | Sus términos prohíben derivados del contenido de su web (§7.1) | [V-2026-11-17]; uso del logo fuera del programa de socios [PV] |
| Wikidata | SPARQL en `query.wikidata.org` desde el servidor: adaptaciones (F-29) y, desde F5, el cruce de un anime de AniList con su ficha de TMDB (por el id público de AniList; solo al abrir la ficha, nunca en lote). User-Agent con contacto web (`PROVIDER_CONTACT` = página `/legal`), nunca un correo personal | Datos estructurados en CC0 (dominio público) | No obligatoria (CC0). Nombrado en `/privacy` y `/terms`; no en el pie | Sin plazo. El cruce se guarda en la caché de Next: 30 días si hay cruce, 7 si no | No aplica (CC0). Límites de WDQS: 60 s de proceso por minuto, 5 consultas en paralelo por IP; en un 429 hay que respetar `Retry-After` | [V-2026-11-24] |

Regla mientras una celda diga `[PV]` (§9.4): no se añade caché propia nueva, ni derivados, ni uso en premios. Lo que ya ocurre sigue según D-HOY-2.

## Hallazgos para Víctor y el encargo legal

1. **AniList prohíbe su API en servicios competidores de listas o *trackers* de anime y manga.** Lo prohíbe tanto para los datos de usuarios como para los de las obras. KULTURA registra lo que cada persona ve y lee. Esto no está en el plan: propuesta de pregunta nueva para el encargo y correo a AniList.
2. **MangaDex bloquea el enlace directo** (sirve una imagen equivocada) y exige un proxy. Hoy el optimizador de Vercel hace de proxy. Quitarlo rompe las portadas, y mantenerlo es copia temporal. Refuerza P7.
3. ~~**MyAnimeList llega por Jikan**, que extrae los datos de la web de MAL. MAL prohíbe el *scraping* y exige su API oficial (§4(i)).~~ **Resuelto en 8.1:** Jikan retirado (#217).
4. ~~**Google Books:** faltan el logo «Powered by Google» y el enlace a Google Books junto a cada libro.~~ **Resuelto en 8.1** (#218).
5. ~~**ComicVine:** el pie lo nombra sin enlace.~~ **Resuelto en 8.1** (#216).
6. **Imágenes OG:** TMDB (§1.C), RAWG (§6.2) y Google (§5(e)(2)) prohíben derivados o alterar el contenido. La OG que incrusta la portada es el uso con más riesgo de los que «ya ocurren». Ya está en P1/P2.
7. **Steam:** `appdetails` no está en la Web API documentada, así que sus términos quizá no lo cubren. Las cápsulas son de cada estudio.

## Fuentes (URL · fecha impresa · instantánea)

| Proveedor | URL | Fecha impresa | Wayback |
|---|---|---|---|
| TMDB | https://www.themoviedb.org/api-terms-of-use | 20-10-2023 | [18-09-2026](https://web.archive.org/web/20260918031458/https://www.themoviedb.org/api-terms-of-use) |
| TMDB (JustWatch) | https://developer.themoviedb.org/reference/movie-watch-providers | 01-10-2025 | — |
| RAWG | https://rawg.io/tos_api | 01-03-2021 | [12-09-2026](https://web.archive.org/web/20260912055721/https://rawg.io/tos_api) |
| ComicVine | https://comicvine.gamespot.com/api/ | sin fecha | [12-11-2026](https://web.archive.org/web/20261112151054/https://comicvine.gamespot.com/api/) |
| Steam | https://steamcommunity.com/dev/apiterms | julio de 2010 | [12-11-2026](https://web.archive.org/web/20261112140647/https://steamcommunity.com/dev/apiterms) |
| AniList | https://docs.anilist.co/guide/terms-of-use | sin fecha | [13-11-2026](https://web.archive.org/web/20261113000946/https://docs.anilist.co/guide/terms-of-use) |
| MangaDex | https://api.mangadex.org/docs/ (y `/docs/2-limitations/`) | sin fecha (v5.13.1) | [29-10-2026](https://web.archive.org/web/20261029144727/https://api.mangadex.org/docs/) |
| MyAnimeList | https://myanimelist.net/static/apiagreement.html | 08-08-2019 | [14-11-2026](https://web.archive.org/web/20261114133109/https://myanimelist.net/static/apiagreement.html) |
| MyAnimeList | https://myanimelist.net/about/terms_of_use | 16-10-2026 | — |
| Jikan (retirado en 8.1) | https://docs.api.jikan.moe/ (`jikan.moe/terms` da 404) | sin fecha (v4.0.0) | [09-11-2026](https://web.archive.org/web/20261109223337/https://docs.api.jikan.moe/) |
| Open Library | https://openlibrary.org/dev/docs/api/covers | 13-08-2024 | [05-11-2026](https://web.archive.org/web/20261105170643/https://openlibrary.org/dev/docs/api/covers) |
| Internet Archive | https://archive.org/about/terms | 31-12-2014 | — |
| Google APIs | https://developers.google.com/terms | 09-11-2021 | [16-11-2026](https://web.archive.org/web/20261116010830/https://developers.google.com/terms) |
| Google Books | https://developers.google.com/books/terms | 25-04-2012 | [05-11-2026](https://web.archive.org/web/20261105170643/https://developers.google.com/books/terms) |
| Google Books (marca) | https://developers.google.com/books/branding | 09-05-2011 | [30-10-2026](https://web.archive.org/web/20261030100532/https://developers.google.com/books/branding) |
| JustWatch | https://support.justwatch.com/article/just-watchs-terms-of-use | 05-05-2026 | [20-10-2026](https://web.archive.org/web/20261020222531/https://support.justwatch.com/article/just-watchs-terms-of-use) |
| TMDB (idiomas de imagen) | https://developer.themoviedb.org/docs/image-languages | 01-10-2025 | [01-11-2026](https://web.archive.org/web/20261101165552/https://developer.themoviedb.org/docs/image-languages) |
| Wikidata (licencias) | https://www.wikidata.org/wiki/Wikidata:Licensing | editada 24-09-2026 | [23-11-2026](https://web.archive.org/web/20261123004321/https://www.wikidata.org/wiki/Wikidata:Licensing) |
| Wikimedia (User-Agent) | https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy | editada 27-03-2026 | [17-11-2026](https://web.archive.org/web/20261117151648/https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy) |
| WDQS (límites) | https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual | editada 23-11-2026 | [18-11-2026](https://web.archive.org/web/20261118020541/https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual) |
| Wikimedia (términos de uso) | https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use | editada 25-10-2026 | [19-11-2026](https://web.archive.org/web/20261119091129/https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use) |

Si la fecha impresa de una página cambia respecto a esta tabla en la revisión de mayo de 2027, se relee entera y se actualiza la fila.
