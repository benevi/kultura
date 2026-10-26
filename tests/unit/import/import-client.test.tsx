// F-26 — Pantalla de importar con los textos reales (es y en): elegir
// archivo → vista previa → importar con progreso → resumen e informe;
// errores de lectura; la demo no puede; paso opcional del onboarding.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactElement } from 'react'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { ImportMessages } from '@/lib/import/i18n'
import { ImportClient } from '@/app/[locale]/(app)/settings/import/ImportClient'
import { WelcomeImport } from '@/app/[locale]/welcome/WelcomeImport'

function renderIn(locale: 'es' | 'en', ui: ReactElement) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'es' ? es : en}
      onError={(err) => {
        throw err
      }}
    >
      <ImportMessages locale={locale} messages={(locale === 'es' ? es : en).import}>
        {ui}
      </ImportMessages>
    </NextIntlClientProvider>
  )
}

const CSV = `Date,Name,Year,Letterboxd URI,Rating
2023-01-04,Dune,2021,https://boxd.it/qMgS,4.5
2023-01-05,Película rara,1901,https://boxd.it/1Y0w,3
`

function csvFile(content = CSV, name = 'ratings.csv') {
  return new File([content], name, { type: 'text/csv' })
}

function pickFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  window.localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function okBatch() {
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    return new Response(
      JSON.stringify({
        results: body.items.map((i: { key: string; title: string }) =>
          i.title === 'Dune'
            ? { key: i.key, outcome: 'added', mediaId: 'movie_438631', title: 'Dune', year: 2021, by: 'title_year' }
            : { key: i.key, outcome: 'unmatched' }
        ),
        diaryImported: 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  })
}

describe('ImportClient', () => {
  it.each(['es', 'en'] as const)('flujo completo en %s sin claves que falten', async (locale) => {
    okBatch()
    const { container } = renderIn(locale, <ImportClient locale={locale} />)
    pickFile(container, csvFile())

    const start = await screen.findByRole('button', { name: locale === 'es' ? 'Importar 2 títulos' : 'Import 2 titles' })
    expect(screen.getByText(locale === 'es' ? 'Letterboxd: 2 títulos' : 'Letterboxd: 2 titles')).toBeInTheDocument()
    fireEvent.click(start)

    await screen.findByRole('heading', { name: locale === 'es' ? 'Importación terminada' : 'Import finished' })
    expect(fetchMock).toHaveBeenCalledWith('/api/account/import/external', expect.objectContaining({ method: 'POST' }))
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body))
    expect(sent.source).toBe('letterboxd')
    expect(sent.items[0]).toMatchObject({ title: 'Dune', year: 2021, rating10: 9, status: 'completed' })
    expect(screen.getByText(locale === 'es' ? '1 añadido' : '1 added')).toBeInTheDocument()
    expect(screen.getByText(locale === 'es' ? '1 sin emparejar' : '1 not matched')).toBeInTheDocument()
    // Lo no emparejado, con enlace a buscarlo.
    const search = screen.getByRole('link', { name: locale === 'es' ? 'Buscar «Película rara»' : 'Search “Película rara”' })
    expect(search.getAttribute('href')).toBe(`/${locale}/discover?type=movie&page=1&q=Pel%C3%ADcula%20rara`)

    // Informe descargable.
    fireEvent.click(screen.getByRole('button', { name: locale === 'es' ? 'Descargar informe (CSV)' : 'Download report (CSV)' }))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('archivo que no se reconoce → aviso con alerta', async () => {
    const { container } = renderIn('es', <ImportClient locale="es" />)
    pickFile(container, csvFile('foo,bar\n1,2\n', 'cosas.csv'))
    expect(await screen.findByRole('alert')).toHaveTextContent('No reconocemos este archivo')
  })

  it('retoma por donde iba con el mismo archivo', async () => {
    okBatch()
    const first = renderIn('es', <ImportClient locale="es" />)
    pickFile(first.container, csvFile())
    fireEvent.click(await screen.findByRole('button', { name: 'Importar 2 títulos' }))
    await screen.findByRole('heading', { name: 'Importación terminada' })
    first.unmount()

    const second = renderIn('es', <ImportClient locale="es" />)
    pickFile(second.container, csvFile())
    expect(await screen.findByText('Ya importaste 2 de 2 títulos de este archivo: se sigue por donde ibas.')).toBeInTheDocument()
    fetchMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 títulos' }))
    await screen.findByRole('heading', { name: 'Importación terminada' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('la demo no ve el selector de archivo', () => {
    const { container } = renderIn('es', <ImportClient locale="es" isDemo />)
    expect(screen.getByRole('status')).toHaveTextContent('La cuenta demo es de solo lectura')
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })
})

describe('WelcomeImport (paso opcional del onboarding)', () => {
  it('lleva su propio proveedor de textos y, sin textos, no se pinta (ni revienta)', () => {
    const { container } = render(<WelcomeImport locale="es" messages={null} onFinished={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
    render(<WelcomeImport locale="en" messages={en.import} onFinished={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Import my history' })).toBeInTheDocument()
  })

  it('cerrado por defecto; se abre y avisa de lo importado', async () => {
    okBatch()
    const onFinished = vi.fn()
    const { container } = render(<WelcomeImport locale="es" messages={es.import} onFinished={onFinished} />)
    const toggle = screen.getByRole('button', { name: 'Importar mi historial' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('input[type="file"]')).toBeNull()
    await act(async () => fireEvent.click(toggle))
    expect(screen.getByRole('button', { name: 'Ahora no' })).toHaveAttribute('aria-expanded', 'true')
    pickFile(container, csvFile())
    fireEvent.click(await screen.findByRole('button', { name: 'Importar 2 títulos' }))
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(1))
  })
})
