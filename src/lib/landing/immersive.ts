// ============================================================
// KULTURA — Matiz de cada formato en piezas heredadas de la portada
//
// La galería WebGL del hero antiguo ya no existe (la sustituye el sobre del
// álbum, `sobre-scene.ts`). Quedan aquí los matices por formato que siguen
// usando las tarjetas de compartir (`lib/og/brand`) y el respaldo de las
// colecciones públicas (`PublicCollection`).
// ============================================================

import type { MediaType } from "@/types/media";

/** Matiz de cada familia: mismo reparto de la paleta que los gradientes F0. */
export const TYPE_HUE: Record<MediaType, number> = {
  movie: 350,
  tv: 300,
  anime: 130,
  manga: 55,
  game: 250,
  book: 95,
  comic: 20,
};

/** Los siete formatos, en el orden en que se presentan. */
export const IMMERSIVE_FORMATS: MediaType[] = ["movie", "tv", "anime", "manga", "game", "book", "comic"];

/** Color de cada formato sobre el fondo de noche (≥ 7:1 en los siete matices). */
export function formatColor(type: MediaType): string {
  return `oklch(80% 0.2 ${TYPE_HUE[type]})`;
}
