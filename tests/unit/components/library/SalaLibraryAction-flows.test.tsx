// ============================================================
// Fase 8.5 · F2b (arreglos de #274): caminos de «Sala» que el primer test no
// cubría. Borrado diferido (caducidad, pagehide, desmontar, re-añadir), foco
// tras «Deshacer» y tras controles que desaparecen, diario, progreso por
// tipo, fecha futura, spoiler y sello.
// ============================================================

import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DiaryConfig, DiaryLog, LibraryEntry } from '@/types/library'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  useLocale: () => 'es',
}))

const mockSave = vi.fn()
const mockRemove = vi.fn()
const mockFetchDiary = vi.fn()
const mockFetchProgress = vi.fn()
const mockDeleteLog = vi.fn()

vi.mock('@/lib/library/actions', () => ({
  saveLibraryEntry: async (...args: unknown[]) => {
    const result = await mockSave(...args)
    return result && typeof result === 'object' && 'entry' in result ? result : { entry: result, log: null, logFailed: false }
  },
  removeFromLibrary: (...args: unknown[]) => mockRemove(...args),
  fetchDiaryConfig: (...args: unknown[]) => mockFetchDiary(...args),
  fetchProgressConfig: (...args: unknown[]) => mockFetchProgress(...args),
  deleteDiaryLog: (...args: unknown[]) => mockDeleteLog(...args),
}))

import { SalaLibraryAction } from '@/components/library/sala/SalaLibraryAction'
import { __resetDiaryCache, type LibraryMediaCache } from '@/components/library/useLibraryAction'
import { ProgressInput } from '@/components/library/ProgressInput'
import { localDateString } from '@/lib/library/dates'

const labels = { region: 'Avisos', dismiss: 'Cerrar', hint: 'F8' }
const movie = { externalId: '550', type: 'movie', title: 'Fight Club', year: 1999 }

const entry = {
  id: 'uuid-1',
  userId: 'user-1',
  mediaId: 'movie_550',
  status: 'in_progress',
  score: 4,
  rating10: 8,
  watchedAt: null,
  episodeProgress: null,
  createdAt: '2024-01-01T00:00:00Z',
  title: 'Fight Club',
} as LibraryEntry

const log = (id: string, watchedOn: string): DiaryLog => ({
  id,
  mediaId: 'movie_550',
  watchedOn,
  rewatch: false,
  rating10: null,
  review: null,
  spoiler: false,
  privateNote: null,
  createdAt: `${watchedOn}T00:00:00Z`,
})

function renderAction(initialEntry: LibraryEntry | null = null, mediaCache: LibraryMediaCache = movie) {
  return render(<SalaLibraryAction mediaId="movie_550" mediaCache={mediaCache} initialEntry={initialEntry} toastLabels={labels} />)
}

const undoButton = () => document.querySelector<HTMLButtonElement>('[data-sala-toast-action]')

