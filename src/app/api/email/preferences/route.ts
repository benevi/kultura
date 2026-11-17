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
// por confirmada al darse de alta). Respuesta: 202 { data: { pending: true } }.
// Topes (en la base, no se saltan alternando alta y baja): 10 min entre
// enlaces (429 `cooldown`), 3 al día por persona (429 `daily_limit`) y
// WEEKLY_EMAIL_OPTIN_DAILY_CAP para toda la app (503 `busy`).
//
// `weekly: false` da de baja al momento (y cancela una confirmación pendiente).
// La demo, nunca.
//
// Contrato en `lib/api/contracts/email.ts`: `{ data }` o
// `{ error: { code, message } }`, con el motivo de `EMAIL_PREFERENCE_ERRORS`
// en `message` (saneamiento 7 y 9).
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { LIMITS } from '@/lib/rate-limit'
import { apiError, ok, parseBody, rateLimit, requireUser } from '@/lib/api/route'
import { emailPreferencesSchema, EMAIL_PREFERENCE_ERRORS as E, type EmailPreferenceResult } from '@/lib/api/contracts/email'
import { ACCOUNT_ERRORS } from '@/lib/account/errors'
import { isDemoUser } from '@/lib/demo'
import { createLogger } from '@/lib/logger'
import { weeklyEmailAllowedFor, weeklyEmailConfig } from '@/lib/email/config'
import { WEEKLY_EMAIL_CONSENT_VERSION, isCurrentConsentVersion } from '@/lib/email/consent'
import { readWeeklyEmailPreference, setWeeklyEmail } from '@/lib/email/preferences'
import { sendOptinRequest } from '@/lib/email/optin'
import { emailFingerprint } from '@/lib/email/unsubscribe-token'

const log = createLogger('api/email/preferences')
const NO_STORE = { 'Cache-Control': 'no-store' }

const done = (result: EmailPreferenceResult, status = 200) => ok(result, { status, headers: NO_STORE })

export async function PUT(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user, supabase } = auth
  if (isDemoUser(user)) return apiError('forbidden', { message: ACCOUNT_ERRORS.demoReadOnly })

  const limited = await rateLimit(request, { key: 'email-prefs', limit: LIMITS.notifications, userId: user.id })
  if (limited) return limited

  const parsed = await parseBody(request, emailPreferencesSchema, { maxBytes: 1024 })
  if (!parsed.ok) return parsed.response
  const body = parsed.value

  if (!body.weekly) {
    const result = await setWeeklyEmail(supabase, false)
    if (!result.ok) {
      if (result.reason === 'forbidden') return apiError('forbidden')
      log.error('No se pudo guardar la baja del correo')
      return apiError('internal')
    }
    return done({ weekly: false, pending: false, consentedAt: result.preference.consentedAt })
  }

  // ── Alta: solo se pide la confirmación ────────────────────────────────
  const config = weeklyEmailConfig()
  if (!config.enabled || !user.email) return apiError('forbidden', { message: E.notAvailable })
  if (!user.email_confirmed_at) return apiError('forbidden', { message: E.unconfirmedEmail })
  if (!weeklyEmailAllowedFor(config, user)) return apiError('forbidden', { message: E.notAvailable })
  if (!isCurrentConsentVersion(body.consentVersion)) return apiError('conflict', { message: E.staleConsent })

  const current = await readWeeklyEmailPreference(supabase, user.id)
  if (current === null) return apiError('unavailable', { message: E.notAvailable })
  // Ya activo con este texto y ESTA dirección: nada que hacer. Si la dirección
  // cambió, se pide confirmar la nueva.
  if (
    current.weekly &&
    current.consentVersion === WEEKLY_EMAIL_CONSENT_VERSION &&
    current.confirmedEmailHash === emailFingerprint(user.email)
  ) {
    return done({ weekly: true, pending: false, consentedAt: current.consentedAt })
  }
  const { data: profile } = await supabase.from('users').select('username').eq('id', user.id).maybeSingle()
  // Topes en la base, en una transacción (10 min, 3 al día por persona y el
  // global): alternar alta y baja no los salta, porque la baja no borra nada.
  const status = await sendOptinRequest(createAdminClient(), config, {
    userId: user.id,
    email: user.email,
    username: (profile as { username?: string } | null)?.username ?? '',
    locale: body.locale === 'en' ? 'en' : 'es',
  })
  switch (status) {
    case 'sent':
      return done({ weekly: false, pending: true }, 202)
    case 'cooldown':
      return apiError('rate_limited', { message: E.cooldown, headers: { 'Retry-After': '600' } })
    case 'user_cap':
      return apiError('rate_limited', { message: E.dailyLimit, headers: { 'Retry-After': '86400' } })
    case 'global_cap':
      return apiError('unavailable', { message: E.busy, headers: { 'Retry-After': '3600' } })
    case 'send_failed':
      log.error('No se pudo enviar el correo de confirmación')
      return apiError('provider_unavailable', { message: E.sendFailed })
    default:
      log.error('No se pudo reservar el correo de confirmación')
      return apiError('internal')
  }
}
