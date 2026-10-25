// ============================================================
// KULTURA — /api/groups/[id]/members/[userId] (F-11, con MODERATION_V2)
// DELETE: el dueño expulsa a un miembro. Se le veta (group_bans) para que no
// vuelva a entrar solo en un grupo público; el dueño puede volver a
// invitarle. Nunca sobre sí mismo ni sobre el dueño.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { isModerationV2, isNotMigratedError } from '@/lib/social/friends'
import { getMemberRole } from '@/lib/social/groups'

const log = createLogger('api/groups/members')

interface RouteParams {
  params: Promise<{ id: string; userId: string }>
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id: groupId, userId: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isModerationV2()) return NextResponse.json({ error: 'moderation_disabled' }, { status: 404 })

  const rl = checkRateLimit(`group_kick:${user.id}`, LIMITS.groups_join)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  if (targetId === user.id) return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 })

  const [myRole, targetRole] = await Promise.all([
    getMemberRole(groupId, user.id),
    getMemberRole(groupId, targetId),
  ])
  if (myRole !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (targetRole === null) return NextResponse.json({ error: 'not_a_member' }, { status: 404 })
  if (targetRole === 'owner') return NextResponse.json({ error: 'cannot_remove_owner' }, { status: 400 })

  // El veto expulsa por disparador (handle_new_group_ban).
  const { error: banError } = await supabase
    .from('group_bans')
    .upsert(
      { group_id: groupId, user_id: targetId, banned_by: user.id },
      { onConflict: 'group_id,user_id', ignoreDuplicates: true },
    )
  if (banError && !isNotMigratedError(banError)) {
    log.error('group ban failed', { err: banError })
    return NextResponse.json({ error: 'remove_failed' }, { status: 500 })
  }

  // Y además el DELETE directo (política "Group owners can remove members"),
  // por si el disparador o la tabla de vetos faltaran.
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', targetId)
  if (error) {
    log.error('group member remove failed', { err: error })
    return NextResponse.json({ error: 'remove_failed' }, { status: 500 })
  }

  if ((await getMemberRole(groupId, targetId)) !== null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
