// ============================================================
// KULTURA — Route Handler: /api/lists
// POST:   crear una lista
// DELETE: eliminar una lista (solo el owner)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

const VALID_TYPES = ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game']

/** POST /api/lists — crear lista */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:lists`, LIMITS.lists)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { name?: string; mediaType?: string; isCollaborative?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!body.mediaType || !VALID_TYPES.includes(body.mediaType)) {
    return NextResponse.json(
      { error: `mediaType must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('lists')
    .insert({
      owner_id: user.id,
      name: body.name.trim(),
      media_type: body.mediaType,
      is_collaborative: body.isCollaborative ?? false,
    })
    .select('id, owner_id, name, media_type, is_collaborative, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 })
  }

  return NextResponse.json({ list: data }, { status: 201 })
}

/** DELETE /api/lists — eliminar lista */
export async function DELETE(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:lists`, LIMITS.lists)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { listId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.listId) {
    return NextResponse.json({ error: 'listId is required' }, { status: 400 })
  }

  // Verificar que el usuario es el owner
  const { data: list } = await supabase
    .from('lists')
    .select('owner_id')
    .eq('id', body.listId)
    .maybeSingle()

  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }
  if (list.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteError } = await supabase
    .from('lists')
    .delete()
    .eq('id', body.listId)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
