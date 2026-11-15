// ============================================================
// KULTURA — Datos de TMDB con menos de 6 meses (saneamiento 12.8)
//
// Las condiciones de la API de TMDB no dejan guardar sus datos más de 6
// meses. `media` guarda póster, fondo, año, sinopsis y géneros de TMDB
// (películas, series y el anime de respaldo `anime_tmdb-…`), y hasta ahora
// una ficha que nadie volvía a abrir no caducaba nunca (el refresco al usarla,
// saneamiento 1.5, solo cubre las que se usan).
//
// Cada día, el cron:
//   - vuelve a pedir a TMDB las fichas con más de 6 meses (`updated_at`), las
//     más viejas primero y como mucho MAX_PER_RUN, y las reescribe con lo que
//     devuelve TMDB ahora (sin mezclar con lo guardado) y `updated_at = now`;
//   - si TMDB responde 404 (el título ya no existe), vacía sus datos y deja la
//     fila (la usan bibliotecas y listas): póster, fondo, año, sinopsis y
//     géneros a null o vacíos. El título se conserva: es la referencia mínima
//     de lo que el usuario guardó;
//   - si TMDB falla por otra cosa (red, 429, 5xx), no toca la fila y se
//     reintenta al día siguiente;
//   - borra las traducciones (`media_translations`) de fichas de TMDB con más
//     de 6 meses: son contenido derivado y se regeneran al pedirlas.
//
// El título no se reescribe tampoco al refrescar: depende del idioma de quien
// creó la ficha (ver upsert-from-provider.ts).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaItem } from '@/types/media'
import { getMovie, getTV } from '@/lib/api/tmdb'
import { fromTmdbAnimeRef, isTmdbAnimeId, normalizeAnimeTmdb } from '@/lib/api/anime-tmdb'
import { normalizeMovie, normalizeTV } from '@/lib/api/normalizer'
import { ProviderError } from '@/lib/api/http'
import { DEFAULT_API_LOCALE } from '@/lib/api/locale'
import { createLogger } from '@/lib/logger'

const log = createLogger('cron/tmdb-retention')

/** 6 meses (183 días): el máximo que TMDB deja guardar sus datos. */
export const TMDB_MAX_AGE_MS = 183 * 24 * 60 * 60 * 1000
/** Fichas por ejecución: el cron comparte 60 s con el correo semanal. */
export const MAX_PER_RUN = 20
/** Tiempo máximo que se dedica a TMDB en una ejecución. */
export const BUDGET_MS = 15_000

export interface TmdbRow {
  id: string
  type: string
  external_id: string
  metadata: Record<string, unknown> | null
}

export type TmdbFetchResult = { kind: 'ok'; item: MediaItem } | { kind: 'gone' } | { kind: 'failed' }

export interface TmdbRetentionResult {
  status: 'done' | 'error'
  refreshed: number
  emptied: number
  failed: number
  translationsDeleted: number
}

/** ¿La ficha viene de TMDB? Películas, series y el anime de respaldo. */
export function isTmdbRow(row: Pick<TmdbRow, 'type' | 'external_id'>): boolean {
  if (row.type === 'movie' || row.type === 'tv') return /^\d+$/.test(row.external_id)
  return row.type === 'anime' && isTmdbAnimeId(row.external_id)
}

/** Pide la ficha a TMDB distinguiendo «ya no existe» (404) de un fallo pasajero. */
export async function fetchFromTmdb(row: TmdbRow, locale = DEFAULT_API_LOCALE): Promise<TmdbFetchResult> {
  try {
    if (row.type === 'movie') return { kind: 'ok', item: normalizeMovie(await getMovie(Number(row.external_id), locale)) }
    if (row.type === 'tv') return { kind: 'ok', item: normalizeTV(await getTV(Number(row.external_id), locale)) }
    return { kind: 'ok', item: normalizeAnimeTmdb(await getTV(fromTmdbAnimeRef(row.external_id), locale)) }
  } catch (e) {
    if (e instanceof ProviderError && e.status === 404) return { kind: 'gone' }
    log.warn('TMDB no respondió; se reintenta mañana', { id: row.id, err: e instanceof Error ? e.message : String(e) })
    return { kind: 'failed' }
  }
}

/** Cambios para la fila: lo de TMDB de ahora, o vacía si TMDB ya no la tiene. */
export function buildRetentionUpdate(row: TmdbRow, result: Exclude<TmdbFetchResult, { kind: 'failed' }>, nowIso: string) {
  const base = { ...(row.metadata ?? {}) }
  if (result.kind === 'gone') {
    return {
      poster: null,
      backdrop: null,
      year: null,
      synopsis: null,
      metadata: { ...base, genres: [], genresSyncedAt: nowIso, tmdbGone: true },
      updated_at: nowIso,
    }
  }
  const { item } = result
  return {
    poster: item.poster ?? null,
    backdrop: item.backdrop ?? null,
    year: Number.isInteger(item.year) ? (item.year as number) : null,
    synopsis: item.synopsis ?? null,
    metadata: {
      ...base,
      genres: Array.isArray(item.genres) ? item.genres.filter((g) => typeof g === 'string') : [],
      genresSyncedAt: nowIso,
    },
    updated_at: nowIso,
  }
}

export interface TmdbRetentionDeps {
  admin: Pick<SupabaseClient, 'from'>
  fetchItem?: (row: TmdbRow) => Promise<TmdbFetchResult>
  now?: () => number
}

export async function refreshTmdbData({
  admin,
  fetchItem = fetchFromTmdb,
  now = Date.now,
}: TmdbRetentionDeps): Promise<TmdbRetentionResult> {
  const start = now()
  const cutoff = new Date(start - TMDB_MAX_AGE_MS).toISOString()
  const result: TmdbRetentionResult = { status: 'done', refreshed: 0, emptied: 0, failed: 0, translationsDeleted: 0 }

  // Traducciones derivadas de TMDB con más de 6 meses: fuera (se regeneran).
  const { count, error: trError } = await admin
    .from('media_translations')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)
    .or('media_id.like.movie_%,media_id.like.tv_%,media_id.like.anime_tmdb-%')
  if (trError) {
    log.error(`traducciones de TMDB: ${trError.code ?? 'error'}`)
    result.status = 'error'
  } else {
    result.translationsDeleted = count ?? 0
  }

  // Más filas de las que se procesan: el filtro de TMDB se hace aquí, y el
  // anime de AniList o Jikan comparte `type` con el de TMDB.
  const { data, error } = await admin
    .from('media')
    .select('id, type, external_id, metadata')
    .in('type', ['movie', 'tv', 'anime'])
    .or(`updated_at.lt.${cutoff},updated_at.is.null`)
    .order('updated_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PER_RUN * 5)
  if (error) {
    log.error(`fichas de TMDB: ${error.code ?? 'error'}`)
    return { ...result, status: 'error' }
  }

  const rows = ((data ?? []) as TmdbRow[]).filter(isTmdbRow).slice(0, MAX_PER_RUN)
  for (const row of rows) {
    if (now() - start > BUDGET_MS) break
    const fetched = await fetchItem(row)
    if (fetched.kind === 'failed') {
      result.failed++
      continue
    }
    const nowIso = new Date(now()).toISOString()
    const { error: upError } = await admin.from('media').update(buildRetentionUpdate(row, fetched, nowIso)).eq('id', row.id)
    if (upError) {
      log.warn('no se pudo actualizar la ficha', { id: row.id, code: upError.code })
      result.failed++
    } else if (fetched.kind === 'gone') {
      result.emptied++
    } else {
      result.refreshed++
    }
  }
  return result
}
