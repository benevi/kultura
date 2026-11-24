// ============================================================
// KULTURA — La obra tal como la pinta la sala (fase 8.5, F5)
//
// Sin dependencias de servidor: lo usa `MediaDetail` (y sus tests). La carga
// de lo que añade la sala está en `sala-extras.ts`.
// ============================================================

import type { MediaItem, StreamingProvider } from "@/types/media";

export interface SalaFichaExtras {
  /** Apaisada para la cabecera de la sala (URL de `image.tmdb.org`). */
  backdrop?: string;
  /** F5c: tráiler de TMDB de un anime cruzado, si AniList no trae ninguno. */
  trailerKey?: string;
  /** F5c: «Dónde ver» de TMDB (datos de JustWatch) de un anime cruzado, si no había. */
  providers?: StreamingProvider[];
  watchLink?: string;
  /**
   * F5c: segunda línea de fuente al pie de la ficha («Imagen, tráiler y
   * disponibilidad: TMDB») cuando algo de lo de arriba viene de TMDB y la
   * fuente del título es otra. Enlaza a la ficha de esa obra en TMDB.
   */
  extraSource?: { name: string; url: string };
}

/**
 * La obra con la apaisada de la sala, si la hay. Solo para la sala (cabecera,
 * fondo del tráiler y su composición); nunca para la imagen de compartir, la
 * caché de la biblioteca ni el JSON-LD: allí sigue `item.backdrop`.
 */
export function salaItemOf<T extends Pick<MediaItem, "backdrop">>(item: T, extras?: SalaFichaExtras | null): T {
  return extras?.backdrop ? { ...item, backdrop: extras.backdrop } : item;
}
