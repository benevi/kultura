// ============================================================
// KULTURA — Route Handler: /api/email/preferences (F-28, CRE-9)
// PUT { weekly: boolean, consentVersion?: string } desde Ajustes, con sesión.
//
// DOBLE OPT-IN. `weekly: true` NO activa nada: comprueba que la dirección de
// la cuenta esté confirmada (email_confirmed_at) y la versión del texto que se
// le ha enseñado (409 si es vieja), apunta la petición y envía a ESA
// dirección un enlace firmado de propósito "optin" (7 días). Solo al pulsarlo
// (/[locale]/email/confirm → POST /api/email/confirm) se activa y se registra
// el consentimiento. Así nadie puede apuntar un buzón ajeno aunque se haya
// registrado con él (con «Confirm email» desactivado, Supabase da la dirección
// por confirmada al darse de alta). Respuesta: 202 { pending: true }.
// Entre dos enlaces hay 10 min (429 `cooldown`) para no llenar el buzón.
//
// `weekly: false` da de baja al momento (y cancela una confirmación pendiente).
// La demo, nunca.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { isDemoUser } from '@/lib/demo'
import { createLogger } from '@/lib/logger'
import { siteUrl } from '@/lib/site-url'
import { weeklyEmailAllowedFor, weeklyEmailConfig } from '@/lib/email/config'
import { WEEKLY_EMAIL_CONSENT_VERSION, isCurrentConsentVersion } from '@/lib/email/consent'
import {
  OPTIN_COOLDOWN_MS,
  readWeeklyEmailPreference,
  requestWeeklyOptin,
  setWeeklyEmail,
} from '@/lib/email/preferences'
import { createOptinToken } from '@/lib/email/unsubscribe-token'
import { buildOptinEmail } from '@/lib/email/optin-template'
import { sendEmail } from '@/lib/email/resend'

const log = createLogger('api/email/preferences')
const NO_STORE = { 'Cache-Control': 'no-store' }

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

  let body: { weekly?: unknown; consentVersion?: unknown; locale?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body.weekly !== 'boolean') {
    return NextResponse.json({ error: 'weekly must be a boolean' }, { status: 400 })
  }

  if (!body.weekly) {
    const result = await setWeeklyEmail(supabase, false)
    if (!result.ok) {
      if (result.reason === 'not_migrated') return NextResponse.json({ error: 'not_available' }, { status: 503 })
      if (result.reason === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      log.error('No se pudo guardar la baja del correo')
      return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
    }
    return NextResponse.json({ weekly: false, pending: false, consentedAt: result.preference.consentedAt }, { headers: NO_STORE })
  }

  // ── Alta: solo se pide la confirmación ────────────────────────────────
  const config = weeklyEmailConfig()
  if (!config.enabled || !user.email) {
    return NextResponse.json({ error: 'not_available' }, { status: 403 })
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'unconfirmed_email' }, { status: 403 })
  }
  if (!weeklyEmailAllowedFor(config, user)) {
    return NextResponse.json({ error: 'not_available' }, { status: 403 })
  }
  if (!isCurrentConsentVersion(body.consentVersion)) {
    return NextResponse.json({ error: 'stale_consent' }, { status: 409 })
  }

  const current = await readWeeklyEmailPreference(supabase, user.id)
  if (current === null) return NextResponse.json({ error: 'not_available' }, { status: 503 })
  if (current.weekly && current.consentVersion === WEEKLY_EMAIL_CONSENT_VERSION) {
    return NextResponse.json({ weekly: true, pending: false, consentedAt: current.consentedAt }, { headers: NO_STORE })
  }
  const now = new Date()
  if (current.optinRequestedAt && now.getTime() - new Date(current.optinRequestedAt).getTime() < OPTIN_COOLDOWN_MS) {
    return NextResponse.json({ error: 'cooldown' }, { status: 429 })
  }

  const recorded = await requestWeeklyOptin(createAdminClient(), user.id, now)
  if (!recorded.ok) {
    if (recorded.reason === 'not_migrated') return NextResponse.json({ error: 'not_available' }, { status: 503 })
    log.error('No se pudo apuntar la petición de confirmación')
    return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
  }

  const locale = body.locale === 'en' ? 'en' : 'es'
  const { data: profile } = await supabase.from('users').select('username').eq('id', user.id).maybeSingle()
  const confirmUrl = new URL(`${siteUrl()}/${locale}/email/confirm`)
  confirmUrl.searchParams.set('t', createOptinToken(user.id, user.email, WEEKLY_EMAIL_CONSENT_VERSION, config.secret, now))
  const content = buildOptinEmail({
    locale,
    username: (profile as { username?: string } | null)?.username ?? '',
    confirmUrl: confirmUrl.toString(),
  })
  const sent = await sendEmail({ from: config.from, to: user.email, ...content })
  if (!sent.ok) {
    log.error(`No se pudo enviar el correo de confirmación (${sent.reason}${sent.status ? ` ${sent.status}` : ''})`)
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ weekly: false, pending: true }, { status: 202, headers: NO_STORE })
}
