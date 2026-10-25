// ============================================================
// KULTURA — /api/groups/[id]/posts/[postId] (F-11)
// DELETE: el autor borra su post (ya lo permitía la base) y, con
// MODERATION_V2, el dueño del grupo borra cualquiera.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { isModerationV2 } from '@/lib/social/friends'
import { getMemberRole } from '@/lib/social/groups'

interface RouteParams {
  params: Promise<{ id: string; postId: string }>
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id: groupId, postId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = checkRateLimit(`group_post_delete:${user.id}`, LIMITS.groups_join)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const { data: post } = await supabase
    .from('group_posts')
    .select('id, user_id')
    .eq('id', postId)
    .eq('group_id', groupId)
    .maybeSingle()
  if (!post) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isAuthor = (post as { user_id: string }).user_id === user.id
  if (!isAuthor) {
    const role = isModerationV2() ? await getMemberRole(groupId, user.id) : null
    if (role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // RETURNING para saber si la RLS dejó borrar (un DELETE filtrado por la
  // RLS no da error: simplemente no borra nada).
  const { data, error } = await supabase
    .from('group_posts')
    .delete()
    .eq('id', postId)
    .eq('group_id', groupId)
    .select('id')

  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ ok: true })
}
