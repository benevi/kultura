// ============================================================
// KULTURA — Route Handler: /api/account/import
// POST: reimporta el JSON que genera /api/account/export.
//
// Existía la exportación pero no la vuelta, así que el fichero que el usuario
// se descarga "para no perder sus datos" no servía para recuperarlos.
//
// Criterios:
//   - IDEMPOTENTE: reimportar el mismo fichero dos veces no duplica nada. La
//     biblioteca va por upsert sobre (user_id, media_id) y las listas se
//     reconocen por nombre.
//   - Los datos se reconstruyen SIEMPRE para el usuario autenticado, nunca para
//     el `profile.id` del fichero: si no, subir el export de otra persona
//     escribiría en su cuenta.
//   - Las amistades NO se importan: una amistad necesita a la otra parte y no
//     puede recrearse unilateralmente desde un fichero. Se informa en la
//     respuesta en vez de ignorarlas en silencio.
//   - El catálogo compartido `media` NUNCA se escribe con el contenido del
//     fichero (SEG-2): editar el JSON renombraba títulos para todos. Las filas
//     que ya existen se usan tal cual y las que faltan se piden al proveedor
//     (lib/media). Lo que no se pueda resolver ahora se omite y se cuenta en
//     `libraryUnresolved`; reimportar el mismo fichero lo completa.
//   - F-24: la nota fina `rating10` (0,5-10) y `favorite` vuelven tal cual con
//     RATING_SCALE_10=1 (sin ella, o sin la migración, se guarda `score`). El
//     diario (`diary`) se reimporta para los títulos que estén en la
//     biblioteca, sin duplicar apuntes (misma fecha, título, revisionado y
//     reseña).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { invalidateRecCache } from '@/lib/claude/recommendations'
import { invalidateMatchScoreCache } from '@/lib/recommendations/match-score'
import { createLogger } from '@/lib/logger'
import { ensureMediaRows } from '@/lib/media/upsert-from-provider'
import { localeFromRequest } from '@/lib/media/request-locale'
import { isValidRating10, rating10ToScore, scoreToRating10 } from '@/lib/library/rating'
import { isNotMigrated, ratingScale10Enabled } from '@/lib/library/scale'
import { isValidDiaryDate, parseLogInput } from '@/lib/library/diary'

const log = createLogger('api/account/import')

const LIBRARY_STATUSES = ['completed', 'in_progress', 'pending', 'abandoned']

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

/**
 * Valida una entrada de biblioteca del fichero. Devuelve `null` si no es
 * utilizable — un fichero a medias no debe tumbar la importación entera.
 *
 * `mediaId` tiene el formato "{type}_{externalId}" (misma convención que el
 * resto de la app). El título, la portada y el año del fichero se ignoran: la
 * ficha la pone el servidor.
 */
