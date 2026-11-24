// ============================================================
// Fase 8.5 · B2: la parte de arriba de la Biblioteca en «Sala»
// (SALA_BIBLIOTECA): cabecera, Títulos/Diario, contadores que filtran por
// estado, panel de filtros y orden. La rejilla es la de B1 (su propio test).
// ============================================================

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { LibraryEntry, LibraryStatus } from '@/types/library'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  useLocale: () => 'es',
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, scroll: _scroll, ...props }: { href: string; children: React.ReactNode; scroll?: boolean }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
// La rejilla tiene su test: aquí, un doble que enseña el orden que recibe.
vi.mock('@/components/library/sala/SalaLibraryGrid', () => ({
  SalaLibraryGrid: ({ entries }: { entries: LibraryEntry[] }) => <div data-testid="grid">{entries.map((e) => e.mediaId).join(',')}</div>,
}))

import { SalaLibraryView, type SalaLibraryViewProps } from '@/components/library/sala/SalaLibraryView'

function entry(mediaId: string, status: LibraryStatus, extra: Partial<LibraryEntry> = {}): LibraryEntry {
  return { id: mediaId, userId: 'u', mediaId, status, score: null, watchedAt: null, episodeProgress: null, createdAt: '2026-01-01', ...extra }
}

const ENTRIES = [
  entry('movie_1', 'completed', { title: 'Zodiac', year: 2007 }),
  entry('game_2', 'pending', { title: 'Alan Wake 2', year: 2023 }),
]

const FILTERS = { type: 'all', status: 'all', score: 'all', favorites: false, sort: 'recent' }

function renderView(props: Partial<SalaLibraryViewProps> = {}) {
  const onFilter = vi.fn()
  const utils = render(
    <SalaLibraryView
      view="collection"
      viewHrefs={{ collection: '/library', diary: '/library?view=diary' }}
      totalCount={7}
      counts={{ completed: 3, in_progress: 2, pending: 2 }}
      filters={FILTERS}
      onFilter={onFilter}
      entries={ENTRIES}
      scale="stars"
      onSaved={vi.fn()}
      toastLabels={{ region: 'Avisos', dismiss: 'Cerrar' }}
      {...props}
    />
  )
  return { onFilter, ...utils }
}

