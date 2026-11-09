// ============================================================
// KULTURA — Estantería de la portada v2
//
// Las portadas cambian solas. Cada formato sale de su mejor fuente:
//   - Series, películas y anime: el ranking destacado de /best (ya filtrado por
//     votos y nota, y localizado). Evita lo que traía la muestra de Descubrir,
//     ordenada por popularidad a secas.
//   - Manga: tendencia de AniList con nota mínima. MangaDex no sirve aquí: sus
//     portadas las bloquea el navegador si se piden desde otra web.
//   - Juegos: la lista blanca de `showcase.ts` (RAWG no tiene carátula vertical).
//   - Libros y cómics: listas revisadas a mano. Las fuentes abiertas devuelven
//     clásicos en inglés y números sueltos sin contexto.
// Además, cada mes se desplaza la ventana de cada lista: los títulos cambian
// aunque el ranking no se haya movido.
//
// Un resultado pobre no se guarda 24 h: si falta algún formato vivo, va a la
// caché corta (1 h). Sin ningún ranking, `getPortadaShelf` usa el respaldo local
// de `scenes.ts` sin guardarlo.
// ============================================================

import { unstable_cache } from "next/cache";
import { discoverTrendingManga, normalizeAniListManga } from "@/lib/api/anilist";
import { getFeaturedRanking } from "@/lib/best/best-of";
import { BEST_CACHE_TAG, SHOWCASE_CACHE_TAG } from "@/lib/best/cache-tags";
import { createLogger } from "@/lib/logger";
import { FALLBACK_MEDIA } from "./scenes";
import { SHELF_FORMATS, type ShelfFormat, type ShelfItem } from "./shelf-types";
import { CURATED_GAMES, isLandscapePoster, steamCover } from "./showcase";

const log = createLogger("portada-shelf");

export { SHELF_FORMATS };
export type { ShelfFormat, ShelfItem };

export interface Shelf {
  /** Abanico de la primera pantalla. */
  fan: ShelfItem[];
  /** Posición inicial en el abanico: la primera serie. */
  start: number;
  /** Obras «a medias» de la segunda sección. */
  rows: ShelfItem[];
  /** Tres portadas por formato. */
  byFormat: Partial<Record<ShelfFormat, ShelfItem[]>>;
}

type Pools = Partial<Record<ShelfFormat, ShelfItem[]>>;

const COVER = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;

/** Ediciones en español con portada de al menos 300 px de ancho, revisadas el 2026-11-09. */
export const CURATED_BOOKS: ReadonlyArray<{ cover: number; title: string }> = [
  { cover: 12334964, title: "Patria" },
  { cover: 11481354, title: "Dune" },
  { cover: 10107644, title: "La sombra del viento" },
  { cover: 1047466, title: "Rayuela" },
  { cover: 13478610, title: "Don Quijote de la Mancha" },
];

/** Cómics revisados el 2026-11-09. Maus se descarta: su cubierta lleva una esvástica. */
export const CURATED_COMICS: ReadonlyArray<{ cover: number; title: string }> = [
  { cover: 7274558, title: "Blacksad" },
  { cover: 12679639, title: "Saga" },
  { cover: 12648915, title: "Persépolis" },
  { cover: 7774899, title: "Watchmen" },
];

const FAMILY_TIMEOUT_MS = 6000;
const PER_FORMAT = 5;
const MANGA_MIN_SCORE = 7;
const MANGA_BLOCKED_GENRES = new Set(["Ecchi", "Hentai"]);

/**
 * Composición del abanico, de izquierda a derecha: [formato, puesto en su lista].
 * Mezcla a propósito: dos portadas del mismo formato nunca van juntas, y junto a
 * la serie central van película y juego para que el conjunto no parezca solo anime.
 */
const FAN_LAYOUT: ReadonlyArray<readonly [ShelfFormat, number]> = [
  ["game", 1],
  ["anime", 1],
  ["manga", 1],
  ["book", 0],
  ["movie", 0],
  ["tv", 0],
  ["game", 0],
  ["comic", 0],
  ["manga", 0],
  ["movie", 1],
  ["anime", 0],
];

/** Meses desde el año 0: cambia exactamente cada mes natural (UTC). */
export function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Ventana de `size` títulos que avanza cada mes y da la vuelta a la lista. El paso
 * es primo con el largo: así recorre todas las posiciones. Con paso `size`, una
 * lista de 5 arrancaría siempre en el mismo título.
 */
export function monthlyWindow<T>(list: readonly T[], month: number, size = PER_FORMAT): T[] {
  const n = list.length;
  if (n === 0) return [];
  let step = size;
  while (gcd(step, n) !== 1) step += 1;
  const start = (month * step) % n;
  return Array.from({ length: Math.min(size, n) }, (_, i) => list[(start + i) % n]);
}

/** Reparte las listas del mes entre el abanico, las filas y los formatos. */
export function buildShelf(pools: Pools): Shelf {
  const fan = FAN_LAYOUT.flatMap(([format, nth]) => {
    const item = pools[format]?.[nth];
    return item ? [item] : [];
  });
  const firstTv = fan.findIndex((item) => item.format === "tv");
  // Abre en otra obra que el centro del abanico: la serie central ya se acaba de ver.
  const rows = (["game", "tv", "anime", "manga"] as const).flatMap((format) => pools[format]?.slice(0, 1) ?? []);
  const byFormat: Shelf["byFormat"] = {};
  for (const format of SHELF_FORMATS) {
    const list = pools[format];
    // Las últimas: así el abanico y los formatos enseñan títulos distintos.
    if (list?.length) byFormat[format] = list.slice(-3);
  }
  return { fan, start: firstTv >= 0 ? firstTv : Math.floor(fan.length / 2), rows, byFormat };
}

