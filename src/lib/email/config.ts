// ============================================================
// KULTURA — Correo semanal (F-28, CRE-9): interruptores y variables
//
// El envío real necesita TODO esto en Vercel (si falta algo, el cron lo dice
// en `weekly.status` y no envía; la opción tampoco se enseña en Ajustes):
//   WEEKLY_EMAIL=1         la bandera (se enciende tras aplicar la migración
//                          20261215280001_calendar_email.sql);
//   RESEND_API_KEY         la clave de Resend (ya existe para moderación);
//   EMAIL_FROM             remitente, p. ej. "KULTURA <hola@tudominio.com>".
//                          Sin dominio verificado en Resend solo vale
//                          "KULTURA <onboarding@resend.dev>", que SOLO entrega
//                          al correo del dueño de la cuenta de Resend;
//   EMAIL_TOKEN_SECRET     secreto (≥ 32 caracteres) para firmar los enlaces de
//                          baja (HMAC). Cambiarlo invalida los enlaces viejos.
// Opcional:
//   WEEKLY_EMAIL_ONLY      lista de correos separados por comas: si existe,
//                          solo esas cuentas ven la opción y reciben el correo
//                          (para probar con onboarding@resend.dev sin que nadie
//                          más se apunte a algo que no le llegaría).
// ============================================================

export const EMAIL_TOKEN_SECRET_MIN = 32

export type WeeklyEmailDisabledReason =
  | 'flag_off'
  | 'missing_resend_key'
  | 'missing_from'
  | 'missing_token_secret'

export type WeeklyEmailConfig =
  | { enabled: true; from: string; secret: string; only: ReadonlySet<string> | null }
  | { enabled: false; reason: WeeklyEmailDisabledReason }

export function weeklyEmailConfig(env: NodeJS.ProcessEnv = process.env): WeeklyEmailConfig {
  if (env.WEEKLY_EMAIL !== '1') return { enabled: false, reason: 'flag_off' }
  if (!env.RESEND_API_KEY?.trim()) return { enabled: false, reason: 'missing_resend_key' }
  const from = env.EMAIL_FROM?.trim()
  if (!from) return { enabled: false, reason: 'missing_from' }
  const secret = env.EMAIL_TOKEN_SECRET?.trim() ?? ''
  if (secret.length < EMAIL_TOKEN_SECRET_MIN) return { enabled: false, reason: 'missing_token_secret' }
  const only = env.WEEKLY_EMAIL_ONLY?.trim()
  return {
    enabled: true,
    from,
    secret,
    only: only ? new Set(only.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) : null,
  }
}

/** Lo que hace falta saber de la persona (el `User` de Supabase lo cumple). */
export interface EmailRecipient {
  email?: string | null
  /** Sin fecha de confirmación de la dirección no se ofrece ni se envía nada. */
  email_confirmed_at?: string | null
}

/**
 * ¿Se le puede ofrecer (y enviar) el correo semanal a esta persona? Exige la
 * dirección confirmada en Supabase Auth. OJO: con «Confirm email» desactivado
 * Supabase la da por confirmada al registrarse, así que esto NO prueba que el
 * buzón sea suyo: eso lo hace el doble opt-in (enlace `optin` enviado a esa
 * dirección); hasta que se pulsa, no se activa nada.
 */
export function weeklyEmailAllowedFor(config: WeeklyEmailConfig, recipient: EmailRecipient | null | undefined): boolean {
  const email = recipient?.email?.trim()
  if (!config.enabled || !email || !recipient?.email_confirmed_at) return false
  return config.only === null || config.only.has(email.toLowerCase())
}
