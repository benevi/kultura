// ============================================================
// KULTURA — Consentimiento del correo semanal (F-28, CRE-9; RGPD art. 7.1)
//
// Lo que la persona acepta es el texto `settings.weeklyEmailConsent` en su
// idioma. Se guarda QUÉ versión aceptó y cuándo (email_preferences y
// email_consent_events). Si el texto cambia, cambia la versión: el test
// `tests/unit/email/consent.test.ts` compara la huella SHA-256 de los dos
// idiomas con la de aquí y falla si alguien retoca el texto sin subirla.
// El servidor rechaza (409) un alta con una versión que no es la vigente: la
// página tenía el texto viejo.
// ============================================================

export const WEEKLY_EMAIL_CONSENT_VERSION = '2026-12-v1'

/** Huella del texto aceptado en cada idioma (sha256 hex de la cadena exacta). */
export const WEEKLY_EMAIL_CONSENT_SHA256: Readonly<Record<'es' | 'en', string>> = {
  es: '93c828b74bf803d3362af71c975c3d8f596b1adac9a2f53b1c7ab05288ae5026',
  en: '7def36b61aac9433537216e5eb160eeee7d86ff325d8d9d16da78ad62c39a750',
}

export function isCurrentConsentVersion(value: unknown): boolean {
  return value === WEEKLY_EMAIL_CONSENT_VERSION
}
