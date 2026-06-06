// ============================================================
// KULTURA — RAWG filter translation tables (E59 F3b)
// Traduce el contrato canónico (docs/E59_FILTER_SPEC.md) a los params nativos
// de /games: genres (slug), platforms (id), dates (rango), ordering.
//
// horas y status → OCULTO para game (ya decidido en el spec): el builder los
// ignora. Guard: vacío/desconocido descartado; ordering siempre presente.
// ============================================================

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

const RAWG_ORDERING: Record<string, string> = {
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
