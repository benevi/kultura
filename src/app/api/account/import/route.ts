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
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { invalidateRecCache } from '@/lib/claude/recommendations'
import { invalidateMatchScoreCache } from '@/lib/recommendations/match-score'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/account/import')

const LIBRARY_STATUSES = ['completed', 'in_progress', 'pending', 'abandoned']

/** Entrada de biblioteca del fichero, ya validada. */
interface ImportableEntry {
  mediaId: string
  type: string
  externalId: string
  status: string
  score: number | null
  watchedAt: string | null
  title: string
  poster: string | null
  year: number | null
}

/**
 * Valida una entrada de biblioteca del fichero. Devuelve `null` si no es
 * utilizable — un fichero a medias no debe tumbar la importación entera.
 *
 * `mediaId` tiene el formato "{type}_{externalId}" (misma convención que el
 * resto de la app), así que de ahí salen el tipo y el id externo que necesita
 * la tabla `media`.
 */
function parseEntry(raw: unknown): ImportableEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Record<string, unknown>

  const mediaId = entry.mediaId
  const status = entry.status
  if (typeof mediaId !== 'string' || !/^[a-z]+_.+$/.test(mediaId)) return null
  if (typeof status !== 'string' || !LIBRARY_STATUSES.includes(status)) return null

  const separator = mediaId.indexOf('_')
  const score = entry.score
  const year = entry.year

  return {
    mediaId,
    type: mediaId.slice(0, separator),
    externalId: mediaId.slice(separator + 1),
    status,
    score: typeof score === 'number' && score >= 1 && score <= 5 ? score : null,
    watchedAt: typeof entry.watchedAt === 'string' ? entry.watchedAt : null,
    title: typeof entry.title === 'string' && entry.title.trim() !== '' ? entry.title : mediaId,
    poster: typeof entry.poster === 'string' ? entry.poster : null,
    year: typeof year === 'number' ? year : null,
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()

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

  const entries = payload.library
    .map(parseEntry)
    .filter((entry): entry is ImportableEntry => entry !== null)

  let libraryImported = 0
  try {
    if (entries.length > 0) {
      // 1. La ficha del título: `user_media.media_id` es FK contra `media`, así
      //    que sin esto la importación fallaría entera en una cuenta nueva.
      //    Los géneros no viajan en el export; los repone el autocurado al
      //    construir el perfil de gustos (lib/library/backfill-genres).
      const { error: mediaError } = await supabase.from('media').upsert(
        entries.map((entry) => ({
          id: entry.mediaId,
          external_id: entry.externalId,
          type: entry.type,
          title: entry.title,
          poster: entry.poster,
          year: entry.year,
        })),
        { onConflict: 'id' }
      )
      if (mediaError) throw new Error(`media: ${mediaError.message}`)

      // 2. La entrada de biblioteca, SIEMPRE para el usuario autenticado.
      const { error: libraryError } = await supabase.from('user_media').upsert(
        entries.map((entry) => ({
          user_id: user.id,
          media_id: entry.mediaId,
          status: entry.status,
          score: entry.score,
          watched_at: entry.watchedAt,
        })),
        { onConflict: 'user_id,media_id' }
      )
      if (libraryError) throw new Error(`user_media: ${libraryError.message}`)

      libraryImported = entries.length
    }
  } catch (err) {
    log.error('Failed to import library', { err, userId: user.id })
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 })
  }

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
    librarySkipped: payload.library.length - entries.length,
    listsImported,
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
  supabase: ReturnType<typeof createClient>
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
