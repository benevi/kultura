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
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
let current = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => current }))

// Con «Sala» la rejilla llega por next/dynamic: aquí, un doble que enseña lo que recibe.
vi.mock('@/components/library/sala/SalaLibraryGridLazy', () => ({
  SalaLibraryGridLazy: ({ entries, scale }: { entries: LibraryEntry[]; scale: string }) => (
    <div data-testid="sala-grid" data-scale={scale}>
      {entries.map((e) => e.mediaId).join(',')}
    </div>
  ),
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
  })

  it('la rejilla de «Sala» sustituye a la de hoy, con lo filtrado y la escala', () => {
    current = new URLSearchParams('status=pending')
    const { container } = render(<LibraryClient entries={ENTRIES} diary={DIARY} quickEdit sala={sala} />)
    const grid = screen.getByTestId('sala-grid')
    expect(grid.textContent).toBe('game_3')
    expect(grid.dataset.scale).toBe('stars')
    expect(container.querySelector('[data-testid="library-quick-edit"]')).toBeNull()
  })

  it('sin títulos que encajen, el mismo vacío de hoy', () => {
    current = new URLSearchParams('type=comic')
    render(<LibraryClient entries={ENTRIES} sala={sala} />)
    expect(screen.queryByTestId('sala-grid')).toBeNull()
    expect(screen.getByText('library.empty.filtered')).toBeTruthy()
  })
})
