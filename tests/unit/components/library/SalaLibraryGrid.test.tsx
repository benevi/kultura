// ============================================================
// Fase 8.5 · B1: la rejilla de la Biblioteca en «Sala» (SALA_BIBLIOTECA) y
// su edición rápida en el diálogo de la ficha.
// ============================================================

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DiaryConfig, LibraryEntry, LibraryStatus } from '@/types/library'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  useLocale: () => 'es',
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mockSave = vi.fn()
const mockFetchDiary = vi.fn()
const mockFetchProgress = vi.fn()
vi.mock('@/lib/library/actions', () => ({
  saveLibraryEntry: (...args: unknown[]) => mockSave(...args),
  fetchDiaryConfig: (...args: unknown[]) => mockFetchDiary(...args),
  fetchProgressConfig: (...args: unknown[]) => mockFetchProgress(...args),
  deleteDiaryLog: vi.fn(),
  removeFromLibrary: vi.fn(),
}))

import { SalaLibraryGrid } from '@/components/library/sala/SalaLibraryGrid'

const labels = { region: 'Avisos', dismiss: 'Cerrar', hint: 'F8' }

function entry(mediaId: string, status: LibraryStatus, extra: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: `id-${mediaId}`,
    userId: 'u',
    mediaId,
    status,
    score: null,
    watchedAt: null,
    episodeProgress: null,
    createdAt: '2026-01-01',
    ...extra,
  }
}

const ENTRIES: LibraryEntry[] = [
  entry('movie_496243', 'completed', { title: 'Parásitos', year: 2019, score: 5, rating10: 9, poster: 'https://image.tmdb.org/t/p/w500/p.jpg' }),
  entry('manga_108556', 'in_progress', { title: '転生したらスライムだった件', year: 2015 }),
  entry('game_326243', 'pending', { title: 'Elden Ring', year: 2022, score: 4 }),
  entry('book_OL1W', 'abandoned'),
]

function renderGrid(props: Partial<React.ComponentProps<typeof SalaLibraryGrid>> = {}) {
  const onSaved = vi.fn()
  render(<SalaLibraryGrid entries={ENTRIES} scale="stars" onSaved={onSaved} toastLabels={labels} {...props} />)
  return { onSaved }
}

beforeEach(() => {
  mockSave.mockReset()
  mockFetchDiary.mockReset().mockResolvedValue({ enabled: true, scale: 'stars', logs: [] } satisfies DiaryConfig)
  mockFetchProgress.mockReset().mockResolvedValue(null)
})

describe('SalaLibraryGrid: la rejilla', () => {
  it('es una lista con nombre y un elemento por título', () => {
    renderGrid()
    const list = screen.getByRole('list', { name: 'library.gridLabel' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(ENTRIES.length)
  })

  it('un enlace por tarjeta: su nombre es solo el título y lleva a la ficha', () => {
    renderGrid()
    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual(['Parásitos', '転生したらスライムだった件', 'Elden Ring', 'book_OL1W'])
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/media/movie/496243',
      '/media/manga/108556',
      '/media/game/326243',
      '/media/book/OL1W',
    ])
  })

  it('títulos en h2 (bajo el h1 de la página)', () => {
    renderGrid()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(ENTRIES.length)
  })

  it('formato, estado y nota con palabras', () => {
    renderGrid()
    const [first, , third, fourth] = screen.getAllByRole('listitem')
    expect(first.textContent).toContain('discoverFilters.typeBadge.movie')
    expect(first.textContent).toContain('library.status.completed')
    // 9/10 en estrellas: 4,5 de 5.
    expect(first.textContent).toContain('library.cardScore:{"scale":"stars","value":"4,5"}')
    // Sin rating10, la nota entera de siempre (4 de 5).
    expect(third.textContent).toContain('library.cardScore:{"scale":"stars","value":"4"}')
    // Sin nota, no se dice nada de la nota.
    expect(fourth.textContent).not.toContain('cardScore')
    expect(fourth.textContent).toContain('library.status.abandoned')
  })

  it('en la escala de 10, la nota tal cual', () => {
    renderGrid({ scale: 'ten' })
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('library.cardScore:{"scale":"ten","value":"9"}')
  })

  it('cada tarjeta tiene su botón de edición rápida, fuera del enlace y con el título en el nombre', () => {
    renderGrid()
    const button = screen.getByRole('button', { name: 'library.quickEdit:{"title":"Elden Ring"}' })
    expect(button.closest('a')).toBeNull()
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
  })
})

