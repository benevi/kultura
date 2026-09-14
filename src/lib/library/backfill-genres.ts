// ============================================================
// KULTURA — Autocurado de géneros de biblioteca (E-MATCH-GENRES)
//
// `media.metadata.genres` es la ÚNICA señal de género del perfil de gustos
// (`buildTasteProfile`). Cachearlo al guardar en biblioteca se arregló el
// 2026-09-12, pero ese fix solo cubre lo que se guarda DESPUÉS: las filas
// anteriores quedaron sin géneros y solo se curaban si el usuario volvía a
// guardar ese mismo título. Con el perfil sin un solo género, `scoreItem` da 0
// para todo — que es justo el "0% MATCH en todos los tipos" visto en producción.
//
// Aquí se repara al vuelo: cuando el perfil encuentra filas sin géneros, se
// piden al proveedor que corresponda y se escriben en `media`. Es idempotente y
// efímero por naturaleza — una vez curada la fila, no se vuelve a tocar.
//
// El enrutado por FORMA DEL ID replica el de la ficha de detalle (AniList vs
// Jikan legacy, MangaDex vs Jikan legacy, Google Books vs Open Library legacy):
// una biblioteca vieja puede tener ids de la fuente anterior y pedirlos a la
// nueva sería un 404.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { getMovie, getTV } from '@/lib/api/tmdb'
import { getAnime as getAnimeAniList, isAniListId, fromAniListRef } from '@/lib/api/anilist'
import { getAnime as getAnimeJikan, getManga as getMangaJikan } from '@/lib/api/jikan'
import { getManga as getMangaDex, isMangaDexId } from '@/lib/api/mangadex'
import { getGoogleBookDetail, isOpenLibraryWorkId } from '@/lib/api/googlebooks'
import { getBookDetail } from '@/lib/api/openlibrary'
import { getGame } from '@/lib/api/rawg'
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
} from '@/lib/api/normalizer'
import { createLogger } from '@/lib/logger'

const log = createLogger('library/backfill-genres')

/**
 * Tope de filas reparadas por ejecución: una biblioteca enorme no puede
 * convertir la primera carga de Descubrir en N llamadas a proveedores. El resto
 * se cura en las siguientes pasadas (el perfil se recalcula cada hora).
 */
const MAX_BACKFILL_PER_RUN = 25

/** Fila de `media` candidata a reparación. */
export interface MediaGenreRow {
  id: string
  type: string
  external_id: string
  metadata: Record<string, unknown> | null
}

/**
 * ¿Hay que resolver los géneros de esta fila?
 *
 * Con géneros ya cacheados, no. Sin ellos, solo si no se intentó antes:
 * `genresSyncedAt` marca los títulos que el proveedor sirve legítimamente sin
 * género (los cómics de ComicVine, por ejemplo) para no reintentarlos en cada
 * carga.
 */
export function needsGenreBackfill(metadata: Record<string, unknown> | null): boolean {
  if (!metadata) return true
  const genres = metadata.genres
  if (Array.isArray(genres) && genres.length > 0) return false
  return !metadata.genresSyncedAt
}

/**
 * Géneros de un título desde su proveedor. `null` = no se pudo resolver (red,
 * 404, id de una fuente ya retirada): el llamador deja la fila como está para
 * reintentarlo más adelante, en vez de marcarla como "sin géneros".
 */
export async function fetchGenresForMedia(
  type: string,
  externalId: string,
  locale?: string | null
): Promise<string[] | null> {
  try {
    switch (type) {
      case 'movie':
        return normalizeMovie(await getMovie(Number(externalId), locale)).genres ?? []
      case 'tv':
        return normalizeTV(await getTV(Number(externalId), locale)).genres ?? []
      case 'anime': {
        if (isAniListId(externalId)) {
          return normalizeAniListAnime(await getAnimeAniList(fromAniListRef(externalId))).genres ?? []
        }
        const legacy = await getAnimeJikan(Number(externalId))
        return normalizeAnime(legacy.data).genres ?? []
      }
      case 'manga': {
        if (isMangaDexId(externalId)) {
          const detail = await getMangaDex(externalId)
          return normalizeMangaDex(detail.data, locale).genres ?? []
        }
        const legacy = await getMangaJikan(Number(externalId))
        return normalizeMangaJikan(legacy.data).genres ?? []
      }
      case 'book': {
        if (isOpenLibraryWorkId(externalId)) {
          const legacy = await getBookDetail(externalId)
          return legacy ? (normalizeBookOpenLibrary(legacy.doc).genres ?? []) : null
        }
        const volume = await getGoogleBookDetail(externalId)
        return volume ? (normalizeBookGoogle(volume).genres ?? []) : null
      }
      case 'game':
        return normalizeGame(await getGame(Number(externalId))).genres ?? []
      case 'comic':
        // ComicVine no expone género en los issues (ver normalizeComic): no hay
        // nada que pedir, pero sí que marcar para no reintentarlo eternamente.
        return []
      default:
        return null
    }
  } catch (err) {
    log.warn('no se pudieron resolver los géneros', { type, externalId, err })
    return null
  }
}

/**
 * Repara los géneros de las filas que lo necesiten y devuelve los resueltos
 * (`media.id` → géneros) para que el llamador los use YA, sin esperar a la
 * siguiente carga.
 *
 * Nunca lanza: un proveedor caído deja esa fila sin curar y el resto sigue.
 */
export async function backfillGenres(
  rows: MediaGenreRow[],
  supabase: SupabaseClient,
  locale?: string | null
): Promise<Map<string, string[]>> {
  const pending = rows
    .filter((row) => needsGenreBackfill(row.metadata))
    .slice(0, MAX_BACKFILL_PER_RUN)

  const resolved = new Map<string, string[]>()
  if (pending.length === 0) return resolved

  const results = await Promise.allSettled(
    pending.map(async (row) => {
      const genres = await fetchGenresForMedia(row.type, row.external_id, locale)
      if (genres === null) return null

      // Se conserva el resto de metadata (no solo genres): la ficha guarda ahí
      // datos por tipo que no son de nuestra incumbencia.
      const metadata = {
        ...(row.metadata ?? {}),
        genres,
        genresSyncedAt: new Date().toISOString(),
      }
      const { error } = await supabase.from('media').update({ metadata }).eq('id', row.id)
      if (error) {
        log.warn('no se pudo escribir los géneros reparados', { id: row.id, error })
        // Se devuelven igualmente: el perfil de ESTA carga ya puede usarlos.
      }
      return { id: row.id, genres }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      resolved.set(result.value.id, result.value.genres)
    }
  }

  log.info('géneros reparados', { intentadas: pending.length, resueltas: resolved.size })
  return resolved
}
