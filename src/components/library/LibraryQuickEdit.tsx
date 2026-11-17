'use client'

// ============================================================
// KULTURA — Cambiar estado y nota desde la Biblioteca (fase 8.2,
// bandera LIBRARY_QUICK_EDIT)
// Botón sobre la portada de cada tarjeta de la Biblioteca, FUERA de su enlace,
// que abre el mismo diálogo de la ficha (`LibraryStatusModal`) sin entrar en
// ella. Antes de abrirlo se piden la escala/diario y el plan de progreso del
// título, como hace la ficha; si alguno falla, el diálogo sale en su forma
// básica con lo que la entrada ya trae (nota y progreso no se pierden).
// ============================================================

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LibraryStatusModal, type LibraryStatusSaveData } from '@/components/library/LibraryStatusModal'
import { useToastContext } from '@/components/ui/ToastProvider'
import {
  deleteDiaryLog,
  fetchDiaryConfig,
  fetchProgressConfig,
  saveLibraryEntry,
  type ProgressConfig,
} from '@/lib/library/actions'
import type { LibraryPayloadWithProgress } from '@/lib/library/progress'
import { ApiError } from '@/lib/api/client'
import { IconMore } from '@/components/icons'
import { cn } from '@/lib/utils/index'
import type { DiaryConfig, LibraryEntry } from '@/types/library'

export interface LibraryQuickEditProps {
  entry: LibraryEntry
  title: string
  /** La entrada tal como quedó guardada. */
  onSaved: (entry: LibraryEntry) => void
  className?: string
}

export function LibraryQuickEdit({ entry, title, onSaved, className }: LibraryQuickEditProps) {
  const t = useTranslations('library')
  const td = useTranslations('diary')
  const { show, showError } = useToastContext()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [opening, setOpening] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [diary, setDiary] = useState<DiaryConfig | null>(null)
  const [progressConfig, setProgressConfig] = useState<ProgressConfig | null>(null)

  const mediaType = entry.mediaId.slice(0, entry.mediaId.indexOf('_'))

  async function openModal() {
    if (opening || open) return
    setOpening(true)
    const [d, p] = await Promise.all([
      fetchDiaryConfig(entry.mediaId).catch(() => null),
      fetchProgressConfig(entry.mediaId).catch(() => null),
    ])
    setDiary(d)
    setProgressConfig(p)
    setOpening(false)
    setOpen(true)
  }

  async function handleSave(data: LibraryStatusSaveData) {
    setSaving(true)
    setSaveError(null)
    try {
      const payload: LibraryPayloadWithProgress = {
        mediaId: entry.mediaId,
        status: data.status,
        // El diálogo sustituye la entrada entera: lo vacío va como `null`.
        score: data.score,
        rating10: data.rating10,
        ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
        watchedAt: data.watchedAt,
        episodeProgress: data.episodeProgress,
        ...(data.progress !== undefined ? { progress: data.progress } : {}),
        ...(data.log ? { log: data.log } : {}),
      }
      const result = await saveLibraryEntry(payload)
      setOpen(false)
      // El listado trae título, portada y año; la respuesta puede no traerlos.
      onSaved({ ...entry, ...result.entry, title: entry.title, poster: entry.poster, year: entry.year })
      if (result.logFailed) showError(td('logFailed'))
      else show({ message: result.log ? td('savedWithLog') : t('saved'), type: 'success' })
    } catch (err) {
      setSaveError(
        err instanceof ApiError && err.code === 'provider_unavailable'
          ? t('errors.providerUnavailable')
          : t('errors.saveFailed')
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteLog(id: string) {
    await deleteDiaryLog(id)
    setDiary((prev) => (prev ? { ...prev, logs: prev.logs.filter((l) => l.id !== id) } : prev))
    show({ message: td('deleted', { title }), type: 'success' })
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openModal}
        aria-label={t('quickEdit', { title })}
        aria-haspopup="dialog"
        aria-disabled={opening}
        data-testid="library-quick-edit"
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full border border-surface-border bg-surface-base/80 text-text-primary backdrop-blur-sm transition-colors',
          'hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-info',
          opening && 'opacity-60',
          className
        )}
      >
        <IconMore className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <LibraryStatusModal
          current={entry}
          mediaType={mediaType}
          onSave={handleSave}
          onClose={() => {
            setOpen(false)
            setSaveError(null)
          }}
          loading={saving}
          finalFocusRef={buttonRef}
          error={saveError}
          diary={diary}
          onDeleteLog={handleDeleteLog}
          title={title}
          progressConfig={progressConfig}
        />
      )}
    </>
  )
}
