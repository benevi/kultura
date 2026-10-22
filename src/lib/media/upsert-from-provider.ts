// ============================================================
// KULTURA — Escritura del catálogo compartido `media` (SEG-2)
//
// `media` es de todos: una fila (`movie_550`) la ven todas las bibliotecas,
// listas públicas y recomendaciones. Por eso:
//   - La escribe SOLO el servidor, con el cliente admin. La migración
//     `20261023030001_media_server_only.sql` retira INSERT/UPDATE a `anon` y
//     `authenticated`; este módulo ya funciona igual antes y después de
//     aplicarla.
//   - La ficha sale del PROVEEDOR (`resolveMediaItem`), nunca de lo que mande
//     el navegador (`mediaCache` se ignora).
//   - Una fila que ya existe NO se reescribe (`ignoreDuplicates`). Única
//     excepción: si le faltan los géneros se rellena `metadata.genres` —y solo
//     eso— desde el proveedor, porque el match score depende de ellos (ver
//     `lib/library/backfill-genres.ts`).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaItem } from '@/types/media'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_API_LOCALE } from '@/lib/api/locale'
import { fetchGenresForMedia, needsGenreBackfill } from '@/lib/library/backfill-genres'
import { createLogger } from '@/lib/logger'
import { parseMediaId, type ParsedMediaId } from './media-id'
import { resolveMediaItem } from './resolve-item'

const log = createLogger('media/upsert-from-provider')

/** Por qué no se pudo garantizar la fila. */
export type MediaWriteFailure = 'invalid_id' | 'unavailable' | 'db_error'

export type EnsureMediaResult =
  | { ok: true; id: string; title: string; created: boolean }
  | { ok: false; id: string; reason: MediaWriteFailure }

interface ExistingMediaRow {
  id: string
  type: string
  external_id: string
  title: string
  metadata: Record<string, unknown> | null
}

/** Columnas de `media` (DDL en `20260502233945_remote_schema.sql`). */
export interface MediaRowInsert {
  id: string
  external_id: string
  type: string
  title: string
  poster: string | null
  backdrop: string | null
  year: number | null
  synopsis: string | null
  metadata: { genres: string[]; genresSyncedAt: string }
}

/** Fila de `media` a partir de la ficha del proveedor (el id manda el de la petición). */
export function buildMediaRow(parsed: ParsedMediaId, item: MediaItem): MediaRowInsert {
  return {
    id: parsed.id,
    external_id: parsed.externalId,
    type: parsed.type,
    title: item.title.trim().slice(0, 500),
    poster: item.poster ?? null,
    backdrop: item.backdrop ?? null,
    year: Number.isInteger(item.year) ? (item.year as number) : null,
    synopsis: item.synopsis ?? null,
    metadata: {
      genres: Array.isArray(item.genres) ? item.genres.filter((g) => typeof g === 'string') : [],
      // Marca de "ya se preguntó al proveedor": evita reintentar los títulos
      // que no tienen género (cómics) en cada carga del perfil de gustos.
      genresSyncedAt: new Date().toISOString(),
    },
  }
}

/**
 * Rellena `metadata.genres` de una fila existente que no los tiene. Solo toca
 * `metadata` (conserva el resto de claves). Nunca lanza: si falla, el perfil
 * de gustos lo reintenta más tarde.
 */
async function fillMissingGenres(
  admin: SupabaseClient,
  row: ExistingMediaRow,
  locale: string
): Promise<void> {
  if (!needsGenreBackfill(row.metadata)) return
  const genres = await fetchGenresForMedia(row.type, row.external_id, locale)
  if (genres === null) return
  const metadata = { ...(row.metadata ?? {}), genres, genresSyncedAt: new Date().toISOString() }
  const { error } = await admin.from('media').update({ metadata }).eq('id', row.id)
  if (error) log.warn('no se pudieron guardar los géneros', { id: row.id, error })
}

/**
 * Garantiza que `media` tiene la fila de `mediaId` antes de escribir algo que
 * la referencie (`user_media`, `list_items`, `recommendations`: todas con FK).
 */
