// ============================================================
// KULTURA — TYPE_FILTERS central (E59 · F5a)
// Fuente de verdad ÚNICA de:
//   - el orden canónico de los 7 tipos (TYPE_ORDER) → SegmentedControl + validación
//   - qué triggers de filtro se MUESTRAN por tipo (TYPE_FILTERS)
//
// Derivado directamente de docs/E59_FILTER_SPEC.md §4 (TYPE_FILTERS real),
// que a su vez sale de la matriz de capacidades §2 + política §3.
//
// Política "nunca un trigger que mienta": solo se listan triggers `nativo` o
// `post` viable. Los `oculto`/`degradado` de la matriz NO aparecen aquí
// (p.ej. status en movie, year en book, genre en comic, temporadas en tv,
// horas en game). Si un trigger no está en la lista de un tipo, ese tipo no lo
// renderiza.
//
// `paramKey` = el query param real que /api/discover parsea hoy
// (cruzado con src/lib/api/discover-params.ts → DiscoverParams).
// ============================================================

import type { MediaType } from "@/types/media";

/**
 * Orden canónico ÚNICO de los 7 tipos. Se elige por afinidad de catálogo
 * (audiovisual → animación japonesa → texto/ilustrado → interactivo), que es
 * el orden con el que el usuario suele pensar el descubrimiento:
 *   movie → tv → anime → manga → book → comic → game
 *
 * Es la fuente de verdad de orden para el SegmentedControl y para validar
 * `type`. Mismo SET que VALID_TYPES de discover-params.ts (el parser solo lo
 * usa como allowlist; su orden ahí es irrelevante). Resuelve los 3 órdenes
 * distintos detectados en Fase 0 (types.ts / parser / UI).
 */
export const TYPE_ORDER: readonly MediaType[] = [
  "movie",
  "tv",
  "anime",
  "manga",
  "book",
  "comic",
  "game",
] as const;

/**
 * Naturaleza de un trigger de cara a la UI:
 *  - 'single'     : una opción exclusiva (year, sort, status, demografía…).
 *  - 'multi'      : lista de opciones combinables (genre, platform, editorial).
 *  - 'min'        : umbral mínimo numérico (reservado; sin uso en F5a).
 *  - 'searchable' : multi con buscador (reservado; sin uso en F5a).
 *  - 'menu'       : single-select etiquetado en Popover, sin opción "all"
 *                   inyectada (sort, donde "all" no tiene sentido).
 */
export type FilterKind = "single" | "multi" | "min" | "searchable" | "menu";

/** Un trigger visible: su clave UI, su naturaleza y el query param real. */
export interface FilterTrigger {
  /** Clave lógica del filtro (también clave i18n en `filters`). */
  key: string;
  kind: FilterKind;
  /** Query param que /api/discover parsea (ver discover-params.ts). */
  paramKey: string;
  /**
   * true = no es filtro nativo de la API; se aplica como post-filtro en el
   * Route Handler (overfetch + re-paginar, spec §3). Visible pero degrada
   * paginación a estimada. Solo: volumenes (manga), editorial (comic).
   */
  postFilter?: boolean;
}

// Triggers reutilizables (misma definición en varios tipos).
const GENRE: FilterTrigger = { key: "genre", kind: "multi", paramKey: "genre" };
const YEAR: FilterTrigger = { key: "year", kind: "single", paramKey: "year" };
const PLATFORM: FilterTrigger = { key: "platform", kind: "multi", paramKey: "platform" };
const SORT: FilterTrigger = { key: "sort", kind: "menu", paramKey: "sort" };
const STATUS: FilterTrigger = { key: "status", kind: "single", paramKey: "status" };
const DEMOGRAFIA: FilterTrigger = { key: "demografia", kind: "single", paramKey: "demografia" };
const DURACION: FilterTrigger = { key: "duracion", kind: "single", paramKey: "duracion" };
const IDIOMA: FilterTrigger = { key: "idioma", kind: "single", paramKey: "idioma" };
const FORMATO: FilterTrigger = { key: "formato", kind: "single", paramKey: "formato" };
// post-filters (no nativos): visibles pero degradan paginación a estimada.
const VOLUMENES: FilterTrigger = { key: "volumenes", kind: "single", paramKey: "volumenes", postFilter: true };
const EDITORIAL: FilterTrigger = { key: "editorial", kind: "multi", paramKey: "editorial", postFilter: true };

/**
 * Triggers VISIBLES por tipo. Orden = orden de render (spec §4).
 * `sort` cierra cada set; `type`/`page` no son triggers (selector global / implícito).
 */
export const TYPE_FILTERS: Record<MediaType, FilterTrigger[]> = {
  // §4: ["genre","year","platform","duracion","idioma","sort"] — sin status/temporadas/volumenes.
  movie: [GENRE, YEAR, PLATFORM, DURACION, IDIOMA, SORT],
  // §4: ["genre","year","platform","status","idioma","sort"] — temporadas fuera de F1 (post N+1).
  tv: [GENRE, YEAR, PLATFORM, STATUS, IDIOMA, SORT],
  // §4: ["genre","year","status","demografia","sort"].
  anime: [GENRE, YEAR, STATUS, DEMOGRAFIA, SORT],
  // §4: ["genre","year","status","demografia","volumenes","sort"].
  manga: [GENRE, YEAR, STATUS, DEMOGRAFIA, VOLUMENES, SORT],
  // §4: ["genre","formato","idioma","sort"] — sin year (Books no filtra año nativo).
  book: [GENRE, FORMATO, IDIOMA, SORT],
  // §4: ["year","editorial","sort"] — sin genre (ComicVine no tiene género en issues).
  comic: [YEAR, EDITORIAL, SORT],
  // §4: ["genre","year","platform","sort"] — sin horas (degradado/oculto en F1).
  game: [GENRE, YEAR, PLATFORM, SORT],
};
