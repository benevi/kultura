// ============================================================
// KULTURA — Reimportar el JSON de /api/account/export (saneamiento 6.3)
//
// Criterios:
//   - IDEMPOTENTE: reimportar el mismo fichero dos veces no duplica nada. La
//     biblioteca va por upsert sobre (user_id, media_id) y las listas se
//     reconocen por nombre.
//   - Los datos se reconstruyen SIEMPRE para el usuario autenticado, nunca para
//     el `profile.id` del fichero: si no, subir el export de otra persona
//     escribiría en su cuenta.
//   - Las amistades NO se importan: una amistad necesita a la otra parte. Se
//     informa en la respuesta en vez de ignorarlas en silencio.
//   - El catálogo compartido `media` NUNCA se escribe con el contenido del
//     fichero (SEG-2). Las filas que ya existen se usan tal cual y las que
//     faltan se piden al proveedor (lib/media). Lo que no se pueda resolver
//     ahora se omite y se cuenta en `libraryUnresolved`; reimportar lo completa.
//   - F-24: la nota fina `rating10` (0,5-10) y `favorite` vuelven tal cual con
//     RATING_SCALE_10=1 (sin ella se guarda `score`). El diario se reimporta
//     para los títulos que estén en la biblioteca, sin duplicar apuntes.
//   - Saneamiento 1.4: todo se escribe por lotes de 200 y se comprueba el
//     error de cada lote. Lo que no entra se cuenta (`libraryFailed`,
//     `listItemsFailed`, `diaryFailed`); un lote que falla no tumba los demás.
// ============================================================

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { failure, success, type ServiceResult } from '@/lib/api/result'
import {
  kulturaDiaryEntrySchema,
  kulturaLibraryEntrySchema,
  kulturaListSchema,
  type kulturaImportResultSchema,
  type kulturaImportSchema,
} from '@/lib/api/contracts/account'
import { invalidateRecCache } from '@/lib/claude/recommendations'
import { invalidateMatchScoreCache } from '@/lib/recommendations/match-score'
import { ensureMediaRows } from '@/lib/media/upsert-from-provider'
import type { ApiLocale } from '@/lib/api/locale'
import { isValidRating10, rating10ToScore, scoreToRating10 } from '@/lib/library/rating'
import { ratingScale10Enabled } from '@/lib/library/scale'
import { parseLogInput } from '@/lib/library/diary'

const log = createLogger('account/import')

export type KulturaImportFile = z.output<typeof kulturaImportSchema>
export type KulturaImportResult = z.infer<typeof kulturaImportResultSchema>

/** Filas por sentencia (upsert/insert) y por filtro `.in()`. */
const CHUNK = 200
/** Cuántos ids de títulos no importados se devuelven (el total va aparte). */
const MAX_FAILED_IDS = 200

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Entrada de biblioteca del fichero, ya validada. */
interface ImportableEntry {
  mediaId: string
  status: string
  score: number | null
  /** F-24: nota fina; sin ella en el fichero, score × 2. */
  rating10: number | null
  favorite: boolean | undefined
  watchedAt: string | null
}

/** Una entrada de biblioteca, o `null` si no se puede usar (no tumba el fichero). */
function parseEntry(raw: unknown): ImportableEntry | null {
  const parsed = kulturaLibraryEntrySchema.safeParse(raw)
  if (!parsed.success) return null
  const entry = parsed.data
  // La nota fina manda si viene y es válida (exports con F-24); si no, la vieja.
  const rating10 = isValidRating10(entry.rating10) ? entry.rating10 : scoreToRating10(entry.score ?? null)
  return {
    mediaId: entry.mediaId,
    status: entry.status,
    score: rating10 === null ? null : rating10ToScore(rating10),
    rating10,
    favorite: entry.favorite,
    watchedAt: entry.watchedAt ?? null,
  }
}

