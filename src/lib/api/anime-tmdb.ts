// ============================================================
// KULTURA — Respaldo de anime con TMDB (E-ANIME-RESPALDO)
//
// AniList es la fuente de anime (E-ANIME-SOURCE), pero es un único punto de
// fallo: el 21/10/2026 su API respondía 403 "temporarily disabled due to
// severe stability issues" y con ella caían Descubrir, el buscador y los
// rankings públicos de anime (/best/anime/* devolvía 500).
//
// Cuando AniList falla, el anime se sirve desde TMDB: series de animación
// (género 16) de origen japonés. Los ids llevan prefijo propio
// (`anime_tmdb-{id}`) para que la ficha y la biblioteca sigan sabiendo que
// es un anime y a qué proveedor preguntar, igual que `al-` para AniList y el
// entero plano para el legacy de Jikan.
//
// Alcance consciente del respaldo: en Descubrir solo respeta año y orden
// (los géneros de AniList no casan con los de TMDB y un filtro que mintiera
// sería peor que no aplicarlo).
// ============================================================

import { discoverTV, getTV, getTVVideos, searchTV } from "./tmdb";
import type { TmdbTV } from "./tmdb";
import { buildTmdbDiscoverParams } from "./tmdb-maps";
import { normalizeTV, type TmdbTVInput } from "./normalizer";
import type { MediaItem } from "@/types/media";

const TMDB_ANIMATION_GENRE = 16;
const ANIME_ORIGIN_COUNTRY = "JP";
/** Suelo de votos más bajo que el general (50): el anime de TMDB vota menos. */
const ANIME_VOTE_FLOOR = "20";

/** Forma del id de un anime servido por TMDB: `tmdb-{entero}`. */
export function isTmdbAnimeId(id: string): boolean {
  return /^tmdb-\d+$/.test(id);
}

export function toTmdbAnimeRef(id: number): string {
  return `tmdb-${id}`;
}

export function fromTmdbAnimeRef(ref: string): number {
  return Number(ref.slice(5));
}

/** Normaliza una serie de TMDB como anime (tipo e ids propios). */
export function normalizeAnimeTmdb(raw: TmdbTVInput): MediaItem {
  const ref = toTmdbAnimeRef(raw.id);
  return { ...normalizeTV(raw), id: `anime_${ref}`, externalId: ref, type: "anime" };
}

type TmdbTVWithOrigin = TmdbTV & {
  origin_country?: string[];
  original_language?: string;
};

/** true si un resultado de TMDB es anime: animación y de origen japonés. */
export function isTmdbAnime(raw: TmdbTVWithOrigin): boolean {
  const genreIds = raw.genre_ids ?? raw.genres?.map((g) => g.id) ?? [];
  const japanese =
    raw.origin_country?.includes(ANIME_ORIGIN_COUNTRY) || raw.original_language === "ja";
  return genreIds.includes(TMDB_ANIMATION_GENRE) && Boolean(japanese);
}

/** Params de /discover/tv para anime; reutiliza el builder (año, orden, tope de futuro). */
export function buildAnimeTmdbParams(filters: { year?: string | null; sort?: string | null } = {}) {
  const params = buildTmdbDiscoverParams("tv", { year: filters.year, sort: filters.sort });
  params.with_genres = String(TMDB_ANIMATION_GENRE);
  params.with_origin_country = ANIME_ORIGIN_COUNTRY;
  if (params["vote_count.gte"]) params["vote_count.gte"] = ANIME_VOTE_FLOOR;
  return params;
}

export interface AnimeTmdbPage {
  items: MediaItem[];
  totalPages: number;
}

export async function discoverAnimeTmdb(
  page: number,
  filters: { year?: string | null; sort?: string | null } = {},
  locale?: string | null
): Promise<AnimeTmdbPage> {
  const res = await discoverTV(page, buildAnimeTmdbParams(filters), locale);
  return {
    items: (res.results ?? []).map((raw) => normalizeAnimeTmdb(raw)),
    totalPages: Math.max(res.total_pages ?? 1, 1),
  };
}

export async function searchAnimeTmdb(
  query: string,
  page = 1,
  locale?: string | null
): Promise<AnimeTmdbPage> {
  const res = await searchTV(query, page, locale);
  const results = (res.results ?? []) as TmdbTVWithOrigin[];
  return {
    items: results.filter(isTmdbAnime).map((raw) => normalizeAnimeTmdb(raw)),
    totalPages: Math.max(res.total_pages ?? 1, 1),
  };
}

/** Ficha de un anime servido por TMDB, con su tráiler de YouTube si lo hay. */
export async function getAnimeTmdb(
  ref: string,
  locale?: string | null
): Promise<{ item: MediaItem; trailerKey?: string } | null> {
  const id = fromTmdbAnimeRef(ref);
  const [detail, videos] = await Promise.allSettled([getTV(id, locale), getTVVideos(id, locale)]);
  if (detail.status === "rejected") return null;
  const item = normalizeAnimeTmdb(detail.value);
  const trailer =
    videos.status === "fulfilled"
      ? videos.value.results.find(
          (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
        )
      : undefined;
  return { item, trailerKey: trailer?.key ?? item.trailerKey };
}
