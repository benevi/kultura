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

/** Tramos del scroll: capítulo de formatos y capítulo final (CTA). */
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
  cta: string;
  /** Respaldo estático: titular y CTA del hero de siempre. */
  staticTagline: string;
  staticCta: string;
  formats: Record<MediaType, string>;
}

/** URL de mismo origen y tamaño acotado: WebGL necesita CORS (ver la escena). */
export function textureUrl(poster: string, mobile: boolean): string {
  return `/_next/image?url=${encodeURIComponent(poster)}&w=${mobile ? 256 : 384}&q=70`;
}

/** Índice del formato en pantalla para un progreso dado (capítulo 2). */
export function formatIndexAt(p: number): number {
  const t = (p - FORMAT_FROM) / (FORMAT_TO - FORMAT_FROM);
  return Math.min(IMMERSIVE_FORMATS.length - 1, Math.max(0, Math.floor(t * IMMERSIVE_FORMATS.length)));
}
