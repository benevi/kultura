// ============================================================
// KULTURA — Filtro NSFW global (E86 · diseño B)
// Post-filtro compartido aplicado en fetchDiscoverData ANTES del return, sobre
// los MediaItem ya normalizados, para TODAS las familias (incl. agregado).
// Complementa la capa nativa (TMDB include_adult=false, Jikan sfw=true, RAWG
// exclude_tags), cerrando los huecos que esos parámetros no cubren (p.ej.
// títulos de usuario en RAWG que escapan al tag, o ramas sin filtros nativos).
//
// Política de matching (anti-falsos-positivos):
//  - genres/subjects → igualdad EXACTA de slug normalizado (lowercase + trim).
//    Catálogo NSFW_GENRES_LC (incl. "adult", seguro aquí: es un género/tag, no
//    texto libre).
//  - title/synopsis → word-boundary regex (\b, case-insensitive) sobre términos
//    INEQUÍVOCOS (NSFW_TERMS_LC). NUNCA substring crudo (evita "Essex"→"sex",
//    "Analysis"→"anal"). "adult" NO está aquí a propósito: en texto libre da
//    falsos positivos ("Young Adult", "Adult Swim", "adult contemporary").
// ============================================================

import type { MediaItem } from "@/types/media";

/**
 * Términos NSFW inequívocos para el match de title/synopsis (word-boundary).
 * Solo palabras que prácticamente nunca aparecen en contenido legítimo. ES/EN.
 * Exportado para los tests y para que la capa nativa (RAWG exclude_tags) pueda
 * alinear su catálogo.
 */
export const NSFW_TERMS_LC = [
  "porn",
  "porno",
  "hentai",
  "erotica",
  "erotic",
  "nsfw",
  "xxx",
  "smut",
  "explicit sex",
] as const;

/**
 * Géneros / subjects / tags NSFW (igualdad exacta de slug normalizado). Incluye
 * "adult": como género/etiqueta es señal fiable, a diferencia del texto libre.
 */
export const NSFW_GENRES_LC = [
  "porn",
  "porno",
  "hentai",
  "erotica",
  "erotic",
  "nsfw",
  "xxx",
  "smut",
  "adult",
] as const;

const GENRES_SET = new Set<string>(NSFW_GENRES_LC);

/**
 * Regex word-boundary sobre los términos de texto libre. Escapa "+18" y demás.
 * Un solo regex (alternancia) para barrer title+synopsis en una pasada.
 */
const TERMS_RE = new RegExp(
  `\\b(?:${NSFW_TERMS_LC.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|")})\\b`,
  "i"
);

// "+18" / "18+" no tienen word-boundary alfanumérico fiable → match aparte.
const PLUS18_RE = /(?:\+18|18\+)/;

function normSlug(s: string): string {
  return s.trim().toLowerCase();
}

/** true si el item es NSFW según género exacto o término en title/synopsis. */
export function isNSFW(item: MediaItem): boolean {
  // 1) Géneros/subjects/tags → igualdad exacta de slug normalizado.
  if (item.genres?.some((g) => GENRES_SET.has(normSlug(g)))) return true;

  // 2) title + synopsis → word-boundary sobre términos inequívocos.
  const text = `${item.title ?? ""} ${item.synopsis ?? ""}`;
  if (TERMS_RE.test(text) || PLUS18_RE.test(text)) return true;

  return false;
}

/**
 * Descarta los items NSFW. Aplicable a todas las familias (movie/tv/anime/manga/
 * book/comic/game) y al agregado type=all. Idempotente; lista vacía → vacía.
 */
export function filterNSFW(items: MediaItem[]): MediaItem[] {
  return items.filter((item) => !isNSFW(item));
}
