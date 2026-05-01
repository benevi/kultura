import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LibraryEntry } from '@/types/library'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

import { LibraryStatusModal } from '@/components/library/LibraryStatusModal'

const baseEntry: LibraryEntry = {
  id: 'uuid-1',
  userId: 'user-1',
  mediaId: 'movie_550',
  status: 'completed',
  score: 3,
  watchedAt: '2024-03-15',
  episodeProgress: null,
  createdAt: '2024-01-01T00:00:00Z',
  title: 'Fight Club',
  poster: undefined,
  year: 1999,
}

const defaultProps = {
  current: null,
  mediaType: 'movie',
  onSave: vi.fn(),
  onClose: vi.fn(),
  loading: false,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LibraryStatusModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('render muestra select de estado', () => {
    render(<LibraryStatusModal {...defaultProps} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('render muestra StarRating', () => {
    render(<LibraryStatusModal {...defaultProps} />)
    const stars = document.querySelectorAll('[data-star]')
    expect(stars).toHaveLength(5)
  })

  it('fecha NO visible cuando status != completed (default pending)', () => {
    render(<LibraryStatusModal {...defaultProps} />)
    expect(screen.queryByLabelText('watchedAt')).not.toBeInTheDocument()
    expect(document.querySelector('input[type="date"]')).not.toBeInTheDocument()
  })

  it('fecha SÍ visible cuando status = completed', () => {
    render(<LibraryStatusModal {...defaultProps} current={baseEntry} />)
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument()
  })

  it('click cancelar llama onClose', () => {
    const onClose = vi.fn()
    render(<LibraryStatusModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click en overlay llama onClose', () => {
    const onClose = vi.fn()
    render(<LibraryStatusModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click en panel NO cierra (stopPropagation)', () => {
    const onClose = vi.fn()
    render(<LibraryStatusModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('modal-panel'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('submit llama onSave con episodeProgress null para movie', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <LibraryStatusModal
        current={null}
        mediaType="movie"
        onSave={onSave}
        onClose={vi.fn()}
        loading={false}
      />
    )
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'in_progress' } })
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        status: 'in_progress',
        score: null,
        watchedAt: null,
        episodeProgress: null,
      })
    })
  })

  // ── EpisodeProgress integration ────────────────────────────────────────────

  it('NO muestra EpisodeProgress para mediaType=movie', () => {
    render(<LibraryStatusModal {...defaultProps} mediaType="movie" />)
    expect(screen.queryByTestId('input-episode')).not.toBeInTheDocument()
  })

  it('muestra EpisodeProgress para mediaType=tv', () => {
    render(<LibraryStatusModal {...defaultProps} mediaType="tv" />)
    expect(screen.getByTestId('input-episode')).toBeInTheDocument()
  })

  it('muestra EpisodeProgress para mediaType=anime', () => {
    render(<LibraryStatusModal {...defaultProps} mediaType="anime" />)
    expect(screen.getByTestId('input-episode')).toBeInTheDocument()
  })

  it('tv muestra campo season, anime no', () => {
    const { rerender } = render(
      <LibraryStatusModal {...defaultProps} mediaType="tv" />
    )
    expect(screen.getByTestId('input-season')).toBeInTheDocument()

    rerender(<LibraryStatusModal {...defaultProps} mediaType="anime" />)
    expect(screen.queryByTestId('input-season')).not.toBeInTheDocument()
  })
})
