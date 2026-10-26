// ============================================================
// KULTURA — Route Handler: /api/library/progress (F-27, PRO-5)
//
// GET ?mediaId=…  → cómo va ese título y qué dice el proveedor (temporadas,
//                   capítulos, páginas, horas medias), si el progreso por
//                   formato está activo y si el diario lo está. Lo pide el
//                   diálogo de biblioteca al abrirse.
// POST { mediaId, action: 'next' }
//                 → «marcar siguiente» (1 toque desde Inicio): siguiente
//                   episodio (con cambio de temporada según TMDB y sin pasar
//                   del último emitido), +1 capítulo, +10 páginas o +5 %, +1 h.
//                   Un pendiente pasa a «En progreso». Responde `finished`
//                   cuando lo marcado es el final, para proponer «Completado».
// POST { mediaId, action: 'complete', log?, watchedOn? }
//                 → pasa a «Completado» (y apunta en el diario si F-24 está
//                   activo y se pide).
//
// Antes y después de la migración 20261215270001: sin PROGRESS_V2 o sin las
// columnas, solo se guarda el progreso de episodios en `episode_progress`
// (como siempre); el resto de formatos responde 409 `progress_unavailable`.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { invalidateRecCache } from '@/lib/claude/recommendations'
import { invalidateMatchScoreCache } from '@/lib/recommendations/match-score'
import { localeFromRequest } from '@/lib/media/request-locale'
import { parseMediaId } from '@/lib/media/media-id'
import { createLogger } from '@/lib/logger'
import { isNotMigrated, ratingScale10Enabled } from '@/lib/library/scale'
import { isValidDiaryDate, mapLog, today } from '@/lib/library/diary'
import {
  nextProgress,
  progressFromRow,
  progressKindFor,
  progressToColumns,
  progressToLegacy,
  rowHasProgressColumns,
  supportsLegacyProgress,
  totalFor,
  type ProgressValue,
} from '@/lib/library/progress'
import { getProgressPlan, nextEpisodeInfo, progressColumnsExist, progressV2Enabled } from '@/lib/library/progress-server'
import type { DbUserMediaLog } from '@/types/supabase'
import type { DiaryLog, LibraryStatus } from '@/types/library'

const log = createLogger('api/library/progress')

const NO_STORE = { 'Cache-Control': 'private, no-store' }

type Row = Record<string, unknown> & { status: LibraryStatus; watched_at: string | null; rating10?: number | null }

async function session() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

/** GET (lo pide el diálogo al abrirse) con su propia cuenta, para que abrir
 * fichas no gaste el cupo de guardar ni al revés. */
function limited(userId: string, bucket: 'library' | 'library_progress' = 'library'): NextResponse | null {
  const rl = checkRateLimit(`${userId}:${bucket}`, LIMITS.library)
  if (rl.allowed) return null
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
  )
}

export async function GET(request: Request): Promise<NextResponse> {
  const { supabase, user } = await session()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const tooMany = limited(user.id, 'library_progress')
  if (tooMany) return tooMany

  const mediaId = new URL(request.url).searchParams.get('mediaId')
  const parsed = parseMediaId(mediaId)
  if (!parsed) {
    return NextResponse.json({ error: 'mediaId must follow the format "{type}_{externalId}"' }, { status: 400 })
  }
  const kind = progressKindFor(parsed.type)
  const diary = ratingScale10Enabled()
  if (!kind) {
    return NextResponse.json({ enabled: false, kind: null, progress: null, plan: null, next: null, diary }, { headers: NO_STORE })
  }

  const { data: row, error } = await supabase
    .from('user_media')
    .select('*')
    .eq('user_id', user.id)
    .eq('media_id', parsed.id)
    .maybeSingle()
  if (error) {
    log.error('Failed to read progress', { err: error, userId: user.id })
    return NextResponse.json({ error: 'Failed to read progress' }, { status: 500 })
  }

  // Sin la bandera no hace falta saber si están las columnas (ni gastar la sonda).
  const enabled = progressV2Enabled() && (row ? rowHasProgressColumns(row) : await progressColumnsExist(supabase))
  const locale = localeFromRequest(request)
  const progress = progressFromRow(row as Row | null)
  const plan = await getProgressPlan(parsed.id, locale)

  // Series: nombre del episodio que tocaría ahora (para el botón y el diálogo).
  let next = null
  if (kind === 'tv' && plan) {
    const step = nextProgress(parsed.type, progress, plan)
    if (step && !step.caughtUp && typeof step.value.episode === 'number' && !(step.finished && progress?.episode === step.value.episode)) {
      next = await nextEpisodeInfo(Number(parsed.externalId), step.value.season ?? 1, step.value.episode, locale)
    }
  }

  return NextResponse.json(
    {
      enabled,
      kind,
      progress,
      total: totalFor(parsed.type, progress, plan) ?? progress?.total ?? null,
      plan,
      next,
      diary,
    },
    { headers: NO_STORE }
  )
}

interface PostBody {
  mediaId?: unknown
  action?: unknown
  log?: unknown
  watchedOn?: unknown
}

