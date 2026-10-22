// ============================================================
// KULTURA — Ficha de un título resuelta EN EL SERVIDOR desde su proveedor
//
// Es la fuente de verdad para escribir el catálogo compartido `media`: lo que
// manda el navegador (`mediaCache`) no se usa nunca para eso (SEG-2).
//
// El enrutado por forma de id replica el de la ficha de detalle
// (`[locale]/(app)/media/[type]/[id]/page.tsx`): conviven ids de fuentes
// actuales y legacy (AniList/Jikan, MangaDex/Jikan, Open Library/Google Books)
// y pedir uno a la fuente equivocada sería un 404 de un título que ya está en
// bibliotecas. Las llamadas van por los clientes de `src/lib/api`, que cachean
// la respuesta una hora (`PROVIDER_CACHE`): como el usuario guarda desde la
// ficha que acaba de pedir lo mismo, lo normal es que no salga a la red.
// ============================================================

import type { MediaItem } from '@/types/media'
import { getMovie, getTV } from '@/lib/api/tmdb'
import { getAnime as getAnimeAniList, isAniListId, fromAniListRef } from '@/lib/api/anilist'
import { getAnimeTmdb, isTmdbAnimeId } from '@/lib/api/anime-tmdb'
import { getAnime as getAnimeJikan, getManga as getMangaJikan } from '@/lib/api/jikan'
import { getManga as getMangaDex, isMangaDexId } from '@/lib/api/mangadex'
import { getBookDetail } from '@/lib/api/openlibrary'
import { cleanOpenLibraryDescription } from '@/lib/api/openlibrary-subjects'
import { enrichBookWithGoogle } from '@/lib/api/books-enrich'
import { getGoogleBookDetail, isOpenLibraryWorkId } from '@/lib/api/googlebooks'
import { getGame } from '@/lib/api/rawg'
import { getComic } from '@/lib/api/comicvine'
import {
  normalizeMovie,
  normalizeTV,
  normalizeAnime,
  normalizeAniListAnime,
  normalizeMangaJikan,
  normalizeMangaDex,
  normalizeBookGoogle,
  normalizeBookOpenLibrary,
  normalizeGame,
  normalizeComic,
} from '@/lib/api/normalizer'
import { createLogger } from '@/lib/logger'
import type { ParsedMediaId } from './media-id'

const log = createLogger('media/resolve-item')

async function resolveBook(externalId: string): Promise<MediaItem | null> {
  if (isOpenLibraryWorkId(externalId)) {
    const detail = await getBookDetail(externalId)
    if (!detail) return null
    const item = normalizeBookOpenLibrary(detail.doc)
    const description = cleanOpenLibraryDescription(detail.description)
    if (description) item.synopsis = description
    // Igual que la ficha: Google Books aporta portada y sinopsis vía ISBN.
    return enrichBookWithGoogle(item).catch(() => item)
  }
  const volume = await getGoogleBookDetail(externalId)
  return volume ? normalizeBookGoogle(volume) : null
}

async function resolveUnsafe(
  { type, externalId }: ParsedMediaId,
  locale: string
): Promise<MediaItem | null> {
  switch (type) {
    case 'movie':
      return normalizeMovie(await getMovie(Number(externalId), locale))
    case 'tv':
      return normalizeTV(await getTV(Number(externalId), locale))
    case 'anime': {
      if (isTmdbAnimeId(externalId)) return (await getAnimeTmdb(externalId, locale))?.item ?? null
      if (isAniListId(externalId)) {
        return normalizeAniListAnime(await getAnimeAniList(fromAniListRef(externalId)))
      }
      return normalizeAnime((await getAnimeJikan(Number(externalId))).data)
    }
    case 'manga': {
      if (isMangaDexId(externalId)) {
        return normalizeMangaDex((await getMangaDex(externalId)).data, locale)
      }
      return normalizeMangaJikan((await getMangaJikan(Number(externalId))).data)
    }
    case 'book':
      return resolveBook(externalId)
    case 'game':
      return normalizeGame(await getGame(Number(externalId)))
    case 'comic':
      return normalizeComic(await getComic(externalId))
    default:
      return null
  }
}

/**
 * Ficha normalizada del título o `null` si el proveedor no la da (caído, 404,
 * cupo agotado). Nunca lanza.
 */
export async function resolveMediaItem(
  parsed: ParsedMediaId,
  locale: string
): Promise<MediaItem | null> {
  try {
    const item = await resolveUnsafe(parsed, locale)
    if (!item || typeof item.title !== 'string' || item.title.trim() === '') return null
    return item
  } catch (err) {
    log.warn('el proveedor no resolvió la ficha', { id: parsed.id, err })
    return null
  }
}
