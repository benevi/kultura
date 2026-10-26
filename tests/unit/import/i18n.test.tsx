// F-26 — Los textos del importador llegan por su propio proveedor (no en el HTML de todas las páginas).
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'
import { ImportMessages, useImportT } from '@/lib/import/i18n'

function Probe() {
  const t = useImportT()
  return <p>{t('counts.added', { count: 3 })}</p>
}

describe('ImportMessages', () => {
  it('traduce el namespace import con plurales ICU en los dos idiomas', () => {
    const { unmount } = render(
      <ImportMessages locale="es" messages={es.import}>
        <Probe />
      </ImportMessages>
    )
    expect(screen.getByText(/3/)).toBeInTheDocument()
    unmount()
    render(
      <ImportMessages locale="en" messages={en.import}>
        <Probe />
      </ImportMessages>
    )
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('sin proveedor, falla en vez de pintar claves sueltas', () => {
    expect(() => render(<Probe />)).toThrow(/ImportMessages/)
  })

  it('es y en tienen las mismas claves en import', () => {
    const keys = (o: unknown, p = ''): string[] =>
      o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [p]
    expect(keys(en.import).sort()).toEqual(keys(es.import).sort())
  })
})
