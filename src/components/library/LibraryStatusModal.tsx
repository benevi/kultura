'use client'

// ============================================================
// KULTURA — LibraryStatusModal
// Modal para añadir o actualizar un título en la biblioteca. Sobre `Modal`
// en variante hoja: en móvil sube desde abajo, cabe con el teclado abierto
// (scroll interno, 85dvh) y se cierra arrastrando el asa (MOV-8).
// ============================================================

import { useId, useState, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { Select } from '@/components/ui/Select'
import { StarRating } from '@/components/ui/StarRating'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { EpisodeProgress } from '@/components/library/EpisodeProgress'
import { Modal } from '@/components/ui/Modal'
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
  /** Dónde vuelve el foco si el botón que lo abrió ya no existe al cerrar. */
  finalFocusRef?: RefObject<HTMLElement | null>
  /** Error al guardar (502 del catálogo…): se anuncia dentro del diálogo. */
  error?: string | null
}

export function LibraryStatusModal({
  current,
  mediaType,
  onSave,
  onClose,
  loading,
  finalFocusRef,
  error = null,
}: LibraryStatusModalProps) {
  const t = useTranslations('library')
  const scoreLabelId = useId()

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
    <Modal
      open
      onClose={onClose}
      variant="sheet"
      title={current ? t('updateEntry') : t('addToLibrary')}
      dismissible={!loading}
      finalFocusRef={finalFocusRef}
      error={error}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Estado: primer control, recibe el foco al abrir. */}
        <Select
          value={status}
          onChange={(val) => setStatus(val as LibraryStatus)}
          options={statusOptions}
          label={t('statusLabel')}
          data-autofocus
        />

        {/* Puntuación */}
        <div className="flex flex-col gap-1">
          <span id={scoreLabelId} className="text-sm font-body font-medium text-text-secondary">
            {t('score')}
          </span>
          <StarRating value={score} onChange={setScore} size="lg" aria-labelledby={scoreLabelId} className="-ml-2.5" />
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

        {/* Progreso de episodios — solo para tv/anime. Cada campo lleva su
            propia etiqueta (Temporada, Episodio). */}
        {showEpisodeProgress && (
          <EpisodeProgress
            value={episodeProgress}
            onChange={setEpisodeProgress}
            showSeason={showSeason}
          />
        )}

        {/* Botones */}
        <div className="flex items-center gap-3 pt-2">
          <KButton
            type="submit"
            variant="primary"
            loading={loading}
            className="flex-1"
          >
            {loading ? t('saving') : t('saveStatus')}
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
    </Modal>
  )
}
