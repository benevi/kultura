// ============================================================
// KULTURA — Servicio de la biblioteca (saneamiento 6.3)
// La lógica que antes vivía en el handler de /api/library. No sabe de HTTP:
// recibe la entrada ya validada por zod y devuelve un `ServiceResult`.
//
// F-24 (D-14): con RATING_SCALE_10=1 se guarda la nota fina `rating10`
// (0,5-10) junto a `score` (1-5, derivada) y el diario. Sin la bandera se
// escribe solo `score` y una nota fina que llegue se redondea a score.
//
// F-27 (PRO-5): con PROGRESS_V2=1 llega `progress` (episodios, capítulos,
// páginas o %, horas según el formato) y se guarda en las columnas
// `progress_*`; el disparador deja `episode_progress` como espejo. Sin la
// bandera se guarda `episodeProgress` (de `progress` se saca temporada y
// episodio).
// ============================================================

import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { invalidateRecCache } from '@/lib/claude/recommendations'
import { invalidateMatchScoreCache } from '@/lib/recommendations/match-score'
import type { DbUserMedia, DbUserMediaLog } from '@/types/supabase'
import type { DiaryLog, EpisodeProgress, LibraryStatus } from '@/types/library'
import { upsertMediaFromProvider } from '@/lib/media/upsert-from-provider'
import { track } from '@/lib/analytics/track'
import { createLogger } from '@/lib/logger'
import { entryRating10, rating10ToScore, scoreToRating10 } from '@/lib/library/rating'
import { ratingScale10Enabled } from '@/lib/library/scale'
import { mapLog, parseLogInput, today } from '@/lib/library/diary'
import {
  parseProgressInput,
  progressFromRow,
  progressToColumns,
  progressToLegacy,
  type LibraryEntryWithProgress,
} from '@/lib/library/progress'
import { progressV2Enabled } from '@/lib/library/progress-server'
import type { LibraryPostInput } from '@/lib/api/contracts/library'
import { failure, success, type ServiceResult } from '@/lib/api/result'

const log = createLogger('library/service')

/** Mapea una fila de user_media a LibraryEntry (con su progreso, F-27). */
export function mapEntry(row: DbUserMedia): LibraryEntryWithProgress {
  const rating10 = row.rating10 === null || row.rating10 === undefined ? undefined : Number(row.rating10)
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    status: row.status as LibraryStatus,
    score: row.score,
    rating10: entryRating10({ rating10, score: row.score }),
    favorite: row.favorite ?? false,
    watchedAt: row.watched_at,
    episodeProgress: row.episode_progress,
    progress: progressFromRow(row as unknown as Record<string, unknown>),
    createdAt: row.created_at,
  }
}

export interface SaveEntryResult {
  entry: LibraryEntryWithProgress
  log: DiaryLog | null
  logFailed: boolean
}

/** La biblioteca cambió: las recomendaciones y el match score se recalculan. */
function invalidateCaches(userId: string): void {
  invalidateRecCache(userId)
  invalidateMatchScoreCache(userId)
}

