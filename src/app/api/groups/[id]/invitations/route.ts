// ============================================================
// KULTURA — /api/groups/[id]/invitations
// GET:  amigos invitables al grupo (owner-only)
// POST: invitar a un amigo al grupo (owner-only, friend-only)
//        body { inviteeId } → inserta invitation + notification group_invite
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import {
  getGroupById,
  getInvitableFriends,
  isGroupOwner,
  isGroupMember,
} from '@/lib/social/groups'

interface Props {
  params: Promise<{ id: string }>
}

/** GET /api/groups/[id]/invitations → amigos invitables (owner-only). */
export async function GET(_req: NextRequest, { params }: Props): Promise<NextResponse> {
  const { id: groupId } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!(await isGroupOwner(groupId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const friends = await getInvitableFriends(groupId, user.id)
  return NextResponse.json({ friends })
}

/** POST /api/groups/[id]/invitations → invitar a un amigo (owner-only, friend-only). */
export async function POST(req: NextRequest, { params }: Props): Promise<NextResponse> {
  const { id: groupId } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = checkRateLimit(`groups:${user.id}`, LIMITS.groups)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const body = await req.json().catch(() => null)
  const inviteeId = body?.inviteeId as string | undefined
  if (!inviteeId) {
    return NextResponse.json({ error: 'inviteeId is required' }, { status: 400 })
  }
  if (inviteeId === user.id) {
    return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 })
  }

  const group = await getGroupById(groupId)
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  // Owner-only
  if (!(await isGroupOwner(groupId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Amistad accepted owner↔invitee (ambas direcciones)
  const { data: friendship } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${user.id},receiver_id.eq.${inviteeId}),and(requester_id.eq.${inviteeId},receiver_id.eq.${user.id})`
    )
    .limit(1)
    .maybeSingle()

  if (!friendship) {
    return NextResponse.json({ error: 'Can only invite friends' }, { status: 403 })
  }

  // No miembro ya
  if (await isGroupMember(groupId, inviteeId)) {
    return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
  }

  // No invitación pending ya
  const { data: existing } = await supabase
    .from('group_invitations')
    .select('id')
    .eq('group_id', groupId)
    .eq('invitee_id', inviteeId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Invitation already pending' }, { status: 409 })
  }

  // Insertar invitación
  const { data: invitation, error: insertErr } = await supabase
    .from('group_invitations')
    .insert({ group_id: groupId, inviter_id: user.id, invitee_id: inviteeId })
    .select('id, group_id, inviter_id, invitee_id, status, created_at')
    .single()

  if (insertErr || !invitation) {
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  // Notificación group_invite (best-effort, mirror de lists invite)
  const { data: senderProfile } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  const admin = createAdminClient()
  const { error: notifErr } = await admin.from('notifications').insert({
    user_id: inviteeId,
    type: 'group_invite',
    payload: {
      groupId,
      groupName: group.name,
      invitationId: invitation.id,
      fromUserId: user.id,
      fromUsername: senderProfile?.username ?? '',
    },
  })
  if (notifErr) console.error('[E83] notif insert failed', { type: 'group_invite', notifErr })

  return NextResponse.json({ invitation }, { status: 201 })
}
