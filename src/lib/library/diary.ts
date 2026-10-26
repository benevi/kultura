// ============================================================
// KULTURA — Diario (user_media_logs, F-24)
//
// Cada apunte es un visionado, lectura o partida con fecha: revisionado o no,
// la nota de ese día, reseña (con aviso de spoiler) y una nota personal. Solo
// lo lee y escribe su dueño (RLS de 20261208240001_rating10_logs.sql). Va
// colgado de la entrada de biblioteca: quitar el título borra su diario.
//
// Las funciones reciben el cliente de Supabase de quien llama (el de la
// sesión) y nunca lanzan por una tabla que aún no existe: devuelven
// `migrated: false` para que la pantalla se quede como antes.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbUserMediaLog, DbMedia } from '@/types/supabase'
import type { DiaryLog, DiaryLogInput } from '@/types/library'
import { isValidRating10 } from './rating'
import { isNotMigrated } from './scale'

export const REVIEW_MAX = 5000
export const PRIVATE_NOTE_MAX = 2000
export const DIARY_PAGE = 200

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Hoy en AAAA-MM-DD (UTC; el cliente manda su fecha local si la tiene). */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** ¿Fecha real AAAA-MM-DD entre 1900 y mañana (margen de husos horarios)? */
export function isValidDiaryDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false
  const tomorrow = new Date(Date.now() + 36 * 3600_000).toISOString().slice(0, 10)
  return value >= '1900-01-01' && value <= tomorrow
}

export type ParsedLog =
  | { ok: true; log: Required<Pick<DiaryLogInput, 'rewatch' | 'spoiler'>> & {
      watchedOn: string | null
      rating10: number | null | undefined
      review: string | null
      privateNote: string | null
    } }
  | { ok: false; error: string }

const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/** Valida lo que manda el cliente. Los textos vacíos se guardan como null. */
export function parseLogInput(raw: unknown): ParsedLog {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'log must be an object' }
  }
  const input = raw as Record<string, unknown>
  if (input.watchedOn !== undefined && input.watchedOn !== null && !isValidDiaryDate(input.watchedOn)) {
    return { ok: false, error: 'log.watchedOn must be a date (YYYY-MM-DD) not in the future' }
  }
  if (input.rating10 !== undefined && input.rating10 !== null && !isValidRating10(input.rating10)) {
    return { ok: false, error: 'log.rating10 must be between 0.5 and 10 in steps of 0.5' }
  }
  for (const key of ['rewatch', 'spoiler'] as const) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') {
      return { ok: false, error: `log.${key} must be a boolean` }
    }
  }
  for (const [key, max] of [['review', REVIEW_MAX], ['privateNote', PRIVATE_NOTE_MAX]] as const) {
    const v = input[key]
    if (v !== undefined && v !== null && typeof v !== 'string') return { ok: false, error: `log.${key} must be a string` }
    if (typeof v === 'string' && v.trim().length > max) return { ok: false, error: `log.${key} is too long (max ${max})` }
  }
  const review = text(input.review)
  return {
    ok: true,
    log: {
      watchedOn: (input.watchedOn as string | null | undefined) ?? null,
      rewatch: input.rewatch === true,
      rating10: input.rating10 as number | null | undefined,
      review,
      // Sin reseña no hay nada que ocultar.
      spoiler: review !== null && input.spoiler === true,
      privateNote: text(input.privateNote),
    },
  }
}

type LogRow = DbUserMediaLog & { media?: Pick<DbMedia, 'title' | 'poster' | 'year'> | null }

export function mapLog(row: LogRow): DiaryLog {
  return {
    id: row.id,
    mediaId: row.media_id,
    watchedOn: row.watched_on,
    rewatch: row.rewatch,
    rating10: row.rating10 === null || row.rating10 === undefined ? null : Number(row.rating10),
    review: row.review,
    spoiler: row.spoiler,
    privateNote: row.private_note,
    createdAt: row.created_at,
    title: row.media?.title,
    poster: row.media?.poster ?? undefined,
    year: row.media?.year ?? undefined,
  }
}

const LOG_COLUMNS = 'id, user_id, media_id, watched_on, rewatch, rating10, review, spoiler, private_note, created_at, updated_at'

export type DiaryRead = { migrated: true; logs: DiaryLog[] } | { migrated: false; logs: [] }

/**
 * El diario de una persona, del más reciente al más antiguo (fecha y, a igual
 * fecha, orden de alta). Con `mediaId`, solo los apuntes de ese título.
 */
export async function readDiary(
  supabase: SupabaseClient,
  userId: string,
  options: { mediaId?: string; limit?: number; withMedia?: boolean } = {}
): Promise<DiaryRead> {
  let query = supabase
    .from('user_media_logs')
    .select(options.withMedia ? `${LOG_COLUMNS}, media(title, poster, year)` : LOG_COLUMNS)
    .eq('user_id', userId)
  if (options.mediaId) query = query.eq('media_id', options.mediaId)
  const { data, error } = await query
    .order('watched_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(options.limit ?? DIARY_PAGE)
  if (error) {
    if (isNotMigrated(error)) return { migrated: false, logs: [] }
    throw new Error(`Failed to read diary: ${error.message}`)
  }
  return { migrated: true, logs: ((data ?? []) as unknown as LogRow[]).map(mapLog) }
}
