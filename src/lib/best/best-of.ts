// ============================================================
// KULTURA — Rankings públicos "Mejores X de {año}"
// Contenido indexable sin cuenta. Reusa el camino de Descubrir
// (`fetchDiscoverData`: builders, normalizador, filtro NSFW y tope de futuro).
//
// F-06 — tres capas de caché (todas con la etiqueta `best-of`, que
// `POST /api/revalidate` puede vaciar sin desplegar):
//   1. Selección (qué títulos y en qué orden), 24 h. Anime y juegos no
//      dependen del idioma (AniList y RAWG sirven lo mismo), así que /es y /en
//      comparten la MISMA lista. Una selección degradada (anime servido por el
//      respaldo de TMDB, un proveedor que falló a medias o una lista vacía)
//      NO entra en la caché de 24 h: va a una de 1 h y, si ya había una buena,
//      Next sigue sirviendo la buena mientras reintenta (DAT-10).
//   2. Localización (géneros, títulos y sinopsis en el idioma de la página),
//      1 h: así las traducciones pendientes se completan en pocas horas.
//   3. Enriquecimientos por título (TMDB para anime en español, Steam/RAWG
//      para la sinopsis de juegos), 7 días.
// ============================================================

import { unstable_cache } from "next/cache";
import { fetchDiscoverData, type DiscoverFilters } from "@/lib/api/discover";
import {
  BEST_CACHE_TAG,
  BEST_CACHE_VERSION,
  localizeRanking,
  type BestItem,
  type BestSource,
} from "@/lib/best/localize";
import {
  isCjkOnly,
  isJapaneseAnimation,
  meetsMinRating,
  rankingScore,
  titleKey,
} from "@/lib/best/quality";
import { resolveApiLocale } from "@/lib/api/locale";
import type { MediaItem } from "@/types/media";

export type { BestItem } from "@/lib/best/localize";
export { BEST_CACHE_TAG } from "@/lib/best/localize";
export { BEST_MIN_RATING } from "@/lib/best/quality";

/** Un ranking listo para pintar, con los datos de su criterio (SEO-10). */
export interface BestRanking {
  items: BestItem[];
  /** Cuándo se decidió esta selección (ISO). Es el "actualizado el …" real. */
  updatedAt: string;
  /** Suelo de votos que se aplicó de verdad (el relajado si hizo falta). Anime: sin suelo numérico. */
  minVotes?: number;
}

/** Selección cacheada (sin localizar): lo que usan la página, los hubs y el sitemap. */
export interface BestSelection {
  items: BestSource[];
  updatedAt: string;
  minVotes?: number;
}

/** Formatos con ranking público. Los demás no tienen valoración fiable por año. */
export const BEST_FORMATS = ["anime", "movie", "tv", "game"] as const;
export type BestFormat = (typeof BEST_FORMATS)[number];

/**
 * Primer año publicado. Desde aquí hasta el año en curso, todos (ROJO-12):
 * antes la ventana era "los 3 últimos" y el 1 de enero de 2027 las URL de 2024
 * —ya en el sitemap, indexadas y compartidas— habrían pasado a 404.
 */
export const BEST_FIRST_YEAR = 2024;

/**
 * Por debajo de esto la lista se considera corta: en el año en curso se
 * relaja el suelo de votos (a principios de año nada llega al normal). Una
 * lista corta se publica corta: nunca se rellena con notas indignas (DAT-3).
 */
export const BEST_MIN_ITEMS = 3;
export const BEST_SIZE = 20;

/**
 * Por debajo de esto un ranking se publica (con su aviso) pero NO se indexa
 * ni entra en el sitemap: una lista de 5 títulos es contenido escaso (D-16,
 * el mismo suelo que el plan pone a las facetas).
 */
export const BEST_INDEX_MIN_ITEMS = 8;

export function isIndexableRanking(count: number): boolean {
  return count >= BEST_INDEX_MIN_ITEMS;
}

/**
 * Ruta (sin idioma) de la ficha pública de un título del ranking (D-01,
 * `/[locale]/media/[type]/[id]`, el mismo id que usa `MediaCard`). Las
 * entradas cacheadas antes de `externalId` lo sacan del id (`anime_al-1`).
 */
export function bestItemPath(item: { id: string; type: string; externalId?: string }): string {
  const prefix = `${item.type}_`;
  const externalId =
    item.externalId ?? (item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.id);
  return `/media/${item.type}/${encodeURIComponent(externalId)}`;
}

const DAY_SECONDS = 60 * 60 * 24;
const HOUR_SECONDS = 60 * 60;

