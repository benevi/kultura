// ============================================================
// KULTURA — Filtro valoracion (E59 · R4b)
// Catálogo canónico ÚNICO del filtro valoracion (single). El slug ES el umbral
// numérico mínimo (escala 0–10): "9"→9, "8"→8, "7"→7, "6"→6. Lo consumen tanto
// los builders nativos (TMDB vote_average.gte / Jikan min_score) como la capa de
// opciones (filter-options getFilterOptions). Fuente única: no duplicar la lista.
//
// Neutral entre APIs a propósito: tmdb-maps y jikan-maps lo importan sin acoplarse
// entre sí. game queda fuera (post-filter metacritic → R4c).
// ============================================================

/** Slugs válidos del filtro valoracion, en orden de menú (mayor → menor). */
export const VALORACION_SLUGS = ["9", "8", "7", "6"] as const;

/**
 * Umbral mínimo (0–10) para un slug de valoracion, o null si vacío/desconocido.
 * El slug ya es el número; se valida contra el catálogo para descartar basura.
 */
export function valoracionThreshold(
  slug: string | null | undefined
): number | null {
  if (!slug) return null;
  return (VALORACION_SLUGS as readonly string[]).includes(slug)
    ? Number(slug)
    : null;
}
