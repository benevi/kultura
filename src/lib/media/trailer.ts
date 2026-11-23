/**
 * El tráiler de YouTube de una ficha: qué clave vale y de dónde se carga.
 * Sin `"use client"`: lo usan la ficha (servidor) y los reproductores
 * (`TrailerEmbed`, `SalaTrailer`).
 */

/** Ids de YouTube: 11 caracteres de `[A-Za-z0-9_-]`. Otra cosa no se pinta. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * La clave lista para usar, o `null` si no vale. AniList manda ids con
 * espacios o tabuladores al final ("LHtdKWJdif4\t").
 */
export function youtubeTrailerKey(raw: string | null | undefined): string | null {
  const key = raw?.trim() ?? "";
  return YOUTUBE_ID.test(key) ? key : null;
}

/** El reproductor en modo de privacidad mejorada, ya en reproducción. */
export function trailerEmbedUrl(youtubeKey: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeKey)}?autoplay=1&rel=0`;
}

export function trailerThumbnailUrl(youtubeKey: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeKey)}/hqdefault.jpg`;
}
