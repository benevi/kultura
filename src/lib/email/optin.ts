// ============================================================
// KULTURA — Enviar el enlace de confirmación del alta (doble opt-in, F-28)
// · solo servidor
//
// Lo usan Ajustes (PUT /api/email/preferences) y el envío semanal cuando la
// dirección de la cuenta ya no es la confirmada. Primero se RESERVA el envío
// en la base con los topes (claimWeeklyOptin: 10 min, 3 al día por persona y
// WEEKLY_EMAIL_OPTIN_DAILY_CAP para toda la app); solo si cabe se manda el
// correo, a la dirección actual de la cuenta, con un enlace "optin" atado a
// ella y a la versión vigente del texto. Un envío fallido cuenta igual para
// los topes: así nadie puede usar esto para gastar el cupo de Resend.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { siteUrl } from '@/lib/site-url'
import { OPTIN_USER_DAILY_CAP, optinGlobalDailyCap, type WeeklyEmailConfig } from './config'
import { WEEKLY_EMAIL_CONSENT_VERSION } from './consent'
import { buildOptinEmail } from './optin-template'
import { claimWeeklyOptin } from './preferences'
import { sendEmail, type EmailMessage, type SendResult } from './resend'
import { createOptinToken } from './unsubscribe-token'

export type OptinSendStatus = 'sent' | 'cooldown' | 'user_cap' | 'global_cap' | 'not_migrated' | 'error' | 'send_failed'

export interface OptinRequest {
  userId: string
  email: string
  username: string
  locale: 'es' | 'en'
  now?: Date
  send?: (message: EmailMessage) => Promise<SendResult>
}

export async function sendOptinRequest(
  admin: Pick<SupabaseClient, 'rpc'>,
  config: Extract<WeeklyEmailConfig, { enabled: true }>,
  req: OptinRequest
): Promise<OptinSendStatus> {
  const claim = await claimWeeklyOptin(admin, req.userId, {
    userDaily: OPTIN_USER_DAILY_CAP,
    globalDaily: optinGlobalDailyCap(),
  })
  if (claim !== 'ok') return claim

  const now = req.now ?? new Date()
  const confirmUrl = new URL(`${siteUrl()}/${req.locale}/email/confirm`)
  confirmUrl.searchParams.set('t', createOptinToken(req.userId, req.email, WEEKLY_EMAIL_CONSENT_VERSION, config.secret, now))
  const content = buildOptinEmail({ locale: req.locale, username: req.username, confirmUrl: confirmUrl.toString() })
  const sent = await (req.send ?? sendEmail)({ from: config.from, to: req.email, ...content })
  return sent.ok ? 'sent' : 'send_failed'
}
