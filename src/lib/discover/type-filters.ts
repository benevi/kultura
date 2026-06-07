// ============================================================
// KULTURA — TYPE_FILTERS central (E59 · R2 V2)
// Fuente de verdad ÚNICA de:
//   - el orden canónico de tipos incl. "all" (TYPE_ORDER) → barra TIPO + validación
//   - qué triggers de filtro se MUESTRAN por tipo (TYPE_FILTERS)
//
// Contrato: docs/E59_FILTER_SPEC_V2.md (mockup = fuente de verdad).
// Política A: pares sin dato en la API se OCULTAN (no aparecen aquí).
// "nunca un trigger que mienta": solo se listan triggers `nativo` o `post` viable.
//
// `paramKey` = el query param que /api/discover parsea. Los paramKeys nuevos
// (rating/seasons/gamemode/playtime) los IGNORA el backend hasta R4 (inocuo).
// ============================================================

import type { MediaType } from "@/types/media";

/** MediaType extendido con el agregado "all" (modo Descubrir todos). */
export type DiscoverType = MediaType | "all";

/**
 * Orden canónico de la barra TIPO (spec V2 §Barra). Incluye "all" primero.
 *   all → movie → tv → anime → book → manga → game → comic
 * Fuente de verdad de orden para la barra TIPO y para validar `type`.
 */
export const TYPE_ORDER: readonly DiscoverType[] = [
  "all",
  "movie",
  "tv",
  "anime",
  "book",
  "manga",
  "game",
  "comic",
] as const;

/**
 * Naturaleza de un trigger de cara a la UI (FilterBar v3, todo-popover):
 *  - 'single'     : una opción exclusiva (year, valoracion, sort, duracion…).
 *  - 'multi'      : lista de opciones combinables (platform, idioma, demografia).
 *  - 'searchable' : multi con buscador (genre, editorial).
 */
export type FilterKind = "single" | "multi" | "searchable";

/** Un trigger visible: su clave UI, su naturaleza y el query param real. */
export interface FilterTrigger {
  /** Clave lógica del filtro (también clave i18n en `filters`). */
  key: string;
  kind: FilterKind;
  /** Query param que /api/discover parsea (ver discover-params.ts). */
  paramKey: string;
  /**
   * true = no es filtro nativo de la API; se aplica como post-filtro en el
   * Route Handler (overfetch + re-paginar, spec §Soporte backend). Visible pero
   * degrada paginación a estimada.
   */
  postFilter?: boolean;
  /** 'end' = se empuja a la derecha de la fila FILTROS (ml-auto). Solo sort. */
  align?: "end";
}

// Triggers reutilizables (misma definición en varios tipos).
const GENRE: FilterTrigger = { key: "genre", kind: "searchable", paramKey: "genre" };
const YEAR: FilterTrigger = { key: "year", kind: "single", paramKey: "year" };
const VALORACION: FilterTrigger = { key: "valoracion", kind: "single", paramKey: "rating" };
const PLATFORM: FilterTrigger = { key: "platform", kind: "multi", paramKey: "platform" };
const IDIOMA: FilterTrigger = { key: "idioma", kind: "multi", paramKey: "idioma" };
const STATUS: FilterTrigger = { key: "status", kind: "multi", paramKey: "status" };
const DEMOGRAFIA: FilterTrigger = { key: "demografia", kind: "multi", paramKey: "demografia" };
const DURACION: FilterTrigger = { key: "duracion", kind: "single", paramKey: "duracion" };
const FORMATO: FilterTrigger = { key: "formato", kind: "multi", paramKey: "formato" };
const SORT: FilterTrigger = { key: "sort", kind: "single", paramKey: "sort", align: "end" };

// post-filters (no nativos): visibles pero degradan paginación a estimada.
const TEMPORADAS: FilterTrigger = { key: "temporadas", kind: "single", paramKey: "seasons", postFilter: true };
const VOLUMENES: FilterTrigger = { key: "volumenes", kind: "single", paramKey: "volumenes", postFilter: true };
const EDITORIAL: FilterTrigger = { key: "editorial", kind: "searchable", paramKey: "editorial", postFilter: true };
const MODOJUEGO: FilterTrigger = { key: "modojuego", kind: "multi", paramKey: "gamemode", postFilter: true };
const DURACIONMEDIA: FilterTrigger = { key: "duracionmedia", kind: "single", paramKey: "playtime", postFilter: true };
// valoracion(game) y estado(game) son post-filter (metacritic / tag Early Access).
const VALORACION_GAME: FilterTrigger = { key: "valoracion", kind: "single", paramKey: "rating", postFilter: true };
const ESTADO_GAME: FilterTrigger = { key: "estado", kind: "multi", paramKey: "estado", postFilter: true };

/**
 * Triggers VISIBLES por tipo. Orden = orden de render (spec V2 §Matriz).
 * `sort` (align:'end') va en TODOS los tipos, empujado a la derecha.
 * Los 5 ocultos (política A) NO aparecen: valoracion×book, valoracion×comic,
 * estado×book, estado×comic, temporadas×anime.
 */
export const TYPE_FILTERS: Record<DiscoverType, FilterTrigger[]> = {
  // all: genero, anio, valoracion, plataforma.
  all: [GENRE, YEAR, VALORACION, PLATFORM, SORT],
  // movie: genero, anio, valoracion, duracion, plataforma, idioma.
  movie: [GENRE, YEAR, VALORACION, DURACION, PLATFORM, IDIOMA, SORT],
  // tv: genero, anio, valoracion, estado, temporadas, plataforma, idioma.
  tv: [GENRE, YEAR, VALORACION, STATUS, TEMPORADAS, PLATFORM, IDIOMA, SORT],
  // anime: genero, anio, valoracion, demografia, estado, idioma.
  anime: [GENRE, YEAR, VALORACION, DEMOGRAFIA, STATUS, IDIOMA, SORT],
  // manga: genero, anio, valoracion, demografia, estado, volumenes, idioma.
  manga: [GENRE, YEAR, VALORACION, DEMOGRAFIA, STATUS, VOLUMENES, IDIOMA, SORT],
  // book: genero, anio, editorial, formato, idioma.
  book: [GENRE, YEAR, EDITORIAL, FORMATO, IDIOMA, SORT],
  // game: plataforma, genero, modojuego, anio, valoracion, duracionmedia, estado.
  game: [PLATFORM, GENRE, MODOJUEGO, YEAR, VALORACION_GAME, DURACIONMEDIA, ESTADO_GAME, SORT],
  // comic: anio, editorial, volumenes, idioma.
  // NOTA R2: el mockup lista 'genero' en comic, pero ComicVine no expone género
  // en issues (sin catálogo en comicvine-maps). Política "nunca trigger que
  // mienta" → se OMITE genre en comic (única divergencia del mockup). Ver spec V2.
  comic: [YEAR, EDITORIAL, VOLUMENES, IDIOMA, SORT],
};
