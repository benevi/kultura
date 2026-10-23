'use client'

// ============================================================
// KULTURA — LibraryAction
// CTA para añadir / actualizar / eliminar un título de la
// biblioteca personal del usuario desde la página de detalle.
// ============================================================

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { LibraryStatusModal } from '@/components/library/LibraryStatusModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToastContext } from '@/components/ui/ToastProvider'
import { addToLibrary, updateLibrary, removeFromLibrary } from '@/lib/library/actions'
import { cn } from '@/lib/utils/index'
import { createLogger } from '@/lib/logger'
import type { LibraryEntry, LibraryStatus, LibraryPayload, EpisodeProgress } from '@/types/library'

const log = createLogger('LibraryAction')

/** Mensaje de `/api/library` cuando el proveedor no responde (502). */
const PROVIDER_UNAVAILABLE = 'Media provider unavailable'

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
    genres?: string[]
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
  const tc = useTranslations('common')
  const { show, showError } = useToastContext()

  const [entry, setEntry] = useState<LibraryEntry | null>(initialEntry)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [loading, setLoading] = useState(false)
  // Al guardar o quitar, el botón que abrió el diálogo desaparece ("Añadir"
  // pasa a "Actualizar" y al revés): el foco va al que lo sustituye.
  const addRef = useRef<HTMLButtonElement>(null)
  const updateRef = useRef<HTMLButtonElement>(null)

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
      show({ message: t('saved'), type: 'success' })
    } catch (err) {
      log.error('Failed to save library entry', { err })
      // ACC-11: antes el fallo solo iba al log y la persona no se enteraba.
      // Un 502 (catálogo caído) se queda hasta que lo cierre: el diálogo sigue
      // abierto con sus datos para reintentar.
      if (err instanceof Error && err.message === PROVIDER_UNAVAILABLE) {
        showError(t('errors.providerUnavailable'), { persistent: true })
      } else {
        showError(t('errors.saveFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await removeFromLibrary(mediaId)
      setEntry(null)
      setConfirmRemove(false)
      show({ message: t('removed'), type: 'success' })
    } catch (err) {
      log.error('Failed to remove library entry', { err })
      showError(t('errors.removeFailed'))
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
        <KButton ref={addRef} variant="primary" onClick={() => setModalOpen(true)}>
          <span aria-hidden="true">+</span> {t('addToLibrary')}
        </KButton>

        {modalOpen && (
          <LibraryStatusModal
            current={null}
            mediaType={mediaCache.type}
            onSave={handleSave}
            onClose={() => setModalOpen(false)}
            loading={loading}
            finalFocusRef={updateRef}
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
        <KButton ref={updateRef} variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
          {t('updateEntry')}
        </KButton>
        <KButton
          variant="secondary"
          size="sm"
          onClick={() => setConfirmRemove(true)}
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

      {/* ACC-11: quitar borra estado, nota y progreso; se confirma antes. */}
      <ConfirmModal
        isOpen={confirmRemove}
        title={t('removeConfirmTitle')}
        message={t('removeConfirmBody', { title: mediaCache.title })}
        confirmLabel={t('removeConfirm')}
        cancelLabel={tc('cancel')}
        isDestructive
        loading={loading}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
        finalFocusRef={addRef}
      />
    </>
  )
}
