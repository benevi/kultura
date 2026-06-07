// ============================================================
// KULTURA — RAWG filter translation tables (E59 F3b · R4c-1)
// Traduce el contrato canónico (docs/E59_FILTER_SPEC.md) a los params nativos
// de /games: genres (slug), platforms (id), dates (rango), ordering.
//
// R4c-1: 4 filtros game NO nativos en RAWG → POST-filtro sobre los MediaItem ya
// normalizados (mismo patrón que volumenes×manga / editorial×comic):
//   valoracion → metacritic >= umbral · estado → tag early-access ·
//   modojuego → tags de modo · duracionmedia → bucket de playtime (horas).
// NO entran en el gate de fetch (hasRawgFilters): el fetch nativo corre igual y
// el filtrado es posterior. Guard: vacío/desconocido → no filtra.
// ============================================================

import type { MediaItem } from "@/types/media";
import { valoracionThreshold } from "@/lib/api/valoracion";

// ── Géneros (RAWG acepta slugs directamente) ────────────────────────────────────
// slug canónico Kultura → slug RAWG. Coma = OR (RAWG une con coma).

export const RAWG_GENRE: Record<string, string> = {
  accion: "action",
  aventura: "adventure",
  rpg: "role-playing-games-rpg",
  estrategia: "strategy",
  shooter: "shooter",
  indie: "indie",
  casual: "casual",
  simulacion: "simulation",
  puzzle: "puzzle",
  arcade: "arcade",
  plataformas: "platformer",
  carreras: "racing",
  deportes: "sports",
  lucha: "fighting",
  familia: "family",
};

// ── Plataformas (RAWG platform IDs) ─────────────────────────────────────────────
// slug canónico → platform_id RAWG. Coma = OR.

export const RAWG_PLATFORM: Record<string, number> = {
  pc: 4,
  ps5: 187,
  ps4: 18,
  "xbox-series": 186,
  "xbox-one": 1,
  switch: 7,
  ios: 3,
  android: 21,
  mac: 5,
  linux: 6,
};

// ── Sort → ordering ─────────────────────────────────────────────────────────────

export const RAWG_ORDERING: Record<string, string> = {
  popularity: "-added",
  rating: "-rating",
  release_desc: "-released",
  release_asc: "released",
  title_az: "name",
  title_za: "-name",
};

export function rawgOrdering(sort: string | null | undefined): string {
  return (sort && RAWG_ORDERING[sort]) || "-added";
}

// ── Año / década → dates=YYYY-MM-DD,YYYY-MM-DD ──────────────────────────────────

export function rawgDates(year: string | null | undefined): string | null {
  if (!year) return null;

  const decade = /^(\d{4})s$/.exec(year);
  if (decade) {
    const start = parseInt(decade[1], 10);
    return `${start}-01-01,${start + 9}-12-31`;
  }

  if (year === "classic") return "1900-01-01,1999-12-31";

  if (/^\d{4}$/.test(year)) return `${year}-01-01,${year}-12-31`;

  return null;
}

// ── Filtros de entrada (subconjunto canónico relevante a RAWG) ───────────────────
// Nota: status/horas se aceptan en el tipo pero se IGNORAN (oculto para game).

export interface RawgFilters {
  genre?: string[];
  platform?: string[];
  year?: string | null;
  sort?: string | null;
  // R4c-1: post-filtros game (NO nativos, NO entran en buildRawgDiscoverParams
  // ni en el gate de fetch). Se aplican sobre los MediaItem normalizados.
  valoracion?: string | null;
  estado?: string | null;
  modojuego?: string[];
  duracionmedia?: string | null;
}

function mapGenreSlugs(slugs: string[] | undefined): string[] {
  if (!slugs?.length) return [];
  return slugs.map((s) => RAWG_GENRE[s]).filter((v): v is string => Boolean(v));
}

function mapPlatformIds(slugs: string[] | undefined): number[] {
  if (!slugs?.length) return [];
  return slugs
    .map((s) => RAWG_PLATFORM[s])
    .filter((id): id is number => typeof id === "number");
}

/**
 * Construye los params nativos de /games. ordering siempre presente. genres como
 * CSV de slugs (OR), platforms como CSV de IDs (OR), dates como rango. Vacío/
 * desconocido se omite.
 */
export function buildRawgDiscoverParams(
  filters: RawgFilters = {}
): Record<string, string> {
  const params: Record<string, string> = {
    ordering: rawgOrdering(filters.sort),
  };

  const genres = mapGenreSlugs(filters.genre);
  if (genres.length > 0) params.genres = genres.join(",");

  const platforms = mapPlatformIds(filters.platform);
  if (platforms.length > 0) params.platforms = platforms.join(",");

  const dates = rawgDates(filters.year);
  if (dates) params.dates = dates;

  return params;
}

