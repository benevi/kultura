// ============================================================
// KULTURA — Cruce de un anime de AniList con su ficha de TMDB, por Wikidata (fase 8.5, F5c)
//
// Para que la sala de un anime de AniList tenga imagen apaisada (AniList no
// la da), tráiler y «Dónde ver» cuando AniList no los trae. Revisión de
// términos de F5 (24-11-2026) y decisiones de Víctor del mismo día:
//
// - **Solo bajo demanda**: lo pide la página al abrir la ficha de UN anime y
//   solo con la sala encendida. Nunca en lote (sería recogida masiva de AniList
//   y carga para WDQS).
// - **A Wikidata solo va el id público** de AniList (y el de MyAnimeList que da
//   AniList, como segunda vía). Nada del usuario; nada en los logs.
// - **Lo que se guarda es la correspondencia** (dato CC0 de Wikidata), en la
//   caché de datos de Next, sin migración: 30 días si hay cruce y 7 si no
//   (Wikidata se corrige). Lo de TMDB que se pinta sigue con su caché de
//   siempre (`providerFetch`).
// - **Validar antes de usar**: tipo coherente (película de AniList → id de
//   película de TMDB; serie → id de serie), un solo id (varios = no se cruza)
//   y año a ±1.
//
// Temporadas: AniList tiene una entrada por temporada y TMDB una serie con
// todas. Una entrada de AniList es «temporada posterior» si es una serie (TV,
// TV_SHORT u ONA) y AniList le da una PRECUELA (`relationType: PREQUEL`) que
// también es una serie: «Sousou no Frieren 2nd Season» tiene de precuela la
// primera. Con eso:
//   - Primera temporada o película: el estreno de TMDB a ±1 año del de AniList.
//     Se usa todo: imagen, tráiler y «Dónde ver».
//   - Temporada posterior: si la ficha de TMDB es solo de esa temporada (su
//     estreno cuadra, ±1), se usa todo. Si es la serie entera (estreno antes),
//     tiene que cuadrar por otro lado: o una temporada de TMDB tiene la fecha
//     de AniList (±1), o el estreno de la serie tiene la de la precuela (±1;
//     TMDB tarda en dar de alta las temporadas nuevas: Frieren, noviembre de
//     2026, solo tiene la primera). Y de TMDB solo se usa la IMAGEN: el
//     tráiler y la oferta pueden ser de otra temporada (decisión de Víctor).
//   - Una «primera temporada» cuya serie de TMDB empezó años antes no se cruza:
//     algo no cuadra.
// ============================================================

import { unstable_cache } from "next/cache";
import { getAnimeCrossInfo, type AniListCrossInfo } from "@/lib/api/anilist";
import { getMovie, getTV, type TmdbMovieDetail, type TmdbTVDetail } from "@/lib/api/tmdb";
import { runSparql, bindingValue, WD, type SparqlBinding } from "@/lib/api/wikidata";

/** Qué se puede usar de TMDB: todo, o solo la imagen (temporada posterior). */
export type CrossScope = "full" | "image";

export interface AnimeTmdbCross {
  kind: "movie" | "tv";
  id: number;
  scope: CrossScope;
}

/** 30 días con cruce; 7 sin él (decisión de Víctor, 24-11-2026). */
export const CROSS_HIT_REVALIDATE_SECONDS = 30 * 24 * 3600;
export const CROSS_MISS_REVALIDATE_SECONDS = 7 * 24 * 3600;
/** Se sube al cambiar la forma de lo guardado. */
const CROSS_CACHE_VERSION = "anime-tmdb-cross-v2";

/** WDQS responde a esta consulta en 0,3-0,4 s; con más de 4 s, mejor sin cruce. */
export const CROSS_WIKIDATA_TIMEOUT_MS = 4000;

const SERIES_FORMATS: ReadonlySet<string> = new Set(["TV", "TV_SHORT", "ONA"]);

const DIGITS = /^\d{1,10}$/;

