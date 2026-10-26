// ============================================================
// KULTURA — Un lote del importador: emparejar, crear fichas y escribir (F-26)
//
// Reglas:
//   - Todo se escribe para el usuario de la sesión, con su cliente (RLS).
//     El catálogo `media` lo escribe solo el servidor, con la ficha del
//     proveedor (SEG-2), igual que `ensureMediaRows`.
//   - NO SE PISA lo que ya había en KULTURA: una entrada existente solo se
//     completa (nota o fecha que faltaban, estado que avanza: pendiente →
//     visto, nunca al revés). Reimportar el mismo archivo no cambia nada.
//   - Con F-24 activa (RATING_SCALE_10=1 y migración 20261208240001) se
//     escribe la nota fina y el diario; sin ella, la nota entera de siempre
//     (`score`) y sin diario. Si la bandera está pero la migración no, se
//     detecta por el código de error y se vuelve a lo de antes.
//   - Lo que no se pudo resolver ahora (presupuesto, plazo, proveedor caído)
//     vuelve como `pending` para que el navegador lo reintente.
//   - Ni títulos ni reseñas en los logs: solo recuentos y códigos.
// ============================================================

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { buildMediaRow, ensureMediaRows, type MediaRowInsert } from '@/lib/media/upsert-from-provider'
import { parseMediaId } from '@/lib/media/media-id'
import { rating10ToScore, scoreToRating10, isValidRating10 } from '@/lib/library/rating'
import { isNotMigrated, ratingScale10Enabled } from '@/lib/library/scale'
import type { LibraryStatus } from '@/types/library'
import type { MediaItem } from '@/types/media'
import { BATCH_DEADLINE_MS, MAX_PROVIDER_CALLS_PER_BATCH } from '../limits'
import { dedupeLogs, strongerStatus } from '../parsers/common'
import type { ImportItem, ImportItemResult, ImportLog, ImportOutcome, MatchMethod } from '../types'
import { ProviderBudget } from './budget'
import { matchItems } from './match'

const log = createLogger('import/batch')

/** Lo que entra para una ficha (varias filas del lote pueden ir a la misma). */
export interface IncomingEntry {
  status: LibraryStatus
  rating10: number | null
  watchedAt: string | null
}

/** Lo que ya había en la biblioteca. */
export interface ExistingEntry {
  status: LibraryStatus
  /** Nota fina guardada o, sin la migración, score × 2. */
  rating10: number | null
  watchedAt: string | null
}

export type LibraryPlan =
  | { outcome: 'added' | 'updated'; entry: IncomingEntry }
  | { outcome: 'kept'; entry: null }

/** Qué hacer con una entrada: crearla, completarla o dejarla como está. */
export function planLibraryWrite(existing: ExistingEntry | undefined, incoming: IncomingEntry): LibraryPlan {
  if (!existing) return { outcome: 'added', entry: incoming }
  const entry: IncomingEntry = {
    status: strongerStatus(existing.status, incoming.status),
    rating10: existing.rating10 ?? incoming.rating10,
    watchedAt: existing.watchedAt ?? incoming.watchedAt,
  }
  const same =
    entry.status === existing.status && entry.rating10 === existing.rating10 && entry.watchedAt === existing.watchedAt
  return same ? { outcome: 'kept', entry: null } : { outcome: 'updated', entry }
}

/** Varias filas del lote → una entrada (la que más avanza, con la nota y fecha que haya). */
export function mergeIncoming(items: ImportItem[]): IncomingEntry & { logs: ImportLog[] } {
  let status: LibraryStatus = items[0].status
  let rating10: number | null = null
  let watchedAt: string | null = null
  const logs: ImportLog[] = []
  for (const item of items) {
    status = strongerStatus(status, item.status)
    rating10 = rating10 ?? item.rating10
    if (item.watchedAt && (!watchedAt || item.watchedAt > watchedAt)) watchedAt = item.watchedAt
    logs.push(...(item.logs ?? []))
  }
  return { status, rating10, watchedAt, logs: dedupeLogs(logs) }
}

export interface ProcessOptions {
  supabase: SupabaseClient
  userId: string
  locale: 'es' | 'en'
  deadlineMs?: number
  maxProviderCalls?: number
}

export interface ProcessResult {
  results: ImportItemResult[]
  diaryImported: number
  /** ¿Se escribió algo en la biblioteca o el diario? (para invalidar cachés) */
  wrote: boolean
  providerCalls: number
}

const CHUNK = 100

