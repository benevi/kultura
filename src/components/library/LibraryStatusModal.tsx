'use client'

// ============================================================
// KULTURA — LibraryStatusModal
// Modal para añadir o actualizar un título en la biblioteca.
// ============================================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Select } from '@/components/ui/Select'
import { StarRating } from '@/components/ui/StarRating'
import { Button } from '@/components/ui/button'
import { EpisodeProgress } from '@/components/library/EpisodeProgress'
import type { LibraryEntry, LibraryStatus, EpisodeProgress as EpisodeProgressType } from '@/types/library'

interface LibraryStatusModalProps {
  current: LibraryEntry | null
  mediaType: string
  onSave: (data: {
    status: LibraryStatus
    score: number | null
    watchedAt: string | null
    episodeProgress: EpisodeProgressType | null
  }) => Promise<void>
  onClose: () => void
  loading: boolean
}

export function LibraryStatusModal({
  current,
  mediaType,
  onSave,
  onClose,
  loading,
}: LibraryStatusModalProps) {
  const t = useTranslations('library')

  const [status, setStatus] = useState<LibraryStatus>(current?.status ?? 'pending')
  const [score, setScore] = useState<number>(current?.score ?? 0)
  const [watchedAt, setWatchedAt] = useState<string>(current?.watchedAt ?? '')
  const [episodeProgress, setEpisodeProgress] = useState<EpisodeProgressType | null>(
    current?.episodeProgress ?? null
  )

  const showEpisodeProgress = mediaType === 'tv' || mediaType === 'anime'
  const showSeason = mediaType === 'tv'

  const statusOptions = [
    { value: 'completed', label: t('status.completed') },
    { value: 'in_progress', label: t('status.in_progress') },
    { value: 'pending', label: t('status.pending') },
    { value: 'abandoned', label: t('status.abandoned') },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      status,
      score: score > 0 ? score : null,
      watchedAt: status === 'completed' && watchedAt ? watchedAt : null,
      episodeProgress,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
        data-testid="modal-overlay"
      />

      {/* Panel */}
      <div
        className="relative z-10 bg-surface border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-panel"
      >
        <h2 className="font-display text-xl text-text mb-6">
          {current ? t('updateEntry') : t('addToLibrary')}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Estado */}
          <Select
            value={status}
            onChange={(val) => setStatus(val as LibraryStatus)}
            options={statusOptions}
            label={t('filterByStatus')}
          />

          {/* Puntuación */}
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted">{t('score')}</span>
            <StarRating value={score} onChange={setScore} size="lg" />
          </div>

          {/* Fecha — solo visible cuando status = 'completed' */}
          {status === 'completed' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted" htmlFor="watched-at">
                {t('watchedAt')}
              </label>
              <input
                id="watched-at"
                type="date"
                value={watchedAt}
                onChange={(e) => setWatchedAt(e.target.value)}
                className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-text w-full focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          )}

          {/* Progreso de episodios — solo para tv/anime */}
          {showEpisodeProgress && (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted">{t('episode')}</span>
              <EpisodeProgress
                value={episodeProgress}
                onChange={setEpisodeProgress}
                showSeason={showSeason}
              />
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              loading={loading}
              className="flex-1"
            >
              {t('saveStatus')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={loading}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
