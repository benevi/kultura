// ============================================================
// KULTURA — Servicio del progreso por formato (F-27, PRO-5; saneamiento 6.3)
// La lógica que antes vivía en el handler de /api/library/progress.
//
// readProgress  → cómo va el título y qué dice el proveedor (temporadas,
//                 capítulos, páginas, horas medias), y si el progreso por
//                 formato y el diario están activos.
// advance       → «marcar siguiente» (1 toque desde Inicio): siguiente
//                 episodio (con cambio de temporada según TMDB y sin pasar del
//                 último emitido), +1 capítulo, +10 páginas o +5 %, +1 h. Un
//                 pendiente pasa a «En progreso». `finished` = lo marcado es el
//                 final (para proponer «Completado»).
// complete      → pasa a «Completado» (y lo apunta en el diario si F-24 está
//                 activo y se pide).
//
// Sin PROGRESS_V2 o sin las columnas, solo se guarda el progreso de episodios
// en `episode_progress`; el resto de formatos responde `conflict` con
// `message: 'progress_unavailable'`.
// ============================================================

import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { ParsedMediaId } from '@/lib/media/media-id'
import { createLogger } from '@/lib/logger'
import { ratingScale10Enabled } from '@/lib/library/scale'
import { mapLog, today } from '@/lib/library/diary'
import {
  nextProgress,
  progressFromRow,
  progressKindFor,
  progressToColumns,
  progressToLegacy,
  supportsLegacyProgress,
  totalFor,
  type ProgressKind,
  type ProgressPlan,
  type ProgressValue,
} from '@/lib/library/progress'
import { getProgressPlan, nextEpisodeInfo, progressV2Enabled } from '@/lib/library/progress-server'
import { invalidateLibraryCaches as invalidateCaches } from '@/lib/library/invalidate'
import { failure, success, type ServiceResult } from '@/lib/api/result'
import type { DbUserMediaLog } from '@/types/supabase'
import type { DiaryLog, LibraryStatus } from '@/types/library'

const log = createLogger('library/progress-service')

/** Mensaje del `conflict` cuando ese formato no tiene progreso todavía. */
export const PROGRESS_UNAVAILABLE = 'progress_unavailable'

type Row = Record<string, unknown> & { status: LibraryStatus; watched_at: string | null; rating10?: number | null }

export interface ProgressConfig {
  enabled: boolean
  kind: ProgressKind | null
  progress: ProgressValue | null
  total: number | null
  plan: ProgressPlan | null
  next: { season: number; episode: number; name: string | null; airDate: string | null } | null
  diary: boolean
}

export interface AdvanceResult {
  progress: ProgressValue | null
  status: LibraryStatus
  finished: boolean
  caughtUp: boolean
  diary: boolean
}

export interface CompleteResult {
  status: 'completed'
  log: DiaryLog | null
  logFailed: boolean
}

async function readRow(
  supabase: SupabaseClient,
  userId: string,
  mediaId: string
): Promise<ServiceResult<Row | null>> {
  const { data, error } = await supabase
    .from('user_media')
    .select('*')
    .eq('user_id', userId)
    .eq('media_id', mediaId)
    .maybeSingle()
  if (error) {
    log.error('Failed to read library entry', { err: error, userId })
    return failure('internal', { message: 'Failed to read library entry' })
  }
  return success(data as Row | null)
}

export async function readProgress(
  supabase: SupabaseClient,
  userId: string,
  media: ParsedMediaId,
  locale: string
): Promise<ServiceResult<ProgressConfig>> {
  const kind = progressKindFor(media.type)
  const diary = ratingScale10Enabled()
  if (!kind) return success({ enabled: false, kind: null, progress: null, total: null, plan: null, next: null, diary })

  const found = await readRow(supabase, userId, media.id)
  if (!found.ok) return found

  const progress = progressFromRow(found.value)
  const plan = await getProgressPlan(media.id, locale)

  // Series: nombre del episodio que tocaría ahora (para el botón y el diálogo).
  let next: ProgressConfig['next'] = null
  if (kind === 'tv' && plan) {
    const step = nextProgress(media.type, progress, plan)
    if (step && !step.caughtUp && typeof step.value.episode === 'number' && !(step.finished && progress?.episode === step.value.episode)) {
      next = await nextEpisodeInfo(Number(media.externalId), step.value.season ?? 1, step.value.episode, locale)
    }
  }

  return success({
    enabled: progressV2Enabled(),
    kind,
    progress,
    total: totalFor(media.type, progress, plan) ?? progress?.total ?? null,
    plan,
    next,
    diary,
  })
}

