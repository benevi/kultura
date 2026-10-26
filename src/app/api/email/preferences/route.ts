// ============================================================
// KULTURA — Route Handler: /api/email/preferences (F-28, CRE-9)
// PUT { weekly: boolean, consentVersion?: string }: alta o baja del correo
// semanal desde Ajustes, con la sesión de la persona.
//
// El alta exige la versión del texto que se le ha enseñado y que sea la
// vigente (409 si no: la página tenía un texto viejo). Fecha y versión las
// guarda la base (set_email_weekly), junto con el registro del
// consentimiento. La baja se acepta siempre. La demo, nunca.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { isDemoUser } from '@/lib/demo'
import { createLogger } from '@/lib/logger'
import { weeklyEmailAllowedFor, weeklyEmailConfig } from '@/lib/email/config'
import { isCurrentConsentVersion } from '@/lib/email/consent'
import { setWeeklyEmail } from '@/lib/email/preferences'

const log = createLogger('api/email/preferences')

export async function PUT(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (isDemoUser(user)) {
    return NextResponse.json({ error: 'Demo account is read-only' }, { status: 403 })
  }

  const rl = checkRateLimit(`${user.id}:email-prefs`, LIMITS.notifications)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { weekly?: unknown; consentVersion?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body.weekly !== 'boolean') {
    return NextResponse.json({ error: 'weekly must be a boolean' }, { status: 400 })
  }

  if (body.weekly) {
    if (!weeklyEmailAllowedFor(weeklyEmailConfig(), user.email)) {
      return NextResponse.json({ error: 'Weekly email is not available' }, { status: 403 })
    }
    if (!isCurrentConsentVersion(body.consentVersion)) {
      return NextResponse.json({ error: 'stale_consent' }, { status: 409 })
    }
  }

  const result = await setWeeklyEmail(supabase, body.weekly)
  if (!result.ok) {
    if (result.reason === 'not_migrated') {
      return NextResponse.json({ error: 'Weekly email is not available yet' }, { status: 503 })
    }
    if (result.reason === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    log.error('No se pudo guardar la preferencia de correo')
    return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
  }
  return NextResponse.json(
    { weekly: result.preference.weekly, consentedAt: result.preference.consentedAt },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
