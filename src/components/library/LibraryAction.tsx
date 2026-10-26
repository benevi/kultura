'use client'

// ============================================================
// KULTURA — LibraryAction
// CTA para añadir / actualizar / eliminar un título de la
// biblioteca personal del usuario desde la página de detalle.
//
// F-24: al abrir el diálogo pide la escala y el diario del título
// (/api/library/diary; se adelanta al pasar el ratón o el foco por el botón y
// se recuerda mientras dure la página). Al marcarlo como completado, el estado
// hace un «sello» lima (DIS-14, ≤ 300 ms, sin mover nada, nada con
// movimiento reducido).
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { LibraryStatusModal, type LibraryStatusSaveData } from '@/components/library/LibraryStatusModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToastContext } from '@/components/ui/ToastProvider'
import { removeFromLibrary, saveLibraryEntry, fetchDiaryConfig, deleteDiaryLog } from '@/lib/library/actions'
import { playStamp, prefersReducedMotion } from '@/lib/library/motion'
import { cn } from '@/lib/utils/index'
import { createLogger } from '@/lib/logger'
import type { DiaryConfig, LibraryEntry, LibraryStatus, LibraryPayload } from '@/types/library'

const log = createLogger('LibraryAction')

/** Mensaje de `/api/library` cuando el proveedor no responde (502). */
const PROVIDER_UNAVAILABLE = 'Media provider unavailable'

/** Cuánto se queda la pegatina de «Visto» antes de irse. */
const STAMP_VISIBLE_MS = 1400

/** Escala y diario por título, mientras dure la página (una petición por título). */
const diaryCache = new Map<string, Promise<DiaryConfig | null>>()

function loadDiary(mediaId: string): Promise<DiaryConfig | null> {
  let pending = diaryCache.get(mediaId)
  if (!pending) {
    pending = fetchDiaryConfig(mediaId).catch((err) => {
      // Sin la configuración, el diálogo de siempre (estrellas enteras).
      log.warn('Failed to load diary config', { err })
      diaryCache.delete(mediaId)
      return null
    })
    diaryCache.set(mediaId, pending)
  }
  return pending
}