export async function processImportBatch(items: ImportItem[], opts: ProcessOptions): Promise<ProcessResult> {
  const started = Date.now()
  const budget = new ProviderBudget({
    maxCalls: opts.maxProviderCalls ?? MAX_PROVIDER_CALLS_PER_BATCH,
    deadline: started + (opts.deadlineMs ?? BATCH_DEADLINE_MS),
  })
  const outcome = new Map<string, ImportItemResult>()
  const set = (key: string, o: ImportOutcome, extra: Partial<ImportItemResult> = {}) =>
    outcome.set(key, { key, outcome: o, ...extra })

  // 1. Emparejar.
  const matches = await matchItems(items, { budget, locale: opts.locale })
  const matchedItems: Array<{ item: ImportItem; mediaId: string; by: MatchMethod; prebuilt?: MediaItem }> = []
  for (const item of items) {
    const m = matches.get(item.key) ?? { status: 'pending' as const }
    if (m.status === 'matched') matchedItems.push({ item, mediaId: m.mediaId, by: m.by, prebuilt: m.item })
    else set(item.key, m.status)
  }

  // 2. Fichas del catálogo: las que ya vienen del proveedor se escriben tal
  //    cual (sin volver a pedirlas); el resto las pide `ensureMediaRows`.
  const admin = createAdminClient()
  const available = new Set<string>()
  const prebuiltRows = new Map<string, MediaRowInsert>()
  for (const m of matchedItems) {
    const parsed = m.prebuilt ? parseMediaId(m.mediaId) : null
    if (parsed && m.prebuilt && !prebuiltRows.has(m.mediaId)) prebuiltRows.set(m.mediaId, buildMediaRow(parsed, m.prebuilt))
  }
  if (prebuiltRows.size > 0) {
    const { error } = await admin
      .from('media')
      .upsert(Array.from(prebuiltRows.values()), { onConflict: 'id', ignoreDuplicates: true })
    if (error) log.warn('no se pudieron crear fichas emparejadas', { code: error.code, count: prebuiltRows.size })
    else prebuiltRows.forEach((_, id) => available.add(id))
  }
  const toEnsure = Array.from(new Set(matchedItems.map((m) => m.mediaId).filter((id) => !available.has(id))))
  if (toEnsure.length > 0) {
    try {
      const ensured = await ensureMediaRows(toEnsure, {
        locale: opts.locale,
        concurrency: 4,
        budgetMs: Math.max(0, budget.remainingMs - 1500),
        maxResolve: budget.remainingCalls,
      })
      ensured.available.forEach((id) => available.add(id))
    } catch (err) {
      log.warn('ensureMediaRows falló; las filas quedan pendientes', { err })
    }
  }

  // 3. Agrupar por ficha (dos filas pueden ir al mismo título).
  const groups = new Map<string, Array<{ item: ImportItem; by: MatchMethod }>>()
  for (const m of matchedItems) {
    if (!available.has(m.mediaId)) {
      set(m.item.key, 'pending')
      continue
    }
    const g = groups.get(m.mediaId) ?? []
    g.push({ item: m.item, by: m.by })
    groups.set(m.mediaId, g)
  }
  const mediaIds = Array.from(groups.keys())
  if (mediaIds.length === 0) {
    return { results: items.map((i) => outcome.get(i.key)!), diaryImported: 0, wrote: false, providerCalls: budget.used }
  }

  // 4. Lo que ya hay en la biblioteca.
  const scale10 = ratingScale10Enabled()
  const existing = await readExisting(opts.supabase, opts.userId, mediaIds, scale10)
  const migrated = existing.migrated

  // 5. Escribir lo nuevo y lo que se completa.
  const rows: Array<Record<string, unknown>> = []
  const merged = new Map<string, ReturnType<typeof mergeIncoming>>()
  const plans = new Map<string, LibraryPlan>()
  for (const [mediaId, group] of Array.from(groups.entries())) {
    const incoming = mergeIncoming(group.map((g) => g.item))
    merged.set(mediaId, incoming)
    const plan = planLibraryWrite(existing.rows.get(mediaId), incoming)
    plans.set(mediaId, plan)
    if (!plan.entry) continue
    const row: Record<string, unknown> = {
      user_id: opts.userId,
      media_id: mediaId,
      status: plan.entry.status,
      score: rating10ToScore(plan.entry.rating10),
      watched_at: plan.entry.watchedAt,
    }
    if (scale10 && migrated) row.rating10 = plan.entry.rating10
    rows.push(row)
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await opts.supabase.from('user_media').upsert(rows.slice(i, i + CHUNK), { onConflict: 'user_id,media_id' })
    if (error) throw new Error(`user_media: ${error.code ?? ''} ${error.message}`)
  }

  // 6. Diario (F-24): apuntes que aún no tenga.
  const diaryImported =
    scale10 && migrated
      ? await importLogs(opts.supabase, opts.userId, merged).catch((err) => {
          log.warn('no se pudo importar el diario del lote', { err })
          return 0
        })
      : 0

  // 7. Resultado por fila, con el título del catálogo para revisar el informe.
  const titles = await readTitles(admin, mediaIds)
  for (const [mediaId, group] of Array.from(groups.entries())) {
    const plan = plans.get(mediaId)!
    const t = titles.get(mediaId) ?? fromPrebuilt(matchedItems, mediaId)
    for (const { item, by } of group) {
      set(item.key, plan.outcome, { mediaId, by, ...(t?.title ? { title: t.title } : {}), ...(t?.year ? { year: t.year } : {}) })
    }
  }

  return {
    results: items.map((i) => outcome.get(i.key)!),
    diaryImported,
    wrote: rows.length > 0 || diaryImported > 0,
    providerCalls: budget.used,
  }
}

