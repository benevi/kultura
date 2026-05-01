// ============================================================
// KULTURA — Route Handler: /api/popular-in-circle
// GET: títulos más populares entre los amigos del usuario.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPopularInCircle } from '@/lib/social/circle'
import { checkRateLimit } from '@/lib/rate-limit'

const CIRCLE_LIMIT = { windowMs: 60_000, max: 20 }

/** GET /api/popular-in-circle */
export async function GET(): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:popular-in-circle`, CIRCLE_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const items = await getPopularInCircle(user.id)
  return NextResponse.json({ items })
}
