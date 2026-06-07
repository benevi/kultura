// ============================================================
// KULTURA — Capa de opciones de filtros (E59 · F5d)
// Para cada trigger visible de TYPE_FILTERS, produce sus opciones
// seleccionables {value,label}. value = slug canónico (key del Record del
// mapa de API correspondiente); NO se duplican values — se importan de los
// mapas existentes. label = placeholder humanizado (i18n real en F6).
//
// NO inyecta la opción "all": eso lo hace FilterBar para kind single/min.
// ============================================================

import type { DiscoverType } from "@/lib/discover/type-filters";
import {
  TMDB_GENRE_MOVIE,
  TMDB_GENRE_TV,
  TMDB_PROVIDER,
  TMDB_LANGUAGE,
  TMDB_TV_STATUS,
  TMDB_SORT_MOVIE,
  TMDB_SORT_TV,
  TMDB_DURACION,
} from "@/lib/api/tmdb-maps";
import {
  JIKAN_GENRE,
  JIKAN_DEMOGRAPHIC,
  JIKAN_SORT,
  ANIME_STATUS,
  MANGA_STATUS,
  VOLUMENES_MIN,
} from "@/lib/api/jikan-maps";
import {
  RAWG_GENRE,
  RAWG_PLATFORM,
  RAWG_ORDERING,
  RAWG_MODOJUEGO_TAGS,
  DURACIONMEDIA_BUCKETS,
} from "@/lib/api/rawg-maps";
import { BOOKS_GENRE, BOOKS_FORMATO, BOOKS_PUBLISHER } from "@/lib/api/books-maps";
import { COMIC_PUBLISHER } from "@/lib/api/comicvine-maps";
import { VALORACION_SLUGS } from "@/lib/api/valoracion";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Placeholder legible a partir de un slug canónico. "title_az" → "Title Az",
 * "ciencia-ficcion" → "Ciencia Ficcion", "20plus" → "20plus".
 * i18n: F6 sustituye esto por traducciones reales por (type,key).
 */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Convierte las keys de un Record en opciones {value,label}. */
function optionsFromKeys(record: Record<string, unknown>): FilterOption[] {
  return Object.keys(record).map((value) => ({
    value,
    label: humanizeSlug(value),
  }));
}

// Catálogo de género por tipo (cada API tiene el suyo).
// "all" (agregado, R5): usa el catálogo de movie como proxy hasta el merge real.
const GENRE_BY_TYPE: Partial<Record<DiscoverType, Record<string, unknown>>> = {
  all: TMDB_GENRE_MOVIE,
  movie: TMDB_GENRE_MOVIE,
  tv: TMDB_GENRE_TV,
  anime: JIKAN_GENRE,
  manga: JIKAN_GENRE,
  book: BOOKS_GENRE,
  game: RAWG_GENRE,
  // comic: sin género (ComicVine no tiene género en issues) → no listado.
};

// Catálogo de sort por tipo (claves canónicas de cada SORT table).
// "all": claves canónicas base (popularity/rating/recent/title_az) vía TMDB_SORT_MOVIE.
const SORT_BY_TYPE: Record<DiscoverType, Record<string, unknown>> = {
  all: TMDB_SORT_MOVIE,
  movie: TMDB_SORT_MOVIE,
  tv: TMDB_SORT_TV,
  anime: JIKAN_SORT,
  manga: JIKAN_SORT,
  book: TMDB_SORT_MOVIE, // Books no expone sort nativo rico; claves canónicas base.
  comic: TMDB_SORT_MOVIE, // idem comic.
  game: RAWG_ORDERING,
};

// Catálogo de status por tipo/subtipo.
const STATUS_BY_TYPE: Partial<Record<DiscoverType, Record<string, unknown>>> = {
  anime: ANIME_STATUS,
  manga: MANGA_STATUS,
  tv: TMDB_TV_STATUS,
};

/**
 * Opciones seleccionables para un trigger (type,key). Devuelve [] si el trigger
 * no aplica a ese tipo (no debería ocurrir si key viene de TYPE_FILTERS[type]).
 */
export function getFilterOptions(
  type: DiscoverType,
  key: string
): FilterOption[] {
  switch (key) {
    case "genre": {
      const record = GENRE_BY_TYPE[type];
      return record ? optionsFromKeys(record) : [];
    }
    case "platform": {
      // platform = TMDB providers para movie/tv, RAWG platforms para game.
      const record = type === "game" ? RAWG_PLATFORM : TMDB_PROVIDER;
      return optionsFromKeys(record);
    }
    case "sort":
      return optionsFromKeys(SORT_BY_TYPE[type]);
    case "status": {
      const record = STATUS_BY_TYPE[type];
      return record ? optionsFromKeys(record) : [];
    }
    case "demografia":
      return optionsFromKeys(JIKAN_DEMOGRAPHIC);
    case "idioma":
      return optionsFromKeys(TMDB_LANGUAGE);
    case "duracion":
      return optionsFromKeys(TMDB_DURACION);
    case "formato":
      return optionsFromKeys(BOOKS_FORMATO);
    case "volumenes":
      return optionsFromKeys(VOLUMENES_MIN);
    case "editorial":
      // editorial aplica a book y comic con catálogos distintos (BUG R4a:
      // antes devolvía COMIC_PUBLISHER para ambos). book→editoriales de libro.
      return optionsFromKeys(
        type === "book" ? BOOKS_PUBLISHER : COMIC_PUBLISHER
      );
    // E59 R1 — keys nuevas del rediseño V2. Values estables; label vía
    // humanizeSlug (placeholder). // i18n: R6 sustituye por traducción real.
    case "valoracion":
      // Catálogo único compartido con los builders nativos (R4b).
      return VALORACION_SLUGS.map((value) => ({
        value,
        label: humanizeSlug(value),
      }));
    case "temporadas":
      return ["1", "2-3", "4-6", "7plus"].map((value) => ({
        value,
        label: humanizeSlug(value),
      }));
    case "modojuego":
      // Catálogo único compartido con el post-filtro game (R4c-1).
      return Object.keys(RAWG_MODOJUEGO_TAGS).map((value) => ({
        value,
        label: humanizeSlug(value),
      }));
    case "duracionmedia":
      // Catálogo único compartido con el post-filtro game (R4c-1).
      return Object.keys(DURACIONMEDIA_BUCKETS).map((value) => ({
        value,
        label: humanizeSlug(value),
      }));
    case "estado":
      // estado(game) post-filter: tags Early Access / Lanzado. No toca
      // "status" tv/anime/manga (key distinta arriba).
      return type === "game"
        ? ["early-access", "released"].map((value) => ({
            value,
            label: humanizeSlug(value),
          }))
        : [];
    default:
      return [];
  }
}
