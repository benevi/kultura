// ============================================================
// KULTURA — Servicio de la biblioteca (saneamiento 6.3)
// La lógica que antes vivía en el handler de /api/library. No sabe de HTTP:
// recibe la entrada ya validada por zod y devuelve un `ServiceResult`.
//
// F-24 (D-14): la nota se guarda siempre en `rating10` (0,5-10); un cliente
// antiguo que mande `score` (1-5) se convierte a score × 2. `score` ya no se
// escribe (saneamiento 6.6): lo rellena el disparador hasta que se retire.
// Favorito y diario, solo con RATING_SCALE_10=1.
//
// F-27 (PRO-5): con PROGRESS_V2=1 llega `progress` (episodios, capítulos,
// páginas o %, horas según el formato) y se guarda en las columnas
// `progress_*`; el disparador deja `episode_progress` como espejo. Sin la
// bandera se guarda `episodeProgress` (de `progress` se saca temporada y
// episodio).
// ============================================================

import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { invalidateLibraryCaches as invalidateCaches } from '@/lib/library/invalidate'
import type { DbUserMedia, DbUserMediaLog } from '@/types/supabase'
import type { DiaryConfig, DiaryLog, EpisodeProgress, LibraryStatus, RatingScale } from '@/types/library'
import { ensureMediaRows, upsertMediaFromProvider } from '@/lib/media/upsert-from-provider'
import { track } from '@/lib/analytics/track'
import { createLogger } from '@/lib/logger'
import { rating10ToScore, scoreToRating10, storedRating10 } from '@/lib/library/rating'
import { RATING_SCALE_KEY, ratingScale10Enabled, readRatingScale } from '@/lib/library/scale'
import { mapLog, parseLogInput, readDiary, today } from '@/lib/library/diary'
import { isDemoUser } from '@/lib/demo'
import {
  parseProgressInput,
  progressFromRow,
  progressToColumns,
  progressToLegacy,
  type LibraryEntryWithProgress,
} from '@/lib/library/progress'
import { progressV2Enabled } from '@/lib/library/progress-server'
import type { LibraryBulkResult, LibraryPostInput } from '@/lib/api/contracts/library'
import { failure, success, type ServiceResult } from '@/lib/api/result'

const log = createLogger('library/service')

/** Mapea una fila de user_media a LibraryEntry (con su progreso, F-27). */
export function mapEntry(row: DbUserMedia): LibraryEntryWithProgress {
  const rating10 = storedRating10(row.rating10)
  const progress = progressFromRow(row as unknown as Record<string, unknown>)
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    status: row.status as LibraryStatus,
    score: rating10ToScore(rating10),
    rating10,
    favorite: row.favorite ?? false,
    watchedAt: row.watched_at,
    episodeProgress: progressToLegacy(progress),
    progress,
    createdAt: row.created_at,
  }
}

