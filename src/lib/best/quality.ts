// ============================================================
// KULTURA — Criterios de calidad de los rankings /best (F-06, DAT-3)
//
// Funciones puras: qué entra en un "Los mejores X de {año}" y cómo se limpia
// lo que se pinta. Medido en producción antes de esto: juegos repetidos
// ("HELLDIVERS 2" y "Helldivers II"), notas de 5,3 en una lista de "mejores",
// el mismo anime en el ranking de anime y en el de series, títulos solo en
// japonés y sinopsis con la coletilla "(Source: Crunchyroll)".
// ============================================================

import type { MediaItem } from "@/types/media";
import { canonicalGenres } from "@/lib/recommendations/genre-canonical";

/** Nota mínima (sobre 10) para aparecer en un ranking de "mejores". */
export const BEST_MIN_RATING = 7;

const ROMAN: Record<string, number> = {
  ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xx: 20,
};

/**
 * Clave de título para deduplicar: minúsculas, sin acentos ni signos y con
 * los números romanos pasados a arábigos ("Helldivers II" = "HELLDIVERS 2").
 * `v` y `x` solo cuentan como número detrás de otra palabra, para no tocar
 * títulos que empiezan por esa letra.
 */
export function titleKey(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ㐀-鿿가-힯]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words
    .map((w, i) => {
      const n = ROMAN[w];
      if (n === undefined) return w;
      if ((w === "v" || w === "x") && i === 0) return w;
      return String(n);
    })
    .join("");
}

/** Tiene escritura japonesa, china o coreana y ninguna letra latina. */
export function isCjkOnly(text: string | undefined | null): boolean {
  if (!text) return false;
  const cjk = /[぀-ヿ㐀-鿿가-힯ｦ-ﾟ]/.test(text);
  return cjk && !/[A-Za-zÀ-ÿ]/.test(text);
}

/**
 * Serie de animación japonesa servida por TMDB como "serie". Tiene su propio
 * ranking (el de anime), así que en el de series sobra. La animación
 * occidental (Arcane, Invencible…) se queda.
 */
export function isJapaneseAnimation(item: MediaItem): boolean {
  const meta = item.metadata ?? {};
  const origin = Array.isArray(meta.originCountry) ? (meta.originCountry as string[]) : [];
  const japanese = origin.includes("JP") || meta.originalLanguage === "ja";
  return japanese && canonicalGenres(item.genres).includes("animacion");
}

/** ¿Llega a la nota mínima? Sin nota no hay ranking que justificar. */
export function meetsMinRating(item: MediaItem, min = BEST_MIN_RATING): boolean {
  return typeof item.rating === "number" && item.rating >= min;
}

// ── Media ponderada (DAT-4) ───────────────────────────────────────────────────

/**
 * Parámetros de la media ponderada tipo IMDb por formato:
 * `WR = v/(v+m)·R + m/(v+m)·C`, con `v` votos del título, `R` su nota, `m`
 * los votos a partir de los que la nota propia pesa más que la media y `C`
 * la nota media del proveedor. Un 9,7 con 300 votos de fans deja de ganar a
 * un 8,6 con 3.000 (PRO-8: "Dragon Ball Super: Beerus" encabezaba series).
 *   - TMDB (cine y series): m = 500, C = 6,5.
 *   - RAWG (juegos, nota 0-5 pasada a 0-10): m = 100 (sus recuentos son
 *     menores), C = 7,0.
 * Anime no lo usa: AniList no da recuento en el listado y su suelo es estar
 * entre los populares del año.
 */
export const WEIGHTED_PRIOR = {
  movie: { m: 500, c: 6.5 },
  tv: { m: 500, c: 6.5 },
  game: { m: 100, c: 7.0 },
} as const;

export function weightedRating(rating: number, votes: number, m: number, c: number): number {
  if (!(votes > 0)) return c;
  return (votes / (votes + m)) * rating + (m / (votes + m)) * c;
}

/** Votos del título según su proveedor (`voteCount` TMDB, `ratingsCount` RAWG). */
export function votesOf(item: MediaItem): number | undefined {
  const meta = item.metadata ?? {};
  for (const key of ["voteCount", "ratingsCount"]) {
    const v = meta[key];
    if (typeof v === "number" && v >= 0) return v;
  }
  return undefined;
}

/**
 * Clave de orden de un ranking: la media ponderada si se conocen los votos;
 * si no (cine hasta que el normalizador traiga `vote_count`, anime), la nota.
 */
export function rankingScore(format: string, item: MediaItem): number {
  const rating = typeof item.rating === "number" ? item.rating : 0;
  const prior = WEIGHTED_PRIOR[format as keyof typeof WEIGHTED_PRIOR];
  const votes = votesOf(item);
  if (!prior || votes === undefined) return rating;
  return weightedRating(rating, votes, prior.m, prior.c);
}

/** Longitud máxima de la sinopsis de una card de ranking (se recorta a 3-4 líneas). */
export const BEST_SYNOPSIS_MAX = 480;

/**
 * Sinopsis presentable: sin HTML, sin las coletillas de fuente de AniList y
 * MyAnimeList ("(Source: …)", "[Written by MAL Rewrite]", "Note: …"), solo el
 * primer párrafo con contenido y cortada en el último punto antes del límite.
 * Recortar ANTES de traducir abarata la traducción y no se pierde nada: la
 * card enseña tres o cuatro líneas.
 */
export function cleanSynopsis(
  text: string | undefined | null,
  max = BEST_SYNOPSIS_MAX
): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
  const paragraphs = plain
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !/^\(?\s*(source|fuente)\s*:/i.test(p) &&
        !/^\[?\s*written by/i.test(p) &&
        !/^(note|notes|nota)\s*:/i.test(p)
    )
    .map((p) =>
      p
        .replace(/\s*\((source|fuente)\s*:[^)]*\)\s*$/i, "")
        .replace(/\s*\[written by[^\]]*\]\s*$/i, "")
        .trim()
    )
    .filter(Boolean);
  const first = paragraphs[0];
  if (!first) return undefined;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}
