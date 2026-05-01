# api-agent — APIS (fuente de verdad)

Registro de todos los endpoints externos usados en KULTURA.
Actualizar cada vez que se integre un endpoint nuevo.

## Estado
Ningún endpoint implementado aún.

---

## TMDB — The Movie Database
**Base URL:** `https://api.themoviedb.org/3`
**Auth:** `?api_key=${NEXT_PUBLIC_TMDB_API_KEY}`
**Docs:** https://developer.themoviedb.org/docs

### Endpoints planificados

| Endpoint | Uso | Params clave | Estado |
|----------|-----|-------------|--------|
| `GET /discover/movie` | Listado películas con filtros | `language`, `sort_by`, `with_genres`, `primary_release_year`, `vote_average.gte` | ⏳ |
| `GET /discover/tv` | Listado series con filtros | `language`, `sort_by`, `with_genres`, `first_air_date_year` | ⏳ |
| `GET /search/movie` | Búsqueda películas | `query`, `language` | ⏳ |
| `GET /search/tv` | Búsqueda series | `query`, `language` | ⏳ |
| `GET /movie/{id}` | Detalle película | `language`, `append_to_response=credits` | ⏳ |
| `GET /tv/{id}` | Detalle serie | `language`, `append_to_response=credits` | ⏳ |
| `GET /tv/{id}/season/{n}` | Episodios de temporada | — | ⏳ |
| `GET /movie/{id}/videos` | Tráilers película | `language` | ⏳ |
| `GET /tv/{id}/videos` | Tráilers serie | `language` | ⏳ |
| `GET /movie/{id}/watch/providers` | Streaming película | filtrar por `ES` | ⏳ |
| `GET /tv/{id}/watch/providers` | Streaming serie | filtrar por `ES` | ⏳ |
| `GET /genre/movie/list` | Lista géneros películas | `language` | ⏳ |
| `GET /genre/tv/list` | Lista géneros series | `language` | ⏳ |

### Imágenes TMDB
- Posters: `https://image.tmdb.org/t/p/w500{poster_path}`
- Backdrops: `https://image.tmdb.org/t/p/w1280{backdrop_path}`
- Logos streaming: `https://image.tmdb.org/t/p/original{logo_path}`

---

## Jikan — MyAnimeList unofficial API
**Base URL:** `https://api.jikan.moe/v4`
**Auth:** Sin key
**Docs:** https://docs.api.jikan.moe/
**Rate limit:** 3 req/seg, 60 req/min

| Endpoint | Uso | Estado |
|----------|-----|--------|
| `GET /top/anime` | Ranking anime | ⏳ |
| `GET /anime?q=` | Búsqueda anime | ⏳ |
| `GET /anime/{id}` | Detalle anime | ⏳ |
| `GET /anime/{id}/episodes` | Episodios para progreso | ⏳ |
| `GET /anime/{id}/videos` | Tráilers anime | ⏳ |
| `GET /top/manga` | Ranking manga | ⏳ |
| `GET /manga?q=` | Búsqueda manga | ⏳ |
| `GET /manga/{id}` | Detalle manga | ⏳ |

---

## Google Books
**Base URL:** `https://www.googleapis.com/books/v1`
**Auth:** `?key=${NEXT_PUBLIC_GOOGLE_BOOKS_KEY}`
**Docs:** https://developers.google.com/books/docs/v1/reference

| Endpoint | Uso | Params clave | Estado |
|----------|-----|-------------|--------|
| `GET /volumes?q=` | Búsqueda libros | `langRestrict=es`, `maxResults=20` | ⏳ |
| `GET /volumes/{id}` | Detalle libro | — | ⏳ |

---

## Open Library (fallback libros)
**Base URL:** `https://openlibrary.org`
**Auth:** Sin key
**Docs:** https://openlibrary.org/developers/api

| Endpoint | Uso | Estado |
|----------|-----|--------|
| `GET /search.json?q=` | Búsqueda libros | ⏳ |
| `GET /works/{id}.json` | Detalle libro | ⏳ |

**Portadas:** `https://covers.openlibrary.org/b/id/{cover_id}-L.jpg`

---

## MangaDex
**Base URL:** `https://api.mangadex.org`
**Auth:** Sin key (pública)
**Docs:** https://api.mangadex.org/docs

| Endpoint | Uso | Estado |
|----------|-----|--------|
| `GET /manga` | Listado + búsqueda manga | ⏳ |
| `GET /manga/{id}` | Detalle manga | ⏳ |
| `GET /cover` | Portadas | ⏳ |

**Portadas:** `https://uploads.mangadex.org/covers/{manga_id}/{filename}`

---

## ComicVine
**Base URL:** `https://comicvine.gamespot.com/api`
**Auth:** `?api_key=${COMICVINE_KEY}&format=json`
**Docs:** https://comicvine.gamespot.com/api/documentation
**⚠️ CORS bloqueado en cliente — solo via Route Handler `/api/comics`**

| Endpoint | Uso | Estado |
|----------|-----|--------|
| `GET /volumes/` | Listado + búsqueda cómics | ⏳ |
| `GET /volume/{id}/` | Detalle cómic | ⏳ |

---

## RAWG — Videojuegos
**Base URL:** `https://api.rawg.io/api`
**Auth:** `?key=${NEXT_PUBLIC_RAWG_KEY}`
**Docs:** https://rawg.io/apidocs

| Endpoint | Uso | Params clave | Estado |
|----------|-----|-------------|--------|
| `GET /games` | Listado + filtros + búsqueda | `search`, `genres`, `dates`, `metacritic`, `ordering` | ⏳ |
| `GET /games/{id}` | Detalle juego | — | ⏳ |
| `GET /genres` | Lista géneros | — | ⏳ |

---

## Tipo normalizado MediaItem

Todas las APIs se normalizan a este tipo antes de llegar a los componentes:

```typescript
type MediaType = 'movie' | 'tv' | 'anime' | 'book' | 'comic' | 'manga' | 'game'

type StreamingProvider = {
  name: string
  logo: string
  type: 'flatrate' | 'rent' | 'buy'
}

type MediaItem = {
  id: string              // "{type}_{external_id}"
  externalId: string
  type: MediaType
  title: string
  originalTitle?: string
  poster?: string
  backdrop?: string
  year?: number
  synopsis?: string
  genres?: string[]
  rating?: number
  ratingSource?: string   // "TMDB" | "MAL" | "Metacritic" | "ComicVine" | "Google"
  trailerKey?: string     // YouTube key
  streamingProviders?: StreamingProvider[]
  metadata?: Record<string, unknown>
}
```