export interface SaveEntryResult {
  entry: LibraryEntryWithProgress
  log: DiaryLog | null
  logFailed: boolean
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
  // Solo para la medición: en la base se escribe únicamente rating10 (saneamiento 6.6).
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
    // La nota va SIEMPRE en rating10, con o sin RATING_SCALE_10; `score` lo
    // rellena el disparador user_media_sync_rating hasta que se retire.
    ...(rating10 !== undefined ? { rating10 } : {}),
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

// ── Añadir en bloque (saneamiento 6.4) ───────────────────────────────────────

/**
 * Añade como Pendiente los títulos que no estén ya en la biblioteca («Añadir
 * toda la franquicia»). SOLO INSERTA (`ignoreDuplicates`): lo que ya esté,
 * también si entra entretanto desde otra pestaña, conserva estado, nota y
 * progreso. Las fichas que falten se piden al proveedor por lotes, con
 * concurrencia y tiempo acotados (`ensureMediaRows`); las que no lleguen van
 * en `failed` y se pueden reintentar. Antes eran N POST /api/library.
 */
export async function addPendingBulk(
  supabase: SupabaseClient,
  user: User,
  mediaIds: string[],
  opts: { locale: string | null }
): Promise<ServiceResult<LibraryBulkResult>> {
  const { data: ownedRows, error: ownedError } = await supabase
    .from('user_media')
    .select('media_id')
    .eq('user_id', user.id)
    .in('media_id', mediaIds)
  if (ownedError) {
    log.error('Failed to read library for bulk add', { err: ownedError, userId: user.id })
    return failure('internal', { message: 'Failed to add titles' })
  }
  const owned = new Set(((ownedRows ?? []) as { media_id: string }[]).map((r) => r.media_id))
  const wanted = mediaIds.filter((id) => !owned.has(id))

  let available: Set<string>
  try {
    available = (await ensureMediaRows(wanted, { locale: opts.locale })).available
  } catch (err) {
    log.error('Failed to cache media for bulk add', { err, userId: user.id })
    return failure('internal', { message: 'Failed to cache media' })
  }
  const insertable = wanted.filter((id) => available.has(id))
  const failed = wanted.filter((id) => !available.has(id))

  let added: string[] = []
  if (insertable.length > 0) {
    const { data, error } = await supabase
      .from('user_media')
      .upsert(
        insertable.map((media_id) => ({ user_id: user.id, media_id, status: 'pending' as const })),
        { onConflict: 'user_id,media_id', ignoreDuplicates: true }
      )
      .select('media_id')
    if (error) {
      log.error('Failed to bulk add library entries', { err: error, userId: user.id })
      return failure('internal', { message: 'Failed to add titles' })
    }
    // RETURNING solo trae las insertadas: las demás entraron entretanto.
    const inserted = new Set(((data ?? []) as { media_id: string }[]).map((r) => r.media_id))
    added = insertable.filter((id) => inserted.has(id))
  }
  const skipped = mediaIds.filter((id) => !added.includes(id) && !failed.includes(id))

  if (added.length > 0) {
    invalidateCaches(user.id)
    await Promise.all(
      added.map((id) =>
        track(user, 'library_add', { media_type: id.split('_')[0], status: 'pending' }, {
          dedupeKey: `library_add:${user.id}:${id}`,
        })
      )
    )
  }

  return success({ added, skipped, failed })
}

// ── Diario y escala (F-24) ───────────────────────────────────────────────────

/**
 * Escala (bandera + preferencia ½★ o /10) y apuntes del diario: los de un
 * título o, sin `mediaId`, los últimos 100 con su ficha.
 */
export async function readDiaryConfig(
  supabase: SupabaseClient,
  user: User,
  mediaId: string | undefined
): Promise<ServiceResult<DiaryConfig>> {
  const scale = readRatingScale(user)
  if (!ratingScale10Enabled()) return success({ enabled: false, scale, logs: [] })
  try {
    const diary = await readDiary(supabase, user.id, { mediaId, limit: mediaId ? 50 : 100, withMedia: !mediaId })
    return success({ enabled: true, scale, logs: diary.logs })
  } catch (err) {
    log.error('Failed to read diary', { err, userId: user.id })
    return failure('internal', { message: 'Failed to read diary' })
  }
}

/** Borra un apunte propio. `not_found` si no existe o no es suyo. */
export async function removeDiaryLog(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<ServiceResult<null>> {
  const { error, count } = await supabase
    .from('user_media_logs')
    .delete({ count: 'exact' })
    .match({ id, user_id: userId })
  if (error) {
    log.error('Failed to delete diary log', { err: error, userId })
    return failure('internal', { message: 'Failed to delete diary entry' })
  }
  if (count === 0) return failure('not_found', { message: 'Entry not found' })
  return success(null)
}

/**
 * Guarda la escala en `user_metadata.rating_scale` (la escribe la propia
 * persona con su sesión). La cuenta demo es de solo lectura.
 */
export async function setRatingScale(
  supabase: SupabaseClient,
  user: User,
  ratingScale: RatingScale
): Promise<ServiceResult<{ ratingScale: RatingScale }>> {
  if (isDemoUser(user)) return failure('forbidden', { message: 'Demo account is read-only' })
  const { error } = await supabase.auth.updateUser({ data: { [RATING_SCALE_KEY]: ratingScale } })
  if (error) {
    log.error('Failed to save rating scale', { err: error, userId: user.id })
    return failure('internal', { message: 'Failed to save preference' })
  }
  return success({ ratingScale })
}