function fromPrebuilt(
  matched: Array<{ mediaId: string; prebuilt?: MediaItem }>,
  mediaId: string
): { title?: string; year?: number } | undefined {
  const p = matched.find((m) => m.mediaId === mediaId)?.prebuilt
  return p ? { title: p.title, year: p.year } : undefined
}

async function readExisting(
  supabase: SupabaseClient,
  userId: string,
  mediaIds: string[],
  scale10: boolean
): Promise<{ rows: Map<string, ExistingEntry>; migrated: boolean }> {
  let migrated = scale10
  const rows = new Map<string, ExistingEntry>()
  for (let i = 0; i < mediaIds.length; i += CHUNK) {
    const chunk = mediaIds.slice(i, i + CHUNK)
    const select = (fine: boolean) =>
      supabase
        .from('user_media')
        .select(fine ? 'media_id, status, score, rating10, watched_at' : 'media_id, status, score, watched_at')
        .eq('user_id', userId)
        .in('media_id', chunk)
    let { data, error } = await select(migrated)
    if (error && migrated && isNotMigrated(error)) {
      log.warn('RATING_SCALE_10 activa sin la migración 20261208240001; se importa solo score', { code: error.code })
      migrated = false
      ;({ data, error } = await select(false))
    }
    if (error) throw new Error(`user_media: ${error.code ?? ''} ${error.message}`)
    for (const r of (data ?? []) as unknown as Array<{ media_id: string; status: LibraryStatus; score: number | null; rating10?: unknown; watched_at: string | null }>) {
      const fine = typeof r.rating10 === 'string' ? Number(r.rating10) : r.rating10
      rows.set(r.media_id, {
        status: r.status,
        rating10: isValidRating10(fine) ? fine : scoreToRating10(r.score),
        watchedAt: r.watched_at,
      })
    }
  }
  return { rows, migrated }
}

async function importLogs(
  supabase: SupabaseClient,
  userId: string,
  merged: Map<string, { logs: ImportLog[] }>
): Promise<number> {
  const withLogs = Array.from(merged.entries()).filter(([, m]) => m.logs.length > 0)
  if (withLogs.length === 0) return 0

  const seen = new Set<string>()
  const ids = withLogs.map(([id]) => id)
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('user_media_logs')
      .select('media_id, watched_on, rewatch')
      .eq('user_id', userId)
      .in('media_id', ids.slice(i, i + CHUNK))
    if (error) {
      if (isNotMigrated(error)) return 0
      throw new Error(`user_media_logs: ${error.code ?? ''}`)
    }
    for (const l of (data ?? []) as Array<{ media_id: string; watched_on: string; rewatch: boolean }>) {
      seen.add(`${l.media_id}|${l.watched_on}|${l.rewatch ? 1 : 0}`)
    }
  }

  const rows = withLogs.flatMap(([mediaId, m]) =>
    m.logs
      .filter((l) => {
        const key = `${mediaId}|${l.watchedOn}|${l.rewatch ? 1 : 0}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((l) => ({
        user_id: userId,
        media_id: mediaId,
        watched_on: l.watchedOn,
        rewatch: l.rewatch,
        rating10: l.rating10,
        review: l.review,
        spoiler: l.spoiler,
        private_note: null,
      }))
  )
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('user_media_logs').insert(rows.slice(i, i + 500))
    if (error) {
      if (isNotMigrated(error)) return 0
      throw new Error(`user_media_logs: ${error.code ?? ''}`)
    }
  }
  return rows.length
}

async function readTitles(
  admin: SupabaseClient,
  mediaIds: string[]
): Promise<Map<string, { title: string; year?: number }>> {
  const out = new Map<string, { title: string; year?: number }>()
  for (let i = 0; i < mediaIds.length; i += CHUNK) {
    const { data, error } = await admin.from('media').select('id, title, year').in('id', mediaIds.slice(i, i + CHUNK))
    if (error) return out
    for (const r of (data ?? []) as Array<{ id: string; title: string; year: number | null }>) {
      out.set(r.id, { title: r.title, ...(r.year ? { year: r.year } : {}) })
    }
  }
  return out
}
