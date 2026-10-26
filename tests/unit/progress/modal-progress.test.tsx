// ============================================================
// F-27 · Diálogo de biblioteca con el progreso por formato: control según el
// formato, total del proveedor, propuesta de «Completado» al llegar al final
// y lo que se guarda (progress + la forma antigua episodeProgress).
// ============================================================

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { renderIntl } from './intl'
import { LibraryStatusModal } from '@/components/library/LibraryStatusModal'
import type { ProgressConfig } from '@/lib/library/actions'
import type { LibraryEntryWithProgress } from '@/lib/library/progress'

const entry = (mediaId: string, extra: Partial<LibraryEntryWithProgress> = {}): LibraryEntryWithProgress => ({
  id: 'e1',
  userId: 'u1',
  mediaId,
  status: 'in_progress',
  score: null,
  watchedAt: null,
  episodeProgress: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...extra,
})

const config = (extra: Partial<ProgressConfig>): ProgressConfig => ({
  enabled: true,
  kind: 'book',
  progress: null,
  total: null,
  plan: null,
  next: null,
  diary: false,
  ...extra,
})

function submit() {
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
}

describe('LibraryStatusModal + progreso', () => {
  it('libro (PROGRESS_V2): páginas con el total de la ficha y se guarda progress con total', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderIntl(
      <LibraryStatusModal
        current={entry('book_OL1W', { progress: { page: 120 } })}
        mediaType="book"
        onSave={onSave}
        onClose={vi.fn()}
        loading={false}
        progressConfig={config({ plan: { total: 350 }, progress: { page: 120 } })}
      />
    )
    expect(screen.getByText('de 350')).toBeInTheDocument()
    submit()
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ progress: { page: 120, total: 350 }, episodeProgress: null })
      )
    )
  })

  it('al llegar a la última página propone «Completado» y lo aplica al estado', () => {
    renderIntl(
      <LibraryStatusModal
        current={entry('book_OL1W', { progress: { page: 340 } })}
        mediaType="book"
        onSave={vi.fn()}
        onClose={vi.fn()}
        loading={false}
        progressConfig={config({ plan: { total: 350 } })}
      />
    )
    expect(screen.queryByText('Has llegado al final del libro.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Más páginas' }))
    expect(screen.getByText('Has llegado al final del libro.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como completado' }))
    expect(screen.getByRole('combobox')).toHaveValue('completed')
  })

  it('serie: «de 10» de la temporada de TMDB y el siguiente episodio con su nombre', () => {
    renderIntl(
      <LibraryStatusModal
        current={entry('tv_1399', { episodeProgress: { season: 1, episode: 2 } })}
        mediaType="tv"
        onSave={vi.fn()}
        onClose={vi.fn()}
        loading={false}
        progressConfig={config({
          kind: 'tv',
          progress: { season: 1, episode: 2 },
          plan: { seasons: [{ number: 1, episodes: 10 }], ended: true },
          next: { season: 1, episode: 3, name: 'Lord Nieve', airDate: '2011-05-01' },
        })}
      />
    )
    expect(screen.getByText('de 10')).toBeInTheDocument()
    expect(screen.getByTestId('progress-next-episode')).toHaveTextContent('Siguiente: T1 · E3 «Lord Nieve»')
  })

  it('sin PROGRESS_V2: el libro no enseña control, pero conserva su progreso al guardar', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderIntl(
      <LibraryStatusModal
        current={entry('book_OL1W', { progress: { page: 50, total: 300 } })}
        mediaType="book"
        onSave={onSave}
        onClose={vi.fn()}
        loading={false}
        progressConfig={config({ enabled: false })}
      />
    )
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    submit()
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ progress: { page: 50, total: 300 } })))
  })

  it('serie antes de cargar la configuración: episodios como siempre (forma antigua incluida)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderIntl(
      <LibraryStatusModal
        current={entry('tv_1399', { episodeProgress: { season: 2, episode: 3 } })}
        mediaType="tv"
        onSave={onSave}
        onClose={vi.fn()}
        loading={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Un episodio más' }))
    submit()
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ episodeProgress: { season: 2, episode: 4 }, progress: { season: 2, episode: 4 } })
      )
    )
  })
})
