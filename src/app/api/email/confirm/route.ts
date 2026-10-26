// ============================================================
// KULTURA — Route Handler: POST /api/email/confirm (F-28, doble opt-in)
//
// Lo envía el botón de /[locale]/email/confirm (campos `t` y `l`). Sin
// sesión: quien demuestra el consentimiento es quien abre el buzón. Activa el
// correo semanal solo si:
//   - el enlace "optin" es auténtico y no ha caducado (7 días);
//   - la versión del texto que se aceptó es la vigente (si no, `stale`);
//   - la cuenta existe, su dirección está confirmada y es LA MISMA a la que se
//     envió el enlace (huella firmada), y se le puede ofrecer el correo
//     (bandera, claves y WEEKLY_EMAIL_ONLY).
// Entonces `email_confirm_weekly` lo activa y registra el consentimiento
// (fecha, versión, origen `email_confirm`). Pulsar dos veces = una.
// Abrir el enlace (GET de la página) no confirma nada: lo pueden abrir los
// filtros de correo.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { clientIp } from '@/lib/api/discover-params'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { weeklyEmailAllowedFor, weeklyEmailConfig } from '@/lib/email/config'
import { isCurrentConsentVersion } from '@/lib/email/consent'
import { confirmWeeklyOptin } from '@/lib/email/preferences'
import { emailFingerprint, verifyOptinToken } from '@/lib/email/unsubscribe-token'

const log = createLogger('api/email/confirm')

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 4096
const LIMIT = { windowMs: 60_000, max: 20 }
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

type Status = 'done' | 'invalid' | 'stale' | 'error'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return new NextResponse(null, { status: 413, headers: NO_STORE })
  let form: URLSearchParams
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) throw new Error('too large')
    form = new URLSearchParams(text)
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE })
  }
  const token = (form.get('t') ?? '').slice(0, 240)
  const locale = form.get('l') === 'en' ? 'en' : 'es'
  const reply = (status: Status) => {
    const url = new URL(`/${locale}/email/confirm`, request.url)
    url.searchParams.set('status', status)
    if (status === 'error') url.searchParams.set('t', token)
    return NextResponse.redirect(url, { status: 303, headers: NO_STORE })
  }

  const rl = checkRateLimit(`email-confirm:${clientIp(request.headers)}`, LIMIT)
  if (!rl.allowed) return reply('error')

  const config = weeklyEmailConfig()
  if (!config.enabled) return reply('invalid')
  const check = verifyOptinToken(token, config.secret)
  if (!check.ok) return reply('invalid')
  if (!isCurrentConsentVersion(check.textVersion)) return reply('stale')

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(check.userId)
  if (error && error.status !== 404) {
    log.error('confirmación de correo: Auth no respondió')
    return reply('error')
  }
  const user = data?.user ?? null
  if (!user?.email || emailFingerprint(user.email) !== check.emailHash || !weeklyEmailAllowedFor(config, user)) {
    return reply('invalid')
  }

  const result = await confirmWeeklyOptin(admin, check.userId, check.textVersion)
  if (!result.ok) {
    if (result.reason === 'not_migrated') return reply('invalid')
    log.error('confirmación de correo: la base no respondió')
    return reply('error')
  }
  return reply('done')
}