/** Solo para tests. */
export function __resetDiaryCache() {
  diaryCache.clear()
}

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
  const td = useTranslations('diary')
  const tc = useTranslations('common')
  const { show, showError } = useToastContext()

  const [entry, setEntry] = useState<LibraryEntry | null>(initialEntry)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [loading, setLoading] = useState(false)
  // ACC-11: los fallos se dicen DENTRO del diálogo que sigue abierto (un
  // toast quedaría debajo y fuera del árbol accesible mientras dure).
  const [saveError, setSaveError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [diary, setDiary] = useState<DiaryConfig | null>(null)
  const [stamp, setStamp] = useState(0)
  // Al guardar o quitar, el botón que abrió el diálogo desaparece ("Añadir"
  // pasa a "Actualizar" y al revés): el foco va al que lo sustituye.
  const addRef = useRef<HTMLButtonElement>(null)
  const updateRef = useRef<HTMLButtonElement>(null)
  const stampRef = useRef<HTMLSpanElement>(null)

  function prefetch() {
    if (!isAuthenticated) return
    void loadDiary(mediaId).then((config) => {
      if (config) setDiary(config)
    })
  }

  function openModal() {
    setModalOpen(true)
    prefetch()
  }

  // Sello de «Visto»: pegatina en posición absoluta (no ocupa sitio, CLS 0).
  useEffect(() => {
    if (stamp === 0) return
    const el = stampRef.current
    if (!el || !playStamp(el)) return
    const timer = window.setTimeout(() => {
      el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
    }, STAMP_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [stamp])

  async function handleSave(data: LibraryStatusSaveData) {
    setLoading(true)
    setSaveError(null)
    try {
      const payload: LibraryPayload = {
        mediaId,
        status: data.status,
        score: data.score ?? undefined,
        rating10: data.rating10,
        ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
        watchedAt: data.watchedAt ?? undefined,
        episodeProgress: data.episodeProgress ?? undefined,
        ...(data.log ? { log: data.log } : {}),
        mediaCache,
      }
      const result = await saveLibraryEntry(payload)
      const becameCompleted = result.entry.status === 'completed' && entry?.status !== 'completed'
      setEntry(result.entry)
      if (result.log) {
        const added = result.log
        setDiary((prev) => (prev ? { ...prev, logs: [added, ...prev.logs] } : prev))
        diaryCache.delete(mediaId)
      }
      setModalOpen(false)
      if (becameCompleted && !prefersReducedMotion()) setStamp((n) => n + 1)
      if (result.logFailed) showError(td('logFailed'))
      else show({ message: result.log ? td('savedWithLog') : t('saved'), type: 'success' })
    } catch (err) {
      log.error('Failed to save library entry', { err })
      // ACC-11: antes el fallo solo iba al log y la persona no se enteraba.
      // El diálogo sigue abierto con sus datos para reintentar.
      setSaveError(
        err instanceof Error && err.message === PROVIDER_UNAVAILABLE
          ? t('errors.providerUnavailable')
          : t('errors.saveFailed')
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteLog(id: string) {
    await deleteDiaryLog(id)
    setDiary((prev) => (prev ? { ...prev, logs: prev.logs.filter((l) => l.id !== id) } : prev))
    diaryCache.delete(mediaId)
    show({ message: td('deleted'), type: 'success' })
  }

  async function handleRemove() {
    setLoading(true)
    setRemoveError(null)
    try {
      await removeFromLibrary(mediaId)
      setEntry(null)
      setConfirmRemove(false)
      // La FK borra el diario del título con la entrada.
      setDiary((prev) => (prev ? { ...prev, logs: [] } : prev))
      diaryCache.delete(mediaId)
      show({ message: t('removed'), type: 'success' })
    } catch (err) {
      log.error('Failed to remove library entry', { err })
      setRemoveError(t('errors.removeFailed'))
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

  const modal = modalOpen ? (
    <LibraryStatusModal
      current={entry}
      mediaType={mediaCache.type}
      onSave={handleSave}
      onClose={() => { setModalOpen(false); setSaveError(null) }}
      loading={loading}
      finalFocusRef={entry ? undefined : updateRef}
      error={saveError}
      diary={diary}
      onDeleteLog={handleDeleteLog}
    />
  ) : null

  if (!entry) {
    return (
      <>
        <KButton
          ref={addRef}
          variant="primary"
          onClick={openModal}
          onPointerEnter={prefetch}
          onFocus={prefetch}
        >
          <span aria-hidden="true">+</span> {t('addToLibrary')}
        </KButton>
        {modal}
      </>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="relative inline-flex">
          <span
            className={cn(
              'px-3 py-1 rounded-pill text-sm font-body font-medium',
              statusClasses[entry.status]
            )}
          >
            {t(`status.${entry.status}`)}
          </span>
          {/* DIS-14: pegatina lima; solo decorativa (el estado ya se lee al lado). */}
          {stamp > 0 && (
            <span
              ref={stampRef}
              aria-hidden="true"
              data-testid="library-stamp"
              className="pointer-events-none absolute -top-4 -right-6 z-10 rounded-md bg-accent-lime px-2 py-0.5 font-display text-xs font-extrabold uppercase text-black opacity-0 shadow-sm"
            >
              {td('stamp', { type: mediaCache.type })}
            </span>
          )}
        </span>
        <KButton
          ref={updateRef}
          variant="secondary"
          size="sm"
          onClick={openModal}
          onPointerEnter={prefetch}
          onFocus={prefetch}
        >
          {t('updateEntry')}
        </KButton>
        <KButton
          variant="secondary"
          size="sm"
          onClick={() => { setConfirmRemove(true); prefetch() }}
          onPointerEnter={prefetch}
          onFocus={prefetch}
          disabled={loading}
          className="text-accent-danger hover:text-accent-danger border-accent-danger/30 hover:border-accent-danger/60"
        >
          {t('remove')}
        </KButton>
      </div>

      {modal}

      {/* ACC-11: quitar borra estado, nota y progreso (y el diario); se confirma antes. */}
      <ConfirmModal
        isOpen={confirmRemove}
        title={t('removeConfirmTitle')}
        message={
          diary?.enabled
            ? td('removeConfirmBody', { title: mediaCache.title })
            : t('removeConfirmBody', { title: mediaCache.title })
        }
        confirmLabel={t('removeConfirm')}
        cancelLabel={tc('cancel')}
        isDestructive
        loading={loading}
        onConfirm={handleRemove}
        onCancel={() => { setConfirmRemove(false); setRemoveError(null) }}
        finalFocusRef={addRef}
        error={removeError}
      />
    </>
  )
}