// ── POST-filtros game (R4c-1) ────────────────────────────────────────────────────
// Todos operan sobre MediaItem[] ya normalizados. metadata.metacritic (0-100),
// metadata.tags (slugs RAWG), metadata.playtime (horas). Vacío/desconocido → no
// filtra (devuelve los items intactos). Items sin el dato necesario se descartan.

/**
 * 1) valoracion×game (POST): conserva items con metacritic >= umbral del slug
 * (escala 0–10 → metacritic 0–100, ×10). Reusa el catálogo valoracion (R4b).
 * Items sin metacritic numérico se descartan cuando hay umbral.
 */
export function filterGamesByValoracion(
  items: MediaItem[],
  valoracion: string | null | undefined
): MediaItem[] {
  const min = valoracionThreshold(valoracion);
  if (min === null) return items;
  const minMetacritic = min * 10;
  return items.filter((item) => {
    const m = item.metadata?.metacritic;
    return typeof m === "number" && m >= minMetacritic;
  });
}

/**
 * 2) estado×game (POST): "early-access" → items con el tag RAWG early-access;
 * "released" → items SIN ese tag. Catálogo estado(game) = early-access/released.
 */
export const GAME_ESTADO_TAG = "early-access";

export function filterGamesByEstado(
  items: MediaItem[],
  estado: string | null | undefined
): MediaItem[] {
  if (estado !== "early-access" && estado !== "released") return items;
  const isEarlyAccess = (item: MediaItem): boolean => {
    const tags = item.metadata?.tags;
    return Array.isArray(tags) && tags.includes(GAME_ESTADO_TAG);
  };
  return items.filter((item) =>
    estado === "early-access" ? isEarlyAccess(item) : !isEarlyAccess(item)
  );
}

/**
 * 3) modojuego×game (POST): slug canónico → tags RAWG aceptados (OR). Un item se
 * conserva si tiene alguno de los tags de algún slug seleccionado. Multi-select:
 * unión. Catálogo modojuego = single/multi/coop/online (R1).
 */
export const RAWG_MODOJUEGO_TAGS: Record<string, string[]> = {
  single: ["singleplayer"],
  multi: ["multiplayer"],
  coop: ["co-op", "cooperative", "online-co-op", "local-co-op"],
  online: ["online-multiplayer", "online-multi-player", "massively-multiplayer"],
};

export function filterGamesByModojuego(
  items: MediaItem[],
  modojuego: string[] | undefined
): MediaItem[] {
  const slugs = modojuego?.filter((s) => s in RAWG_MODOJUEGO_TAGS) ?? [];
  if (slugs.length === 0) return items;
  const wanted = new Set(slugs.flatMap((s) => RAWG_MODOJUEGO_TAGS[s]));
  return items.filter((item) => {
    const tags = item.metadata?.tags;
    return Array.isArray(tags) && tags.some((t) => wanted.has(t));
  });
}

/**
 * 4) duracionmedia×game (POST): normaliza metadata.playtime (horas) a un bucket y
 * conserva los items cuyo playtime cae en el bucket del slug. Catálogo duracionmedia
 * = lt10/10-30/30-60/60plus (R1). Items sin playtime numérico se descartan.
 */
export const DURACIONMEDIA_BUCKETS: Record<
  string,
  { min: number; max: number }
> = {
  lt10: { min: 0, max: 9 },
  "10-30": { min: 10, max: 30 },
  "30-60": { min: 31, max: 60 },
  "60plus": { min: 61, max: Infinity },
};

/** Normaliza horas de playtime → slug de bucket duracionmedia, o null si <0/NaN. */
export function playtimeBucket(hours: unknown): string | null {
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) {
    return null;
  }
  for (const [slug, { min, max }] of Object.entries(DURACIONMEDIA_BUCKETS)) {
    if (hours >= min && hours <= max) return slug;
  }
  return null;
}

export function filterGamesByDuracionmedia(
  items: MediaItem[],
  duracionmedia: string | null | undefined
): MediaItem[] {
  if (!duracionmedia || !(duracionmedia in DURACIONMEDIA_BUCKETS)) return items;
  return items.filter(
    (item) => playtimeBucket(item.metadata?.playtime) === duracionmedia
  );
}

/**
 * Aplica los 4 post-filtros game en cadena. Orden indiferente (todos AND).
 */
export function applyGamePostFilters(
  items: MediaItem[],
  filters: RawgFilters
): MediaItem[] {
  let out = filterGamesByValoracion(items, filters.valoracion);
  out = filterGamesByEstado(out, filters.estado);
  out = filterGamesByModojuego(out, filters.modojuego);
  out = filterGamesByDuracionmedia(out, filters.duracionmedia);
  return out;
}
