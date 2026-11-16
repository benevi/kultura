// ============================================================
// KULTURA — Mensajes estables de /api/email/preferences (saneamiento 9)
// Van en `error.message` junto al `code` del catálogo. Sin dependencias:
// los comparten la ruta y Ajustes.
// ============================================================

export const EMAIL_PREFERENCE_ERRORS = {
  /** `forbidden` 403: la dirección de la cuenta no está confirmada. */
  unconfirmedEmail: 'unconfirmed_email',
  /** `forbidden` 403 (sin configurar o fuera de la lista) o `unavailable` 503 (sin la migración). */
  notAvailable: 'not_available',
  /** `conflict` 409: el texto del consentimiento que se enseñó es viejo. */
  staleConsent: 'stale_consent',
  /** `rate_limited` 429: un enlace cada 10 minutos. */
  cooldown: 'cooldown',
  /** `rate_limited` 429: 3 enlaces al día por persona. */
  dailyLimit: 'daily_limit',
  /** `unavailable` 503: tope diario de toda la app. */
  busy: 'busy',
  /** `provider_unavailable` 502: Resend no aceptó el correo. */
  sendFailed: 'send_failed',
} as const
