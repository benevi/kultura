// ============================================================
// KULTURA — Route Handler: /api/notifications
// GET:   listar notificaciones del usuario autenticado
// PATCH: marcar como leída (una o todas)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNotifications, markAllRead, markOneRead, getUnreadCount } from '@/lib/social/notifications'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

/** GET /api/notifications */
export async function GET(): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id),
    getUnreadCount(user.id),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

/** PATCH /api/notifications — marcar leída/s */
export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:notifications`, LIMITS.notifications)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (body.id) {
    await markOneRead(body.id, user.id)
  } else {
    await markAllRead(user.id)
  }

  return NextResponse.json({ ok: true })
}
