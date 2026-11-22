// ============================================================
// Fase 8.5 · F2b: las acciones de biblioteca de la ficha en «Sala».
// El comportamiento es el de `LibraryAction` (`useLibraryAction`): aquí se
// comprueba la vista (SalaButton, SalaDialog, SalaConfirmDialog, avisos de
// Sala) y que llama a las mismas server actions con lo mismo.
// ============================================================

import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LibraryEntry } from '@/types/library'

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
import { __resetDiaryCache } from '@/components/library/useLibraryAction'

const mediaCache = { externalId: '550', type: 'movie', title: 'Fight Club', year: 1999 }
const labels = { region: 'Avisos (F8)', dismiss: 'Cerrar el aviso', hint: 'Pulsa F8' }

const entry: LibraryEntry = {
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
  year: 1999,
} as LibraryEntry

function renderAction(initialEntry: LibraryEntry | null = null) {
  return render(
    <div className="sala-work" style={{ ['--sala-work-dark-ink' as string]: '#fff' }}>
      <SalaLibraryAction mediaId="movie_550" mediaCache={mediaCache} initialEntry={initialEntry} toastLabels={labels} />
    </div>
  )
}

describe('SalaLibraryAction (F2b)', () => {
  beforeEach(() => {
    __resetDiaryCache()
    mockSave.mockReset()
    mockRemove.mockReset().mockResolvedValue(undefined)
    mockFetchDiary.mockReset().mockResolvedValue({ enabled: false, scale: 'stars', logs: [] })
    mockFetchProgress.mockReset().mockResolvedValue(null)
    mockDeleteLog.mockReset()
  })

  it('sin entrada: un SalaButton primario de 48 px «Añadir a biblioteca»', () => {
    renderAction()
    const add = screen.getByRole('button', { name: 'addToLibrary' })
    expect(add.className).toContain('min-h-sala-target')
    expect(add.className).toContain('bg-sala-accent')
  })

  it('con entrada: el estado en texto, «Actualizar» y «Eliminar»', () => {
    renderAction(entry)
    expect(screen.getByTestId('sala-library-status')).toHaveTextContent('status.in_progress')
    expect(screen.getByText('statusLabel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'updateEntry' }).className).toContain('min-h-sala-target')
    expect(screen.getByRole('button', { name: 'removeConfirm' }).className).toContain('min-h-sala-target')
  })

  it('añadir: abre el diálogo de Sala con el foco en «Estado» y guarda con la server action', async () => {
    mockSave.mockResolvedValue({ ...entry, status: 'pending' })
    renderAction()
    fireEvent.click(screen.getByRole('button', { name: 'addToLibrary' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-sala-dialog', 'sheet')
    const status = within(dialog).getByRole('combobox', { name: 'statusLabel' })
    await waitFor(() => expect(status).toHaveFocus())
    // Una nota en el deslizador de Sala (escala de siempre: 1-5 enteras).
    fireEvent.change(within(dialog).getByTestId('sala-rating'), { target: { value: '4' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'saveStatus' }))
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
    expect(mockSave.mock.calls[0][0]).toMatchObject({
      mediaId: 'movie_550',
      status: 'pending',
      score: 4,
      rating10: 8,
      mediaCache,
    })
    // Al guardar, el diálogo se cierra y el aviso (región viva de Sala) lo dice.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const polite = document.querySelector('[data-sala-toast-live="polite"]')!
    await waitFor(() => expect(polite).toHaveTextContent('saved'))
    expect(screen.getByRole('button', { name: 'updateEntry' })).toBeInTheDocument()
  })

  it('error al guardar: el diálogo sigue abierto y lo anuncia dentro', async () => {
    mockSave.mockRejectedValue(new Error('502'))
    renderAction()
    fireEvent.click(screen.getByRole('button', { name: 'addToLibrary' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'saveStatus' }))
    await waitFor(() => expect(within(dialog).getByText('errors.saveFailed')).toBeInTheDocument())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Escape cierra el diálogo y el foco vuelve a quien lo abrió', async () => {
    renderAction(entry)
    const update = screen.getByRole('button', { name: 'updateEntry' })
    update.focus()
    fireEvent.click(update)
    const dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(update).toHaveFocus())
  })

  it('quitar: confirma con SalaConfirmDialog (botón danger) y deja un «Deshacer» de Sala', async () => {
    renderAction(entry)
    fireEvent.click(screen.getByRole('button', { name: 'removeConfirm' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(confirm).toHaveTextContent('removeConfirmBody')
    const ok = within(confirm).getByRole('button', { name: 'removeConfirm' })
    expect(ok.className).toContain('bg-sala-danger')
    fireEvent.click(ok)
    // Desaparece al momento; el borrado real espera al aviso.
    await waitFor(() => expect(screen.getByRole('button', { name: 'addToLibrary' })).toBeInTheDocument())
    expect(mockRemove).not.toHaveBeenCalled()
    const undo = await waitFor(() => {
      const el = document.querySelector<HTMLButtonElement>('[data-sala-toast-action]')
      expect(el).not.toBeNull()
      return el!
    })
    expect(undo).toHaveTextContent('undo')
    // «Deshacer»: el borrado no se hace y la entrada vuelve tal cual.
    await act(async () => fireEvent.click(undo))
    await waitFor(() => expect(screen.getByTestId('sala-library-status')).toHaveTextContent('status.in_progress'))
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('la paleta de la obra viaja con el diálogo (cuelga de <body>, fuera de sala-work)', async () => {
    const { container } = renderAction(entry)
    const work = container.querySelector<HTMLElement>('.sala-work')!
    for (const mode of ['light', 'dark']) {
      for (const role of ['background', 'panel', 'ink', 'ink-secondary', 'accent', 'accent-ink', 'band', 'band-ink', 'border']) {
        work.style.setProperty(`--sala-work-${mode}-${role}`, mode === 'dark' ? '#101010' : '#fafafa')
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'updateEntry' }))
    const dialog = await screen.findByRole('dialog')
    const veil = dialog.parentElement!
    expect(veil.className).toContain('sala-work')
    expect(veil.style.getPropertyValue('--sala-work-dark-accent')).toBe('#101010')
  })
})
