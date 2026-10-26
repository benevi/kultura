// ============================================================
// KULTURA — Fechas del diario (F-24, cliente y servidor)
// ============================================================

/** Hoy en la zona horaria de quien mira, como AAAA-MM-DD. */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "20 oct 2026" / "Oct 20, 2026" para una fecha AAAA-MM-DD (sin desfase horario). */
export function formatDiaryDate(value: string, locale: string, style: 'short' | 'long' = 'short'): string {
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/** "octubre de 2026" / "October 2026": cabecera de cada mes del diario. */
export function formatDiaryMonth(value: string, locale: string): string {
  const [y, m] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, (m ?? 1) - 1, 1))
  )
}
