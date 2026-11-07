// ============================================================
// KULTURA — Portada de cada mini-landing de cuña (F1, D2)
//
// Sale de las mismas imágenes de la semana que la portada (`buildLandingScenes`)
// y, si no hay ninguna que valga, del respaldo fijo. Vale una portada vertical
// del formato de la cuña, en orden de preferencia.
// ============================================================

import type { Wedge } from "@/lib/analytics/attribution";
import type { LandingMedia } from "./media";
import { FALLBACK_MEDIA, type LandingScenes } from "./scenes";

/** Formatos de cada cuña, el preferido primero. */
export const WEDGE_TYPES: Record<Wedge, readonly string[]> = {
  series: ["tv", "movie"],
  anime: ["anime", "manga"],
};

const isPortrait = (m: LandingMedia) => m.height > m.width;

function pick(pool: LandingMedia[], types: readonly string[]): LandingMedia | undefined {
  for (const type of types) {
    const hit = pool.find((m) => m.type === type && isPortrait(m));
    if (hit) return hit;
  }
  return undefined;
}

export function pickWedgePoster(scenes: LandingScenes, wedge: Wedge): LandingMedia {
  const types = WEDGE_TYPES[wedge];
  const week = [...scenes.feature, ...scenes.step, ...scenes.hero];
  const fallback = FALLBACK_MEDIA.filter((m) => m.slot !== "ranking");
  // El respaldo tiene al menos una portada vertical de cada cuña (lo fija el test).
  return pick(week, types) ?? (pick(fallback, types) as LandingMedia);
}
