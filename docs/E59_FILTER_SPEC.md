# E59 · Spec de filtros — Contrato de `/api/discover`

> **Estado:** F1 — contrato. Solo documento. No toca código, no añade deps.
> **Alcance:** define el set canónico de params que aceptará el Route Handler
> `/api/discover`, la matriz de capacidades param × API, la política para filtros
> no soportados nativamente, los `TYPE_FILTERS` por tipo, el mapa de valores y las
> claves i18n a crear.

## Contexto y problema actual

Hoy `discover` solo llama a los endpoints **populares/top** de cada API
([`src/lib/api/discover.ts`](../src/lib/api/discover.ts)) y el único filtro real
(`year`) se aplica **client-side sobre la página ya descargada**
([`DiscoverClient.tsx:18-26,87-90`](../src/app/[locale]/(app)/discover/DiscoverClient.tsx#L18-L90)).
Eso rompe semánticamente: filtrar el año sobre 20 ítems de la página N **no**
recorre el catálogo, solo esconde filas y deja páginas casi vacías.

E59 mueve el filtrado **full server-side**: el cliente manda params a
`/api/discover`, el Route Handler traduce cada param al filtro **nativo** de la
API destino cuando existe, y solo cae a post-filtrado controlado cuando no hay
nativo. La paginación pasa a reflejar el conjunto filtrado real.

---

## 1. Params canónicos

Set único que `/api/discover` acepta. Nombres en inglés (alineados al código y a
los query params HTTP). `multi` = acepta lista separada por comas.

| Param | Card. | Valores canónicos | Notas |
|-------|-------|-------------------|-------|
| `type` | single | `movie` `tv` `anime` `manga` `book` `game` `comic` | Obligatorio. Determina API destino y qué triggers se muestran. |
| `page` | single | entero ≥ 1 | Paginación. |
| `genre` | **multi** | slug canónico Kultura (ver §5) | Se traduce a IDs/slugs por familia. Multi = intersección donde la API lo permita. |
| `year` | single | `2025`…, `2010s`, `2000s`, `classic` (<2000) | Década o año exacto. Se traduce a rangos `gte/lte` por API. |
| `platform` | **multi** | slug canónico (ver §5) | Solo aplica a `movie`/`tv` (TMDB watch providers) y `game` (RAWG platforms). |
| `sort` | single | `popularity` `rating` `release_desc` `release_asc` `title_az` `title_za` | Default `popularity`. Mapea al campo nativo de orden. |
| `status` | single | `airing` `complete` `upcoming` | Solo `anime`/`tv`/`manga` (estado de emisión/publicación). **No** es el estado de la librería del usuario. |
| `demografia` | single | `shonen` `shojo` `seinen` `josei` `kids` | Solo `anime`/`manga` (Jikan genres demográficos). |
| `duracion` | single | `short` `medium` `long` | Solo `movie` (runtime). Rangos en §3. |
| `temporadas` | single | `1` `2-3` `4plus` | Solo `tv` (number_of_seasons). |
| `volumenes` | single | `1-5` `6-20` `20plus` | Solo `manga` (volumes). |
| `horas` | single | `short` `medium` `long` | Solo `game` (playtime). RAWG no lo expone en list → ver §3. |
| `editorial` | **multi** | slug canónico | Solo `comic` (ComicVine publisher). |
| `formato` | single | `physical` `ebook` `free` | Solo `book` (Google Books `filter`). |
| `idioma` | single | ISO-639-1 (`es` `en` `ja` `fr`…) | `book` (langRestrict). TMDB tiene `with_original_language`. |

> **Recortes vs. brief original:** `modo` se **elimina** (no mapea a nada nativo en
> ninguna API; era ambiguo). `editorial`/`formato`/`idioma` se mantienen pero
> acotados a su único tipo útil. `horas` se mantiene pero documentado como
> **degradado** (RAWG no filtra playtime en `/games`). El estado de librería del
> usuario (`pending/completed/dropped`) **no** entra aquí: es filtro de
> `library`, no de descubrimiento de catálogo.

---

## 2. Matriz de capacidades — param × API

`nativo(param)` = la API tiene un parámetro real, se cita. `post` = filtrable solo
en nuestro Route Handler sobre el resultado. `oculto` = trigger no se muestra para
ese tipo. `—` = no aplica / sin soporte razonable.

Endpoints base asumidos: TMDB pasa de `/{movie,tv}/popular` a
**`/discover/{movie,tv}`** (necesario para filtrar nativo); Jikan usa
`/anime` y `/manga` (search soporta filtros, `/top/*` no); RAWG `/games`;
Google Books `/volumes`; ComicVine `/issues`.

| Param | TMDB movie | TMDB tv | Jikan anime | Jikan manga | RAWG game | Google Books | ComicVine comic |
|-------|-----------|---------|-------------|-------------|-----------|--------------|-----------------|
| **type** | (selector) | (selector) | (selector) | (selector) | (selector) | (selector) | (selector) |
| **page** | nativo `page` | nativo `page` | nativo `page` | nativo `page` | nativo `page` | nativo `startIndex` | nativo `offset` |
| **genre** | nativo `with_genres` | nativo `with_genres` | nativo `genres` (IDs) | nativo `genres` (IDs) | nativo `genres` (id/slug) | nativo `subject:` (q) | **post** (sin genre nativo) |
| **year** | nativo `primary_release_date.gte/lte` (o `primary_release_year`) | nativo `first_air_date.gte/lte` | nativo `start_date`/`end_date` | nativo `start_date`/`end_date` | nativo `dates=a,b` | **post** (q no fiable) | nativo `filter=cover_date:a|b` |
| **platform** | nativo `with_watch_providers`+`watch_region` | nativo `with_watch_providers`+`watch_region` | oculto | oculto | nativo `platforms` (IDs) | oculto | oculto |
| **sort** | nativo `sort_by` | nativo `sort_by` | nativo `order_by`+`sort` | nativo `order_by`+`sort` | nativo `ordering` | nativo `orderBy` (relevance/newest) | nativo `sort` |
| **status** | **oculto** (movie no tiene `with_status`; `with_release_type` filtra formato de estreno, no estado) | nativo `with_status` | nativo `status` | nativo `status` | oculto | oculto | oculto |
| **demografia** | oculto | oculto | nativo `genres` (IDs demo) | nativo `genres` (IDs demo) | oculto | oculto | oculto |
| **duracion** | nativo `with_runtime.gte/lte` | oculto | oculto | oculto | oculto | oculto | oculto |
| **temporadas** | oculto | **post** (`number_of_seasons`) | oculto | oculto | oculto | oculto | oculto |
| **volumenes** | oculto | oculto | oculto | **post** (`volumes`) | oculto | oculto | oculto |
| **horas** | oculto | oculto | oculto | oculto | **degradado** (no nativo en `/games`) | oculto | oculto |
| **editorial** | oculto | oculto | oculto | oculto | oculto | oculto | **post** (publisher vía `/volumes`, ya resuelto hoy) |
| **formato** | oculto | oculto | oculto | oculto | oculto | nativo `filter` (ebooks/free-ebooks/paid-ebooks) | oculto |
| **idioma** | nativo `with_original_language` | nativo `with_original_language` | oculto | oculto | oculto | nativo `langRestrict` | oculto |

### Notas de params nativos clave

- **TMDB** `with_genres` (CSV IDs, AND con `,` / OR con `|`), `sort_by`
  (`popularity.desc`, `vote_average.desc`, `primary_release_date.desc|asc`,
  `title.asc|desc` solo si la API lo soporta — TMDB **no** ordena por título, ver
  §3), `with_runtime.gte/lte` (minutos), `with_status` (tv: 0–5),
  `with_watch_providers`+`watch_region` (provider IDs, **distintos** de los IDs de
  género), `with_original_language` (ISO-639-1).
- **Jikan** `genres` (CSV de MAL genre IDs; las demografías son genre IDs:
  Shounen=27, Shoujo=25, Seinen=42, Josei=43, Kids=15), `order_by`
  (`score`,`start_date`,`title`,`popularity`…), `sort` (`asc`/`desc`),
  `start_date`/`end_date` (`YYYY-MM-DD`), `status`
  (`airing`/`complete`/`upcoming`), `sfw=true`. **No** filtra por
  episodios/volúmenes/temporadas nativamente.
- **RAWG** `genres` (id o slug, CSV), `platforms` (id CSV), `dates`
  (`YYYY-MM-DD,YYYY-MM-DD`), `ordering` (`name`,`released`,`rating`,`metacritic`;
  prefijo `-` invierte), `metacritic` (`min,max`). Playtime **no** es param.
- **Google Books** `q` con operadores `subject:`/`inauthor:`/`intitle:`,
  `filter` (`ebooks`,`free-ebooks`,`paid-ebooks`,`partial`,`full`), `orderBy`
  (`relevance`|`newest`), `langRestrict`, `startIndex`, `maxResults`. **No** hay
  filtro de año ni de rating como param; solo embebido en `q` (poco fiable).
- **ComicVine** `/issues`: `filter` (campo:valor, fechas con rango `a|b`, IDs con
  `|`), `sort` (`cover_date:desc`…), `field_list`, `offset`, `limit`. El filtro
  es greedy + case-sensitive. **No** hay genre; el publisher vive en `/volumes`,
  no en el issue (ya se resuelve aparte hoy → `editorial` es post-filtro natural).

---

## 3. Política para "no soportado"

Tres mecanismos, recomendación **por celda** de la matriz §2. Como vamos
server-side, la regla maestra es: **preferir nativo > ocultar trigger > post-filtro
con compensación de paginación > degradado documentado.** Nunca dejar un trigger
visible que no se cumpla.

### Mecanismos

1. **`nativo`** — traducir param al filtro de la API. Paginación intacta
   (la API ya devuelve `total_pages`/`count` del conjunto filtrado).

2. **`oculto`** — si el tipo no puede cumplir el filtro de forma significativa, el
   trigger **no se renderiza** para ese tipo (control por `TYPE_FILTERS`, §4). Es la
   opción por defecto para todo lo marcado `oculto`. Cero riesgo de prometer de más.

3. **`post`** — filtrado en el Route Handler sobre el resultado de la API.
   **Riesgo:** rompe paginación (pedir page=1 limit=20 y filtrar deja <20).
   **Compensación obligatoria (patrón "overfetch + re-paginar"):**
   - Pedir a la API un lote grande (`limit=100` donde la API lo permita: ComicVine
     ya hace `limit=100` hoy; Jikan `limit=25`).
   - Aplicar el post-filtro sobre el lote.
   - Re-paginar **nuestras** páginas de 20 sobre el conjunto filtrado, **no** sobre
     las páginas crudas de la API.
   - `totalPages` se reporta como **estimación** (`ceil(filtrados_estimados/20)`) y
     se marca como aproximado en la respuesta para que la UI no prometa páginas que
     pueden venir vacías. Este es exactamente el patrón que ComicVine ya usa para
     excluir manga/adultos ([`comicvine.ts:251-282`](../src/lib/api/comicvine.ts#L251-L282)).
   - **Solo** usar `post` para filtros de baja cardinalidad/alta selectividad donde
     un overfetch acotado basta. No para filtros que descartarían el 95% del lote.

4. **`degradado`** — el filtro se acepta en el contrato pero **no se aplica** y se
   documenta. Único caso: `horas` en RAWG. Se renderiza solo si decidimos exponerlo;
   recomendación: **ocultarlo** hasta tener fuente (ver tabla).

### Recomendación por celda no-nativa

| Celda | Recomendación |
|-------|---------------|
| `genre` × ComicVine | **oculto.** ComicVine no tiene género en issues; no inventar post-filtro (descarta demasiado). Comic descubre por fecha/editorial. |
| `year` × Google Books | **oculto.** El año vía `q` es ruidoso; el riesgo de post-filtro (descarta gran parte del lote) no compensa. Libros descubren por `subject`/`orderBy=newest`. |
| `temporadas` × tv | **post** con overfetch. Selectividad media; `number_of_seasons` viene en el detalle, no en `/discover/tv` → requiere o bien `with_status`/años como proxy, o enriquecer. **Recomendado:** post sobre lote `/discover/tv` solo si `number_of_seasons` está disponible sin N+1; si exige N llamadas de detalle, **ocultar** en F1 y abrir ticket. |
| `volumenes` × manga | **post** con overfetch (`volumes` viene en search de Jikan). Baja cardinalidad → viable. |
| `editorial` × comic | **post** (ya implementado de facto: el publisher se resuelve vía `/volumes` y se filtra). Reusar `resolveVolumePublishers`. |
| `horas` × game | **degradado → ocultar en F1.** RAWG no filtra playtime en `/games`; `playtime` solo en detalle. Exponerlo obligaría N+1. Recomendación: no renderizar el trigger hasta tener fuente. |

**Resumen recomendación punto 3:** nativo siempre que exista (es la mayoría de la
matriz); **ocultar** `genre/year` en las APIs sin soporte razonable (ComicVine
genre, Books year) en vez de fingir post-filtro que vacía páginas; **post con
overfetch + paginación estimada** solo para `volumenes` (manga) y `editorial`
(comic, ya hecho); `temporadas` (tv) condicional a no incurrir en N+1; `horas`
(game) **degradado/oculto** hasta tener fuente. Así ningún trigger visible miente.

---

## 4. `TYPE_FILTERS` real

Triggers visibles por tipo, derivados directamente de §2/§3 (solo `nativo` o `post`
viable; nunca `oculto`/`degradado`). Orden = orden de render sugerido.

```ts
// Pseudocontrato — la implementación vive en F2, aquí solo el set acordado.
const TYPE_FILTERS: Record<MediaType, FilterKey[]> = {
  movie: ["genre", "year", "platform", "duracion", "idioma", "sort"],
  tv:    ["genre", "year", "platform", "status", "idioma", "sort"],
  //      "temporadas" → condicional (post sin N+1); fuera de F1 si exige detalle.
  anime: ["genre", "year", "status", "demografia", "sort"],
  manga: ["genre", "year", "status", "demografia", "volumenes", "sort"],
  book:  ["genre", "formato", "idioma", "sort"],
  //      sin "year" (oculto: Books no filtra año nativo).
  game:  ["genre", "year", "platform", "sort"],
  //      sin "horas" (degradado/oculto en F1).
  comic: ["year", "editorial", "sort"],
  //      sin "genre" (oculto: ComicVine no tiene género en issues).
};
```

`sort` y `page` están siempre presentes (page implícito). `type` es el selector
global, no un trigger dentro del set.

---

## 5. Mapa de valores

Cómo traducir las opciones canónicas Kultura (slugs, en es para UI) a los
IDs/valores de cada API. **Negrita** = requiere tabla de traducción mantenida.

### Géneros

| Familia | Mecanismo | Tabla |
|---------|-----------|-------|
| TMDB movie/tv | slug → **TMDB genre ID** | **Sí.** Existe parcial en [`tmdb.ts:201-235`](../src/lib/api/tmdb.ts#L201-L235) (`TMDB_GENRE_MAP`, name→ID). F2 debe pasar a **slug canónico→ID** y separar movie/tv (algunos IDs difieren: TV usa 10759 Action&Adventure, 10765 Sci-Fi&Fantasy). |
| Jikan anime/manga | slug → **MAL genre ID** | **Sí, nueva.** No existe. MAL IDs distintos de TMDB (Action=1, Adventure=2, Comedy=4, Drama=8, Fantasy=10, Horror=14, Romance=22, Sci-Fi=24…). Demografías son también genre IDs (§2). |
| RAWG game | slug → RAWG genre **slug** | Opcional. RAWG acepta slugs (`action`,`indie`,`rpg`,`shooter`…). Tabla fina solo si los slugs Kultura difieren de RAWG. |
| Google Books | slug → `subject:"…"` string | **Sí, nueva.** Mapear género Kultura a término BISAC/subject inglés (`Fiction`, `Science Fiction`, `Fantasy`, `History`…). |
| ComicVine | — | N/A (oculto). |

### Plataformas

| Familia | Mecanismo | Tabla |
|---------|-----------|-------|
| TMDB movie/tv | slug → **watch provider ID** (region ES) | **Sí, nueva.** Provider IDs (Netflix=8, Prime=119, Disney+=337, HBO Max=1899…). Requiere `watch_region=ES`. **No** confundir con genre IDs. |
| RAWG game | slug → **RAWG platform ID** | **Sí, nueva.** (PC=4, PS5=187, PS4=18, Xbox Series=186, Switch=7…). |

### Estado (`status`)

| Familia | Mecanismo |
|---------|-----------|
| Jikan anime/manga | `airing`/`complete`/`upcoming` directo (ya son los valores nativos). |
| TMDB tv | slug → **`with_status` numérico** (0 Returning,1 Planned,2 In Production,3 Ended,4 Cancelled,5 Pilot). **Tabla nueva.** Mapear nuestro `airing→0`, `upcoming→1,2`, `complete→3,4`. |

### Año, duración, etc. (rangos, sin tabla externa)

- `year`: década → `gte/lte` (`2010s`→`2010-01-01`/`2019-12-31`), exacto → año.
- `duracion` (movie): `short`<90, `medium`90–150, `long`>150 min → `with_runtime.gte/lte`.
- `volumenes` (manga): `1-5`/`6-20`/`20plus` → comparación post sobre `volumes`.
- `temporadas`/`horas`: ver §3.

---

## 6. i18n — claves a crear en `filters/`

El namespace **`filters` ya existe** ([`messages/es.json`](../messages/es.json),
mismo en `en.json`) con: `type`, los 7 tipos, `year`, `classic`, `status`,
`inProgress/pending/completed/dropped`, `minScore`, `reset`, `all`, `scope*`,
`size*`. **Reutilizar** `type`, los tipos, `year`, `classic`, `status`, `all`,
`reset`. Las claves de orden ya existen en **`search`** (`sortRelevance`, `sortAZ`,
`sortZA`, `sortRatingDesc`, `sortRatingAsc`, `sortYearDesc`, `sortYearAsc`) y los
géneros se renderizan dinámicamente desde la API → **no** hardcodear géneros en i18n.

### Claves nuevas a añadir en `filters` (es + en)

```jsonc
// Labels de trigger
"genre":        "Género" / "Genre",
"platform":     "Plataforma" / "Platform",
"sort":         "Ordenar por" / "Sort by",
"demografia":   "Demografía" / "Demographic",
"duracion":     "Duración" / "Duration",
"temporadas":   "Temporadas" / "Seasons",
"volumenes":    "Volúmenes" / "Volumes",
"editorial":    "Editorial" / "Publisher",
"formato":      "Formato" / "Format",
"idioma":       "Idioma" / "Language",

// Valores: orden (sort) — alinear con las claves existentes de search si se centralizan
"sortPopularity":  "Popularidad" / "Popularity",
"sortRating":      "Mejor valorados" / "Top rated",
"sortReleaseDesc": "Más recientes" / "Newest",
"sortReleaseAsc":  "Más antiguos" / "Oldest",
"sortTitleAz":     "Título A–Z" / "Title A–Z",
"sortTitleZa":     "Título Z–A" / "Title Z–A",

// Valores: status (extiende los existentes con los de catálogo)
"airing":    "En emisión" / "Airing",
"complete":  "Finalizado" / "Completed",
"upcoming":  "Próximamente" / "Upcoming",

// Valores: demografía
"shonen": "Shōnen", "shojo": "Shōjo", "seinen": "Seinen",
"josei":  "Josei",  "kids":  "Infantil" / "Kids",

// Valores: duración
"durShort":  "Corta (<90 min)" / "Short (<90 min)",
"durMedium": "Media (90–150 min)" / "Medium (90–150 min)",
"durLong":   "Larga (>150 min)" / "Long (>150 min)",

// Valores: temporadas
"seasons1":     "1" , "seasons23": "2–3", "seasons4plus": "4+",

// Valores: volúmenes
"vol1to5": "1–5", "vol6to20": "6–20", "vol20plus": "20+",

// Valores: formato (book)
"fmtPhysical": "Físico" / "Physical",
"fmtEbook":    "Ebook" / "Ebook",
"fmtFree":     "Gratis" / "Free",

// Valor común
"noFilter":  "Sin filtro" / "Any",
```

> Recomendación: si se quieren los labels de orden compartidos entre `search` y
> `discover`, centralizar en `filters.sort*` y migrar `search` a referenciarlos en
> un ticket aparte (no en E59-F1). Mientras tanto, duplicar las 6 claves de orden en
> `filters` es aceptable.

---

## Decisiones abiertas (para F2)

1. `temporadas` (tv): confirmar si `number_of_seasons` llega en `/discover/tv` sin
   N+1. Si no → ocultar en F1.
2. Centralización de claves de orden `search`↔`discover` (ticket aparte).
3. Tablas de traducción nuevas a crear como módulos: MAL genres, watch providers ES,
   RAWG platforms, TMDB tv status, Books subjects.
