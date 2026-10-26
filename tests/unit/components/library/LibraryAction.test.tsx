import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LibraryEntry } from '@/types/library'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}))

const mockShow = vi.fn()
const mockShowError = vi.fn()
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: mockShow, showError: mockShowError, dismiss: vi.fn() }),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}))

// F-24: añadir y actualizar van por `saveLibraryEntry` (entrada + apunte del
// diario opcional). El mock devuelve la entrada que se le dé, sin apunte.
const mockSave = vi.fn()
const mockRemoveFromLibrary = vi.fn()
const mockFetchDiary = vi.fn()
const mockDeleteLog = vi.fn()

vi.mock('@/lib/library/actions', () => ({
  saveLibraryEntry: async (...args: unknown[]) => {
    const result = await mockSave(...args)
    return result && typeof result === 'object' && 'entry' in result
      ? result
      : { entry: result, log: null, logFailed: false }
  },
  removeFromLibrary: (...args: unknown[]) => mockRemoveFromLibrary(...args),
  fetchDiaryConfig: (...args: unknown[]) => mockFetchDiary(...args),
  deleteDiaryLog: (...args: unknown[]) => mockDeleteLog(...args),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

import { LibraryAction, __resetDiaryCache } from '@/components/library/LibraryAction'

const mediaCache = {
  externalId: '550',
  type: 'movie',
  title: 'Fight Club',
  poster: undefined,
  backdrop: undefined,
  year: 1999,
  synopsis: 'Test synopsis',
}

const baseEntry: LibraryEntry = {
  id: 'uuid-1',
  userId: 'user-1',
  mediaId: 'movie_550',
  status: 'completed',
  score: 4,
  watchedAt: null,
  episodeProgress: null,
  createdAt: '2024-01-01T00:00:00Z',
  title: 'Fight Club',
  poster: undefined,
  year: 1999,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LibraryAction', () => {
  beforeEach(() => {
    __resetDiaryCache()
    mockSave.mockReset()
    mockRemoveFromLibrary.mockReset()
    mockFetchDiary.mockReset()
    mockFetchDiary.mockResolvedValue({ enabled: false, scale: 'stars', logs: [] })
    mockDeleteLog.mockReset()
    mockShow.mockReset()
    mockShowError.mockReset()
    mockSave.mockResolvedValue({ ...baseEntry, status: 'pending' })
    mockRemoveFromLibrary.mockResolvedValue(undefined)
  })

  it('no autenticado → muestra link signInToSave', () => {
    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={null}
        isAuthenticated={false}
      />
    )
    const link = screen.getByText('signInToSave')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/login')
  })

  it('autenticado sin entry → muestra botón addToLibrary', () => {
    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={null}
        isAuthenticated={true}
      />
    )
    expect(screen.getByText(/addToLibrary/)).toBeInTheDocument()
  })

  it('autenticado sin entry → click botón abre modal', () => {
    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={null}
        isAuthenticated={true}
      />
    )
    fireEvent.click(screen.getByText(/addToLibrary/))
    // El modal se abre — muestra el select o el botón de guardar
    expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
  })

  it('autenticado con entry → muestra badge de estado correcto', () => {
    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={baseEntry}
        isAuthenticated={true}
      />
    )
    const badge = screen.getByText('status.completed')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/accent-positive/)
  })

  it('autenticado con entry → muestra botones Actualizar y Eliminar', () => {
    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={baseEntry}
        isAuthenticated={true}
      />
    )
    expect(screen.getByText('updateEntry')).toBeInTheDocument()
    expect(screen.getByText('remove')).toBeInTheDocument()
  })

  it('click Eliminar → llama removeFromLibrary y limpia entry', async () => {
    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={baseEntry}
        isAuthenticated={true}
      />
    )
    fireEvent.click(screen.getByText('remove'))
    // ACC-11: antes de borrar se confirma (estado, nota y progreso se pierden).
    expect(mockRemoveFromLibrary).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('removeConfirmBody')
    fireEvent.click(screen.getByRole('button', { name: 'removeConfirm' }))
    // Desaparece al momento; el borrado real llega cuando se va el aviso.
    await waitFor(() => {
      expect(screen.getByText(/addToLibrary/)).toBeInTheDocument()
    })
    const toast = mockShow.mock.calls[0][0] as { action: { onExpire: () => void } }
    await act(async () => toast.action.onExpire())
    expect(mockRemoveFromLibrary).toHaveBeenCalledWith('movie_550')
  })

  it('handleSave con entry null → guarda la entrada nueva', async () => {
    const newEntry: LibraryEntry = { ...baseEntry, status: 'pending', score: null }
    mockSave.mockResolvedValue(newEntry)

    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={null}
        isAuthenticated={true}
      />
    )
    // Abrir modal
    fireEvent.click(screen.getByText(/addToLibrary/))
    // Hacer submit
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled()
    })
  })

  it('handleSave con entry existente → guarda la actualización', async () => {
    mockSave.mockResolvedValue(baseEntry)

    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={baseEntry}
        isAuthenticated={true}
      />
    )
    // Abrir modal de actualización
    fireEvent.click(screen.getByText('updateEntry'))
    // Submit
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled()
    })
  })

  it('modal se cierra tras guardar correctamente', async () => {
    mockSave.mockResolvedValue({ ...baseEntry, status: 'pending', score: null })

    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={null}
        isAuthenticated={true}
      />
    )
    fireEvent.click(screen.getByText(/addToLibrary/))
    expect(screen.getByTestId('modal-panel')).toBeInTheDocument()

    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    await waitFor(() => {
      expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
    })
  })

  it('error en guardar → mantiene modal abierto', async () => {
    mockSave.mockRejectedValue(new Error('Save failed'))

    render(
      <LibraryAction
        mediaId="movie_550"
        mediaCache={mediaCache}
        initialEntry={null}
        isAuthenticated={true}
      />
    )
    fireEvent.click(screen.getByText(/addToLibrary/))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled()
    })
    // El modal sigue abierto porque hubo error
    expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
  })

  // ── ACC-11: los fallos se avisan (antes solo iban al log) ──────────────────

  // Revisión #41: el error va DENTRO del diálogo abierto (role="alert"): un
  // toast quedaba debajo de la hoja y fuera del árbol accesible.
  it('error 502 del proveedor → aviso dentro del diálogo, que sigue abierto', async () => {
    mockSave.mockRejectedValue(new Error('Media provider unavailable'))
    render(
      <LibraryAction mediaId="movie_550" mediaCache={mediaCache} initialEntry={null} isAuthenticated={true} />
    )
    fireEvent.click(screen.getByText(/addToLibrary/))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    const dialog = screen.getByRole('dialog')
    await waitFor(() => {
      expect(dialog.querySelector('[role="alert"]')).toHaveTextContent('errors.providerUnavailable')
    })
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('otro error al guardar → aviso genérico dentro del diálogo', async () => {
    mockSave.mockRejectedValue(new Error('Failed to save library entry'))
    render(
      <LibraryAction mediaId="movie_550" mediaCache={mediaCache} initialEntry={null} isAuthenticated={true} />
    )
    fireEvent.click(screen.getByText(/addToLibrary/))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    const dialog = screen.getByRole('dialog')
    await waitFor(() => {
      expect(dialog.querySelector('[role="alert"]')).toHaveTextContent('errors.saveFailed')
    })
  })

  it('error al quitar (al irse el aviso) → aviso de error y la entrada vuelve', async () => {
    mockRemoveFromLibrary.mockRejectedValue(new Error('Failed to remove from library'))
    render(
      <LibraryAction mediaId="movie_550" mediaCache={mediaCache} initialEntry={baseEntry} isAuthenticated={true} />
    )
    fireEvent.click(screen.getByText('remove'))
    fireEvent.click(screen.getByRole('button', { name: 'removeConfirm' }))
    await waitFor(() => expect(mockShow).toHaveBeenCalled())
    const toast = mockShow.mock.calls[0][0] as { action: { onExpire: () => void } }
    await act(async () => toast.action.onExpire())
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('errors.removeFailed'))
    expect(screen.getByText('status.completed')).toBeInTheDocument()
  })

  it('guardar bien → aviso de éxito', async () => {
    render(
      <LibraryAction mediaId="movie_550" mediaCache={mediaCache} initialEntry={null} isAuthenticated={true} />
    )
    fireEvent.click(screen.getByText(/addToLibrary/))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith({ message: 'saved', type: 'success' })
    })
  })

  // DIS-14: «Deshacer» en el aviso al quitar. El borrado real (que se lleva
  // por la FK el diario: reseñas y notas privadas) espera a que el aviso se
  // vaya; «Deshacer» lo cancela, así que no se pierde nada.
  describe('quitar con «Deshacer»', () => {
    type Toast = { message: string; action?: { label: string; onAction: () => void; onExpire?: () => void } }
    async function removeIt(entry: LibraryEntry = baseEntry) {
      render(
        <LibraryAction mediaId="movie_550" mediaCache={mediaCache} initialEntry={entry} isAuthenticated={true} />
      )
      fireEvent.click(screen.getByText('remove'))
      fireEvent.click(screen.getByRole('button', { name: 'removeConfirm' }))
      await waitFor(() => expect(mockShow).toHaveBeenCalled())
      return mockShow.mock.calls[0][0] as Toast
    }

    it('el aviso de quitado trae «Deshacer» y aún no se ha borrado nada', async () => {
      const toast = await removeIt()
      expect(toast.message).toBe('removed')
      expect(toast.action?.label).toBe('undo')
      expect(mockRemoveFromLibrary).not.toHaveBeenCalled()
    })

    it('REGRESIÓN: deshacer cancela el borrado (el diario no se toca) y la entrada vuelve tal cual', async () => {
      mockFetchDiary.mockResolvedValue({ enabled: true, scale: 'stars', logs: [{ id: 'log-1' }] })
      const entry = { ...baseEntry, status: 'in_progress' as const, score: 3, rating10: 6.5, favorite: true }
      const toast = await removeIt(entry)
      await act(async () => toast.action!.onAction())
      // Si luego se va el aviso, ya no borra.
      await act(async () => toast.action!.onExpire?.())
      expect(mockRemoveFromLibrary).not.toHaveBeenCalled()
      expect(mockSave).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.getByText('status.in_progress')).toBeInTheDocument())
      expect(mockShow).toHaveBeenLastCalledWith({ message: 'restored', type: 'success' })
    })

    it('volver a añadirlo antes de que se vaya el aviso cancela el borrado pendiente', async () => {
      const toast = await removeIt()
      fireEvent.click(screen.getByText(/addToLibrary/))
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
      await waitFor(() => expect(mockSave).toHaveBeenCalled())
      await act(async () => toast.action!.onExpire?.())
      expect(mockRemoveFromLibrary).not.toHaveBeenCalled()
    })

    it('al cerrar la página con el borrado pendiente, se hace ya', async () => {
      await removeIt()
      act(() => {
        window.dispatchEvent(new Event('pagehide'))
      })
      await waitFor(() => expect(mockRemoveFromLibrary).toHaveBeenCalledWith('movie_550', { keepalive: true }))
    })
  })
})
