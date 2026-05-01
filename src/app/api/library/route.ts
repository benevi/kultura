// ============================================================
// KULTURA — Route Handler: /api/library
// Gestiona la biblioteca personal del usuario autenticado.
// POST: upsert de una entrada (status, score, progress)
// DELETE: eliminar una entrada
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { invalidateRecCache } from '@/lib/claude/recommendations'
import type { DbUserMedia } from '@/types/supabase'
import type { LibraryEntry, LibraryPayload, LibraryStatus } from '@/types/library'
import { isLibraryStatus } from '@/types/library'

/** Mapea una fila de user_media a LibraryEntry */
function mapEntry(row: DbUserMedia): LibraryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    mediaId: row.media_id,
    status: row.status as LibraryStatus,
    score: row.score,
    watchedAt: row.watched_at,
    episodeProgress: row.episode_progress,
    createdAt: row.created_at,
  }
}

/** POST /api/library — upsert en user_media */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  // 1. Autenticar
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // 1b. Rate limiting — 30 req/min por usuario
  const rl = checkRateLimit(`${user.id}:library`, LIMITS.library)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  // 2. Validar body
  let body: LibraryPayload
  try {
    body = await request.json() as LibraryPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.mediaId) {
    return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
  }

  // Validar formato "{type}_{externalId}" — evita datos corruptos en FK
  if (!/^[a-z]+_.+$/.test(body.mediaId)) {
    return NextResponse.json(
      { error: 'mediaId must follow the format "{type}_{externalId}"' },
      { status: 400 }
    )
  }

  if (!body.status || !isLibraryStatus(body.status)) {
    return NextResponse.json(
      { error: 'status must be one of: completed, in_progress, pending, abandoned' },
      { status: 400 }
    )
  }

  // 3. Si viene mediaCache, upsert en tabla media (insert if not exists)
  if (body.mediaCache) {
    const { error: mediaError } = await supabase.from('media').upsert(
      {
        id: body.mediaId,
        external_id: body.mediaCache.externalId,
        type: body.mediaCache.type,
        title: body.mediaCache.title,
        poster: body.mediaCache.poster ?? null,
        backdrop: body.mediaCache.backdrop ?? null,
        year: body.mediaCache.year ?? null,
        synopsis: body.mediaCache.synopsis ?? null,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )

    if (mediaError) {
      return NextResponse.json({ error: 'Failed to cache media' }, { status: 500 })
    }
  }

  // 4. Upsert en user_media
  const { data, error: upsertError } = await supabase
    .from('user_media')
    .upsert(
      {
        user_id: user.id,
        media_id: body.mediaId,
        status: body.status,
        score: body.score ?? null,
        watched_at: body.watchedAt ?? null,
        episode_progress: body.episodeProgress ?? null,
      },
      { onConflict: 'user_id,media_id' }
    )
    .select()
    .single()

  if (upsertError || !data) {
    return NextResponse.json({ error: 'Failed to save library entry' }, { status: 500 })
  }

  // 5. Invalidar cache de recomendaciones — biblioteca cambió
  invalidateRecCache(user.id)

  const entry = mapEntry(data as DbUserMedia)
  return NextResponse.json({ entry })
}

/** DELETE /api/library — eliminar entrada de user_media */
export async function DELETE(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  // 1. Autenticar
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // 2. Leer mediaId del body
  let body: { mediaId: string }
  try {
    body = await request.json() as { mediaId: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.mediaId) {
    return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
  }

  // 3. Delete con match user_id + media_id
  const { error: deleteError, count } = await supabase
    .from('user_media')
    .delete({ count: 'exact' })
    .match({ user_id: user.id, media_id: body.mediaId })

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete library entry' }, { status: 500 })
  }

  // 4. 404 si no existía
  if (count === 0) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  // 5. Invalidar cache de recomendaciones — biblioteca cambió
  invalidateRecCache(user.id)

  return NextResponse.json({ ok: true })
}