describe('SalaLibraryGrid: edición rápida', () => {
  it('abre el diálogo de «Sala» con el foco en «Estado» y la entrada guardada', async () => {
    renderGrid()
    fireEvent.click(screen.getByRole('button', { name: 'library.quickEdit:{"title":"Elden Ring"}' }))
    const dialog = await screen.findByRole('dialog')
    expect(mockFetchDiary).toHaveBeenCalledWith('game_326243')
    expect(mockFetchProgress).toHaveBeenCalledWith('game_326243')
    const status = within(dialog).getByRole('combobox', { name: /library\.statusLabel/ }) as HTMLSelectElement
    expect(status.value).toBe('pending')
    await waitFor(() => expect(document.activeElement).toBe(status))
  })

  it('guardar: llama al servidor, cierra, avisa y devuelve la entrada con su título y portada', async () => {
    const saved = { ...ENTRIES[2], status: 'completed' as const, title: undefined }
    mockSave.mockResolvedValue({ entry: saved, log: null, logFailed: false })
    const { onSaved } = renderGrid()
    const button = screen.getByRole('button', { name: 'library.quickEdit:{"title":"Elden Ring"}' })
    fireEvent.click(button)
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('combobox', { name: /library\.statusLabel/ }), { target: { value: 'completed' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'library.saveStatus' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'game_326243', status: 'completed' }))
    // Sin `mediaCache`: la biblioteca no reescribe la caché de la obra.
    expect(mockSave.mock.calls[0][0]).not.toHaveProperty('mediaCache')
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'game_326243', status: 'completed', title: 'Elden Ring' }))
    await waitFor(() => expect(screen.getByText('library.saved')).toBeTruthy())
  })

  it('error al guardar: el diálogo sigue abierto y lo dice dentro', async () => {
    mockSave.mockRejectedValue(new Error('red'))
    const { onSaved } = renderGrid()
    fireEvent.click(screen.getByRole('button', { name: 'library.quickEdit:{"title":"Elden Ring"}' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'library.saveStatus' }))
    await waitFor(() => expect(within(dialog).getByText('library.errors.saveFailed')).toBeTruthy())
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('«Cancelar» va primero, cierra y devuelve el foco al botón', async () => {
    renderGrid()
    const button = screen.getByRole('button', { name: 'library.quickEdit:{"title":"Parásitos"}' })
    button.focus()
    fireEvent.click(button)
    const dialog = await screen.findByRole('dialog')
    const footer = within(dialog).getAllByRole('button').filter((b) => /library\.(cancel|saveStatus)/.test(b.textContent ?? ''))
    expect(footer.map((b) => b.textContent)).toEqual(['library.cancel', 'library.saveStatus'])
    fireEvent.click(footer[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(button))
  })
})

describe('Biblioteca con la bandera apagada: sin código de «Sala»', () => {
  it('LibraryClient solo trae «Sala» por next/dynamic (y tipos)', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/[locale]/(app)/library/LibraryClient.tsx'), 'utf8')
    const salaImports = [...src.matchAll(/^import (type )?.*from '([^']*sala[^']*)'/gim)].map((m) => ({ type: !!m[1], from: m[2] }))
    expect(salaImports.length).toBeGreaterThan(0)
    for (const imp of salaImports) {
      expect(imp.type || imp.from === '@/components/library/sala/SalaLibraryGridLazy', imp.from).toBe(true)
    }
    const lazy = readFileSync(join(process.cwd(), 'src/components/library/sala/SalaLibraryGridLazy.tsx'), 'utf8')
    expect(lazy).toMatch(/dynamic\(\(\) => import\("\.\/SalaLibraryGrid"\)/)
  })
})
