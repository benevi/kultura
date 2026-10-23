import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LibraryEntry } from '@/types/library'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
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

const mockAddToLibrary = vi.fn()
const mockUpdateLibrary = vi.fn()
const mockRemoveFromLibrary = vi.fn()

vi.mock('@/lib/library/actions', () => ({
  addToLibrary: (...args: unknown[]) => mockAddToLibrary(...args),
  updateLibrary: (...args: unknown[]) => mockUpdateLibrary(...args),
  removeFromLibrary: (...args: unknown[]) => mockRemoveFromLibrary(...args),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

import { LibraryAction } from '@/components/library/LibraryAction'

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
    mockAddToLibrary.mockReset()
    mockUpdateLibrary.mockReset()
    mockRemoveFromLibrary.mockReset()
    mockShow.mockReset()
    mockShowError.mockReset()
    mockAddToLibrary.mockResolvedValue({ ...baseEntry, status: 'pending' })
    mockUpdateLibrary.mockResolvedValue(baseEntry)
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
    await waitFor(() => {
      expect(mockRemoveFromLibrary).toHaveBeenCalledWith('movie_550')
    })
    // Después de eliminar, debe mostrar el botón de añadir
    await waitFor(() => {
      expect(screen.getByText(/addToLibrary/)).toBeInTheDocument()
    })
  })

  it('handleSave con entry null → llama addToLibrary', async () => {
    const newEntry: LibraryEntry = { ...baseEntry, status: 'pending', score: null }
    mockAddToLibrary.mockResolvedValue(newEntry)

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
      expect(mockAddToLibrary).toHaveBeenCalled()
    })
  })

  it('handleSave con entry existente → llama updateLibrary', async () => {
    mockUpdateLibrary.mockResolvedValue(baseEntry)

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
      expect(mockUpdateLibrary).toHaveBeenCalled()
    })
  })

  it('modal se cierra tras guardar correctamente', async () => {
    mockAddToLibrary.mockResolvedValue({ ...baseEntry, status: 'pending', score: null })

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
    mockAddToLibrary.mockRejectedValue(new Error('Save failed'))

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
      expect(mockAddToLibrary).toHaveBeenCalled()
    })
    // El modal sigue abierto porque hubo error
    expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
  })

  // ── ACC-11: los fallos se avisan (antes solo iban al log) ──────────────────

  // Revisión #41: el error va DENTRO del diálogo abierto (role="alert"): un
  // toast quedaba debajo de la hoja y fuera del árbol accesible.
  it('error 502 del proveedor → aviso dentro del diálogo, que sigue abierto', async () => {
    mockAddToLibrary.mockRejectedValue(new Error('Media provider unavailable'))
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
    mockAddToLibrary.mockRejectedValue(new Error('Failed to save library entry'))
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

  it('error al quitar → aviso de error y la entrada sigue', async () => {
    mockRemoveFromLibrary.mockRejectedValue(new Error('Failed to remove from library'))
    render(
      <LibraryAction mediaId="movie_550" mediaCache={mediaCache} initialEntry={baseEntry} isAuthenticated={true} />
    )
    fireEvent.click(screen.getByText('remove'))
    fireEvent.click(screen.getByRole('button', { name: 'removeConfirm' }))
    const dialog = screen.getByRole('alertdialog')
    await waitFor(() => {
      expect(dialog.querySelector('[role="alert"]')).toHaveTextContent('errors.removeFailed')
    })
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
})
