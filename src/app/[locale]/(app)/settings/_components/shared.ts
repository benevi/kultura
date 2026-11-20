import type { useAccountSettings } from '@/hooks/useAccountSettings'

/** Estado y acciones de Ajustes; cada sección toma solo lo suyo con `Pick`. */
export type AccountSettings = ReturnType<typeof useAccountSettings>

/** Rótulo en versalitas encima de cada sección. */
export const eyebrow = 'text-meta font-extrabold uppercase tracking-wide text-text-tertiary mb-3'
/** Relleno de cada fila de una tarjeta de Ajustes. */
export const row = 'px-5 py-4 sm:px-6 sm:py-5'

/**
 * Contacto para pedir lo que la exportación no incluye (mensajes recibidos),
 * el mismo que publica la política de privacidad. Cuando entre `LEGAL_CONTACT_EMAIL`
 * (src/app/.well-known/contact.ts, F-19) conviene importarlo de allí.
 */
export const PRIVACY_CONTACT_EMAIL = 'kultura.app.contacto@gmail.com'

export function formatDay(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