/** Upsert de una entrada (y, si llega `input.log`, un apunte del diario). */
export async function saveEntry(
  supabase: SupabaseClient,
  user: User,
  input: LibraryPostInput,
  opts: { locale: string | null }
): Promise<ServiceResult<SaveEntryResult>> {
  // Los parsers propios de diario y progreso (dependen del formato).
  const parsedLog = input.log === undefined || input.log === null ? null : parseLogInput(input.log)
  if (parsedLog && !parsedLog.ok) return failure('invalid_input', { field: 'log', message: parsedLog.error })

  const mediaType = input.mediaId.split('_')[0]
  const parsedProgress = input.progress === undefined ? null : parseProgressInput(mediaType, input.progress)
  if (parsedProgress && !parsedProgress.ok) {
    return failure('invalid_input', { field: 'progress', message: parsedProgress.error })
  }
  const progressV2 = progressV2Enabled() && parsedProgress?.ok === true
  const progressValue = parsedProgress?.ok ? parsedProgress.value : null

  // Una sola nota: manda rating10 si llega; si no, la de siempre (score × 2).
  // Saneamiento 1.2: sin nota en el cuerpo NO se toca la que haya.
  const hasRating = input.rating10 !== undefined || input.score !== undefined
  const rating10 = !hasRating
    ? undefined
    : input.rating10 !== undefined
      ? input.rating10
      : scoreToRating10(input.score ?? undefined)
  const score = rating10 === undefined ? undefined : rating10 === null ? null : rating10ToScore(rating10)
  const scale10 = ratingScale10Enabled()

  // La fila del catálogo compartido `media` (FK de user_media). La escribe el
  // servidor con la ficha del proveedor (SEG-2).
  const media = await upsertMediaFromProvider(input.mediaId, { locale: opts.locale })
  if (!media.ok) {
    if (media.reason === 'invalid_id') return failure('invalid_input', { field: 'mediaId', message: 'Unknown media id' })
    if (media.reason === 'unavailable') return failure('provider_unavailable', { message: 'Media provider unavailable' })
    return failure('internal', { message: 'Failed to cache media' })
  }

  // Saneamiento 1.2: solo van las columnas que trae el cuerpo. En un upsert
  // PostgREST actualiza únicamente esas; las demás conservan su valor.
  type Row = {
    user_id: string
    media_id: string
    status: LibraryStatus
    score?: number | null
    watched_at?: string | null
    episode_progress?: EpisodeProgress | null
    rating10?: number | null
    favorite?: boolean
  }
  const hasLegacyProgress = parsedProgress?.ok === true || input.episodeProgress !== undefined
  const legacyRow: Row = {
    user_id: user.id,
    media_id: input.mediaId,
    status: input.status,
    ...(score !== undefined ? { score } : {}),
    ...(input.watchedAt !== undefined ? { watched_at: input.watchedAt } : {}),
    // Con `progress` (cliente nuevo) manda él; si no, el campo de siempre.
    ...(hasLegacyProgress
      ? {
          episode_progress: parsedProgress?.ok
            ? (progressToLegacy(progressValue) as EpisodeProgress | null)
            : (input.episodeProgress ?? null),
        }
      : {}),
  }
  const scaleExtras = scale10
    ? {
        ...(rating10 !== undefined ? { rating10 } : {}),
        ...(typeof input.favorite === 'boolean' ? { favorite: input.favorite } : {}),
      }
    : {}
  // F-27: con las columnas, el espejo `episode_progress` lo escribe el
  // disparador (mandarlo también podría pisar páginas u horas).
  const withProgress = (row: Row): Row => {
    if (!progressV2) return row
    const { episode_progress: _legacy, ...rest } = row
    void _legacy
    return { ...rest, ...progressToColumns(progressValue) }
  }

  const { data, error } = await supabase
    .from('user_media')
    .upsert(withProgress({ ...legacyRow, ...scaleExtras }), { onConflict: 'user_id,media_id' })
    .select()
    .single()
  if (error || !data) {
    log.error('Failed to save library entry', { err: error, userId: user.id })
    return failure('internal', { message: 'Failed to save library entry' })
  }

  // Apunte del diario (F-24). Si falla, la entrada ya está guardada: se
  // devuelve igualmente y el cliente avisa de que el apunte no entró.
  let diaryLog: DiaryLog | null = null
  let logFailed = false
  if (parsedLog?.ok && scale10) {
    const entry = parsedLog.log
    const { data: logRow, error: logError } = await supabase
      .from('user_media_logs')
      .insert({
        user_id: user.id,
        media_id: input.mediaId,
        watched_on: entry.watchedOn ?? input.watchedAt ?? today(),
        rewatch: entry.rewatch,
        rating10: entry.rating10 !== undefined ? entry.rating10 : (rating10 ?? null),
        review: entry.review,
        spoiler: entry.spoiler,
        private_note: entry.privateNote,
      })
      .select()
      .single()
    if (logError || !logRow) {
      log.error('Failed to insert diary log', { err: logError, userId: user.id })
      logFailed = true
    } else {
      diaryLog = mapLog(logRow as DbUserMediaLog)
    }
  }

  invalidateCaches(user.id)

  // D-12: embudo (1.ª acción, 3 títulos). Una vez por título y por usuario;
  // nunca bloquea ni falla la respuesta.
  await Promise.all([
    track(user, 'library_add', { media_type: mediaType, status: input.status }, {
      dedupeKey: `library_add:${user.id}:${input.mediaId}`,
    }),
    typeof score === 'number'
      ? track(user, 'rating_set', { media_type: mediaType, score }, {
          dedupeKey: `rating_set:${user.id}:${input.mediaId}`,
        })
      : null,
  ])

  return success({ entry: mapEntry(data as DbUserMedia), log: diaryLog, logFailed })
}

/** Borra la entrada (y, por la FK, su diario). `not_found` si no existía. */
export async function removeEntry(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<ServiceResult<null>> {
  const { error, count } = await supabase
    .from('user_media')
    .delete({ count: 'exact' })
    .match({ user_id: userId, media_id: mediaId })
  if (error) {
    log.error('Failed to delete library entry', { err: error, userId })
    return failure('internal', { message: 'Failed to delete library entry' })
  }
  if (count === 0) return failure('not_found', { message: 'Entry not found' })
  invalidateCaches(userId)
  return success(null)
}
