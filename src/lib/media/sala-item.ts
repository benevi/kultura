// ============================================================
// KULTURA — La obra tal como la pinta la sala (fase 8.5, F5)
//
// Sin dependencias de servidor: lo usa `MediaDetail` (y sus tests). La carga
// de lo que añade la sala está en `sala-extras.ts`.
// ============================================================

import type { MediaItem } from "@/types/media";

export interface SalaFichaExtras {
  /** Apaisada para la cabecera de la sala (URL de `image.tmdb.org`). */
  backdrop?: string;
}

/**
 * La obra con la apaisada de la sala, si la hay. Solo para la sala (cabecera,
 * fondo del tráiler y su composición); nunca para la imagen de compartir, la
 * caché de la biblioteca ni el JSON-LD: allí sigue `item.backdrop`.
 */
export function salaItemOf<T extends Pick<MediaItem, "backdrop">>(item: T, extras?: SalaFichaExtras | null): T {
  return extras?.backdrop ? { ...item, backdrop: extras.backdrop } : item;
}
