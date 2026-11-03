// ============================================================
// KULTURA — Gramática del «Álbum de cromos» (DISENO.md)
//
// Correspondencias que comparten los componentes de `src/components/album`
// y las páginas: estado de biblioteca → forma del cromo, formato → su color
// (dato, nunca decoración) y el respaldo de color que va DETRÁS de cada
// portada. Sin React: lo usan componentes de servidor y de cliente.
// ============================================================

import type { MediaStatus, MediaType } from "@/types/media";

/** Los 7 formatos, en el orden en que se enseñan. */
export const FORMATS: readonly MediaType[] = ["movie", "tv", "anime", "manga", "game", "book", "comic"];

/**
 * Color de cada formato como valor CSS (la custom property `--format-<tipo>`). Es un DATO: el
 * punto de `FormatTag`, la tira de progreso y la pestaña del hueco. Siempre
 * acompañado del nombre del formato.
 */
export const FORMAT_COLOR: Record<MediaType, string> = {
  movie: "var(--format-movie)",
  tv: "var(--format-tv)",
  anime: "var(--format-anime)",
  manga: "var(--format-manga)",
  game: "var(--format-game)",
  book: "var(--format-book)",
  comic: "var(--format-comic)",
};

/** Variante apta para texto sobre la superficie actual (noche o papel). */
export const FORMAT_INK: Record<MediaType, string> = {
  movie: "var(--format-movie-ink)",
  tv: "var(--format-tv-ink)",
  anime: "var(--format-anime-ink)",
  manga: "var(--format-manga-ink)",
  game: "var(--format-game-ink)",
  book: "var(--format-book-ink)",
  comic: "var(--format-comic-ink)",
};

/** Hex exacto de cada formato, para lo que no entiende CSS (OG, correos). */
export const FORMAT_HEX: Record<MediaType, string> = {
  movie: "#ff4f9a",
  tv: "#5aa9ff",
  anime: "#c6f24e",
  manga: "#ff6b5a",
  game: "#3fd9e6",
  book: "#ffb347",
  comic: "#ffe04a",
};

/**
 * Forma de un título en el álbum:
 * - `slot`: pendiente, el hueco numerado vacío con el título impreso;
 * - `placed`: en curso, el cromo puesto pero sin apretar (tira de progreso);
 * - `pasted`: completado, el cromo pegado;
 * - `folded`: abandonado, con la esquina doblada (visible y reversible).
 */
export type AlbumShape = "slot" | "placed" | "pasted" | "folded";
/** Estado visual de un `Cromo` (un hueco vacío es `Slot`, no un cromo). */
export type CromoState = Exclude<AlbumShape, "slot">;

export function albumShapeFor(status: MediaStatus | null | undefined): AlbumShape {
  switch (status) {
    case "pending":
      return "slot";
    case "in_progress":
      return "placed";
    case "abandoned":
      return "folded";
    default:
      return "pasted";
  }
}

/** Una nota de 10/10 lleva brillo (foil). */
export function isFoil(rating: number | null | undefined, scale = 10): boolean {
  return typeof rating === "number" && rating >= scale;
}

/**
 * Respaldo de color que va DETRÁS de la portada (requirePoster, E-CARD-
 * PORTADA-404): dos paradas del mismo matiz, tomadas de las tintas del
 * álbum (cian, marino, rosa, amarillo oscurecido, verde de imprenta). Nunca
 * violeta. Si la portada no carga, queda esto con las iniciales.
 */
const PLACEHOLDER_HUES = [237, 262, 0.9, 101, 203, 29, 72, 252];

export function cromoPlaceholder(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = PLACEHOLDER_HUES[hash % PLACEHOLDER_HUES.length];
  return `linear-gradient(160deg, oklch(46% 0.12 ${hue}), oklch(30% 0.08 ${hue}))`;
}