export async function importKulturaExport(
  supabase: SupabaseClient,
  userId: string,
  file: KulturaImportFile,
  opts: { locale: ApiLocale }
): Promise<ServiceResult<KulturaImportResult>> {
  const valid = file.library.map(parseEntry).filter((entry): entry is ImportableEntry => entry !== null)
  // Una misma entrada repetida se queda con la última: Postgres rechaza un
  // upsert que toca dos veces la misma fila en una sola sentencia.
  const entries = Array.from(new Map(valid.map((entry) => [entry.mediaId, entry])).values())

  let libraryImported = 0
  let libraryUnresolved = 0
  const libraryFailedIds: string[] = []
  const scale10 = ratingScale10Enabled()
  try {
    if (entries.length > 0) {
      // 1. La ficha: `user_media.media_id` es FK contra `media`, así que solo
      //    entran los títulos que ya están en el catálogo o se han podido pedir
      //    ahora al proveedor. Las filas existentes no se tocan.
      const { available, unresolved } = await ensureMediaRows(
        entries.map((entry) => entry.mediaId),
        { locale: opts.locale }
      )
      libraryUnresolved = unresolved.length
      const importable = entries.filter((entry) => available.has(entry.mediaId))

      // 2. La entrada de biblioteca, SIEMPRE para el usuario autenticado. Un
      //    upsert de varias filas necesita las mismas columnas en todas:
      //    `favorite` solo si el fichero lo trae en alguna.
      const withFavorite = scale10 && importable.some((entry) => entry.favorite !== undefined)
      const toRow = (entry: ImportableEntry) => ({
        user_id: userId,
        media_id: entry.mediaId,
        status: entry.status,
        score: entry.score,
        watched_at: entry.watchedAt,
        ...(scale10 ? { rating10: entry.rating10 } : {}),
        ...(withFavorite ? { favorite: entry.favorite ?? false } : {}),
      })
      for (const batch of chunks(importable)) {
        const { error } = await supabase
          .from('user_media')
          .upsert(batch.map(toRow), { onConflict: 'user_id,media_id' })
        if (error) {
          log.error('Failed to import library batch', { err: error, userId, size: batch.length })
          libraryFailedIds.push(...batch.map((entry) => entry.mediaId))
        } else {
          libraryImported += batch.length
        }
      }
      // Nada entró y había qué importar: es un fallo, no un «0 importados».
      if (importable.length > 0 && libraryImported === 0) {
        throw new Error('user_media: every batch failed')
      }
    }
  } catch (err) {
    log.error('Failed to import library', { err, userId })
    return failure('internal', { message: 'Failed to import data' })
  }

  const diary = scale10
    ? await importDiary(file.diary, userId, supabase).catch((err) => {
        // Secundario: no invalida la biblioteca importada.
        log.error('Failed to import diary', { err, userId })
        return { imported: 0, failed: 0, errored: true }
      })
    : { imported: 0, failed: 0, errored: false }

  const lists = await importLists(file.lists, userId, supabase).catch((err) => {
    log.error('Failed to import lists', { err, userId })
    return { imported: 0, itemsFailed: 0, errored: true }
  })

  // El perfil de gustos y las recomendaciones salen de la biblioteca.
  invalidateMatchScoreCache(userId)
  invalidateRecCache(userId)

  const sectionsFailed: Array<'lists' | 'diary'> = [
    ...(lists.errored ? (['lists'] as const) : []),
    ...(diary.errored ? (['diary'] as const) : []),
  ]
  return success({
    libraryImported,
    librarySkipped: file.library.length - valid.length,
    libraryUnresolved,
    libraryFailed: libraryFailedIds.length,
    libraryFailedIds: libraryFailedIds.slice(0, MAX_FAILED_IDS),
    listsImported: lists.imported,
    listItemsFailed: lists.itemsFailed,
    diaryImported: diary.imported,
    diaryFailed: diary.failed,
    ...(sectionsFailed.length > 0 ? { sectionsFailed } : {}),
    friendshipsImported: 0 as const,
  })
}

/**
 * Recrea las listas PROPIAS del fichero con su contenido. Se identifican por
 * nombre para que reimportar no duplique; los ids originales no se reutilizan
 * porque pueden chocar con los de otra cuenta.
 */
async function importLists(
  raw: unknown,
  userId: string,
  supabase: SupabaseClient
): Promise<{ imported: number; itemsFailed: number; errored: boolean }> {
  if (!Array.isArray(raw)) return { imported: 0, itemsFailed: 0, errored: false }

  const { data: existingRaw, error: existingError } = await supabase
    .from('lists')
    .select('id, name')
    .eq('owner_id', userId)
  // Sin saber cuáles existen, crearlas duplicaría: mejor no tocar nada.
  if (existingError) throw new Error(`lists: ${existingError.message}`)
  const existing = new Map(
    ((existingRaw ?? []) as Array<{ id: string; name: string }>).map((l) => [l.name, l.id])
  )

  let imported = 0
  let itemsFailed = 0
  for (const candidate of raw) {
    const parsed = kulturaListSchema.safeParse(candidate)
    if (!parsed.success) continue
    const list = parsed.data
    const name = list.name

    let listId = existing.get(name)
    if (!listId) {
      // `media_type` es NOT NULL: sin tipo va como lista mixta. Si el CHECK
      // la rechaza, se salta como cualquier fallo.
      const mediaType = list.mediaType ? list.mediaType : 'mixed'
      const { data: created, error } = await supabase
        .from('lists')
        .insert({
          owner_id: userId,
          name,
          media_type: mediaType,
          is_collaborative: list.isCollaborative === true,
        })
        .select('id')
        .single()
      if (error || !created) continue
      listId = (created as { id: string }).id
      existing.set(name, listId)
      imported++
    }

    const items = (list.items ?? []).filter((id): id is string => typeof id === 'string')
    if (items.length === 0) continue

    // Solo los títulos que ya existan en `media` (insertar una FK inexistente
    // fallaría). Por lotes: un `.in()` con miles de ids no cabe en la URL.
    const known = new Set<string>()
    let lookupFailed = false
    for (const batch of chunks(items)) {
      const { data: knownRaw, error } = await supabase.from('media').select('id').in('id', batch)
      if (error) { lookupFailed = true; break }
      for (const m of (knownRaw ?? []) as Array<{ id: string }>) known.add(m.id)
    }

    const { data: alreadyRaw, error: alreadyError } = await supabase
      .from('list_items')
      .select('media_id')
      .eq('list_id', listId)
    if (lookupFailed || alreadyError) {
      log.error('Failed to read list items for import', { listId, err: alreadyError })
      itemsFailed += items.length
      continue
    }
    const already = new Set(((alreadyRaw ?? []) as Array<{ media_id: string }>).map((i) => i.media_id))

    const toInsert = Array.from(new Set(items))
      .filter((mediaId) => known.has(mediaId) && !already.has(mediaId))
      .map((mediaId) => ({ list_id: listId, media_id: mediaId, added_by: userId }))

    for (const batch of chunks(toInsert)) {
      const { error } = await supabase.from('list_items').insert(batch)
      if (error) {
        log.error('Failed to import list items batch', { listId, err: error, size: batch.length })
        itemsFailed += batch.length
      }
    }
  }

  return { imported, itemsFailed, errored: false }
}

