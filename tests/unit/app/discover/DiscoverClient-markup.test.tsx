// ============================================================
// KULTURA — Descubrir: HTML de DiscoverClient (caracterización, fase 8.5 D1).
//
// Fija el marcado de Descubrir de hoy (cabecera, barra con el buscador de
// verdad, tipos, filtros, rejilla bento con `MediaGrid`, «+», aleatorio,
// errores, vacíos y paginación) para que la bandera `SALA_DESCUBRIR` apagada
// la deje EXACTAMENTE igual. La instantánea se sacó antes de tocar Descubrir:
// si cambia, algo de «Sala» se ha colado.
// ============================================================

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '@/types/media'

vi.mock('next-intl', () => {
  const make = (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? `(${Object.values(values).join(',')})` : ''}`
    t.has = () => true
    t.rich = t
    return t
  }
  return { useTranslations: make, useLocale: () => 'es' }
})
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: vi.fn(), showError: vi.fn(), dismiss: vi.fn() }),
}))
const mockPush = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/discover',
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
let current = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => current }))

// Con «Sala» Descubrir llega por next/dynamic: aquí, un doble que guarda lo que recibe.
let salaProps: Record<string, unknown> | null = null
vi.mock('@/components/discover/sala/SalaDiscoverViewLazy', () => ({
  SalaDiscoverViewLazy: (props: Record<string, unknown>) => {
    salaProps = props
    return <div data-testid="sala-discover" />
  },
}))

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

import { DiscoverClient } from '@/app/[locale]/(app)/discover/DiscoverClient'

function item(i: number, extra: Partial<MediaItem> = {}): MediaItem {
  return {
    id: `movie_${i}`,
    externalId: String(i),
    type: 'movie',
    title: `Obra ${i}`,
    year: 2000 + i,
    poster: `https://image.tmdb.org/t/p/w500/${i}.jpg`,
    ...extra,
  } as MediaItem
}

const ITEMS: MediaItem[] = [
  item(1),
  item(2, { type: 'manga', id: 'manga_2', title: '転生したらスライムだった件' }),
  item(3, { poster: undefined }),
  item(4, { type: 'game', id: 'game_4' }),
]