export async function POST(request: Request): Promise<NextResponse> {
  const { supabase, user } = await session()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const tooMany = limited(user.id)
  if (tooMany) return tooMany

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = parseMediaId(body.mediaId)
  if (!parsed) {
    return NextResponse.json({ error: 'mediaId must follow the format "{type}_{externalId}"' }, { status: 400 })
  }
  if (body.action !== 'next' && body.action !== 'complete') {
    return NextResponse.json({ error: "action must be 'next' or 'complete'" }, { status: 400 })
  }
  if (body.log !== undefined && typeof body.log !== 'boolean') {
    return NextResponse.json({ error: 'log must be a boolean' }, { status: 400 })
  }
  if (body.watchedOn !== undefined && !isValidDiaryDate(body.watchedOn)) {
    return NextResponse.json({ error: 'watchedOn must be a valid YYYY-MM-DD date' }, { status: 400 })
  }

  const { data: found, error: readError } = await supabase
    .from('user_media')
    .select('*')
    .eq('user_id', user.id)
    .eq('media_id', parsed.id)
    .maybeSingle()
  if (readError) {
    log.error('Failed to read entry', { err: readError, userId: user.id })
    return NextResponse.json({ error: 'Failed to read library entry' }, { status: 500 })
  }
  if (!found) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  const row = found as Row

  const invalidate = () => {
    invalidateRecCache(user.id)
    invalidateMatchScoreCache(user.id)
  }

  // ── Completar ────────────────────────────────────────────────────────────
  if (body.action === 'complete') {
    const watchedOn = (body.watchedOn as string | undefined) ?? today()
    const { error } = await supabase
      .from('user_media')
      .update({ status: 'completed', watched_at: row.watched_at ?? watchedOn })
      .eq('user_id', user.id)
      .eq('media_id', parsed.id)
    if (error) {
      log.error('Failed to complete entry', { err: error, userId: user.id })
      return NextResponse.json({ error: 'Failed to save library entry' }, { status: 500 })
    }
    invalidate()

    let diaryLog: DiaryLog | null = null
    let logFailed = false
    if (body.log === true && ratingScale10Enabled()) {
      const { data: logRow, error: logError } = await supabase
        .from('user_media_logs')
        .insert({
          user_id: user.id,
          media_id: parsed.id,
          watched_on: watchedOn,
          rewatch: row.status === 'completed',
          rating10: typeof row.rating10 === 'number' ? row.rating10 : null,
        })
        .select()
        .single()
      if (logError || !logRow) {
        if (!isNotMigrated(logError)) {
          log.error('Failed to insert diary log', { err: logError, userId: user.id })
          logFailed = true
        }
      } else {
        diaryLog = mapLog(logRow as DbUserMediaLog)
      }
    }
    return NextResponse.json({ status: 'completed', log: diaryLog, ...(logFailed ? { logFailed: true } : {}) })
  }

  // ── Marcar siguiente ─────────────────────────────────────────────────────
  if (!progressKindFor(parsed.type)) {
    return NextResponse.json({ error: `progress is not supported for ${parsed.type}` }, { status: 400 })
  }
  const v2 = progressV2Enabled() && rowHasProgressColumns(row)
  if (!v2 && !supportsLegacyProgress(parsed.type)) {
    return NextResponse.json({ error: 'progress_unavailable' }, { status: 409 })
  }

  const current = progressFromRow(row)
  const plan = await getProgressPlan(parsed.id, localeFromRequest(request))
  const step = nextProgress(parsed.type, current, plan)
  if (!step) return NextResponse.json({ error: 'progress_unavailable' }, { status: 409 })

  const status: LibraryStatus = row.status === 'completed' ? 'completed' : 'in_progress'
  const unchanged = JSON.stringify(progressToColumns(step.value)) === JSON.stringify(progressToColumns(current))
  if (step.caughtUp || (unchanged && status === row.status)) {
    return NextResponse.json({
      progress: current,
      status: row.status,
      finished: step.finished,
      caughtUp: step.caughtUp,
      diary: ratingScale10Enabled(),
    })
  }

  const write = (value: ProgressValue, columns: boolean) =>
    supabase
      .from('user_media')
      .update({
        ...(columns ? progressToColumns(value) : { episode_progress: progressToLegacy(value) }),
        ...(status !== row.status ? { status } : {}),
      })
      .eq('user_id', user.id)
      .eq('media_id', parsed.id)
      .select('*')
      .single()

  let { data: saved, error: writeError } = await write(step.value, v2)
  if (writeError && v2 && isNotMigrated(writeError) && supportsLegacyProgress(parsed.type)) {
    log.warn('PROGRESS_V2 activa pero falta la migración 20261215270001; se escribe episode_progress', {
      code: writeError.code,
    })
    ;({ data: saved, error: writeError } = await write(step.value, false))
  }
  if (writeError || !saved) {
    log.error('Failed to save progress', { err: writeError, userId: user.id })
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
  if (status !== row.status) invalidate()

  return NextResponse.json({
    progress: progressFromRow(saved as Row) ?? step.value,
    status,
    finished: step.finished,
    caughtUp: false,
    diary: ratingScale10Enabled(),
  })
}
