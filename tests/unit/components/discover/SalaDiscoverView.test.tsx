// ============================================================
// Fase 8.5 · D1: Descubrir en «Sala» (SALA_DESCUBRIR). Buscador, tipos,
// «Sorpréndeme», rejilla, error, vacíos y paginación; y los cuatro fallos que
// arregla de paso (imagen rota, × repetidas, error sin anunciar, aria-pressed).
// ============================================================

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaItem } from '@/types/media'

vi.mock('next-intl', () => {
  const make = (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`
    t.has = () => true
    return t
  }
  return { useTranslations: make, useLocale: () => 'es' }
})
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
const mockFetch = vi.fn()
vi.mock('@/lib/api/client', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/client')>()),
  apiFetch: (...args: unknown[]) => mockFetch(...args),
}))
vi.mock('@/lib/library/actions', () => ({ removeFromLibrary: vi.fn() }))

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

import { SalaDiscoverView, type SalaDiscoverViewProps } from '@/components/discover/sala/SalaDiscoverView'

function item(i: number, extra: Partial<MediaItem> = {}): MediaItem {
  return { id: `movie_${i}`, externalId: String(i), type: 'movie', title: `Obra ${i}`, year: 2000 + i, poster: `https://image.tmdb.org/t/p/w500/${i}.jpg`, ...extra }
}

const ITEMS: MediaItem[] = [item(1), item(2, { id: 'manga_2', externalId: '2', type: 'manga', title: '転生したらスライムだった件' }), item(3, { poster: undefined })]

function props(over: Partial<SalaDiscoverViewProps> = {}): SalaDiscoverViewProps {
  return {
    type: 'movie',
    query: '',
    isSearching: false,
    loading: false,
    items: ITEMS,
    fetchErrorKind: null,
    onRetry: vi.fn(),
    randomItem: null,
    onRandom: vi.fn(),
    onClearRandom: vi.fn(),
    filterGroups: [],
    activeFilters: {},
    hasActiveFilters: false,
    onFilterChange: vi.fn(),
    onClearFilters: vi.fn(),
    onSearch: vi.fn(),
    onClearSearch: vi.fn(),
    onTypeChange: vi.fn(),
    currentPage: 1,
    hasMore: false,
    totalPages: 1,
    onPageChange: vi.fn(),
    quickAdd: false,
    toastLabels: { region: 'Avisos', dismiss: 'Cerrar', hint: 'F8' },
    ...over,
  }
}

beforeEach(() => mockFetch.mockReset())

describe('SalaDiscoverView', () => {
  it('un h1, la lista con nombre y un enlace por obra (con su formato con palabras)', () => {
    render(<SalaDiscoverView {...props()} />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const list = screen.getByRole('list', { name: 'discover.sala.gridLabel' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(within(list).getByRole('link', { name: 'Obra 1' })).toHaveAttribute('href', '/media/movie/1')
    expect(within(list).getByRole('heading', { level: 2, name: '転生したらスライムだった件' })).toBeInTheDocument()
    expect(within(list).getAllByText('discoverFilters.typeBadge.movie')).toHaveLength(2)
  })

  it('imagen rota: la obra sin portada sigue en la rejilla, con el campo de color y su título', () => {
    const { container } = render(<SalaDiscoverView {...props()} />)
    const sinPortada = screen.getByRole('link', { name: 'Obra 3' }).closest('[data-sala-card]')!
    expect(sinPortada.querySelector('img')).toBeNull()
    expect(sinPortada.textContent).toContain('Obra 3')
    // Las que sí la traen, con imagen (de adorno).
    expect(container.querySelectorAll('[data-sala-card] img').length).toBeGreaterThanOrEqual(2)
  })

  it('× sin repetir: con búsqueda, una sola, la de borrar dentro del campo; sin chip de búsqueda', () => {
    render(<SalaDiscoverView {...props({ query: 'matrix', isSearching: true })} />)
    expect(screen.getAllByRole('button', { name: 'discover.sala.clearSearch' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'filters.reset' })).toBeNull()
    expect(screen.getByText('discover.sala.resultsFor:{"query":"matrix"}')).toBeInTheDocument()
    expect(screen.getByRole('search')).toContainElement(screen.getByRole('combobox', { name: 'discover.sala.searchLabel' }))
  })

  it('borrar la búsqueda vuelve al catálogo y deja el foco en el campo', () => {
    const p = props({ query: 'matrix', isSearching: true })
    render(<SalaDiscoverView {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'discover.sala.clearSearch' }))
    expect(p.onClearSearch).toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'discover.sala.searchLabel' })).toHaveFocus()
    expect(screen.getByRole('combobox', { name: 'discover.sala.searchLabel' })).toHaveValue('')
  })

  it('el campo tiene etiqueta a la vista y Enter busca', () => {
    const p = props()
    render(<SalaDiscoverView {...p} />)
    const input = screen.getByLabelText('discover.sala.searchLabel')
    fireEvent.change(input, { target: { value: 'dune' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(p.onSearch).toHaveBeenCalledWith('dune')
  })

  it('tipo en el móvil: un select nativo con las mismas opciones y el mismo manejador', () => {
    const p = props()
    render(<SalaDiscoverView {...p} />)
    const select = screen.getByRole('combobox', { name: 'filters.type' })
    expect(select).toHaveValue('movie')
    const group = screen.getByRole('group', { name: 'filters.type' })
    const options = within(select).getAllByRole('option').map((o) => o.textContent)
    const buttons = within(group).getAllByRole('button').map((b) => b.textContent)
    expect(options).toEqual(buttons)
    // Uno u otro según el ancho, solo con CSS.
    expect(select.closest('.sm\\:hidden')).not.toBeNull()
    expect(group).toHaveClass('hidden', 'sm:block')
    fireEvent.change(select, { target: { value: 'tv' } })
    expect(p.onTypeChange).toHaveBeenCalledWith('tv')
  })

  it('aria-pressed en los tipos y en «Sorpréndeme»', () => {
    const p = props()
    const { rerender } = render(<SalaDiscoverView {...p} />)
    const group = screen.getByRole('group', { name: 'filters.type' })
    expect(within(group).getByRole('button', { name: 'filters.movie' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'filters.tv' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(within(group).getByRole('button', { name: 'filters.tv' }))
    expect(p.onTypeChange).toHaveBeenCalledWith('tv')

    const random = screen.getByRole('button', { name: 'search.randomize' })
    expect(random).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(random)
    expect(p.onRandom).toHaveBeenCalled()

    rerender(<SalaDiscoverView {...p} randomItem={ITEMS[1]} />)
    const pressed = screen.getByRole('button', { name: 'search.randomize' })
    expect(pressed).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('list', { name: 'discover.sala.gridLabel' })).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('search.showingRandom:{"count":3}')).toHaveAttribute('role', 'status')
    fireEvent.click(pressed)
    expect(p.onClearRandom).toHaveBeenCalled()
  })

  it('«Sorpréndeme» sin obras: deshabilitado', () => {
    render(<SalaDiscoverView {...props({ items: [] })} />)
    expect(screen.getByRole('button', { name: 'search.randomize' })).toBeDisabled()
  })

  it('error anunciado: la región alert existe antes y el aviso entra en ella, con «Reintentar»', () => {
    const p = props({ items: [] })
    const { rerender } = render(<SalaDiscoverView {...p} />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeEmptyDOMElement()
    rerender(<SalaDiscoverView {...p} fetchErrorKind="rate-limit" />)
    expect(screen.getByRole('alert')).toBe(alert)
    expect(alert).toHaveTextContent('discover.sala.errorTitle')
    expect(alert).toHaveTextContent('discover.fetchError.rateLimit')
    // Con error no se pinta además el «sin resultados».
    expect(screen.queryByText('discover.noResults')).toBeNull()
    fireEvent.click(within(alert).getByRole('button', { name: 'discover.sala.retry' }))
    expect(p.onRetry).toHaveBeenCalled()
  })

  it('anuncia la carga y, al acabar, cuántas obras hay', async () => {
    const p = props({ loading: true, items: [] })
    const { rerender, container } = render(<SalaDiscoverView {...p} />)
    const status = container.querySelector('[data-sala-list-status]')!
    expect(status).toHaveTextContent('discover.sala.loading')
    expect(screen.getByRole('list', { name: 'discover.sala.gridLabel' })).toHaveAttribute('aria-busy', 'true')
    await act(async () => rerender(<SalaDiscoverView {...p} loading={false} items={ITEMS} />))
    expect(status).toHaveTextContent('discover.sala.results:{"count":3}')
  })

  it('vacíos: búsqueda (borrar), filtros (quitar) y catálogo', () => {
    const p = props({ items: [], query: 'zzz', isSearching: true })
    const { rerender } = render(<SalaDiscoverView {...p} />)
    expect(screen.getByRole('heading', { name: 'discover.sala.emptySearch:{"query":"zzz"}' })).toBeInTheDocument()
    rerender(<SalaDiscoverView {...p} query="" isSearching={false} hasActiveFilters />)
    fireEvent.click(screen.getByRole('button', { name: 'filters.reset' }))
    // D2: quita los filtros y deja el orden (no vuelve al catálogo pelado).
    expect(p.onClearFilters).toHaveBeenCalled()
    expect(p.onClearSearch).not.toHaveBeenCalled()
    rerender(<SalaDiscoverView {...p} query="" isSearching={false} />)
    expect(screen.getByRole('heading', { name: 'discover.noResults' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'filters.reset' })).toBeNull()
  })

  it('paginación: la actual con aria-current, anterior y siguiente', () => {
    const p = props({ currentPage: 2, hasMore: true, totalPages: 5 })
    render(<SalaDiscoverView {...p} />)
    const nav = screen.getByRole('navigation', { name: 'discover.paginationLabel' })
    expect(within(nav).getByRole('button', { name: 'discover.pageN:{"n":2}' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(within(nav).getByRole('button', { name: 'discover.next' }))
    expect(p.onPageChange).toHaveBeenCalledWith(3)
    fireEvent.click(within(nav).getByRole('button', { name: 'discover.pageN:{"n":5}' }))
    expect(p.onPageChange).toHaveBeenCalledWith(5)
  })

  it('sin más páginas en la primera, no hay paginación', () => {
    render(<SalaDiscoverView {...props()} />)
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('«+» de QUICK_ADD fuera del enlace, con nombre y aviso de «Sala»', async () => {
    mockFetch.mockResolvedValue({ added: ['movie_1'], skipped: [] })
    render(<SalaDiscoverView {...props({ quickAdd: true })} />)
    const add = screen.getByRole('button', { name: 'library.quickAdd:{"title":"Obra 1"}' })
    expect(add.closest('a')).toBeNull()
    await act(async () => fireEvent.click(add))
    expect(mockFetch).toHaveBeenCalledWith('/api/library/bulk', expect.objectContaining({ method: 'POST', json: { mediaIds: ['movie_1'] } }))
    expect(screen.getByRole('button', { name: 'library.quickInLibrary:{"title":"Obra 1"}' })).toHaveAttribute('aria-disabled', 'true')
    expect(await screen.findByText('library.quickAdded:{"title":"Obra 1"}')).toBeInTheDocument()
  })

  // ── D2: filtros ──────────────────────────────────────────────
  const GROUPS: SalaDiscoverViewProps['filterGroups'] = [
    { key: 'genre', kind: 'searchable', label: 'Género', options: [{ value: 'action', label: 'Acción' }, { value: 'drama', label: 'Drama' }] },
    { key: 'year', kind: 'single', label: 'Año', options: [{ value: '2026', label: '2026' }, { value: 'classic', label: 'Clásicos' }] },
    { key: 'platform', kind: 'multi', label: 'Plataforma', options: [{ value: 'netflix', label: 'Netflix' }] },
    { key: 'sort', kind: 'single', align: 'end', variant: 'sort', label: 'Ordenar', options: [{ value: 'popularity', label: 'Popularidad' }, { value: 'rating', label: 'Nota' }] },
  ]
  const NONE = { genre: [], year: 'all', platform: [], sort: 'all' }

  it('filtros: panel cerrado al entrar, «Filtros» con aria-expanded y sin FilterBar', () => {
    const { container } = render(<SalaDiscoverView {...props({ filterGroups: GROUPS, activeFilters: NONE })} />)
    const button = screen.getByRole('button', { name: 'filters.filters' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!
    expect(panel).not.toBeVisible()
    expect(container.querySelector('[data-testid^="filter-trigger-"]')).toBeNull()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toBeVisible()
    // Sin filtros puestos, sin «Quitar filtros».
    expect(screen.queryByRole('button', { name: 'filters.reset' })).toBeNull()
  })

  it('filtros: los de varias opciones son botones con aria-pressed; los de una, un select con «Cualquiera»', () => {
    const p = props({ filterGroups: GROUPS, activeFilters: { ...NONE, genre: ['drama'] } })
    render(<SalaDiscoverView {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'discover.sala.filtersActive:{"count":1}' }))
    const genre = screen.getByRole('group', { name: 'Género' })
    expect(within(genre).getByRole('button', { name: 'Drama' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(genre).getByRole('button', { name: 'Acción' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(within(genre).getByRole('button', { name: 'Acción' }))
    expect(p.onFilterChange).toHaveBeenLastCalledWith('genre', ['drama', 'action'])
    fireEvent.click(within(genre).getByRole('button', { name: 'Drama' }))
    expect(p.onFilterChange).toHaveBeenLastCalledWith('genre', [])

    const year = screen.getByRole('combobox', { name: 'Año' })
    expect(year).toHaveValue('all')
    expect(within(year).getAllByRole('option').map((o) => o.textContent)).toEqual(['discover.sala.any', '2026', 'Clásicos'])
    fireEvent.change(year, { target: { value: 'classic' } })
    expect(p.onFilterChange).toHaveBeenLastCalledWith('year', 'classic')
    fireEvent.change(year, { target: { value: 'all' } })
    expect(p.onFilterChange).toHaveBeenLastCalledWith('year', 'all')
  })

  it('orden: un select fuera del panel, con la primera opción si la URL no trae ninguna', () => {
    const p = props({ filterGroups: GROUPS, activeFilters: NONE })
    render(<SalaDiscoverView {...p} />)
    const sort = screen.getByRole('combobox', { name: 'discover.sala.sortLabel' })
    expect(sort).toBeVisible()
    expect(sort).toHaveValue('popularity')
    fireEvent.change(sort, { target: { value: 'rating' } })
    expect(p.onFilterChange).toHaveBeenLastCalledWith('sort', 'rating')
  })

  it('«Filtros · N» cuenta los filtros puestos (no el orden) y «Quitar filtros» los quita', () => {
    const p = props({ filterGroups: GROUPS, activeFilters: { genre: ['drama', 'action'], year: '2026', platform: [], sort: 'rating' }, hasActiveFilters: true })
    render(<SalaDiscoverView {...p} />)
    expect(screen.getByRole('button', { name: 'discover.sala.filtersActive:{"count":2}' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'filters.reset' }))
    expect(p.onClearFilters).toHaveBeenCalled()
  })

  it('al buscar no hay filtros ni orden', () => {
    render(<SalaDiscoverView {...props({ filterGroups: GROUPS, activeFilters: NONE, query: 'x', isSearching: true })} />)
    expect(screen.queryByRole('button', { name: 'filters.filters' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'discover.sala.sortLabel' })).toBeNull()
  })

  it('al cambiar de página, el foco pasa a la lista cuando llega la página nueva (o al h1 si llega vacía)', async () => {
    const p = props({ currentPage: 1, hasMore: true, totalPages: 3 })
    const { rerender } = render(<SalaDiscoverView {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'discover.next' }))
    expect(p.onPageChange).toHaveBeenCalledWith(2)
    await act(async () => rerender(<SalaDiscoverView {...p} currentPage={2} loading items={[]} />))
    await act(async () => rerender(<SalaDiscoverView {...p} currentPage={2} loading={false} items={ITEMS} />))
    const list = screen.getByRole('list', { name: 'discover.sala.gridLabel' })
    expect(list).toHaveFocus()
    expect(list).toHaveAttribute('tabindex', '-1')

    fireEvent.click(screen.getByRole('button', { name: 'discover.next' }))
    await act(async () => rerender(<SalaDiscoverView {...p} currentPage={3} loading items={[]} />))
    await act(async () => rerender(<SalaDiscoverView {...p} currentPage={3} loading={false} items={[]} />))
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  it('sin cambiar de página, la carga no mueve el foco', async () => {
    const p = props()
    const { rerender } = render(<SalaDiscoverView {...p} />)
    const input = screen.getByRole('combobox', { name: 'discover.sala.searchLabel' })
    input.focus()
    await act(async () => rerender(<SalaDiscoverView {...p} loading items={[]} />))
    await act(async () => rerender(<SalaDiscoverView {...p} loading={false} items={ITEMS} />))
    expect(input).toHaveFocus()
  })
})
