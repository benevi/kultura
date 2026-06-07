// ============================================================
// KULTURA — Capa de opciones de filtros (E59 · F5d)
// Para cada trigger visible de TYPE_FILTERS, produce sus opciones
// seleccionables {value,label}. value = slug canónico (key del Record del
// mapa de API correspondiente); NO se duplican values — se importan de los
// mapas existentes. label = placeholder humanizado (i18n real en F6).
//
// NO inyecta la opción "all": eso lo hace FilterBar para kind single/min.
// ============================================================

import type { MediaType } from "@/types/media";
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
import { RAWG_GENRE, RAWG_PLATFORM, RAWG_ORDERING } from "@/lib/api/rawg-maps";
import { BOOKS_GENRE, BOOKS_FORMATO } from "@/lib/api/books-maps";
import { COMIC_PUBLISHER } from "@/lib/api/comicvine-maps";

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
const GENRE_BY_TYPE: Partial<Record<MediaType, Record<string, unknown>>> = {
  movie: TMDB_GENRE_MOVIE,
  tv: TMDB_GENRE_TV,
  anime: JIKAN_GENRE,
  manga: JIKAN_GENRE,
  book: BOOKS_GENRE,
  game: RAWG_GENRE,
  // comic: sin género (ComicVine no tiene género en issues) → no listado.
};

// Catálogo de sort por tipo (claves canónicas de cada SORT table).
const SORT_BY_TYPE: Record<MediaType, Record<string, unknown>> = {
  movie: TMDB_SORT_MOVIE,
  tv: TMDB_SORT_TV,
  anime: JIKAN_SORT,
  manga: JIKAN_SORT,
  book: TMDB_SORT_MOVIE, // Books no expone sort nativo rico; claves canónicas base.
  comic: TMDB_SORT_MOVIE, // idem comic.
  game: RAWG_ORDERING,
};

// Catálogo de status por tipo/subtipo.
const STATUS_BY_TYPE: Partial<Record<MediaType, Record<string, unknown>>> = {
  anime: ANIME_STATUS,
  manga: MANGA_STATUS,
  tv: TMDB_TV_STATUS,
};

/**
 * Opciones seleccionables para un trigger (type,key). Devuelve [] si el trigger
 * no aplica a ese tipo (no debería ocurrir si key viene de TYPE_FILTERS[type]).
 */
export function getFilterOptions(type: MediaType, key: string): FilterOption[] {
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
      return optionsFromKeys(COMIC_PUBLISHER);
    // E59 R1 — keys nuevas del rediseño V2. Values estables; label vía
    // humanizeSlug (placeholder). // i18n: R6 sustituye por traducción real.
    case "valoracion":
      return ["9", "8", "7", "6"].map((value) => ({
        value,
        label: humanizeSlug(value),
      }));
    case "temporadas":
      return ["1", "2-3", "4-6", "7plus"].map((value) => ({
        value,
        label: humanizeSlug(value),
      }));
    case "modojuego":
      return ["single", "multi", "coop", "online"].map((value) => ({
        value,
        label: humanizeSlug(value),
      }));
    case "duracionmedia":
      return ["lt10", "10-30", "30-60", "60plus"].map((value) => ({
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