/** Película o serie, según el formato de AniList; `null` si no se cruza (OVA, especial, música…). */
export function expectedKind(format: string | null | undefined): "movie" | "tv" | null {
  if (format === "MOVIE") return "movie";
  return format && SERIES_FORMATS.has(format) ? "tv" : null;
}

/** ¿Temporada posterior? Serie con una precuela que también es serie (ver cabecera). */
export function isLaterSeason(info: Pick<AniListCrossInfo, "format" | "relations">): boolean {
  return seriesPrequels(info).length > 0;
}

function seriesPrequels(info: Pick<AniListCrossInfo, "format" | "relations">): AniListCrossInfo["relations"] {
  if (!info.format || !SERIES_FORMATS.has(info.format)) return [];
  return (info.relations ?? []).filter(
    (r) => r.relationType === "PREQUEL" && r.type === "ANIME" && !!r.format && SERIES_FORMATS.has(r.format)
  );
}

/**
 * Consulta de WDQS: el elemento con el id de AniList (o el de MyAnimeList) y
 * sus ids de TMDB, propios o de la serie de la que es temporada (P179). Forma
 * barata (0,3-0,4 s): las vías en UNION y los ids en OPTIONAL. Con cada id
 * en su propio UNION tardaba 12 s.
 */
export function buildCrossQuery(anilistId: number, malId?: number | null): string {
  const al = String(anilistId);
  if (!DIGITS.test(al)) throw new Error("buildCrossQuery: id de AniList no válido");
  const seeds = [`{ ?seed wdt:${WD.anilistAnime} "${al}" . }`];
  const mal = malId != null ? String(malId) : "";
  if (DIGITS.test(mal)) seeds.push(`{ ?seed wdt:${WD.malAnime} "${mal}" . }`);
  return `SELECT ?seed ?tmdbMovie ?tmdbTv ?seriesTv WHERE {
  ${seeds.join(" UNION ")}
  OPTIONAL { ?seed wdt:${WD.tmdbMovie} ?tmdbMovie . }
  OPTIONAL { ?seed wdt:${WD.tmdbTv} ?tmdbTv . }
  OPTIONAL { ?seed wdt:${WD.partOfSeries} ?series . ?series wdt:${WD.tmdbTv} ?seriesTv . }
}
LIMIT 20`;
}

/**
 * El id de TMDB que dice Wikidata para ese tipo, o `null`: sin ninguno, o con
 * varios distintos (no se adivina). En una serie, el id del propio elemento
 * manda sobre el de la serie de la que es temporada.
 */
