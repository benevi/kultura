'use client'

// ============================================================
// KULTURA — LibraryAction
// CTA para añadir / actualizar / eliminar un título de la
// biblioteca personal del usuario desde la página de detalle.
// ============================================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
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

const statusColors: Record<LibraryStatus, string> = {
  completed: 'bg-green-500/20 text-green-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  abandoned: 'bg-red-500/20 text-red-400',
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
      <Link
        href="/login"
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
          'bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm'
        )}
      >
        {t('signInToSave')}
      </Link>
    )
  }

  if (!entry) {
    return (
      <>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          + {t('addToLibrary')}
        </Button>

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
            'px-3 py-1 rounded-full text-sm font-medium',
            statusColors[entry.status]
          )}
        >
          {t(`status.${entry.status}`)}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setModalOpen(true)}>
          {t('updateEntry')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={loading}
          className="text-red-400 hover:text-red-300"
        >
          {t('remove')}
        </Button>
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