/** Clave de un apunte para no duplicarlo al reimportar. */
const logKey = (l: { media_id: string; watched_on: string; rewatch: boolean; review: string | null }) =>
  [l.media_id, l.watched_on, l.rewatch ? 1 : 0, l.review ?? ''].join('\u0000')

const DIARY_IMPORT_MAX = 5000
const EXISTING_PAGE = 1000
/** Techo de seguridad: 50.000 apuntes leídos para deduplicar. */
const EXISTING_MAX_PAGES = 50

/**
 * Reimporta el diario (F-24): solo apuntes de títulos que estén en la
 * biblioteca del usuario (FK compuesta) y sin repetir los que ya tiene.
 */
async function importDiary(
  raw: unknown,
  userId: string,
  supabase: SupabaseClient
): Promise<{ imported: number; failed: number; errored: boolean }> {
  const none = { imported: 0, failed: 0, errored: false }
  if (!Array.isArray(raw) || raw.length === 0) return none

  const rows: Array<{
    user_id: string
    media_id: string
    watched_on: string
    rewatch: boolean
    rating10: number | null
    review: string | null
    spoiler: boolean
    private_note: string | null
  }> = []
  for (const candidate of raw.slice(0, DIARY_IMPORT_MAX)) {
    const item = kulturaDiaryEntrySchema.safeParse(candidate)
    if (!item.success) continue
    const entry = item.data
    const parsed = parseLogInput({
      watchedOn: entry.watchedOn,
      rewatch: entry.rewatch === true,
      rating10: isValidRating10(entry.rating10) ? entry.rating10 : null,
      review: entry.review,
      spoiler: entry.spoiler === true,
      privateNote: entry.privateNote,
    })
    if (!parsed.ok) continue
    rows.push({
      user_id: userId,
      media_id: entry.mediaId,
      watched_on: entry.watchedOn,
      rewatch: parsed.log.rewatch,
      rating10: parsed.log.rating10 ?? null,
      review: parsed.log.review,
      spoiler: parsed.log.spoiler,
      private_note: parsed.log.privateNote,
    })
  }
  if (rows.length === 0) return none

  const mediaIds = Array.from(new Set(rows.map((r) => r.media_id)))
  const inLibrary = new Set<string>()
  for (const batch of chunks(mediaIds)) {
    const { data: inLibraryRaw, error: libError } = await supabase
      .from('user_media')
      .select('media_id')
      .eq('user_id', userId)
      .in('media_id', batch)
    if (libError) throw new Error(`user_media: ${libError.message}`)
    for (const r of (inLibraryRaw ?? []) as Array<{ media_id: string }>) inLibrary.add(r.media_id)
  }

  // Apuntes que ya tiene, TODOS: PostgREST corta en 1.000 filas por petición
  // y sin paginar, a partir del apunte 1.001 se duplicaría al reimportar.
  const seen = new Set<string>()
  for (let page = 0; page < EXISTING_MAX_PAGES; page++) {
    const from = page * EXISTING_PAGE
    const { data: existingRaw, error: existingError } = await supabase
      .from('user_media_logs')
      .select('id, media_id, watched_on, rewatch, review')
      .eq('user_id', userId)
      .order('id')
      .range(from, from + EXISTING_PAGE - 1)
    if (existingError) throw new Error(`user_media_logs: ${existingError.message}`)
    const batch = (existingRaw ?? []) as Array<{ media_id: string; watched_on: string; rewatch: boolean; review: string | null }>
    for (const l of batch) seen.add(logKey(l))
    if (batch.length < EXISTING_PAGE) break
  }

  const toInsert = rows.filter((r) => {
    if (!inLibrary.has(r.media_id)) return false
    const key = logKey(r)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let imported = 0
  let failed = 0
  for (const batch of chunks(toInsert)) {
    const { error } = await supabase.from('user_media_logs').insert(batch)
    if (error) {
      log.error('Failed to import diary batch', { err: error, userId, size: batch.length })
      failed += batch.length
    } else {
      imported += batch.length
    }
  }
  return { imported, failed, errored: false }
}
