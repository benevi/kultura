// ============================================================
// KULTURA — POST /api/groups/[id]/posts (saneamiento 4.6)
// Publicar en un grupo: valida el texto y aplica rate limit antes de
// insertar. Quién puede publicar (miembro, sin veto) lo decide la RLS.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimitDistributed, LIMITS } from '@/lib/rate-limit'
import { isRlsDenied } from '@/lib/social/friends'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** El formulario corta en 1000; la base admite hasta 2000. */
const MAX_POST_LENGTH = 1000

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id: groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = await checkRateLimitDistributed(`group_posts:${user.id}`, LIMITS.group_posts)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { content?: unknown }
  try {
    body = await req.json() as { content?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return NextResponse.json({ error: 'content_required' }, { status: 400 })
  if (content.length > MAX_POST_LENGTH) {
    return NextResponse.json({ error: 'content_too_long' }, { status: 400 })
  }

  const { error } = await supabase
    .from('group_posts')
    .insert({ group_id: groupId, user_id: user.id, content })

  if (isRlsDenied(error)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (error) return NextResponse.json({ error: 'post_failed' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
