// ============================================================
// KULTURA — Route Handler: /api/library/prefs (F-24)
// PUT { ratingScale: 'stars' | 'ten' }: cómo ve y pone sus notas la persona.
//
// Se guarda en `user_metadata.rating_scale` (lo escribe la propia persona con
// su sesión): no necesita columna nueva y viaja con la sesión a cualquier
// dispositivo. La cuenta demo es de solo lectura también aquí.
// El control vive de momento en la Biblioteca; pasará a Ajustes (F-25).
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { isDemoUser } from '@/lib/demo'
import { createLogger } from '@/lib/logger'
import { RATING_SCALE_KEY } from '@/lib/library/scale'
import { isRatingScale } from '@/types/library'

const log = createLogger('api/library/prefs')

export async function PUT(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (isDemoUser(user)) {
    return NextResponse.json({ error: 'Demo account is read-only' }, { status: 403 })
  }

  const rl = checkRateLimit(`${user.id}:library`, LIMITS.library)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { ratingScale?: unknown }
  try {
    body = (await request.json()) as { ratingScale?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!isRatingScale(body.ratingScale)) {
    return NextResponse.json({ error: "ratingScale must be 'stars' or 'ten'" }, { status: 400 })
  }

  const { error } = await supabase.auth.updateUser({ data: { [RATING_SCALE_KEY]: body.ratingScale } })
  if (error) {
    log.error('Failed to save rating scale', { err: error, userId: user.id })
    return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
  }
  return NextResponse.json({ ratingScale: body.ratingScale })
}
