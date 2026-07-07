// ============================================================
// KULTURA — /api/groups/invitations/[invitationId]
// PATCH:  aceptar invitación (invitee-only) → status='accepted'
//          (RLS restringe a invitee; trigger on_invitation_accepted da el alta)
//          + marca leída la notificación group_invite asociada
// DELETE: rechazar invitación (invitee-only) → borra invitation + notificación
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

interface Props {
  params: Promise<{ invitationId: string }>
}

/**
 * Marca leída la notificación group_invite asociada a una invitación.
 * Best-effort: el payload jsonb guarda invitationId al crearla.
 */
async function markInviteNotificationRead(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  invitationId: string
): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'group_invite')
    .eq('payload->>invitationId', invitationId)
}

/** PATCH /api/groups/invitations/[invitationId] → aceptar. */
export async function PATCH(_req: NextRequest, { params }: Props): Promise<NextResponse> {
  const { invitationId } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = checkRateLimit(`${user.id}:group_invitations`, LIMITS.group_invitations)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  // Cargar invitación (RLS: solo inviter/invitee la ven)
  const { data: invitation } = await supabase
    .from('group_invitations')
    .select('id, invitee_id, status')
    .eq('id', invitationId)
    .maybeSingle()

  if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  if (invitation.invitee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: 'Invitation already resolved' }, { status: 409 })
  }

  // Aceptar: RLS restringe a invitee; el trigger inserta el group_member
  const { error: updateErr, count } = await supabase
    .from('group_invitations')
    .update({ status: 'accepted' }, { count: 'exact' })
    .eq('id', invitationId)
    .eq('status', 'pending')

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
  }
  if (count === 0) {
    return NextResponse.json({ error: 'Invitation already resolved' }, { status: 409 })
  }

  await markInviteNotificationRead(supabase, user.id, invitationId)

  return NextResponse.json({ ok: true })
}

/** DELETE /api/groups/invitations/[invitationId] → rechazar (borra invitation + notificación). */
export async function DELETE(_req: NextRequest, { params }: Props): Promise<NextResponse> {
  const { invitationId } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = checkRateLimit(`${user.id}:group_invitations`, LIMITS.group_invitations)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  // Cargar invitación (RLS: solo inviter/invitee la ven)
  const { data: invitation } = await supabase
    .from('group_invitations')
    .select('id, inviter_id, invitee_id')
    .eq('id', invitationId)
    .maybeSingle()

  if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  if (invitation.invitee_id !== user.id && invitation.inviter_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteErr, count } = await supabase
    .from('group_invitations')
    .delete({ count: 'exact' })
    .eq('id', invitationId)

  if (deleteErr) {
    return NextResponse.json({ error: 'Failed to reject invitation' }, { status: 500 })
  }
  if (count === 0) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  // Borra la notificación group_invite del invitee (best-effort)
  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', invitation.invitee_id)
    .eq('type', 'group_invite')
    .eq('payload->>invitationId', invitationId)

  return NextResponse.json({ ok: true })
}
