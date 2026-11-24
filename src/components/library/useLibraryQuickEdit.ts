'use client'

// ============================================================
// KULTURA — useLibraryQuickEdit
// Cambiar estado y nota desde una tarjeta de la Biblioteca, sin vista: lo
// usan `LibraryQuickEdit` (la biblioteca de hoy, bandera LIBRARY_QUICK_EDIT)
// y `SalaLibraryQuickEdit` («Sala», fase 8.5 B1, bandera SALA_BIBLIOTECA).
// Mismas server actions y mismos avisos; cada vista pone su diálogo y su
// sistema de avisos (`toast`).
//
// Antes de abrir el diálogo se piden la escala/diario y el plan de progreso
// del título, como hace la ficha; si alguno falla, el diálogo sale en su
// forma básica con lo que la entrada ya trae (nota y progreso no se pierden).
// ============================================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { LibraryStatusSaveData } from '@/components/library/useLibraryStatusForm'
import type { LibraryToastApi } from '@/components/library/useLibraryAction'
import {
  deleteDiaryLog,
  fetchDiaryConfig,
  fetchProgressConfig,
  saveLibraryEntry,
  type ProgressConfig,
} from '@/lib/library/actions'
import type { LibraryPayloadWithProgress } from '@/lib/library/progress'
import { ApiError } from '@/lib/api/client'
import type { DiaryConfig, LibraryEntry } from '@/types/library'

interface UseLibraryQuickEditOptions {
  entry: LibraryEntry
  title: string
  /** La entrada tal como quedó guardada. */
  onSaved: (entry: LibraryEntry) => void
  toast: LibraryToastApi
}

export function useLibraryQuickEdit({ entry, title, onSaved, toast }: UseLibraryQuickEditOptions) {
  const t = useTranslations('library')
  const td = useTranslations('diary')
  const { show, showError } = toast
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

  function closeModal() {
    setOpen(false)
    setSaveError(null)
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

  return {
    mediaType,
    opening,
    open,
    openModal,
    closeModal,
    saving,
    saveError,
    diary,
    progressConfig,
    handleSave,
    handleDeleteLog,
  }
}
