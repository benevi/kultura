// ============================================================
// KULTURA — Biblioteca: HTML de LibraryClient (caracterización, fase 8.5 B1).
//
// Fija el marcado de la biblioteca de hoy (contadores, filtros, rejilla con
// `MediaGrid` de verdad, edición rápida, vacíos y diario) para que la bandera
// `SALA_BIBLIOTECA` apagada la deje EXACTAMENTE igual. La instantánea se sacó
// antes de tocar la biblioteca: si cambia, algo de «Sala» se ha colado.
// ============================================================

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DiaryLog, LibraryEntry, LibraryStatus } from '@/types/library'

vi.mock('next-intl', () => {
  const make = (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? `(${Object.values(values).join(',')})` : ''}`
    t.has = () => true
    t.rich = t
    return t
  }
  return { useTranslations: make, useLocale: () => 'es', useFormatter: () => ({ dateTime: () => 'fecha' }) }
})
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: vi.fn(), showError: vi.fn(), dismiss: vi.fn() }),
}))
const mockPush = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
let current = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => current }))

// Con «Sala» la biblioteca llega por next/dynamic: aquí, un doble que guarda lo que recibe.
let salaProps: Record<string, unknown> | null = null
vi.mock('@/components/library/sala/SalaLibraryViewLazy', () => ({
  SalaLibraryViewLazy: (props: { entries: LibraryEntry[]; scale: string; diary?: React.ReactNode }) => {
    salaProps = props
    return (
      <div data-testid="sala-view" data-scale={props.scale}>
        {props.entries.map((e) => e.mediaId).join(',')}
        {props.diary}
      </div>
    )
  },
}))

import { LibraryClient } from '@/app/[locale]/(app)/library/LibraryClient'

function entry(i: number, type: string, status: LibraryStatus, extra: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: `e${i}`,
    userId: 'u',
    mediaId: `${type}_${i}`,
    status,
    score: null,
    watchedAt: null,
    episodeProgress: null,
    createdAt: '2026-01-01',
    title: `Obra ${i}`,
    year: 2000 + i,
    ...extra,
  }
}

const ENTRIES: LibraryEntry[] = [
  entry(1, 'movie', 'completed', { score: 4, rating10: 8, poster: 'https://image.tmdb.org/t/p/w500/a.jpg' }),
  entry(2, 'manga', 'in_progress', { title: '転生したらスライムだった件' }),
  entry(3, 'game', 'pending', { poster: 'https://media.rawg.io/media/games/b.jpg' }),
  entry(4, 'book', 'abandoned', { title: undefined, year: undefined }),
]

const DIARY: { logs: DiaryLog[]; scale: 'stars' } = { logs: [], scale: 'stars' }

describe('LibraryClient (sin «Sala»): marcado de hoy', () => {
  beforeEach(() => {
    current = new URLSearchParams()
  })

  it('rejilla con contadores y filtros', () => {
    const { container } = render(<LibraryClient entries={ENTRIES} />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('rejilla con edición rápida y diario', () => {
    const { container } = render(<LibraryClient entries={ENTRIES} diary={DIARY} quickEdit />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('filtro sin resultados', () => {
    current = new URLSearchParams('type=comic')
    const { container } = render(<LibraryClient entries={ENTRIES} quickEdit />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('biblioteca vacía', () => {
    const { container } = render(<LibraryClient entries={[]} diary={DIARY} />)
    expect(container.innerHTML).toMatchSnapshot()
  })
})

describe('LibraryClient con «Sala» (SALA_BIBLIOTECA)', () => {
  const sala = { toastLabels: { region: 'Avisos', dismiss: 'Cerrar' } }

  beforeEach(() => {
    current = new URLSearchParams()
    salaProps = null
    mockPush.mockReset()
  })

  it('la vista de «Sala» sustituye a toda la biblioteca, con lo filtrado, los contadores y la escala', () => {
    current = new URLSearchParams('status=pending&sort=title')
    const { container } = render(<LibraryClient entries={ENTRIES} diary={DIARY} quickEdit sala={sala} />)
    const view = screen.getByTestId('sala-view')
    expect(view.textContent).toBe('game_3')
    expect(view.dataset.scale).toBe('stars')
    // Nada de la de hoy: ni su cabecera, ni sus chips, ni su edición rápida.
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('[role="group"]')).toBeNull()
    expect(container.querySelector('[data-testid="library-quick-edit"]')).toBeNull()
    expect(salaProps).toMatchObject({
      view: 'collection',
      totalCount: 4,
      counts: { completed: 1, in_progress: 1, pending: 1, abandoned: 1 },
      filters: { type: 'all', status: 'pending', score: 'all', favorites: false, sort: 'title' },
      viewHrefs: { collection: '/library?status=pending&sort=title', diary: '/library?view=diary&status=pending&sort=title' },
      toastLabels: sala.toastLabels,
    })
  })

  it('los filtros siguen en la URL y en el historial, sin ir al servidor: conserva el resto y el orden', () => {
    current = new URLSearchParams('type=movie&sort=year')
    const pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
    render(<LibraryClient entries={ENTRIES} diary={DIARY} sala={sala} />)
    const onFilter = salaProps!.onFilter as (next: Record<string, string>) => void
    const path = window.location.pathname
    onFilter({ status: 'completed' })
    expect(pushState).toHaveBeenLastCalledWith(null, '', `${path}?type=movie&status=completed&sort=year`)
    onFilter({ type: 'all', status: 'all', score: 'all', fav: 'all' })
    expect(pushState).toHaveBeenLastCalledWith(null, '', `${path}?sort=year`)
    onFilter({ type: 'all', sort: 'recent' })
    expect(pushState).toHaveBeenLastCalledWith(null, '', path)
    expect(mockPush).not.toHaveBeenCalled()
    pushState.mockRestore()
  })

  it('sin diario: ni selector de vista ni favoritos', () => {
    render(<LibraryClient entries={ENTRIES} sala={sala} />)
    expect(salaProps!.viewHrefs).toBeNull()
  })

  it('el diario va dentro de la vista de «Sala»', () => {
    current = new URLSearchParams('view=diary')
    render(<LibraryClient entries={ENTRIES} diary={DIARY} sala={sala} />)
    expect(salaProps!.view).toBe('diary')
    expect(salaProps!.diary).toBeTruthy()
  })

  it('sin títulos que encajen, la vista recibe la lista vacía (su vacío es de «Sala»)', () => {
    current = new URLSearchParams('type=comic')
    render(<LibraryClient entries={ENTRIES} sala={sala} />)
    expect(screen.getByTestId('sala-view').textContent).toBe('')
    expect(screen.queryByText('library.empty.filtered')).toBeNull()
  })
})
