// ============================================================
// KULTURA — Envío de correo con Resend por su API REST (sin SDK)
//
// Solo servidor. Sin `RESEND_API_KEY` no se envía nada y se devuelve
// `{ ok: false, reason: 'not_configured' }`: quien llama decide qué hacer
// (p. ej. avisar por Sentry). Nunca lanza.
// ============================================================

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
/** Remitente de pruebas de Resend: entrega solo al dueño de la cuenta. */
const DEFAULT_FROM = 'KULTURA <onboarding@resend.dev>'
const TIMEOUT_MS = 8_000

export interface EmailMessage {
  to: string | string[]
  subject: string
  /** Texto plano: el contenido de usuario nunca se interpreta como HTML. */
  text: string
  replyTo?: string
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'not_configured' | 'http_error' | 'network_error'; status?: number }

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { ok: false, reason: 'not_configured' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MODERATION_EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, reason: 'http_error', status: res.status }
    const data = (await res.json().catch(() => null)) as { id?: string } | null
    return { ok: true, id: data?.id ?? null }
  } catch {
    return { ok: false, reason: 'network_error' }
  } finally {
    clearTimeout(timer)
  }
}