describe('SalaLibraryView: cabecera', () => {
  it('un h1 y el número de títulos que se ven, en una región que se anuncia', () => {
    renderView()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('library.title')
    expect(screen.getByRole('status').textContent).toBe('library.items:{"count":2}')
  })

  it('Títulos/Diario: dos enlaces con la vista actual marcada', () => {
    renderView()
    const nav = screen.getByRole('navigation', { name: 'diary.view' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')])).toEqual([
      ['diary.viewCollection', '/library', 'page'],
      ['diary.viewDiary', '/library?view=diary', null],
    ])
  })

  it('sin diario no hay selector ni favoritos', () => {
    renderView({ viewHrefs: null })
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('en el diario: la cabecera, el diario y nada de filtros', () => {
    renderView({ view: 'diary', diary: <p>diario</p> })
    expect(screen.getByText('diario')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByTestId('grid')).toBeNull()
  })

  it('biblioteca vacía: el vacío de «Sala» con su enlace a Descubrir', () => {
    renderView({ totalCount: 0, entries: [], counts: {} })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('library.empty.title')
    expect(screen.getByRole('link', { name: 'library.empty.cta' }).getAttribute('href')).toBe('/discover')
    expect(screen.queryByRole('group')).toBeNull()
  })
})

describe('SalaLibraryView: contadores que filtran por estado', () => {
  it('cuatro botones con aria-pressed que cuentan la biblioteca entera', () => {
    renderView({ filters: { ...FILTERS, status: 'pending' } })
    const group = screen.getByRole('group', { name: 'library.sala.statusFilter' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['3 library.counters.completed', 'false'],
      ['2 library.counters.inProgress', 'false'],
      ['2 library.counters.pending', 'true'],
      ['0 library.counters.dropped', 'false'],
    ])
  })

  it('pulsar filtra; pulsar el activo lo quita', () => {
    const { onFilter } = renderView({ filters: { ...FILTERS, status: 'pending' } })
    fireEvent.click(screen.getByRole('button', { name: '3 library.counters.completed' }))
    expect(onFilter).toHaveBeenLastCalledWith({ status: 'completed' })
    fireEvent.click(screen.getByRole('button', { name: '2 library.counters.pending' }))
    expect(onFilter).toHaveBeenLastCalledWith({ status: 'all' })
  })
})

describe('SalaLibraryView: panel de filtros', () => {
  it('«Filtros» abre y cierra el panel (aria-expanded y aria-controls)', () => {
    renderView()
    const button = screen.getByRole('button', { name: 'filters.filters' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!
    expect(panel.hidden).toBe(true)
    expect(panel.className).toContain('hidden')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)
    expect(panel.className).toContain('grid')
    fireEvent.click(button)
    expect(panel.hidden).toBe(true)
  })

  it('formato: botones con aria-pressed en un grupo con nombre', () => {
    const { onFilter } = renderView({ filters: { ...FILTERS, type: 'manga' } })
    fireEvent.click(screen.getByRole('button', { name: /library\.sala\.filtersActive/ }))
    const type = screen.getByRole('group', { name: 'filters.type' })
    const typeButtons = within(type).getAllByRole('button')
    expect(typeButtons).toHaveLength(8)
    expect(typeButtons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)).toEqual(['filters.manga'])
    fireEvent.click(within(type).getByRole('button', { name: 'filters.manga' }))
    expect(onFilter).toHaveBeenLastCalledWith({ type: 'all' })
    fireEvent.click(within(type).getByRole('button', { name: 'filters.book' }))
    expect(onFilter).toHaveBeenLastCalledWith({ type: 'book' })
  })

  it('nota mínima: un desplegable con etiqueta y el mismo parámetro', () => {
    const { onFilter } = renderView({ filters: { ...FILTERS, score: '4' } })
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    const select = screen.getByRole('combobox', { name: 'library.sala.scoreLabel' }) as HTMLSelectElement
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
      ['all', 'library.sala.scoreAny'],
      ['5', 'library.sala.scoreTop'],
      ['4', 'library.sala.scoreMin:{"stars":4}'],
      ['3', 'library.sala.scoreMin:{"stars":3}'],
      ['2', 'library.sala.scoreMin:{"stars":2}'],
    ])
    expect(select.value).toBe('4')
    fireEvent.change(select, { target: { value: '5' } })
    expect(onFilter).toHaveBeenLastCalledWith({ score: '5' })
    fireEvent.change(select, { target: { value: 'all' } })
    expect(onFilter).toHaveBeenLastCalledWith({ score: 'all' })
  })

  it('solo favoritos: un interruptor (role="switch")', () => {
    const { onFilter, rerender } = renderView({ filters: { ...FILTERS, favorites: true } })
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    const fav = screen.getByRole('switch', { name: 'library.sala.favoritesOnly' }) as HTMLInputElement
    expect(fav.checked).toBe(true)
    fireEvent.click(fav)
    expect(onFilter).toHaveBeenLastCalledWith({ fav: 'all' })
    rerender(
      <SalaLibraryView
        view="collection"
        viewHrefs={{ collection: '/library', diary: '/library?view=diary' }}
        totalCount={7}
        counts={{}}
        filters={FILTERS}
        onFilter={onFilter}
        entries={ENTRIES}
        scale="stars"
        onSaved={vi.fn()}
        toastLabels={{ region: 'Avisos', dismiss: 'Cerrar' }}
      />
    )
    fireEvent.click(screen.getByRole('switch', { name: 'library.sala.favoritesOnly' }))
    expect(onFilter).toHaveBeenLastCalledWith({ fav: '1' })
  })

  it('el botón dice cuántos filtros del panel hay puestos', () => {
    renderView({ filters: { ...FILTERS, type: 'manga', favorites: true, status: 'pending' } })
    expect(screen.getByRole('button', { name: 'library.sala.filtersActive:{"count":2}' })).toBeTruthy()
  })

  it('«Quitar filtros» solo con alguno puesto; deja el orden y la vista', () => {
    renderView()
    expect(screen.queryByRole('button', { name: 'filters.reset' })).toBeNull()
    const { onFilter } = renderView({ filters: { ...FILTERS, status: 'completed', sort: 'year' } })
    fireEvent.click(screen.getByRole('button', { name: 'filters.reset' }))
    expect(onFilter).toHaveBeenLastCalledWith({ type: 'all', status: 'all', score: 'all', fav: 'all' })
  })

  it('sin resultados: el vacío de «Sala» con «Quitar filtros»', () => {
    const { onFilter } = renderView({ entries: [], filters: { ...FILTERS, type: 'comic' } })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('library.empty.filtered')
    expect(screen.getByRole('status').textContent).toBe('library.items:{"count":0}')
    expect(screen.queryByTestId('grid')).toBeNull()
    const resets = screen.getAllByRole('button', { name: 'filters.reset' })
    fireEvent.click(resets[resets.length - 1])
    expect(onFilter).toHaveBeenLastCalledWith({ type: 'all', status: 'all', score: 'all', fav: 'all' })
  })
})

describe('SalaLibraryView: orden', () => {
  it('un desplegable con los cuatro órdenes; cambiarlo va a la URL', () => {
    const { onFilter } = renderView()
    const select = screen.getByRole('combobox', { name: 'library.sala.sortLabel' }) as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['recent', 'title', 'year', 'rating'])
    expect(select.value).toBe('recent')
    fireEvent.change(select, { target: { value: 'title' } })
    expect(onFilter).toHaveBeenLastCalledWith({ sort: 'title' })
  })

  it('la rejilla recibe los títulos en el orden elegido; uno raro es el de siempre', () => {
    const { rerender } = renderView({ filters: { ...FILTERS, sort: 'title' } })
    expect(screen.getByTestId('grid').textContent).toBe('game_2,movie_1')
    rerender(
      <SalaLibraryView
        view="collection"
        viewHrefs={null}
        totalCount={7}
        counts={{}}
        filters={{ ...FILTERS, sort: 'nope' }}
        onFilter={vi.fn()}
        entries={ENTRIES}
        scale="stars"
        onSaved={vi.fn()}
        toastLabels={{ region: 'Avisos', dismiss: 'Cerrar' }}
      />
    )
    expect(screen.getByTestId('grid').textContent).toBe('movie_1,game_2')
  })
})
