'use client'

// ============================================================
// KULTURA — LibraryStatusModal
// Modal para añadir o actualizar un título en la biblioteca.
// ============================================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Select } from '@/components/ui/Select'
import { StarRating } from '@/components/ui/StarRating'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
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
        className="absolute inset-0 bg-black/60 animate-backdrop-in"
        onClick={onClose}
        aria-hidden="true"
        data-testid="modal-overlay"
      />

      {/* Panel */}
      <div
        className="relative z-10 bg-surface-elevated border border-surface-border rounded-modal shadow-2xl w-full max-w-sm mx-4 p-6 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-panel"
      >
        <h2 className="font-display text-xl font-semibold text-text-primary mb-6">
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
            <span className="text-sm font-body font-medium text-text-secondary">{t('score')}</span>
            <StarRating value={score} onChange={setScore} size="lg" />
          </div>

          {/* Fecha — solo visible cuando status = 'completed' */}
          {status === 'completed' && (
            <KInput
              id="watched-at"
              type="date"
              label={t('watchedAt')}
              value={watchedAt}
              onChange={(e) => setWatchedAt(e.target.value)}
            />
          )}

          {/* Progreso de episodios — solo para tv/anime */}
          {showEpisodeProgress && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-body font-medium text-text-secondary">{t('episode')}</span>
              <EpisodeProgress
                value={episodeProgress}
                onChange={setEpisodeProgress}
                showSeason={showSeason}
              />
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center gap-3 pt-2">
            <KButton
              type="submit"
              variant="primary"
              disabled={loading}
              className="flex-1"
            >
              {loading ? '…' : t('saveStatus')}
            </KButton>
            <KButton
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              {t('cancel')}
            </KButton>
          </div>
        </form>
      </div>
    </div>
  )
}