function parseEntry(raw: unknown): ImportableEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Record<string, unknown>

  const mediaId = entry.mediaId
  const status = entry.status
  if (typeof mediaId !== 'string' || !/^[a-z]+_.+$/.test(mediaId)) return null
  if (typeof status !== 'string' || !LIBRARY_STATUSES.includes(status)) return null

  const score = entry.score
  const legacyScore = typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5 ? score : null
  // La nota fina manda si viene y es válida (exports con F-24); si no, la vieja.
  const rating10 = isValidRating10(entry.rating10) ? entry.rating10 : scoreToRating10(legacyScore)

  return {
    mediaId,
    status,
    score: rating10 === null ? null : rating10ToScore(rating10),
    rating10,
    favorite: typeof entry.favorite === 'boolean' ? entry.favorite : undefined,
    watchedAt: typeof entry.watchedAt === 'string' ? entry.watchedAt : null,
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:account_import`, LIMITS.account_import)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const payload = body as Record<string, unknown>

  // Un export de Kultura siempre trae `library` (aunque esté vacía). Sin eso, el
  // fichero no es nuestro y es mejor decirlo que importar cero cosas en silencio.
  if (!Array.isArray(payload.library)) {
    return NextResponse.json(
      { error: 'Not a Kultura export file: missing "library"' },
      { status: 400 }
    )
  }

  const valid = payload.library
    .map(parseEntry)
    .filter((entry): entry is ImportableEntry => entry !== null)
  // Una misma entrada repetida en el fichero se queda con la última: Postgres
  // rechaza un upsert que toca dos veces la misma fila en una sola sentencia.
  const entries = Array.from(new Map(valid.map((entry) => [entry.mediaId, entry])).values())

  let libraryImported = 0
  let libraryUnresolved = 0
  const scale10 = ratingScale10Enabled()
  let migrated = scale10
  try {
    if (entries.length > 0) {
      // 1. La ficha del título: `user_media.media_id` es FK contra `media`, así
      //    que solo se importan las entradas cuyo título ya está en el catálogo
      //    o ha podido pedirse ahora al proveedor. Las filas existentes no se
      //    tocan; los géneros que les falten los repone el autocurado del perfil
      //    de gustos (lib/library/backfill-genres).
      const { available, unresolved } = await ensureMediaRows(
        entries.map((entry) => entry.mediaId),
        { locale: localeFromRequest(request) }
      )
      libraryUnresolved = unresolved.length
      const importable = entries.filter((entry) => available.has(entry.mediaId))

      // 2. La entrada de biblioteca, SIEMPRE para el usuario autenticado.
      if (importable.length > 0) {
        const legacyRows = importable.map((entry) => ({
          user_id: user.id,
          media_id: entry.mediaId,
          status: entry.status,
          score: entry.score,
          watched_at: entry.watchedAt,
        }))
        let libraryError: { code?: string; message: string } | null = null
        if (scale10) {
          // Un upsert de varias filas necesita las mismas columnas en todas:
          // `favorite` solo si el fichero lo trae en alguna (si no, no se toca).
          const withFavorite = importable.some((entry) => entry.favorite !== undefined)
          ;({ error: libraryError } = await supabase.from('user_media').upsert(
            importable.map((entry, i) => ({
              ...legacyRows[i],
              rating10: entry.rating10,
              ...(withFavorite ? { favorite: entry.favorite ?? false } : {}),
            })),
            { onConflict: 'user_id,media_id' }
          ))
          if (libraryError && isNotMigrated(libraryError)) {
            log.warn('RATING_SCALE_10 activa sin la migración 20261208240001; se importa solo score', {
              code: libraryError.code,
            })
            migrated = false
            libraryError = null
            ;({ error: libraryError } = await supabase
              .from('user_media')
              .upsert(legacyRows, { onConflict: 'user_id,media_id' }))
          }
        } else {
          ;({ error: libraryError } = await supabase
            .from('user_media')
            .upsert(legacyRows, { onConflict: 'user_id,media_id' }))
        }
        if (libraryError) throw new Error(`user_media: ${libraryError.message}`)
      }

      libraryImported = importable.length
    }
  } catch (err) {
    log.error('Failed to import library', { err, userId: user.id })
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 })
  }

  const diaryImported =
    scale10 && migrated
      ? await importDiary(payload.diary, user.id, supabase).catch((err) => {
          // Como las listas: secundario, no invalida la biblioteca importada.
          log.error('Failed to import diary', { err, userId: user.id })
          return 0
        })
      : 0

  const listsImported = await importLists(payload.lists, user.id, supabase).catch((err) => {
    // Las listas son secundarias: que fallen no debe invalidar una biblioteca
    // ya importada correctamente.
    log.error('Failed to import lists', { err, userId: user.id })
    return 0
  })

  // El perfil de gustos y las recomendaciones se calculan sobre la biblioteca:
  // tras repoblarla, lo cacheado ya no vale.
  invalidateMatchScoreCache(user.id)
  invalidateRecCache(user.id)

  return NextResponse.json({
    libraryImported,
    librarySkipped: payload.library.length - valid.length,
    // Títulos válidos cuyo proveedor no respondió (o fuera del tope por
    // petición): reimportar el mismo fichero los completa.
    libraryUnresolved,
    listsImported,
    diaryImported,
    // Explícito, no silencioso: el usuario debe saber que esto no vuelve solo.
    friendshipsImported: 0,
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
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  if (!Array.isArray(raw)) return 0

  const { data: existingRaw } = await supabase
    .from('lists')
    .select('id, name')
    .eq('owner_id', userId)
  const existing = new Map(
    ((existingRaw ?? []) as Array<{ id: string; name: string }>).map((l) => [l.name, l.id])
  )

  let imported = 0
  for (const candidate of raw) {
    if (typeof candidate !== 'object' || candidate === null) continue
    const list = candidate as Record<string, unknown>
    const name = list.name
    if (typeof name !== 'string' || name.trim() === '') continue

    let listId = existing.get(name)
    if (!listId) {
      const { data: created, error } = await supabase
        .from('lists')
        .insert({
          owner_id: userId,
          name,
          media_type: typeof list.mediaType === 'string' ? list.mediaType : null,
          is_collaborative: list.isCollaborative === true,
        })
        .select('id')
        .single()
      if (error || !created) continue
      listId = (created as { id: string }).id
      existing.set(name, listId)
      imported++
    }

    const items = Array.isArray(list.items)
      ? list.items.filter((id): id is string => typeof id === 'string')
      : []
    if (items.length === 0) continue

    // Solo los títulos que existan ya en `media` (los que venían en la
    // biblioteca importada): insertar una FK inexistente fallaría.
    const { data: knownRaw } = await supabase.from('media').select('id').in('id', items)
    const known = new Set(((knownRaw ?? []) as Array<{ id: string }>).map((m) => m.id))

    const { data: alreadyRaw } = await supabase
      .from('list_items')
      .select('media_id')
      .eq('list_id', listId)
    const already = new Set(
      ((alreadyRaw ?? []) as Array<{ media_id: string }>).map((i) => i.media_id)
    )

    const toInsert = items
      .filter((mediaId) => known.has(mediaId) && !already.has(mediaId))
      .map((mediaId) => ({ list_id: listId, media_id: mediaId, added_by: userId }))

    if (toInsert.length > 0) await supabase.from('list_items').insert(toInsert)
  }

  return imported
}

/** Clave de un apunte para no duplicarlo al reimportar. */
const logKey = (l: { media_id: string; watched_on: string; rewatch: boolean; review: string | null }) =>
  [l.media_id, l.watched_on, l.rewatch ? 1 : 0, l.review ?? ''].join('\u0000')

const DIARY_IMPORT_MAX = 5000
const DIARY_CHUNK = 500

/**
 * Reimporta el diario (F-24) del fichero: solo apuntes de títulos que estén
 * en la biblioteca del usuario (FK compuesta) y sin repetir los que ya tiene.
 */
async function importDiary(
  raw: unknown,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  if (!Array.isArray(raw) || raw.length === 0) return 0

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
    if (typeof candidate !== 'object' || candidate === null) continue
    const item = candidate as Record<string, unknown>
    if (typeof item.mediaId !== 'string' || !/^[a-z]+_.+$/.test(item.mediaId)) continue
    if (!isValidDiaryDate(item.watchedOn)) continue
    const parsed = parseLogInput({
      watchedOn: item.watchedOn,
      rewatch: item.rewatch === true,
      rating10: isValidRating10(item.rating10) ? item.rating10 : null,
      review: typeof item.review === 'string' ? item.review : undefined,
      spoiler: item.spoiler === true,
      privateNote: typeof item.privateNote === 'string' ? item.privateNote : undefined,
    })
    if (!parsed.ok) continue
    rows.push({
      user_id: userId,
      media_id: item.mediaId,
      watched_on: item.watchedOn,
      rewatch: parsed.log.rewatch,
      rating10: parsed.log.rating10 ?? null,
      review: parsed.log.review,
      spoiler: parsed.log.spoiler,
      private_note: parsed.log.privateNote,
    })
  }
  if (rows.length === 0) return 0

  const mediaIds = Array.from(new Set(rows.map((r) => r.media_id)))
  const inLibrary = new Set<string>()
  for (let i = 0; i < mediaIds.length; i += 100) {
    const { data: inLibraryRaw, error: libError } = await supabase
      .from('user_media')
      .select('media_id')
      .eq('user_id', userId)
      .in('media_id', mediaIds.slice(i, i + 100))
    if (libError) throw new Error(`user_media: ${libError.message}`)
    for (const r of (inLibraryRaw ?? []) as Array<{ media_id: string }>) inLibrary.add(r.media_id)
  }

  const { data: existingRaw, error: existingError } = await supabase
    .from('user_media_logs')
    .select('media_id, watched_on, rewatch, review')
    .eq('user_id', userId)
  if (existingError) {
    if (isNotMigrated(existingError)) return 0
    throw new Error(`user_media_logs: ${existingError.message}`)
  }
  const seen = new Set(
    ((existingRaw ?? []) as Array<{ media_id: string; watched_on: string; rewatch: boolean; review: string | null }>).map(logKey)
  )

  const toInsert = rows.filter((r) => {
    if (!inLibrary.has(r.media_id)) return false
    const key = logKey(r)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  for (let i = 0; i < toInsert.length; i += DIARY_CHUNK) {
    const { error } = await supabase.from('user_media_logs').insert(toInsert.slice(i, i + DIARY_CHUNK))
    if (error) throw new Error(`user_media_logs: ${error.message}`)
  }
  return toInsert.length
}
