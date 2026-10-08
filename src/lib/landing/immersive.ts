// ============================================================
// KULTURA — Constantes y helpers del hero inmersivo (E-LANDING-INMERSIVA)
//
// Viven FUERA de `ImmersiveHero.tsx` porque ese archivo es "use client": un
// valor exportado desde ahí llega a un Server Component como referencia de
// cliente, no como el array de verdad (y `page.tsx` lo recorre).
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

/** Orden en que la cámara "presenta" los formatos. */
export const IMMERSIVE_FORMATS: MediaType[] = ["movie", "tv", "anime", "manga", "game", "book", "comic"];

/**
 * Intro automática (E-LANDING-INTRO): el recorrido lo marca el TIEMPO, no el
 * scroll. Con la rueda del ratón el scroll avanza a saltos de ~100 px, y una
 * escena atada a él avanzaba a tirones por mucho que se suavizara.
 */
export const INTRO_MS = 12000;
/** Progreso de la intro (0-1): lineal durante `INTRO_MS`. */
export function introProgress(elapsed: number): number {
  return Math.min(1, Math.max(0, elapsed / INTRO_MS));
}

/** Tramos del recorrido: capítulo de formatos y capítulo final (CTA). */
export const FORMAT_FROM = 0.18;
export const FORMAT_TO = 0.68;
export const FINAL_FROM = 0.86;

export interface ImmersiveCopy {
  title: string;
  titleAccent: string;
  sub: string;
  badge: string;
  finalTitle: string;
  finalSub: string;
  /** Idioma, para el formulario de la demo. */
  locale: string;
  /** Botón "Ver la demo" (E-DEMO); sin él no se pinta (demo sin configurar). */
  demo?: string;
  cta: string;
  /** Respaldo estático: titular y CTA del hero de siempre. */
  staticTagline: string;
  staticCta: string;
  formats: Record<MediaType, string>;
}

/**
 * Ancho ÚNICO de textura, también en móvil: la misma URL la precarga el servidor
 * (`ImmersiveHeroSlot`) antes de que exista la escena, y con dos tamaños la
 * precarga no sabría cuál pedir y el móvil descargaría la imagen dos veces.
 */
export const TEXTURE_WIDTH = 384;

/**
 * Portadas distintas que tienen que haber llegado para enseñar la galería, y
 * las que el servidor precarga: son las de las piezas más cercanas a la cámara.
 */
export const IMMERSIVE_READY_AT = 12;

/** URL de mismo origen y tamaño acotado: WebGL necesita CORS (ver la escena). */
export function textureUrl(poster: string): string {
  return `/_next/image?url=${encodeURIComponent(poster)}&w=${TEXTURE_WIDTH}&q=70`;
}

/** Índice del formato en pantalla para un progreso dado (capítulo 2). */
export function formatIndexAt(p: number): number {
  const t = (p - FORMAT_FROM) / (FORMAT_TO - FORMAT_FROM);
  return Math.min(IMMERSIVE_FORMATS.length - 1, Math.max(0, Math.floor(t * IMMERSIVE_FORMATS.length)));
}