function mockDiscover(body: Record<string, unknown>, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    headers: new Headers(),
    json: async () => (ok ? { data: body } : { error: body }),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

async function settle() {
  await waitFor(() => expect(document.querySelector('.animate-pulse')).toBeNull())
}

describe('DiscoverClient (sin «Sala»): marcado de hoy', () => {
  beforeEach(() => {
    current = new URLSearchParams('type=movie')
    vi.clearAllMocks()
  })

  it('cargando', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)))
    const { container } = render(<DiscoverClient currentType="movie" currentPage={1} />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('catálogo con resultados, «+» y paginación', async () => {
    mockDiscover({ items: ITEMS, hasMore: true, totalPages: 5, fetchErrorKind: null })
    const { container } = render(<DiscoverClient currentType="movie" currentPage={2} quickAdd />)
    await settle()
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('búsqueda con resultados (todos los tipos)', async () => {
    current = new URLSearchParams('type=all&q=matrix')
    mockDiscover({ items: ITEMS, hasMore: false, totalPages: 1, fetchErrorKind: null })
    const { container } = render(<DiscoverClient currentType="all" currentPage={1} currentQuery="matrix" />)
    await settle()
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('aleatorio', async () => {
    mockDiscover({ items: ITEMS, hasMore: false, totalPages: 1, fetchErrorKind: null })
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { container } = render(<DiscoverClient currentType="movie" currentPage={1} />)
    await settle()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'search.randomize' }))
    })
    expect(container.innerHTML).toMatchSnapshot()
    vi.mocked(Math.random).mockRestore()
  })

  it('error del catálogo (genérico)', async () => {
    mockDiscover({ items: [], hasMore: false, totalPages: 1, fetchErrorKind: 'generic' })
    const { container } = render(<DiscoverClient currentType="movie" currentPage={1} />)
    await settle()
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('error por límite de peticiones', async () => {
    mockDiscover({ code: 'rate_limited', message: 'x' }, false, 429)
    const { container } = render(<DiscoverClient currentType="movie" currentPage={1} />)
    await settle()
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('búsqueda sin resultados', async () => {
    current = new URLSearchParams('type=movie&q=zzz')
    mockDiscover({ items: [], hasMore: false, totalPages: 1, fetchErrorKind: null })
    const { container } = render(<DiscoverClient currentType="movie" currentPage={1} currentQuery="zzz" />)
    await settle()
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('filtros sin resultados', async () => {
    current = new URLSearchParams('type=movie&genre=28')
    mockDiscover({ items: [], hasMore: false, totalPages: 1, fetchErrorKind: null })
    const { container } = render(<DiscoverClient currentType="movie" currentPage={1} />)
    await settle()
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('no monta la vista de «Sala»', async () => {
    mockDiscover({ items: ITEMS, hasMore: false, totalPages: 1, fetchErrorKind: null })
    render(<DiscoverClient currentType="movie" currentPage={1} />)
    await settle()
    expect(screen.queryByTestId('sala-discover')).toBeNull()
    expect(salaProps).toBeNull()
  })
})

describe('DiscoverClient con «Sala» (SALA_DESCUBRIR)', () => {
  const sala = { toastLabels: { region: 'Avisos', dismiss: 'Cerrar' } }

  beforeEach(() => {
    current = new URLSearchParams('type=all&q=matrix')
    salaProps = null
    vi.clearAllMocks()
  })

  it('la vista de «Sala» sustituye a toda la pantalla y recibe el estado de la URL y de la petición', async () => {
    mockDiscover({ items: ITEMS, hasMore: true, totalPages: 3, fetchErrorKind: null })
    const { container } = render(
      <DiscoverClient currentType="all" currentPage={2} currentQuery="matrix" quickAdd sala={sala} />
    )
    await waitFor(() => expect(salaProps?.loading).toBe(false))
    expect(screen.getByTestId('sala-discover')).toBeInTheDocument()
    // Nada de la de hoy: ni su cabecera, ni su barra, ni su paginación.
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('nav')).toBeNull()
    expect(salaProps).toMatchObject({
      type: 'all',
      query: 'matrix',
      isSearching: true,
      items: ITEMS,
      fetchErrorKind: null,
      randomItem: null,
      currentPage: 2,
      hasMore: true,
      totalPages: 3,
      quickAdd: true,
      toastLabels: sala.toastLabels,
    })
  })

  it('«Reintentar» vuelve a pedir la misma página', async () => {
    current = new URLSearchParams('type=movie')
    const fetchFn = mockDiscover({ items: [], hasMore: false, totalPages: 1, fetchErrorKind: 'generic' })
    render(<DiscoverClient currentType="movie" currentPage={1} sala={sala} />)
    await waitFor(() => expect(salaProps?.fetchErrorKind).toBe('generic'))
    await waitFor(() => expect(salaProps?.loading).toBe(false))
    const calls = fetchFn.mock.calls.length
    await act(async () => (salaProps!.onRetry as () => void)())
    await waitFor(() => expect(fetchFn.mock.calls.length).toBe(calls + 1))
    expect(fetchFn.mock.calls.at(-1)?.[0]).toBe(fetchFn.mock.calls.at(-2)?.[0])
  })

  it('buscar y borrar la búsqueda van a la URL como hoy', async () => {
    mockDiscover({ items: ITEMS, hasMore: false, totalPages: 1, fetchErrorKind: null })
    render(<DiscoverClient currentType="all" currentPage={1} currentQuery="matrix" sala={sala} />)
    await waitFor(() => expect(salaProps?.loading).toBe(false))
    act(() => (salaProps!.onSearch as (q: string) => void)('dune'))
    expect(mockPush).toHaveBeenLastCalledWith(expect.stringContaining('q=dune'))
    act(() => (salaProps!.onClearSearch as () => void)())
    expect(mockPush).toHaveBeenLastCalledWith('/discover?type=all&page=1')
  })
})