function fallbackPool(format: ShelfFormat): ShelfItem[] {
  return FALLBACK_MEDIA.filter((m) => m.format === format && m.slot !== "hero").map((m) => ({
    id: `${format}_${m.externalId}`,
    format,
    title: m.title,
    poster: m.image,
  }));
}

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), FAMILY_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

async function rankingPool(format: "tv" | "movie" | "anime", locale: string): Promise<ShelfItem[]> {
  const featured = await getFeaturedRanking(format, locale);
  return (featured?.ranking.items ?? []).flatMap((item) =>
    item.poster && !isLandscapePoster(item.poster) ? [{ id: item.id, format, title: item.title, poster: item.poster }] : [],
  );
}

async function mangaPool(): Promise<ShelfItem[]> {
  const raw = await discoverTrendingManga();
  return raw.flatMap((manga) => {
    const item = normalizeAniListManga(manga);
    const blocked = item.genres?.some((genre) => MANGA_BLOCKED_GENRES.has(genre));
    if (!item.poster || blocked || (item.rating ?? 0) < MANGA_MIN_SCORE) return [];
    return [{ id: item.id, format: "manga" as const, title: item.title, poster: item.poster }];
  });
}

function staticPools(): Pools {
  return {
    game: CURATED_GAMES.map((g) => ({ id: `game_${g.rawg}`, format: "game", title: g.title, poster: steamCover(g.steam) })),
    book: CURATED_BOOKS.map((b) => ({ id: `book_${b.cover}`, format: "book", title: b.title, poster: COVER(b.cover) })),
    comic: CURATED_COMICS.map((c) => ({ id: `comic_${c.cover}`, format: "comic", title: c.title, poster: COVER(c.cover) })),
  };
}

function windowed(pools: Pools, month: number): Pools {
  return Object.fromEntries(
    Object.entries(pools).map(([format, list]) => [format, monthlyWindow(list ?? [], month)]),
  );
}

/** Estantería con algún formato de respaldo: sirve, pero no 24 h. */
class DegradedShelf extends Error {}

/** Última degradada de este proceso: evita repetir las llamadas al pasar a la caché corta. */
const recentDegraded = new Map<string, { at: number; shelf: Shelf }>();

async function loadShelf(locale: string, month: number): Promise<{ shelf: Shelf; degraded: boolean }> {
  const [tv, movie, anime, manga] = await Promise.all([
    withTimeout(rankingPool("tv", locale), []),
    withTimeout(rankingPool("movie", locale), []),
    withTimeout(rankingPool("anime", locale), []),
    withTimeout(mangaPool(), []),
  ]);
  if (tv.length === 0 && movie.length === 0 && anime.length === 0) {
    throw new Error("estantería sin rankings");
  }
  const live: Pools = { ...staticPools(), tv, movie, anime, manga };
  let degraded = false;
  for (const format of ["tv", "movie", "anime", "manga"] as const) {
    if (!live[format]?.length) {
      live[format] = fallbackPool(format);
      degraded = true;
    }
  }
  return { shelf: buildShelf(windowed(live, month)), degraded };
}

// El mes forma parte de la clave: el primer render del mes calcula la lista nueva.
const shelfLong = unstable_cache(
  async (locale: string, month: number): Promise<Shelf> => {
    const { shelf, degraded } = await loadShelf(locale, month);
    if (degraded) {
      recentDegraded.set(`${locale}|${month}`, { at: Date.now(), shelf });
      throw new DegradedShelf("estantería con formatos de respaldo");
    }
    return shelf;
  },
  ["portada-shelf-v2"],
  { revalidate: 60 * 60 * 24, tags: [BEST_CACHE_TAG, SHOWCASE_CACHE_TAG] },
);

const shelfShort = unstable_cache(
  async (locale: string, month: number): Promise<Shelf> => {
    const memo = recentDegraded.get(`${locale}|${month}`);
    if (memo && Date.now() - memo.at < 60_000) return memo.shelf;
    return (await loadShelf(locale, month)).shelf;
  },
  ["portada-shelf-v2-short"],
  { revalidate: 60 * 60, tags: [BEST_CACHE_TAG, SHOWCASE_CACHE_TAG] },
);

async function cachedShelf(locale: string, month: number): Promise<Shelf> {
  try {
    return await shelfLong(locale, month);
  } catch (e) {
    if (e instanceof DegradedShelf) return shelfShort(locale, month);
    throw e;
  }
}

/** Estantería del mes. Nunca lanza: sin proveedores, usa el respaldo local. */
export async function getPortadaShelf(locale: string, today: Date = new Date()): Promise<Shelf> {
  const month = monthIndex(today);
  try {
    return await cachedShelf(locale, month);
  } catch (e) {
    log.warn(`estantería de respaldo · ${e instanceof Error ? e.message : String(e)}`);
    const pools: Pools = { ...staticPools() };
    for (const format of ["tv", "movie", "anime", "manga"] as const) pools[format] = fallbackPool(format);
    return buildShelf(windowed(pools, month));
  }
}
