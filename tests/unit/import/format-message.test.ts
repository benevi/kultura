// @vitest-environment node
// F-26 — Formateo propio de los textos `import` (sin next-intl en el chunk,
// para no duplicar useTranslations en el JS de todas las páginas).
import { describe, it, expect } from 'vitest'
import { IntlMessageFormat } from 'intl-messageformat'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'
import { formatMessage } from '@/lib/import/format-message'

function leaves(o: unknown, p = ''): Array<[string, string]> {
  if (typeof o === 'string') return [[p, o]]
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k))
}

describe('formatMessage', () => {
  it('variables, plural con one/other, =N y # con formato local', () => {
    expect(formatMessage('{source}: {count, plural, one {# título} other {# títulos}}', { source: 'MAL', count: 1 }, 'es')).toBe('MAL: 1 título')
    expect(formatMessage('{count, plural, one {# título} other {# títulos}}', { count: 1234 }, 'es')).toBe('1234 títulos')
    expect(formatMessage('{count, plural, one {# title} other {# titles}}', { count: 12345 }, 'en')).toBe('12,345 titles')
    expect(formatMessage('{n, plural, =0 {nada} one {uno} other {#}}', { n: 0 }, 'es')).toBe('nada')
    expect(formatMessage('{n, plural, one {y # más de {who}} other {y # más de {who}}}', { n: 2, who: 'Ana' }, 'es')).toBe('y 2 más de Ana')
    expect(formatMessage("It's {mb} MB, won't fit", { mb: 10 }, 'en')).toBe("It's 10 MB, won't fit")
    expect(formatMessage('Sin valor: {x}')).toBe('Sin valor: {x}')
  })

  it('ICU no admitido: lanza (lo ve el test de abajo, no la persona)', () => {
    expect(() => formatMessage('{g, select, a {A} other {B}}')).toThrow()
  })

  it.each([
    ['es', es],
    ['en', en],
  ])('todos los textos de import en %s salen IGUAL que con intl-messageformat (next-intl)', (locale, messages) => {
    const values = { count: 3, source: 'Letterboxd', mb: 10, max: '10.000', files: 'a.csv', processed: 5, total: 9, done: 2, title: 'Dune' }
    for (const [key, message] of leaves((messages as Record<string, unknown>).import)) {
      const expected = String(new IntlMessageFormat(message, locale).format(values))
      expect(formatMessage(message, values, locale), key).toBe(expected)
      if (message.includes('plural')) {
        for (const count of [0, 1, 2, 1500]) {
          expect(formatMessage(message, { ...values, count }, locale), `${key} ${count}`).toBe(
            String(new IntlMessageFormat(message, locale).format({ ...values, count }))
          )
        }
      }
    }
  })
})
