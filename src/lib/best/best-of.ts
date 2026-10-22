// ============================================================
// KULTURA — Rankings públicos "Mejores X de {año}"
// Contenido indexable sin cuenta. Reusa el camino de Descubrir
// (`fetchDiscoverData`: builders, normalizador, filtro NSFW y tope de futuro).
// ============================================================

import { unstable_cache } from "next/cache";
import { fetchDiscoverData } from "@/lib/api/discover";
import type { MediaItem, MediaType } from "@/types/media";

/** Formatos con ranking público. Los demás no tienen valoración fiable por año. */
export const BEST_FORMATS = ["anime", "movie", "tv", "game"] as const;
export type BestFormat = (typeof BEST_FORMATS)[number];

/** Cuántos años hacia atrás se publican (incluye el actual). */
export const BEST_YEARS_BACK = 3;

/** Mínimo de títulos con portada para que la página merezca existir. */
export const BEST_MIN_ITEMS = 5;
export const BEST_SIZE = 20;

const TTL_SECONDS = 60 * 60 * 24;

export function bestYears(today: Date = new Date()): number[] {
  const current = today.getFullYear();
  return Array.from({ length: BEST_YEARS_BACK }, (_, i) => current - i);
}

export function isBestFormat(value: string): value is BestFormat {
  return (BEST_FORMATS as readonly string[]).includes(value);
}

/** Valida los segmentos de la URL. `null` = 404. */
export function parseBestParams(
  format: string,
  year: string,
  today: Date = new Date(),
): { format: BestFormat; year: number } | null {
  if (!isBestFormat(format) || !/^\d{4}$/.test(year)) return null;
  const y = Number(year);
  return bestYears(today).includes(y) ? { format, year: y } : null;
}

export interface BestItem {
  id: string;
  type: MediaType;
  title: string;
  poster: string;
  year?: number;
  rating?: number;
  genres: string[];
  synopsis?: string;
}

export function pickBest(items: MediaItem[], size = BEST_SIZE): BestItem[] {
  const seen = new Set<string>();
  const out: BestItem[] = [];
  for (const item of items) {
    if (!item.poster || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({
      id: item.id,
      type: item.type,
      title: item.title,
      poster: item.poster,
      year: item.year,
      rating: item.rating && item.rating > 0 ? item.rating : undefined,
      genres: (item.genres ?? []).slice(0, 3),
      synopsis: item.synopsis?.trim() || undefined,
    });
    if (out.length >= size) break;
  }
  return out;
}

/**
 * Suelo de votos de los rankings de TMDB (E-BEST-VOTOS). Con el general de
 * Descubrir (50) el "mejor valorado" lo copaban títulos casi desconocidos con
 * pocos votos muy altos (conciertos, estrenos sin traducir). Más exigente con
 * los años cerrados, que ya han acumulado votos. En juegos es un mínimo de Metacritic (60/70). Anime no lo usa.
 */
export function bestMinVotes(
  format: BestFormat,
  year: number,
  today: Date = new Date(),
): number | undefined {
  const current = year >= today.getFullYear();
  if (format === "movie") return current ? 400 : 1500;
  if (format === "tv") return current ? 200 : 500;
  // Juegos: RAWG no filtra por nº de votos; el suelo es de Metacritic.
  if (format === "game") return current ? 60 : 70;
  return undefined;
}

/**
 * Juegos: RAWG ordena por su "rating" propio, que premia títulos con cuatro
 * votos. Se piden las páginas mejor puntuadas por Metacritic, se descartan las
 * que no llegan al suelo y se reordenan por valoración.
 */
async function loadGames(
  year: number,
  locale: string,
  min: number,
): Promise<MediaItem[]> {
  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      fetchDiscoverData(
        "game",
        page,
        { year: String(year), sort: "metacritic" },
        locale,
      )
        .then((r) => r.items)
        .catch(() => [] as MediaItem[]),
    ),
  );
  return pages
    .flat()
    .filter(
      (i) =>
        typeof i.metadata?.metacritic === "number" &&
        i.metadata.metacritic >= min,
    )
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}

const load = unstable_cache(
  async (format: BestFormat, year: number, locale: string) => {
    const base = { year: String(year), sort: "rating" };
    const minVotes = bestMinVotes(format, year);
    let items: BestItem[];
    if (format === "game" && minVotes) {
      items = pickBest(await loadGames(year, locale, minVotes));
      if (items.length < BEST_MIN_ITEMS) {
        items = pickBest(
          (await fetchDiscoverData(format, 1, base, locale)).items,
        );
      }
    } else {
      let res = await fetchDiscoverData(
        format,
        1,
        { ...base, minVotes },
        locale,
      );
      items = pickBest(res.items);
      // Si el suelo deja la lista corta (p. ej. a principios de año), se relaja
      // al general antes que dejar la página sin ranking.
      if (minVotes && items.length < BEST_MIN_ITEMS) {
        res = await fetchDiscoverData(format, 1, base, locale);
        items = pickBest(res.items);
      }
    }
    // Una carga corta LANZA: `unstable_cache` no guarda rechazos, así un hipo
    // de proveedor no congela la página vacía 24 h.
    if (items.length < BEST_MIN_ITEMS) {
      throw new Error(
        `best-of ${format} ${year}: solo ${items.length} títulos`,
      );
    }
    return items;
  },
  ["best-of-v4"],
  { revalidate: TTL_SECONDS },
);

export function getBestOf(
  format: BestFormat,
  year: number,
  locale: string,
): Promise<BestItem[]> {
  return load(format, year, locale);
}
