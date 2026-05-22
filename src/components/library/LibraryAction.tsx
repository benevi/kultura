'use client'

// ============================================================
// KULTURA — LibraryAction
// CTA para añadir / actualizar / eliminar un título de la
// biblioteca personal del usuario desde la página de detalle.
// ============================================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { LibraryStatusModal } from '@/components/library/LibraryStatusModal'
import { addToLibrary, updateLibrary, removeFromLibrary } from '@/lib/library/actions'
import { cn } from '@/lib/utils/index'
import type { LibraryEntry, LibraryStatus, LibraryPayload, EpisodeProgress } from '@/types/library'

interface LibraryActionProps {
  mediaId: string
  mediaCache: {
    externalId: string
    type: string
    title: string
    poster?: string
    backdrop?: string
    year?: number
    synopsis?: string
  }
  initialEntry: LibraryEntry | null
  isAuthenticated: boolean
}

const statusClasses: Record<LibraryStatus, string> = {
  completed: 'bg-accent-positive/20 text-accent-positive',
  in_progress: 'bg-accent-info/20 text-accent-info',
  pending: 'bg-accent-highlight/20 text-accent-highlight',
  abandoned: 'bg-accent-danger/20 text-accent-danger',
}

export function LibraryAction({
  mediaId,
  mediaCache,
  initialEntry,
  isAuthenticated,
}: LibraryActionProps) {
  const t = useTranslations('library')

  const [entry, setEntry] = useState<LibraryEntry | null>(initialEntry)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSave(data: {
    status: LibraryStatus
    score: number | null
    watchedAt: string | null
    episodeProgress: EpisodeProgress | null
  }) {
    setLoading(true)
    try {
      const payload: LibraryPayload = {
        mediaId,
        status: data.status,
        score: data.score ?? undefined,
        watchedAt: data.watchedAt ?? undefined,
        episodeProgress: data.episodeProgress ?? undefined,
        mediaCache,
      }
      const saved = entry
        ? await updateLibrary(payload)
        : await addToLibrary(payload)
      setEntry(saved)
      setModalOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await removeFromLibrary(mediaId)
      setEntry(null)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <KButton asChild variant="primary">
        <Link href="/login">{t('signInToSave')}</Link>
      </KButton>
    )
  }

  if (!entry) {
    return (
      <>
        <KButton variant="primary" onClick={() => setModalOpen(true)}>
          + {t('addToLibrary')}
        </KButton>

        {modalOpen && (
          <LibraryStatusModal
            current={null}
            mediaType={mediaCache.type}
            onSave={handleSave}
            onClose={() => setModalOpen(false)}
            loading={loading}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={cn(
            'px-3 py-1 rounded-pill text-sm font-body font-medium',
            statusClasses[entry.status]
          )}
        >
          {t(`status.${entry.status}`)}
        </span>
        <KButton variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
          {t('updateEntry')}
        </KButton>
        <KButton
          variant="secondary"
          size="sm"
          onClick={handleRemove}
          disabled={loading}
          className="text-accent-danger hover:text-accent-danger border-accent-danger/30 hover:border-accent-danger/60"
        >
          {t('remove')}
        </KButton>
      </div>

      {modalOpen && (
        <LibraryStatusModal
          current={entry}
          mediaType={mediaCache.type}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          loading={loading}
        />
      )}
    </>
  )
}
