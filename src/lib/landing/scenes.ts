// ============================================================
// KULTURA — Qué imagen va en cada hueco de la landing (rediseño v2)
//
// Las imágenes de la semana (`getLandingMedia()`) se reparten por sección y
// posición. Si falta alguna (tabla vacía, semana a medias o un fallo), ese
// hueco usa el respaldo fijo de `public/landing/fallback/` (semana del
// 2/11/2026, la que Víctor dio por buena): la landing nunca queda con huecos.
// ============================================================

import type { LandingMedia, LandingSlot } from "./media";

/**
 * Formatos con ranking, en el orden de las tarjetas. La portada ya no pinta el
 * bloque (F0 §7.3, hasta v2.0), pero la tarea semanal sigue exigiendo el hueco
 * `ranking` para activar una semana (`build.py`), así que los datos se quedan.
 */
export const RANKING_FORMATS = ["anime", "movie", "tv", "game"] as const;
export type RankingFormat = (typeof RANKING_FORMATS)[number];

type Seed = [
  slot: LandingSlot, position: number, format: string, externalId: string, title: string,
  year: number | null, rating: number | null, width: number, height: number,
  threshold: number, focusX: number, focusY: number, accent: string,
];

// prettier-ignore
const SEEDS: Seed[] = [
  ["hero", 0, "tv", "259909", "Dexter: Resurrección", 2025, null, 1920, 1080, 0.38, 0.508, 0.6, "#0b93a9"],
  ["hero", 1, "movie", "1571955", "Colisión", 2026, null, 1920, 1080, 0.34, 0.456, 0.6, "#9f7c5f"],
  ["hero", 2, "tv", "96677", "Lupin", 2021, null, 1920, 1080, 0.62, 0.49, 0.594, "#4c7a6b"],
  ["feature", 0, "anime", "al-185874", "BLEACH: Thousand-Year Blood War - The Calamity", 2026, 8.8, 460, 650, 0.22, 0.513, 0.6, "#592e7c"],
  ["feature", 1, "movie", "980431", "Avatar Aang: El último maestro del aire", 2026, 9, 640, 960, 0.3, 0.527, 0.339, "#a8a775"],
  ["feature", 2, "tv", "273240", "Off Campus", 2026, 8.9, 640, 960, 0.42, 0.516, 0.6, "#604b4c"],
  ["feature", 3, "game", "248521", "Valheim", 2026, 8, 600, 900, 0.32, 0.375, 0.6, "#f1a231"],
  ["step", 0, "manga", "manga_32d76d19-8a05-4db0-9fc2-e0b0648fe9d0", "Na Honjaman Level-Up", null, null, 640, 864, 0.48, 0.616, 0.6, "#886ee1"],
  ["step", 1, "anime", "al-182255", "Frieren: Beyond Journey’s End Season 2", 2026, 8.7, 460, 649, 0.54, 0.433, 0.475, "#19a2d6"],
  ["step", 2, "movie", "1007757", "Intercambiados", 2026, 8.8, 640, 960, 0.5, 0.479, 0.6, "#6138ac"],
  ["ranking", 0, "anime", "al-189046", "Re:ZERO -Starting Life in Another World- Season 4", 2026, 9, 460, 610, 0.44, 0.474, 0.6, "#d2714a"],
  ["ranking", 1, "movie", "1560520", "Batman: El ocaso del Caballero Oscuro - Primera parte", 2026, 9.1, 640, 960, 0.64, 0.439, 0.6, "#c7605a"],
  ["ranking", 2, "tv", "276161", "Así aprenderás", 2026, 9.4, 640, 948, 0.4, 0.571, 0.6, "#608ac6"],
  ["ranking", 3, "game", "452650", "Pragmata", 2026, 8.7, 600, 900, 0.52, 0.578, 0.6, "#404163"],
];

/** Respaldo fijo (sirve también de datos para los tests). */
export const FALLBACK_MEDIA: LandingMedia[] = SEEDS.map(
  ([slot, position, format, externalId, title, year, rating, width, height, threshold, fx, fy, accent]) => ({
    slot, position, format, type: format, externalId, title, year, rating, width, height, threshold, accent,
    image: `/landing/fallback/${slot}-${position}.jpg`,
    depth: `/landing/fallback/${slot}-${position}_d.jpg`,
    focus: [fx, fy],
    layered: true,
  }),
);

export interface LandingScenes {
  hero: LandingMedia[];
  feature: LandingMedia[];
  step: LandingMedia[];
  ranking: Record<RankingFormat, LandingMedia>;
}

const COUNTS = { hero: 3, feature: 4, step: 3 } as const;

/** Reparte las imágenes de la semana; cada hueco vacío toma su respaldo. */
export function buildLandingScenes(media: LandingMedia[]): LandingScenes {
  const pick = (slot: LandingSlot, list: LandingMedia[], n: number) => {
    const own = list.filter((m) => m.slot === slot).sort((a, b) => a.position - b.position);
    const backup = FALLBACK_MEDIA.filter((m) => m.slot === slot);
    return Array.from({ length: n }, (_, i) => own[i] ?? backup[i]);
  };
  const ranking = Object.fromEntries(
    RANKING_FORMATS.map((f) => [
      f,
      media.find((m) => m.slot === "ranking" && m.format === f) ??
        FALLBACK_MEDIA.find((m) => m.slot === "ranking" && m.format === f)!,
    ]),
  ) as Record<RankingFormat, LandingMedia>;
  return {
    hero: pick("hero", media, COUNTS.hero),
    feature: pick("feature", media, COUNTS.feature),
    step: pick("step", media, COUNTS.step),
    ranking,
  };
}

/** Nota con el separador decimal del idioma («9,0» / «9.0»). */
export function formatRating(rating: number | null, locale: string): string | null {
  if (rating === null || !Number.isFinite(rating)) return null;
  return rating.toLocaleString(locale === "en" ? "en-GB" : "es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
