// ============================================================
// Fase 8.2 · Cambiar estado y nota desde la Biblioteca (bandera
// LIBRARY_QUICK_EDIT): el diálogo de la ficha, abierto desde la tarjeta.
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LibraryEntry } from '@/types/library'
import type { LibraryStatusSaveData } from '@/components/library/LibraryStatusModal'

const h = vi.hoisted(() => ({
  show: vi.fn(),
  showError: vi.fn(),
  fetchDiaryConfig: vi.fn(),
  fetchProgressConfig: vi.fn(),
  saveLibraryEntry: vi.fn(),
  modalProps: null as null | Record<string, unknown>,
}))

vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: h.show, showError: h.showError, dismiss: vi.fn() }),
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('@/lib/library/actions', () => ({
  fetchDiaryConfig: h.fetchDiaryConfig,
  fetchProgressConfig: h.fetchProgressConfig,
  saveLibraryEntry: h.saveLibraryEntry,
  deleteDiaryLog: vi.fn(),
}))
// El diálogo tiene sus propios tests: aquí solo importa qué recibe y qué guarda.
vi.mock('@/components/library/LibraryStatusModal', () => ({
  LibraryStatusModal: (props: Record<string, unknown>) => {
    h.modalProps = props
    return (
      <div role="dialog">
        {props.error ? <p role="alert">{String(props.error)}</p> : null}
        <button type="button" onClick={() => void (props.onSave as (d: LibraryStatusSaveData) => Promise<void>)(SAVE)}>
          guardar
        </button>
      </div>
    )
  },
}))

import { LibraryQuickEdit } from '@/components/library/LibraryQuickEdit'
import { ApiError } from '@/lib/api/client'

const ENTRY = {
  mediaId: 'book_OL1W',
  status: 'pending',
  score: null,
  rating10: null,
  title: 'Dune',
  poster: 'https://covers/dune.jpg',
  year: 1965,
  progress: { page: 120 },
} as unknown as LibraryEntry

const SAVE: LibraryStatusSaveData = {
  status: 'in_progress',
  score: 4,
  rating10: 8,
  watchedAt: null,
  episodeProgress: null,
  progress: { page: 150 },
}

const onSaved = vi.fn()
const trigger = () => screen.getByTestId('library-quick-edit')

beforeEach(() => {
  vi.clearAllMocks()
  h.modalProps = null
  h.fetchDiaryConfig.mockResolvedValue({ enabled: true, scale: 'ten', logs: [] })
  h.fetchProgressConfig.mockResolvedValue({ enabled: true, kind: 'book', progress: { page: 120 }, plan: null, next: null })
})

describe('LibraryQuickEdit', () => {
  it('abre el diálogo de la ficha con la entrada, la escala y el plan de progreso', async () => {
    render(<LibraryQuickEdit entry={ENTRY} title="Dune" onSaved={onSaved} />)
    expect(trigger()).toHaveAccessibleName('quickEdit:{"title":"Dune"}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(trigger())
    await screen.findByRole('dialog')
    expect(h.fetchDiaryConfig).toHaveBeenCalledWith('book_OL1W')
    expect(h.fetchProgressConfig).toHaveBeenCalledWith('book_OL1W')
    expect(h.modalProps).toMatchObject({
      current: ENTRY,
      mediaType: 'book',
      title: 'Dune',
      diary: { enabled: true, scale: 'ten' },
      progressConfig: { kind: 'book' },
    })
  })

  it('guarda con el mismo cuerpo que la ficha y devuelve la entrada con su título y portada', async () => {
    h.saveLibraryEntry.mockResolvedValue({ entry: { mediaId: 'book_OL1W', status: 'in_progress', score: 4, rating10: 8 }, log: null, logFailed: false })
    render(<LibraryQuickEdit entry={ENTRY} title="Dune" onSaved={onSaved} />)
    fireEvent.click(trigger())
    fireEvent.click(await screen.findByText('guardar'))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())

    expect(h.saveLibraryEntry).toHaveBeenCalledWith({
      mediaId: 'book_OL1W',
      status: 'in_progress',
      score: 4,
      rating10: 8,
      watchedAt: null,
      episodeProgress: null,
      progress: { page: 150 },
    })
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: 'book_OL1W', status: 'in_progress', rating10: 8, title: 'Dune', poster: 'https://covers/dune.jpg', year: 1965 })
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(h.show).toHaveBeenCalledWith({ message: 'saved', type: 'success' })
  })

  it('si falla al guardar, el error va dentro del diálogo, que sigue abierto', async () => {
    h.saveLibraryEntry.mockRejectedValue(new ApiError('provider_unavailable', 502))
    render(<LibraryQuickEdit entry={ENTRY} title="Dune" onSaved={onSaved} />)
    fireEvent.click(trigger())
    fireEvent.click(await screen.findByText('guardar'))
    expect(await screen.findByRole('alert')).toHaveTextContent('errors.providerUnavailable')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('sin escala ni plan (fallan las dos peticiones) el diálogo se abre igual, con la entrada', async () => {
    h.fetchDiaryConfig.mockRejectedValue(new Error('x'))
    h.fetchProgressConfig.mockRejectedValue(new Error('x'))
    render(<LibraryQuickEdit entry={ENTRY} title="Dune" onSaved={onSaved} />)
    fireEvent.click(trigger())
    await screen.findByRole('dialog')
    expect(h.modalProps).toMatchObject({ current: ENTRY, diary: null, progressConfig: null })
  })
})
