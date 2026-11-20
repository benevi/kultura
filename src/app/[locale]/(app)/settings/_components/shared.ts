import type { useAccountSettings } from '@/hooks/useAccountSettings'

/** Estado y acciones de Ajustes; cada sección toma solo lo suyo con `Pick`. */
export type AccountSettings = ReturnType<typeof useAccountSettings>

/** Rótulo en versalitas encima de cada sección. */
export const eyebrow = 'text-meta font-extrabold uppercase tracking-wide text-text-tertiary mb-3'
/** Relleno de cada fila de una tarjeta de Ajustes. */
export const row = 'px-5 py-4 sm:px-6 sm:py-5'

export function formatDay(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