async function removeAndConfirm() {
  fireEvent.click(screen.getByRole('button', { name: 'removeConfirm' }))
  const confirm = await screen.findByRole('alertdialog')
  fireEvent.click(within(confirm).getByRole('button', { name: 'removeConfirm' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  await waitFor(() => expect(undoButton()).not.toBeNull())
}

beforeEach(() => {
  __resetDiaryCache()
  mockSave.mockReset()
  mockRemove.mockReset().mockResolvedValue(undefined)
  mockFetchDiary.mockReset().mockResolvedValue({ enabled: true, scale: 'ten', logs: [] } satisfies DiaryConfig)
  mockFetchProgress.mockReset().mockResolvedValue(null)
  mockDeleteLog.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('borrado diferido en Sala', () => {
  it('si el aviso caduca sin «Deshacer», el borrado se hace', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderAction(entry)
    await removeAndConfirm()
    expect(mockRemove).not.toHaveBeenCalled()
    // Con el foco en «Deshacer» el reloj está parado (WCAG 2.2.1): se sale.
    act(() => (document.activeElement as HTMLElement | null)?.blur())
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('movie_550'))
  })

  it('al cerrar la página (pagehide) se borra ya, con keepalive', async () => {
    renderAction(entry)
    await removeAndConfirm()
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('movie_550', { keepalive: true }))
  })

  it('al irse a otra pantalla de la app (desmontar) también se borra', async () => {
    const { unmount } = renderAction(entry)
    await removeAndConfirm()
    unmount()
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('movie_550', { keepalive: true }))
  })

  it('volver a añadirlo con el borrado pendiente lo anula', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockSave.mockResolvedValue({ ...entry, status: 'pending' })
    renderAction(entry)
    await removeAndConfirm()
    fireEvent.click(screen.getByRole('button', { name: 'addToLibrary' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'saveStatus' }))
    await waitFor(() => expect(mockSave).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    window.dispatchEvent(new Event('pagehide'))
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('«Deshacer» devuelve la entrada y el foco a «Actualizar» (no a <body>)', async () => {
    renderAction(entry)
    await removeAndConfirm()
    const undo = undoButton()!
    undo.focus()
    await act(async () => fireEvent.click(undo))
    const update = await screen.findByRole('button', { name: 'updateEntry' })
    await waitFor(() => expect(update).toHaveFocus())
    // Aunque salga el aviso «restored», el foco no se va a él.
    await waitFor(() => expect(document.querySelector('[data-sala-toast-live="polite"]')).toHaveTextContent('restored'))
    expect(update).toHaveFocus()
    expect(mockRemove).not.toHaveBeenCalled()
  })
})

describe('diálogo de Sala', () => {
  async function openUpdate(e: LibraryEntry = entry) {
    renderAction(e)
    fireEvent.click(screen.getByRole('button', { name: 'updateEntry' }))
    return screen.findByRole('dialog')
  }

  it('quitar nota: el foco vuelve al deslizador', async () => {
    const dialog = await openUpdate()
    const clear = await within(dialog).findByRole('button', { name: 'clearRating' })
    fireEvent.click(clear)
    expect(within(dialog).getByRole('slider')).toHaveFocus()
    expect(within(dialog).queryByRole('button', { name: 'clearRating' })).toBeNull()
  })

  it('completado con diario: apunte con reseña; el spoiler sin reseña explica por qué está apagado', async () => {
    mockSave.mockResolvedValue({ entry: { ...entry, status: 'completed' }, log: log('l9', '2024-02-02'), logFailed: false })
    const dialog = await openUpdate()
    await waitFor(() => expect(mockFetchDiary).toHaveBeenCalled())
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'statusLabel' }), { target: { value: 'completed' } })
    const spoiler = await within(dialog).findByRole('checkbox', { name: 'spoiler' })
    expect(spoiler).toBeDisabled()
    expect(spoiler).toHaveAccessibleDescription('spoilerHint')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'review' }), { target: { value: 'Muy buena' } })
    expect(spoiler).toBeEnabled()
    expect(spoiler).not.toHaveAccessibleDescription('spoilerHint')
    fireEvent.click(within(dialog).getByRole('button', { name: 'saveStatus' }))
    await waitFor(() => expect(mockSave).toHaveBeenCalled())
    expect(mockSave.mock.calls[0][0].log).toMatchObject({ review: 'Muy buena', spoiler: false })
    await waitFor(() => expect(document.querySelector('[data-sala-toast-live="polite"]')).toHaveTextContent('savedWithLog'))
  })

  it('fecha futura: no guarda, el campo dice el error y recibe el foco', async () => {
    const dialog = await openUpdate({ ...entry, status: 'completed' } as LibraryEntry)
    const form = within(dialog).getByTestId('sala-library-form') as HTMLFormElement
    expect(form.noValidate).toBe(true)
    const date = dialog.querySelector<HTMLInputElement>('input[type=date]')!
    const tomorrow = new Date(Date.now() + 2 * 86400000)
    fireEvent.change(date, { target: { value: localDateString(tomorrow) } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'saveStatus' }))
    await waitFor(() => expect(within(dialog).getByText('errors.futureDate')).toBeInTheDocument())
    expect(date).toHaveFocus()
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('apuntes anteriores: borrar lleva el foco al siguiente; el último, al encabezado', async () => {
    mockFetchDiary.mockResolvedValue({ enabled: true, scale: 'ten', logs: [log('a', '2024-01-01'), log('b', '2024-01-05')] })
    const dialog = await openUpdate()
    const first = await within(dialog).findAllByRole('button', { name: /deleteLog/ })
    fireEvent.click(first[0])
    await waitFor(() => expect(mockDeleteLog).toHaveBeenCalledWith('a'))
    await waitFor(() => expect(within(dialog).getAllByRole('button', { name: /deleteLog/ })).toHaveLength(1))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /deleteLog/ })).toHaveFocus())
    fireEvent.click(within(dialog).getByRole('button', { name: /deleteLog/ }))
    await waitFor(() => expect(mockDeleteLog).toHaveBeenCalledWith('b'))
    await waitFor(() => expect(document.activeElement?.tagName).toBe('SELECT'))
  })

  it('borrar un apunte que falla: error anunciado y el foco se queda en su botón', async () => {
    mockFetchDiary.mockResolvedValue({ enabled: true, scale: 'ten', logs: [log('a', '2024-01-01')] })
    mockDeleteLog.mockRejectedValue(new Error('500'))
    const dialog = await openUpdate()
    const del = await within(dialog).findByRole('button', { name: /deleteLog/ })
    del.focus()
    fireEvent.click(del)
    await waitFor(() =>
      expect(within(dialog).getAllByRole('alert').some((el) => el.textContent?.includes('deleteFailed'))).toBe(true)
    )
    expect(within(dialog).getByRole('button', { name: /deleteLog/ })).toHaveFocus()
  })

  it('al llegar al final, «Marcar como completado» lo anuncia y lleva el foco a «Estado»', async () => {
    mockFetchProgress.mockResolvedValue({
      enabled: true,
      kind: 'pages',
      progress: { page: 300, total: 300 },
      total: 300,
      plan: { total: 300 },
      next: null,
    })
    const book = { externalId: 'OL1', type: 'book', title: 'Libro' }
    renderAction({ ...entry, progress: { page: 300, total: 300 } } as LibraryEntry, book)
    fireEvent.click(screen.getByRole('button', { name: 'updateEntry' }))
    const dialog = await screen.findByRole('dialog')
    const mark = await within(dialog).findByRole('button', { name: 'markCompleted' })
    await act(async () => {
      fireEvent.click(mark)
      await new Promise((r) => requestAnimationFrame(() => r(null)))
    })
    expect(within(dialog).getByRole('combobox', { name: 'statusLabel' })).toHaveValue('completed')
    expect(within(dialog).getByRole('combobox', { name: 'statusLabel' })).toHaveFocus()
    expect(within(dialog).getByText('markedCompleted')).toBeInTheDocument()
  })

  it('sello «Visto» al pasar a completado (plano, del acento)', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    Element.prototype.animate = vi.fn() as unknown as Element['animate']
    mockSave.mockResolvedValue({ ...entry, status: 'completed' })
    const dialog = await openUpdate()
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'statusLabel' }), { target: { value: 'completed' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'saveStatus' }))
    const stamp = await screen.findByTestId('library-stamp')
    expect(stamp).toHaveAttribute('aria-hidden', 'true')
    expect(stamp.className).toContain('bg-sala-accent')
    vi.unstubAllGlobals()
  })
})

describe('ProgressInput variant="sala" por tipo', () => {
  const cases: Array<[string, Record<string, number>, string[]]> = [
    ['tv', { season: 1, episode: 3 }, ['input-season', 'input-episode']],
    ['anime', { episode: 12 }, ['input-episode']],
    ['manga', { chapter: 40, volume: 4 }, ['input-chapter', 'input-volume']],
    ['comic', { chapter: 5 }, ['input-chapter', 'input-volume']],
    ['book', { percent: 40 }, ['input-percent']],
    ['game', { hours: 12 }, ['input-hours']],
  ]
  for (const [type, value, ids] of cases) {
    it(`${type}: sus campos, con la piel de Sala; limpiar lleva el foco al primero`, () => {
      const onChange = vi.fn()
      render(<ProgressInput mediaType={type} value={value} onChange={onChange} variant="sala" />)
      for (const id of ids) expect(screen.getByTestId(id).className).toContain('min-h-sala-target')
      fireEvent.click(screen.getByTestId('clear-progress'))
      expect(onChange).toHaveBeenLastCalledWith(null)
      expect(screen.getByTestId(ids[0])).toHaveFocus()
    })
  }
})
