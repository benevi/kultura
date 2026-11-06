// KULTURA — Iconos y esqueleto de la barra de Descubrir (UI vieja).
//
// Separado de `src/lib/discover/discover-config.ts` en el rescate F0: dependen
// del set de iconos y de la rejilla bento del sistema viejo y se irán con él.

import { BENTO_CELL_CLASSES } from "@/components/media/MediaGrid";
import type { DiscoverType } from "@/lib/discover/type-filters";
import {
  type KIcon,
  IconGrid,
  IconTag,
  IconCalendar,
  IconStar,
  IconMonitor,
  IconClock,
  IconGlobe,
  IconActivity,
  IconLayers,
  IconGroups,
  IconVolumes,
  IconStudio,
  IconFormat,
  IconGamepad,
  IconTimer,
  IconSort,
  IconFilm,
  IconTv,
  IconAnime,
  IconLibrary,
  IconManga,
  IconComic,
} from "@/components/icons";

/**
 * Icono por pill de tipo (iconos propios > emoji, F1b/E78). Decorativo:
 * `aria-hidden`, nunca forma parte del nombre accesible del radio.
 */
export const TYPE_ICONS: Record<DiscoverType, KIcon> = {
  all: IconGrid,
  movie: IconFilm,
  tv: IconTv,
  anime: IconAnime,
  book: IconLibrary,
  manga: IconManga,
  game: IconGamepad,
  comic: IconComic,
};

/** Icono por clave de filtro (trigger y cabecera del popover). */
export const FILTER_ICONS: Record<string, KIcon> = {
  genre: IconTag,
  year: IconCalendar,
  valoracion: IconStar,
  platform: IconMonitor,
  duracion: IconClock,
  idioma: IconGlobe,
  status: IconActivity,
  estado: IconActivity,
  temporadas: IconLayers,
  demografia: IconGroups,
  volumenes: IconVolumes,
  editorial: IconStudio,
  formato: IconFormat,
  modojuego: IconGamepad,
  duracionmedia: IconTimer,
  sort: IconSort,
};

/** Esqueleto con el mismo patrón bento que la rejilla real (sin salto). */
export const DISCOVER_SKELETON_CELLS = Array.from(
  { length: 18 },
  (_, i) => BENTO_CELL_CLASSES[i % BENTO_CELL_CLASSES.length]
);