/** Años publicados, del más reciente al más antiguo. Nunca encoge. */
export function bestYears(today: Date = new Date()): number[] {
  const out: number[] = [];
  for (let y = today.getFullYear(); y >= BEST_FIRST_YEAR; y--) out.push(y);
  return out;
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

function toSource(item: MediaItem): BestSource {
  const meta = item.metadata ?? {};
  return {
    id: item.id,
    externalId: item.externalId,
    type: item.type,
    title: item.title,
    originalTitle: item.originalTitle,
    nativeTitle: typeof meta.nativeTitle === "string" ? meta.nativeTitle : undefined,
    poster: item.poster as string,
    year: item.year,
    rating: item.rating && item.rating > 0 ? item.rating : undefined,
    genres: (item.genres ?? []).slice(0, 5),
    synopsis: item.synopsis?.trim() || undefined,
  };
}

/** Sin portada, repetidos por id o por título normalizado: fuera. */
function selectBest(items: MediaItem[], size = BEST_SIZE): BestSource[] {
  const ids = new Set<string>();
  const titles = new Set<string>();
  const out: BestSource[] = [];
  for (const item of items) {
    if (!item.poster || ids.has(item.id)) continue;
    const key = titleKey(item.title);
    if (key && titles.has(key)) continue;
    ids.add(item.id);
    if (key) titles.add(key);
    out.push(toSource(item));
    if (out.length >= size) break;
  }
  return out;
}

/** Ítems de ranking a partir de un listado (sin filtros de nota). */
export function pickBest(items: MediaItem[], size = BEST_SIZE): BestItem[] {
  return selectBest(items, size).map((s) => ({
    id: s.id,
    externalId: s.externalId,
    type: s.type,
    title: s.title,
    poster: s.poster,
    year: s.year,
    rating: s.rating,
    genres: s.genres.slice(0, 3),
    synopsis: s.synopsis,
  }));
}

/**
 * Suelo de votos de los rankings de TMDB (E-BEST-VOTOS). Con el general de
 * Descubrir (50) el "mejor valorado" lo copaban títulos casi desconocidos con
 * pocos votos muy altos. Más exigente con los años cerrados, que ya han
 * acumulado votos; en el año en curso, más alto que antes (PRO-8: notas de
 * 9,4-9,7 con pocos votos de fans). En juegos es un mínimo de valoraciones
 * RAWG. Anime no lo usa: su suelo es estar entre los 60 más populares del año.
 */
export function bestMinVotes(
  format: BestFormat,
  year: number,
  today: Date = new Date(),
): number | undefined {
  const current = year >= today.getFullYear();
  if (format === "movie") return current ? 500 : 1500;
  if (format === "tv") return current ? 300 : 500;
  if (format === "game") return current ? 25 : 60;
  return undefined;
}

/** Suelo relajado del año en curso cuando el normal deja la lista corta. */
function relaxedMinVotes(min: number): number {
  return Math.max(10, Math.round(min / 4));
}

interface Fetched {
  items: MediaItem[];
  /** Páginas pedidas que fallaron (proveedor caído o con error). */
  failed: number;
  pages: number;
}

async function fetchPages(
  format: BestFormat,
  filters: DiscoverFilters,
  locale: string,
  pages: number[],
): Promise<Fetched> {
  const results = await Promise.all(
    pages.map((page) =>
      fetchDiscoverData(format, page, filters, locale).then(
        (r) => (r.fetchErrorKind ? null : r.items ?? []),
        () => null,
      ),
    ),
  );
  return {
    items: results.flatMap((r) => r ?? []),
    failed: results.filter((r) => r === null).length,
    pages: pages.length,
  };
}

const byRatingDesc = (a: MediaItem, b: MediaItem) => (b.rating ?? 0) - (a.rating ?? 0);

/**
 * Filtros de calidad comunes, orden por media ponderada (DAT-4) y selección
 * final. La nota mínima se mira sobre la nota PROPIA (la que se pinta); la
 * ponderada solo decide el orden. Orden estable: a igualdad, el del proveedor.
 */
function rank(format: BestFormat, items: MediaItem[]): BestSource[] {
  const eligible = items
    .filter((i) => meetsMinRating(i) && !(format === "tv" && isJapaneseAnimation(i)))
    .map((item, i) => ({ item, i, score: rankingScore(format, item) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item);
  return selectBest(eligible);
}

interface Selection {
  items: BestSource[];
  degraded: boolean;
  /** Suelo de votos aplicado (cine, series y juegos). */
  minVotes?: number;
}

/** Una carga en la que TODO falló lanza: `unstable_cache` no guarda rechazos. */
function assertSomeData(f: Fetched, format: BestFormat, year: number) {
  if (f.failed === f.pages) {
    throw new Error(`best-of ${format} ${year}: el proveedor no respondió`);
  }
}

async function selectTmdb(
  format: "movie" | "tv",
  year: number,
  locale: string,
  today: Date,
): Promise<Selection> {
  const base: DiscoverFilters = { year: String(year), sort: "rating" };
  const min = bestMinVotes(format, year, today)!;
  let floor = min;
  let filters: DiscoverFilters = { ...base, minVotes: floor };
  let fetched = await fetchPages(format, filters, locale, [1, 2]);
  assertSomeData(fetched, format, year);
  let items = rank(format, fetched.items);

  if (year >= today.getFullYear() && items.length < BEST_MIN_ITEMS) {
    const relaxedFloor = relaxedMinVotes(min);
    const relaxed: DiscoverFilters = { ...base, minVotes: relaxedFloor };
    const again = await fetchPages(format, relaxed, locale, [1, 2]);
    const more = rank(format, again.items);
    if (more.length > items.length) {
      items = more;
      fetched = again;
      filters = relaxed;
      floor = relaxedFloor;
    }
  }

  // DAT-5: en español TMDB devuelve el título ORIGINAL (a veces solo en
  // japonés o coreano) y la sinopsis vacía cuando no hay traducción. Se
  // completan con la versión inglesa; la sinopsis se traduce después.
  if (resolveApiLocale(locale) === "es" && items.some((i) => isCjkOnly(i.title) || !i.synopsis)) {
    const en = await fetchPages(format, filters, "en", [1, 2]);
    const byId = new Map(en.items.map((i) => [i.id, i] as const));
    items = items.map((i) => {
      const alt = byId.get(i.id);
      if (!alt) return i;
      return {
        ...i,
        title: isCjkOnly(i.title) && alt.title && !isCjkOnly(alt.title) ? alt.title : i.title,
        synopsis: i.synopsis || alt.synopsis?.trim() || undefined,
      };
    });
  }

  return { items, degraded: fetched.failed > 0 || items.length === 0, minVotes: floor };
}

/**
 * Anime: los 60 más populares del año en AniList, reordenados por nota. Estar
 * entre los populares es el suelo de votos (AniList no expone un mínimo de
 * puntuaciones en el filtro), así no se cuelan títulos con un puñado de notas.
 */
async function selectAnime(year: number): Promise<Selection> {
  const fetched = await fetchPages("anime", { year: String(year), sort: "popularity" }, "en", [1, 2, 3]);
  assertSomeData(fetched, "anime", year);
  const items = rank("anime", [...fetched.items].sort(byRatingDesc));
  // Ids `tmdb-…` = AniList caído y servido por el respaldo: vale para hoy,
  // no para fijarlo 24 h (antes /es y /en acababan con listas distintas).
  const fallback = items.some((i) => i.externalId.startsWith("tmdb-"));
  return { items, degraded: fallback || fetched.failed > 0 || items.length === 0 };
}

/**
 * Juegos: RAWG ordena por su "rating" propio, que premia títulos con cuatro
 * votos. Se piden las páginas más populares del año, se descartan las que no
 * llegan al suelo de valoraciones y se reordenan por media ponderada (DAT-4).
 */
async function selectGames(year: number, today: Date): Promise<Selection> {
  const min = bestMinVotes("game", year, today)!;
  const fetched = await fetchPages("game", { year: String(year), sort: "popularity" }, "en", [1, 2, 3, 4, 5]);
  assertSomeData(fetched, "game", year);
  const withFloor = (floor: number) =>
    rank(
      "game",
      fetched.items
        .filter((i) => typeof i.metadata?.ratingsCount === "number" && i.metadata.ratingsCount >= floor)
        .sort(byRatingDesc),
    );
  let floor = min;
  let items = withFloor(floor);
  if (year >= today.getFullYear() && items.length < BEST_MIN_ITEMS) {
    floor = relaxedMinVotes(min);
    items = withFloor(floor);
  }
  return { items, degraded: fetched.failed > 0 || items.length === 0, minVotes: floor };
}

/** Selección sin caché. Exportada para los tests. */
export async function computeSelection(
  format: BestFormat,
  year: number,
  locale: string,
  today: Date = new Date(),
): Promise<Selection> {
  if (format === "anime") return selectAnime(year);
  if (format === "game") return selectGames(year, today);
  return selectTmdb(format, year, locale, today);
}

/** Idioma de la clave de selección: anime y juegos no dependen de él. */
function selectionLocale(format: BestFormat, locale: string): string {
  return format === "anime" || format === "game" ? "all" : resolveApiLocale(locale);
}

class DegradedSelection extends Error {
  readonly degradedSelection = true;
  constructor(readonly selection: BestSelection) {
    super("best-of: selección degradada, no se fija 24 h");
  }
}

function toCached(s: Selection): BestSelection {
  const out: BestSelection = { items: s.items, updatedAt: new Date().toISOString() };
  if (s.minVotes !== undefined) out.minVotes = s.minVotes;
  return out;
}

/**
 * Última selección degradada calculada en este proceso. Evita repetir las
 * llamadas al pasar de la caché larga (que la rechaza) a la corta.
 */
const recentDegraded = new Map<string, { at: number; selection: BestSelection }>();

const selectionLong = unstable_cache(
  async (format: BestFormat, year: number, locale: string): Promise<BestSelection> => {
    const s = await computeSelection(format, year, locale);
    const cached = toCached(s);
    if (s.degraded) {
      recentDegraded.set(`${format}|${year}|${locale}`, { at: Date.now(), selection: cached });
      throw new DegradedSelection(cached);
    }
    return cached;
  },
  [BEST_CACHE_VERSION, "selection"],
  { revalidate: DAY_SECONDS, tags: [BEST_CACHE_TAG] },
);

const selectionShort = unstable_cache(
  async (format: BestFormat, year: number, locale: string): Promise<BestSelection> => {
    const memo = recentDegraded.get(`${format}|${year}|${locale}`);
    if (memo && Date.now() - memo.at < 60_000) return memo.selection;
    return toCached(await computeSelection(format, year, locale));
  },
  [BEST_CACHE_VERSION, "selection-short"],
  { revalidate: HOUR_SECONDS, tags: [BEST_CACHE_TAG] },
);

async function getSelection(format: BestFormat, year: number, locale: string): Promise<BestSelection> {
  const key = selectionLocale(format, locale);
  try {
    return await selectionLong(format, year, key);
  } catch (e) {
    if ((e as { degradedSelection?: boolean })?.degradedSelection) {
      return selectionShort(format, year, key);
    }
    throw e;
  }
}

/**
 * Selección de un ranking SIN localizar (sin traducciones ni llamadas al
 * modelo): para el sitemap y los recuentos. Cine y series se miran en `es`,
 * la misma clave de caché que la página en español.
 */
export function getBestSelection(format: BestFormat, year: number): Promise<BestSelection> {
  return getSelection(format, year, "es");
}

const localized = unstable_cache(
  async (format: BestFormat, year: number, locale: string): Promise<BestRanking> => {
    const selection = await getSelection(format, year, locale);
    const ranking: BestRanking = {
      items: await localizeRanking(selection.items, locale),
      updatedAt: selection.updatedAt,
    };
    if (selection.minVotes !== undefined) ranking.minVotes = selection.minVotes;
    return ranking;
  },
  [BEST_CACHE_VERSION, "localized"],
  { revalidate: HOUR_SECONDS, tags: [BEST_CACHE_TAG] },
);

/**
 * Ranking listo para pintar, con fecha y criterio. Lanza solo si el
 * proveedor no respondió y no hay ninguna versión anterior; una lista corta
 * (incluso vacía a primeros de año) se devuelve tal cual.
 */
export function getBestRanking(format: BestFormat, year: number, locale: string): Promise<BestRanking> {
  return localized(format, year, resolveApiLocale(locale));
}

/**
 * Ranking que enseñan los hubs para un formato: el del año más reciente con
 * lista indexable (a primeros de año el del año en curso aún es corto).
 * `null` si ninguno llega al mínimo. Si un proveedor falla, lanza: el hub
 * distingue "no disponible" (aviso en esa sección) de "aún no hay ranking".
 */
export async function getFeaturedRanking(
  format: BestFormat,
  locale: string,
  today: Date = new Date(),
): Promise<{ year: number; ranking: BestRanking } | null> {
  for (const year of bestYears(today)) {
    const ranking = await getBestRanking(format, year, locale);
    if (isIndexableRanking(ranking.items.length)) return { year, ranking };
  }
  return null;
}

/** Solo los títulos de `getBestRanking` (landing e imagen OG). */
export async function getBestOf(
  format: BestFormat,
  year: number,
  locale: string,
): Promise<BestItem[]> {
  return (await getBestRanking(format, year, locale)).items;
}
