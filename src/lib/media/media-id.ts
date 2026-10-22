// ============================================================
// KULTURA — Forma de los ids del catálogo `media` ("{type}_{externalId}")
//
// La tabla `media` solo admite estos siete tipos (CHECK `media_type_check`) y
// cada proveedor tiene su propia forma de id. Validar aquí, antes de llamar a
// nadie, evita dos cosas: crear filas basura con ids inventados y meter texto
// arbitrario en la ruta de la URL de un proveedor (ComicVine construye
// `/issue/4000-{id}/`).
//
// Formas admitidas (las mismas que enruta la ficha de detalle):
//   movie, tv, game, comic → entero
//   anime → `al-{n}` (AniList), `tmdb-{n}` (respaldo TMDB) o entero (Jikan legacy)
//   manga → UUID (MangaDex) o entero (Jikan legacy)
//   book  → `OL…W|M` (Open Library) o id de volumen de Google Books
// ============================================================

import type { MediaType } from '@/types/media'

export const MEDIA_TYPES: readonly MediaType[] = [
  'movie',
  'tv',
  'anime',
  'manga',
  'book',
  'comic',
  'game',
]

const EXTERNAL_ID_SHAPES: Record<MediaType, RegExp> = {
  movie: /^\d{1,10}$/,
  tv: /^\d{1,10}$/,
  game: /^\d{1,10}$/,
  comic: /^\d{1,10}$/,
  anime: /^(?:al-\d{1,10}|tmdb-\d{1,10}|\d{1,10})$/,
  manga: /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{1,10})$/i,
  book: /^(?:OL\d{1,12}[WM]|[A-Za-z0-9_-]{6,24})$/,
}

export interface ParsedMediaId {
  id: string
  type: MediaType
  externalId: string
}

/** `null` si el id no tiene una forma que algún proveedor pueda resolver. */
export function parseMediaId(mediaId: unknown): ParsedMediaId | null {
  if (typeof mediaId !== 'string' || mediaId.length > 80) return null
  const separator = mediaId.indexOf('_')
  if (separator <= 0) return null
  const type = mediaId.slice(0, separator) as MediaType
  const externalId = mediaId.slice(separator + 1)
  if (!MEDIA_TYPES.includes(type)) return null
  if (!EXTERNAL_ID_SHAPES[type].test(externalId)) return null
  return { id: mediaId, type, externalId }
}
