// ============================================================
// KULTURA — Catálogos de filtro heredados de Jikan (E59 F3b)
//
// ESTADO REAL: anime se sirve con AniList (E-ANIME-SOURCE) y manga con
// MangaDex (E-MANGA-SOURCE) — ninguno de los dos llama ya a la API de Jikan
// para Descubrir/búsqueda. Las TABLAS de este módulo (slugs canónicos →
// valor legible) se conservan porque `filter-options.ts` las sigue usando
// como catálogo de OPCIONES de UI (mismos slugs, reusados por los builders
// reales de AniList/MangaDex); los builders que traducían estos slugs a
// params nativos de Jikan (`buildJikanDiscoverParams` y afines) se
// eliminaron por no tener ya ningún caller.
// ============================================================

import type { MediaItem } from "@/types/media";

// ── Géneros (MAL genre IDs) ─────────────────────────────────────────────────────
// Mismos IDs para anime y manga en MyAnimeList. slug canónico Kultura → MAL ID.
// genres admite CSV; usamos coma = OR (alineado al prototipo).

export const JIKAN_GENRE: Record<string, number> = {
  accion: 1, // Action
  aventura: 2, // Adventure
  comedia: 4, // Comedy
  drama: 8, // Drama
  fantasia: 10, // Fantasy
  terror: 14, // Horror
  misterio: 7, // Mystery
  romance: 22, // Romance
  "ciencia-ficcion": 24, // Sci-Fi
  "recuentos-de-la-vida": 36, // Slice of Life
  deportes: 30, // Sports
  sobrenatural: 37, // Supernatural
  suspense: 41, // Suspense (Thriller en MAL v4)
};

// ── Demografía (también son genre IDs MAL) ──────────────────────────────────────

export const JIKAN_DEMOGRAPHIC: Record<string, number> = {
  shonen: 27, // Shounen
  shojo: 25, // Shoujo
  seinen: 42, // Seinen
  josei: 43, // Josei
  kids: 15, // Kids
};

// ── Status — VALORES DISTINTOS por subtipo ──────────────────────────────────────
// Anime: airing | complete | upcoming.
// Manga: publishing | complete | hiatus | discontinued | upcoming.
// Nuestro contrato canónico de status es airing/complete/upcoming (anime-céntrico).
// Para manga: "airing" (en curso) se mapea a "publishing"; complete/upcoming 1:1.
// Los estados solo-manga (hiatus/discontinued) NO tienen clave canónica → se
// aceptan como passthrough si llegan literalmente, pero no se derivan de canónico.

export const ANIME_STATUS: Record<string, string> = {
  airing: "airing",
  complete: "complete",
  upcoming: "upcoming",
};

export const MANGA_STATUS: Record<string, string> = {
  airing: "publishing", // canónico "en emisión" → manga "publishing"
  complete: "complete",
  upcoming: "upcoming",
  // passthrough nativos de manga (sin clave canónica equivalente):
  publishing: "publishing",
  hiatus: "hiatus",
  discontinued: "discontinued",
};

// ── Sort — catálogo de opciones de UI (order_by/sort ya no se traduce aquí) ───
// Los VALORES (order_by/sort) eran específicos del builder de Jikan, ya
// eliminado; se conservan solo las CLAVES (popularity/rating/…), que
// `filter-options.ts` usa para listar las opciones del selector de sort de
// anime (AniList) y manga (MangaDex) — cada builder real las traduce a su
// propio formato nativo.
export const JIKAN_SORT: Record<string, true> = {
  popularity: true,
  rating: true,
  release_desc: true,
  release_asc: true,
  title_az: true,
  title_za: true,
};

// ── Volúmenes (manga) — POST-filtro de mínimo ───────────────────────────────────
// Buckets canónicos (spec §1/§3): "1-5"/"6-20"/"20plus" → umbral mínimo de volumes.
// kind "min": se conserva el manga cuyo volumes >= umbral. Solo manga (anime oculto).

export const VOLUMENES_MIN: Record<string, number> = {
  "1-5": 1,
  "6-20": 6,
  "20plus": 20,
};

/** Umbral mínimo de volúmenes para un bucket canónico, o null si desconocido. */
export function volumenesMin(bucket: string | null | undefined): number | null {
  if (!bucket) return null;
  return VOLUMENES_MIN[bucket] ?? null;
}

/**
 * Post-filtra items de manga por mínimo de volúmenes. Conserva solo los que tienen
 * `metadata.volumes` numérico y >= umbral del bucket. Bucket vacío/desconocido →
 * devuelve los items intactos (no filtra). Items sin volumes resuelto se descartan.
 */
export function filterByMinVolumes(
  items: MediaItem[],
  bucket: string | null | undefined
): MediaItem[] {
  const min = volumenesMin(bucket);
  if (min === null) return items;
  return items.filter((item) => {
    const v = item.metadata?.volumes;
    return typeof v === "number" && v >= min;
  });
}