export async function upsertMediaFromProvider(
  mediaId: string,
  options: { locale?: string | null } = {}
): Promise<EnsureMediaResult> {
  const locale = options.locale ?? DEFAULT_API_LOCALE
  const admin = createAdminClient()

  const { data: existing, error: readError } = await admin
    .from('media')
    .select('id, type, external_id, title, metadata')
    .eq('id', mediaId)
    .maybeSingle()
  if (readError) {
    log.error('no se pudo leer media', { mediaId, error: readError })
    return { ok: false, id: mediaId, reason: 'db_error' }
  }

  // Una fila ya existente se usa tal cual, aunque su id sea de una forma
  // antigua que hoy no se aceptaría para crearla.
  if (existing) {
    const row = existing as ExistingMediaRow
    await fillMissingGenres(admin, row, locale)
    return { ok: true, id: mediaId, title: row.title, created: false }
  }

  const parsed = parseMediaId(mediaId)
  if (!parsed) return { ok: false, id: mediaId, reason: 'invalid_id' }

  const item = await resolveMediaItem(parsed, locale)
  if (!item) return { ok: false, id: mediaId, reason: 'unavailable' }

  const row = buildMediaRow(parsed, item)
  const { error: writeError } = await admin
    .from('media')
    .upsert(row, { onConflict: 'id', ignoreDuplicates: true })
  if (writeError) {
    log.error('no se pudo crear la fila de media', { mediaId, error: writeError })
    return { ok: false, id: mediaId, reason: 'db_error' }
  }
  return { ok: true, id: mediaId, title: row.title, created: true }
}

/** Respuesta HTTP para un `EnsureMediaResult` fallido (mismo criterio en todas las rutas). */
export function mediaFailureStatus(reason: MediaWriteFailure): { status: number; error: string } {
  switch (reason) {
    case 'invalid_id':
      return { status: 400, error: 'Unknown media id' }
    case 'unavailable':
      // El proveedor no respondió: reintentable, no es culpa del cliente.
      return { status: 502, error: 'Media provider unavailable' }
    default:
      return { status: 500, error: 'Failed to cache media' }
  }
}

const READ_CHUNK = 100

export interface EnsureManyOptions {
  locale?: string | null
  /** Peticiones simultáneas a proveedores (Jikan admite ~3/s). */
  concurrency?: number
  /** Tiempo máximo para resolver títulos nuevos; lo que no entre queda pendiente. */
  budgetMs?: number
  /** Máximo de títulos nuevos resueltos por llamada (cupos de RAWG y ComicVine). */
  maxResolve?: number
}

export interface EnsureManyResult {
  /** Ids con fila en `media` (ya existían o se han creado ahora). */
  available: Set<string>
  /** Ids que no se pudieron garantizar (forma inválida, proveedor caído o fuera de presupuesto). */
  unresolved: string[]
}

/**
 * Versión por lotes para la importación. Las filas que ya existen no se tocan
 * (los géneros que falten los repone el perfil de gustos); las nuevas se piden
 * al proveedor con concurrencia y tiempo acotados. Reimportar el mismo fichero
 * completa lo que quedó pendiente, porque todo es idempotente.
 */
export async function ensureMediaRows(
  mediaIds: string[],
  options: EnsureManyOptions = {}
): Promise<EnsureManyResult> {
  const locale = options.locale ?? DEFAULT_API_LOCALE
  const concurrency = Math.max(1, options.concurrency ?? 4)
  const deadline = Date.now() + (options.budgetMs ?? 7000)
  const maxResolve = options.maxResolve ?? 150

  const ids = Array.from(new Set(mediaIds))
  const available = new Set<string>()
  const unresolved: string[] = []
  if (ids.length === 0) return { available, unresolved }

  const admin = createAdminClient()

  for (let i = 0; i < ids.length; i += READ_CHUNK) {
    const chunk = ids.slice(i, i + READ_CHUNK)
    const { data, error } = await admin.from('media').select('id').in('id', chunk)
    if (error) throw new Error(`media: ${error.message}`)
    for (const row of (data ?? []) as Array<{ id: string }>) available.add(row.id)
  }

  const toResolve: ParsedMediaId[] = []
  for (const id of ids) {
    if (available.has(id)) continue
    const parsed = parseMediaId(id)
    if (parsed && toResolve.length < maxResolve) toResolve.push(parsed)
    else unresolved.push(id)
  }

  const rows: MediaRowInsert[] = []
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < toResolve.length) {
      const parsed = toResolve[cursor++]
      if (Date.now() > deadline) {
        unresolved.push(parsed.id)
        continue
      }
      const item = await resolveMediaItem(parsed, locale)
      if (item) rows.push(buildMediaRow(parsed, item))
      else unresolved.push(parsed.id)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, toResolve.length) }, worker))

  if (rows.length > 0) {
    const { error } = await admin
      .from('media')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error(`media: ${error.message}`)
    for (const row of rows) available.add(row.id)
  }

  return { available, unresolved }
}
