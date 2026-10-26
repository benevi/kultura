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
  /**
   * F-28: versión HTML (plantilla propia, con todo lo dinámico escapado). Si
   * falta, el correo va solo en texto plano, como los avisos de moderación.
   */
  html?: string
  /** F-28: remitente propio (por defecto MODERATION_EMAIL_FROM o el de pruebas). */
  from?: string
  /** F-28: cabeceras extra (List-Unsubscribe, List-Unsubscribe-Post…). */
  headers?: Record<string, string>
  /**
   * F-28: clave de idempotencia de Resend (24 h): si la misma petición se
   * repite (reintento, cron duplicado), Resend no manda un segundo correo.
   */
  idempotencyKey?: string
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
        ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: message.from?.trim() || process.env.MODERATION_EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        ...(message.headers && Object.keys(message.headers).length > 0 ? { headers: message.headers } : {}),
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
