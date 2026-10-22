// ============================================================
// KULTURA — Route Handler: /api/friends/blocks (F-11, D-13)
// GET  ?userId=…  → { enabled, blocked } (¿he bloqueado a este usuario?)
// GET             → { enabled, users }   (a quién he bloqueado)
// POST   { userId } → bloquear (la base borra la amistad y las invitaciones)
// DELETE { userId } → desbloquear (la amistad no vuelve: hay que pedirla)
// `enabled: false` sin MODERATION_V2 o sin la migración: la UI no enseña nada.
// ============================================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { getBlockedUsers, hasBlocked, isModerationV2, isNotMigratedError } from '@/lib/social/friends'

const log = createLogger('api/friends/blocks')

const BodySchema = z.object({ userId: z.string().uuid() })

async function requireUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(request: Request): Promise<NextResponse> {
  const { user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const userId = new URL(request.url).searchParams.get('userId')

  if (!isModerationV2()) {
    return NextResponse.json(userId ? { enabled: false, blocked: false } : { enabled: false, users: [] })
  }

  try {
    if (userId) {
      if (!z.string().uuid().safeParse(userId).success || userId === user.id) {
        return NextResponse.json({ enabled: true, blocked: false })
      }
      const blocked = await hasBlocked(user.id, userId)
      return NextResponse.json({ enabled: blocked !== null, blocked: blocked === true })
    }
    const users = await getBlockedUsers(user.id)
    return NextResponse.json({ enabled: users !== null, users: users ?? [] })
  } catch (err) {
    log.error('blocks read failed', { err })
    return NextResponse.json({ error: 'blocks_failed' }, { status: 500 })
  }
}

async function mutate(request: Request, action: 'block' | 'unblock'): Promise<NextResponse> {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isModerationV2()) return NextResponse.json({ error: 'moderation_disabled' }, { status: 404 })

  const rl = checkRateLimit(`${user.id}:blocks`, LIMITS.friends)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const otherId = parsed.data.userId
  if (otherId === user.id) return NextResponse.json({ error: 'cannot_block_self' }, { status: 400 })

  if (action === 'unblock') {
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', otherId)
    if (error) {
      if (isNotMigratedError(error)) return NextResponse.json({ error: 'moderation_unavailable' }, { status: 503 })
      log.error('unblock failed', { err: error })
      return NextResponse.json({ error: 'unblock_failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const { data: target } = await supabase.from('users').select('id').eq('id', otherId).maybeSingle()
  if (!target) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

  // upsert: bloquear dos veces no es un error.
  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: user.id, blocked_id: otherId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true })
  if (error) {
    if (isNotMigratedError(error)) return NextResponse.json({ error: 'moderation_unavailable' }, { status: 503 })
    log.error('block failed', { err: error })
    return NextResponse.json({ error: 'block_failed' }, { status: 500 })
  }

  // La base ya lo hace con el disparador; aquí también, por si el disparador
  // faltara (la política friendships_delete_own lo permite a cualquiera de los dos).
  await supabase
    .from('friendships')
    .delete()
    .or(`and(requester_id.eq.${user.id},receiver_id.eq.${otherId}),and(requester_id.eq.${otherId},receiver_id.eq.${user.id})`)

  return NextResponse.json({ ok: true })
}

export function POST(request: Request): Promise<NextResponse> {
  return mutate(request, 'block')
}

export function DELETE(request: Request): Promise<NextResponse> {
  return mutate(request, 'unblock')
}