export async function complete(
  supabase: SupabaseClient,
  user: User,
  media: ParsedMediaId,
  opts: { log: boolean; watchedOn?: string }
): Promise<ServiceResult<CompleteResult>> {
  const found = await readRow(supabase, user.id, media.id)
  if (!found.ok) return found
  const row = found.value
  if (!row) return failure('not_found', { message: 'Entry not found' })

  const watchedOn = opts.watchedOn ?? today()
  const { error } = await supabase
    .from('user_media')
    .update({ status: 'completed', watched_at: row.watched_at ?? watchedOn })
    .eq('user_id', user.id)
    .eq('media_id', media.id)
  if (error) {
    log.error('Failed to complete entry', { err: error, userId: user.id })
    return failure('internal', { message: 'Failed to save library entry' })
  }
  invalidateCaches(user.id)

  let diaryLog: DiaryLog | null = null
  let logFailed = false
  if (opts.log && ratingScale10Enabled()) {
    const { data: logRow, error: logError } = await supabase
      .from('user_media_logs')
      .insert({
        user_id: user.id,
        media_id: media.id,
        watched_on: watchedOn,
        rewatch: row.status === 'completed',
        rating10: typeof row.rating10 === 'number' ? row.rating10 : null,
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
  return success({ status: 'completed', log: diaryLog, logFailed })
}

export async function advance(
  supabase: SupabaseClient,
  user: User,
  media: ParsedMediaId,
  locale: string
): Promise<ServiceResult<AdvanceResult>> {
  if (!progressKindFor(media.type)) {
    return failure('invalid_input', { field: 'mediaId', message: `progress is not supported for ${media.type}` })
  }

  const found = await readRow(supabase, user.id, media.id)
  if (!found.ok) return found
  const row = found.value
  if (!row) return failure('not_found', { message: 'Entry not found' })

  const v2 = progressV2Enabled()
  if (!v2 && !supportsLegacyProgress(media.type)) return failure('conflict', { message: PROGRESS_UNAVAILABLE })

  const current = progressFromRow(row)
  const plan = await getProgressPlan(media.id, locale)
  const step = nextProgress(media.type, current, plan)
  if (!step) return failure('conflict', { message: PROGRESS_UNAVAILABLE })

  const diary = ratingScale10Enabled()
  const status: LibraryStatus = row.status === 'completed' ? 'completed' : 'in_progress'
  const unchanged = JSON.stringify(progressToColumns(step.value)) === JSON.stringify(progressToColumns(current))
  if (step.caughtUp || (unchanged && status === row.status)) {
    return success({ progress: current, status: row.status, finished: step.finished, caughtUp: step.caughtUp, diary })
  }

  const { data: saved, error } = await supabase
    .from('user_media')
    .update({
      ...(v2 ? progressToColumns(step.value) : { episode_progress: progressToLegacy(step.value) }),
      ...(status !== row.status ? { status } : {}),
    })
    .eq('user_id', user.id)
    .eq('media_id', media.id)
    .select('*')
    .single()
  if (error || !saved) {
    log.error('Failed to save progress', { err: error, userId: user.id })
    return failure('internal', { message: 'Failed to save progress' })
  }
  if (status !== row.status) invalidateCaches(user.id)

  return success({ progress: progressFromRow(saved as Row) ?? step.value, status, finished: step.finished, caughtUp: false, diary })
}
