// KULTURA — Iconos y opciones fijas de la barra de Descubrir.

import { BENTO_CELL_CLASSES } from "@/components/media/MediaGrid";
import { TYPE_ORDER, type DiscoverType } from "@/lib/discover/type-filters";
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

/**
 * Años relativos al actual: [actual, -1, -2] como YYYY + las 2 décadas
 * previas como YYYYs + 'classic' (formatos que parsea discover-params).
 */
export function buildYearBuckets(now = new Date().getFullYear()): { value: string; label: string }[] {
  const years = [now, now - 1, now - 2].map((y) => ({ value: String(y), label: String(y) }));
  // Década que contiene el año más antiguo listado, y la anterior.
  const baseDecade = Math.floor((now - 2) / 10) * 10;
  const decades = [baseDecade - 10, baseDecade - 20].map((d) => ({ value: `${d}s`, label: `${d}s` }));
  return [...years, ...decades, { value: "classic", label: "classic" }];
}

export function isDiscoverType(t: string): t is DiscoverType {
  return (TYPE_ORDER as readonly string[]).includes(t);
}
