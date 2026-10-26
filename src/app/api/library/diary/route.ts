// ============================================================
// KULTURA — Route Handler: /api/library/diary (F-24)
// GET ?mediaId=…: configuración de la escala (bandera + preferencia ½★ o /10)
//      y los apuntes del diario de ese título (o los últimos, sin mediaId).
//      Lo pide el diálogo de biblioteca al abrirse.
// DELETE { id }: borra un apunte propio.
//
// Los apuntes nuevos se crean con POST /api/library (campo `log`), junto con
// la entrada: así nunca hay un apunte sin entrada (FK compuesta).
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { readDiary } from '@/lib/library/diary'
import { isNotMigrated, ratingScale10Enabled, readRatingScale } from '@/lib/library/scale'
import type { DiaryConfig } from '@/types/library'

const log = createLogger('api/library/diary')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:library_diary`, LIMITS.library)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const mediaId = new URL(request.url).searchParams.get('mediaId') ?? undefined
  if (mediaId !== undefined && !/^[a-z]+_.+$/.test(mediaId)) {
    return NextResponse.json({ error: 'mediaId must follow the format "{type}_{externalId}"' }, { status: 400 })
  }

  const scale = readRatingScale(user)
  const off: DiaryConfig = { enabled: false, scale, logs: [] }
  if (!ratingScale10Enabled()) {
    return NextResponse.json(off, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  try {
    const diary = await readDiary(supabase, user.id, { mediaId, limit: mediaId ? 50 : 100, withMedia: !mediaId })
    const body: DiaryConfig = diary.migrated ? { enabled: true, scale, logs: diary.logs } : off
    return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    log.error('Failed to read diary', { err, userId: user.id })
    return NextResponse.json({ error: 'Failed to read diary' }, { status: 500 })
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:library`, LIMITS.library)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { id?: unknown }
  try {
    body = (await request.json()) as { id?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) {
    return NextResponse.json({ error: 'id must be a uuid' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('user_media_logs')
    .delete({ count: 'exact' })
    .match({ id: body.id, user_id: user.id })

  if (error) {
    if (isNotMigrated(error)) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    log.error('Failed to delete diary log', { err: error, userId: user.id })
    return NextResponse.json({ error: 'Failed to delete diary entry' }, { status: 500 })
  }
  if (count === 0) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