export function pickTmdbId(rows: SparqlBinding[], kind: "movie" | "tv"): number | null {
  const ids = (name: string) =>
    new Set(rows.map((r) => bindingValue(r, name)).filter((v): v is string => !!v && DIGITS.test(v)));
  let found: Set<string>;
  if (kind === "movie") {
    found = ids("tmdbMovie");
  } else {
    const own = ids("tmdbTv");
    found = own.size > 0 ? own : ids("seriesTv");
  }
  if (found.size !== 1) return null;
  const id = Number([...found][0]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function yearOf(date: string | null | undefined): number | null {
  const m = typeof date === "string" ? /^(\d{4})-/.exec(date) : null;
  return m ? Number(m[1]) : null;
}

const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) <= 1;

/**
 * Valida el cruce con la ficha de TMDB y decide qué se puede usar (ver
 * cabecera). `null` = no se cruza.
 */
export function crossScope(
  kind: "movie" | "tv",
  detail: Pick<TmdbMovieDetail, "release_date"> | Pick<TmdbTVDetail, "first_air_date" | "seasons">,
  anilistYear: number,
  laterSeason: boolean,
  /** Años de las precuelas que son serie (solo cuentan con `laterSeason`). */
  prequelYears: readonly number[] = []
): CrossScope | null {
  if (kind === "movie") {
    return near(yearOf((detail as TmdbMovieDetail).release_date), anilistYear) ? "full" : null;
  }
  const tv = detail as TmdbTVDetail;
  if (near(yearOf(tv.first_air_date), anilistYear)) return "full";
  if (!laterSeason) return null;
  const first = yearOf(tv.first_air_date);
  if (first === null || first > anilistYear) return null;
  const season = (tv.seasons ?? []).some((s) => (s?.season_number ?? 0) > 0 && near(yearOf(s?.air_date), anilistYear));
  const prequel = prequelYears.some((y) => near(first, y));
  return season || prequel ? "image" : null;
}

/** Sin caché: AniList (formato, año, precuelas, id de MAL) → Wikidata → TMDB. Lanza si un proveedor falla. */
export async function findAnimeTmdbCrossUncached(anilistId: number): Promise<AnimeTmdbCross | null> {
  const info = await getAnimeCrossInfo(anilistId);
  const kind = expectedKind(info.format);
  const year = info.seasonYear ?? info.startDate?.year ?? null;
  if (!kind || !year) return null;

  const { results } = await runSparql(buildCrossQuery(anilistId, info.idMal), {
    // La caché es la de este cruce (30/7 días), no la de la respuesta de WDQS.
    cache: false,
    timeoutMs: CROSS_WIKIDATA_TIMEOUT_MS,
  });
  const id = pickTmdbId(results.bindings, kind);
  if (id === null) return null;

  const detail = kind === "movie" ? await getMovie(id) : await getTV(id);
  const prequels = seriesPrequels(info);
  const prequelYears = prequels.map((r) => r.year).filter((y): y is number => typeof y === "number");
  const scope = crossScope(kind, detail, year, prequels.length > 0, prequelYears);
  return scope ? { kind, id, scope } : null;
}

// ── Caché: 30 días con cruce, 7 sin él ───────────────────────────────────────
//
// `unstable_cache` tiene un plazo fijo y no guarda rechazos. Dos capas:
//   - la de fuera (30 días) solo guarda cruces: si no lo hay, lanza;
//   - la de dentro (7 días) solo guarda «sin cruce»: si lo hay, lanza con él.
// Un fallo de un proveedor lanza en las dos y no se guarda en ninguna.

class CrossFound extends Error {
  constructor(readonly cross: AnimeTmdbCross) {
    super("cruce encontrado");
  }
}
class NoCross extends Error {
  constructor() {
    super("sin cruce");
  }
}

const cachedMiss = unstable_cache(
  async (anilistId: number): Promise<null> => {
    const cross = await findAnimeTmdbCrossUncached(anilistId);
    if (cross) throw new CrossFound(cross);
    return null;
  },
  [CROSS_CACHE_VERSION, "miss"],
  { revalidate: CROSS_MISS_REVALIDATE_SECONDS, tags: ["anime-tmdb-cross"] }
);

const cachedHit = unstable_cache(
  async (anilistId: number): Promise<AnimeTmdbCross> => {
    try {
      await cachedMiss(anilistId);
    } catch (e) {
      if (e instanceof CrossFound) return e.cross;
      throw e;
    }
    throw new NoCross();
  },
  [CROSS_CACHE_VERSION, "hit"],
  { revalidate: CROSS_HIT_REVALIDATE_SECONDS, tags: ["anime-tmdb-cross"] }
);

function isMissingIncrementalCache(e: unknown): boolean {
  return e instanceof Error && e.message.includes("incrementalCache missing");
}

/**
 * El cruce de un anime de AniList con TMDB, o `null` (sin cruce, o un
 * proveedor caído: se vuelve a intentar en la siguiente visita). Nunca lanza.
 */
export async function findAnimeTmdbCross(anilistId: number): Promise<AnimeTmdbCross | null> {
  if (!Number.isSafeInteger(anilistId) || anilistId <= 0) return null;
  try {
    return await cachedHit(anilistId);
  } catch (e) {
    if (e instanceof NoCross) return null;
    // `unstable_cache` puede envolver el error: se mira también la causa.
    const cause = (e as { cause?: unknown } | null)?.cause;
    if (cause instanceof NoCross) return null;
    if (isMissingIncrementalCache(e)) {
      // Fuera de Next (tests, scripts) no hay caché incremental.
      return findAnimeTmdbCrossUncached(anilistId).catch(() => null);
    }
    return null;
  }
}
