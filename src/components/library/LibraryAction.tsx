'use client'

// ============================================================
// KULTURA — LibraryAction
// Tu estado de un título en la ficha: añadirlo, cambiarlo o quitarlo de tu
// biblioteca. Con el título dentro, la banda de estado («En curso · hace 3
// días») y tu nota («8,5 de 10»); el cromo de la ficha (`TitleCromo`) cambia
// de forma a la vez porque comparten estado (`TitleEntryProvider`) y se pega
// al cambiar (DISENO.md: pegado al cambiar de estado).
//
// F-24: el diálogo usa la escala y el diario del título. La ficha ya los
// trae del servidor (`initialDiary`); si no, se piden a /api/library/diary
// (se adelanta al pasar el ratón o el foco por el botón y se recuerda
// mientras dure la página).
//
// Quitar con «Deshacer»: el título desaparece al momento, pero el DELETE real
// espera a que se vaya el aviso (`onExpire`). El borrado se lleva por la FK
// (ON DELETE CASCADE) el diario del título —reseñas y notas privadas— y eso
// no se puede volver a crear: por eso «Deshacer» CANCELA el borrado en vez de
// volver a guardar la entrada. Si la página se cierra antes, se borra ya
// (`keepalive`); si se vuelve a añadir antes, el borrado pendiente se anula.
//
// F-27: a la vez se pide el progreso del título y lo que dice el proveedor
// (/api/library/progress: temporadas, capítulos, páginas, horas medias) para
// el control de progreso por formato del diálogo.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { StatusBand } from '@/components/album/StatusBand'
import { LibraryStatusModal, type LibraryStatusSaveData } from '@/components/library/LibraryStatusModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToastContext } from '@/components/ui/ToastProvider'
import {
  removeFromLibrary,
  saveLibraryEntry,
  fetchDiaryConfig,
  deleteDiaryLog,
  fetchProgressConfig,
  type ProgressConfig,
} from '@/lib/library/actions'
import type { LibraryPayloadWithProgress } from '@/lib/library/progress'
import { entryRating10 } from '@/lib/library/rating'
import { createLogger } from '@/lib/logger'
import type { DiaryConfig, DiaryLog, LibraryEntry, RatingScale } from '@/types/library'
import { useTitleEntryState } from './entry-context'
import { ratingParts, type DisplayScale } from './rating-display'

const log = createLogger('LibraryAction')

/** Mensaje de `/api/library` cuando el proveedor no responde (502). */
const PROVIDER_UNAVAILABLE = 'Media provider unavailable'

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

/** Progreso y plan del proveedor por título (F-27), igual que el diario. */
const progressCache = new Map<string, Promise<ProgressConfig | null>>()

function loadProgress(mediaId: string): Promise<ProgressConfig | null> {
  let pending = progressCache.get(mediaId)
  if (!pending) {
    pending = Promise.resolve()
      .then(() => fetchProgressConfig(mediaId))
      .catch((err) => {
        // Sin la configuración, el progreso de siempre (episodios).
        log.warn('Failed to load progress config', { err })
        progressCache.delete(mediaId)
        return null
      })
    progressCache.set(mediaId, pending)
  }
  return pending
}

/** Entrada con la última vez que se tocó (`updated_at`), si la trae. */
type TouchedEntry = LibraryEntry & { updatedAt?: string }

/** Borrado pendiente mientras dura el aviso con «Deshacer». */
interface PendingRemoval {
  entry: LibraryEntry
  logs: DiaryLog[]
  settled: boolean
}

/** Solo para tests. */
export function __resetDiaryCache() {
  diaryCache.clear()
  progressCache.clear()
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
  /**
   * Diario del título ya leído en el servidor (F-24, con la migración): el
   * diálogo no tiene que pedirlo. `null`/ausente: se pide al abrir.
   */
  initialDiary?: { scale: RatingScale; logs: DiaryLog[] } | null
  /** Escala con la que se pinta tu nota antes de que llegue la del diario. */
  scale?: DisplayScale
  /**
   * `?guardar=1` (vuelta de «Guardar» en un ranking tras entrar): si el
   * título NO está en tu biblioteca, se guarda como pendiente al llegar. Si ya
   * está, no se toca (POST /api/library sustituye: pisaría estado, nota y
   * progreso).
   */
  autoSave?: boolean
}

/** Cruz del «+»: dibujada, no un carácter (DISENO.md). */
function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

export function LibraryAction({
  mediaId,
  mediaCache,
  initialEntry,
  isAuthenticated,
  initialDiary = null,
  scale = 'legacy',
  autoSave = false,
}: LibraryActionProps) {
  const t = useTranslations('library')
  const td = useTranslations('diary')
  const tc = useTranslations('common')
  const locale = useLocale()
  const { show, showError } = useToastContext()

  const shared = useTitleEntryState(initialEntry, initialDiary?.logs ?? null, initialDiary?.scale ?? scale)
  const { entry, setEntry, logs, setLogs } = shared
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [loading, setLoading] = useState(false)
  // ACC-11: los fallos se dicen DENTRO del diálogo que sigue abierto (un
  // toast quedaría debajo y fuera del árbol accesible mientras dure).
  const [saveError, setSaveError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [diaryMeta, setDiaryMeta] = useState<Pick<DiaryConfig, 'enabled' | 'scale'> | null>(
    initialDiary ? { enabled: true, scale: initialDiary.scale } : null
  )
  // Con el diario del servidor, los apuntes ya son los buenos: lo que llegue
  // después de /api/library/diary no los pisa (podría traer uno que se está
  // borrando con «Deshacer»).
  const logsKnown = useRef(initialDiary !== null)
  const [progressConfig, setProgressConfig] = useState<ProgressConfig | null>(null)
  // Al guardar o quitar, el botón que abrió el diálogo desaparece ("Añadir"
  // pasa a "Actualizar" y al revés): el foco va al que lo sustituye.
  const addRef = useRef<HTMLButtonElement>(null)
  const updateRef = useRef<HTMLButtonElement>(null)
  const pendingRef = useRef<PendingRemoval | null>(null)
  // Tras confirmar, el foco va al «Deshacer» del aviso (el botón que abrió el
  // diálogo ya no existe); si no hay aviso, a «Añadir».
  const afterRemoveFocus = {
    get current(): HTMLElement | null {
      const actions = document.querySelectorAll<HTMLElement>('[data-toast-action]')
      return actions[actions.length - 1] ?? addRef.current
    },
  }

  function prefetch() {
    if (!isAuthenticated) return
    void loadDiary(mediaId).then((config) => {
      if (!config) return
      setDiaryMeta({ enabled: config.enabled, scale: config.scale })
      if (!logsKnown.current) {
        logsKnown.current = true
        setLogs(config.logs)
      }
    })
    void loadProgress(mediaId).then((config) => {
      if (config) setProgressConfig(config)
    })
  }

  function openModal() {
    setModalOpen(true)
    prefetch()
  }

  async function handleSave(data: LibraryStatusSaveData) {
    // Volver a añadirlo mientras sigue el aviso: el borrado pendiente no se hace.
    if (pendingRef.current) pendingRef.current.settled = true
    setLoading(true)
    setSaveError(null)
    try {
      const payload: LibraryPayloadWithProgress = {
        mediaId,
        status: data.status,
        score: data.score ?? undefined,
        rating10: data.rating10,
        ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
        watchedAt: data.watchedAt ?? undefined,
        episodeProgress: data.episodeProgress ?? undefined,
        ...(data.progress !== undefined ? { progress: data.progress } : {}),
        ...(data.log ? { log: data.log } : {}),
        mediaCache,
      }
      const result = await saveLibraryEntry(payload)
      // Lo acabas de tocar: la banda dice «hoy».
      const touched: TouchedEntry = { ...result.entry, updatedAt: new Date().toISOString() }
      setEntry(touched)
      // El progreso guardado pasa a ser el de partida (y el plan sigue valiendo).
      progressCache.delete(mediaId)
      setProgressConfig((prev) =>
        prev ? { ...prev, progress: (result.entry as { progress?: ProgressConfig['progress'] }).progress ?? null, next: null } : prev
      )
      if (result.log) {
        const added = result.log
        setLogs((prev) => [added, ...prev])
        diaryCache.delete(mediaId)
      }
      setModalOpen(false)
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

  /** Desde el diálogo, tras confirmar en la propia fila (no hay aviso encima de un diálogo). */
  async function handleDeleteLog(id: string) {
    await deleteDiaryLog(id)
    setLogs((prev) => prev.filter((l) => l.id !== id))
    diaryCache.delete(mediaId)
    show({ message: td('deleted', { title: mediaCache.title }), type: 'success' })
  }

  /** «Deshacer»: el borrado no llega a hacerse; la entrada vuelve tal cual. */
  function undoRemove(pending: PendingRemoval) {
    if (pending.settled) return
    pending.settled = true
    pendingRef.current = null
    setEntry(pending.entry)
    setLogs(pending.logs)
    show({ message: t('restored'), type: 'success' })
  }

  /** El aviso se fue sin «Deshacer» (o se cierra la página): ahora sí se borra. */
  async function commitRemove(pending: PendingRemoval, keepalive = false) {
    if (pending.settled) return
    pending.settled = true
    if (pendingRef.current === pending) pendingRef.current = null
    try {
      await (keepalive ? removeFromLibrary(mediaId, { keepalive: true }) : removeFromLibrary(mediaId))
      diaryCache.delete(mediaId)
    } catch (err) {
      log.error('Failed to remove library entry', { err })
      setEntry(pending.entry)
      setLogs(pending.logs)
      showError(t('errors.removeFailed'))
    }
  }

  // `?guardar=1`: guardar como pendiente SOLO si no estaba (la entrada que ya
  // pinta la ficha manda), una vez, y quitar el parámetro de la URL para que
  // recargar no lo repita.
  const autoSaved = useRef(false)
  useEffect(() => {
    if (!autoSave || autoSaved.current || !isAuthenticated) return
    autoSaved.current = true
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('guardar')
      window.history.replaceState(window.history.state, '', url.toString())
    } catch {
      // Sin URL que limpiar (tests): no pasa nada.
    }
    if (initialEntry) return
    void saveLibraryEntry({ mediaId, status: 'pending', mediaCache })
      .then((result) => {
        setEntry({ ...result.entry, updatedAt: new Date().toISOString() } as TouchedEntry)
        show({ message: t('saved'), type: 'success' })
      })
      .catch((err) => {
        log.error('Failed to auto-save library entry', { err })
        showError(t('errors.saveFailed'))
      })
    // Solo al llegar a la ficha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cerrar o dejar la página con un borrado pendiente: se hace ya.
  useEffect(() => {
    const flush = () => {
      if (pendingRef.current) void commitRemove(pendingRef.current, true)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  })

  function handleRemove() {
    if (!entry) return
    const pending: PendingRemoval = { entry, logs, settled: false }
    pendingRef.current = pending
    setRemoveError(null)
    setEntry(null)
    // La FK se lleva el diario con la entrada: se deja de ver ya.
    setLogs([])
    setConfirmRemove(false)
    show({
      message: t('removed'),
      type: 'success',
      action: {
        label: t('undo'),
        onAction: () => undoRemove(pending),
        onExpire: () => void commitRemove(pending),
        autoFocus: true,
      },
    })
  }

  if (!isAuthenticated) {
    return (
      <KButton asChild variant="primary">
        <Link href="/login">{t('signInToSave')}</Link>
      </KButton>
    )
  }

  const diary: DiaryConfig | null = diaryMeta ? { ...diaryMeta, logs } : null

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
      title={mediaCache.title}
      progressConfig={progressConfig}
    />
  ) : null

  if (!entry) {
    return (
      <>
        <KButton
          ref={addRef}
          variant="primary"
          size="lg"
          className="w-full sm:w-auto"
          onClick={openModal}
          onPointerEnter={prefetch}
          onFocus={prefetch}
        >
          <PlusIcon /> {t('addToLibrary')}
        </KButton>
        {modal}
      </>
    )
  }

  const ratingScale: DisplayScale = diaryMeta?.enabled ? diaryMeta.scale : shared.scale
  const rating = ratingParts(entryRating10(entry), ratingScale, locale)
  const touchedAt = (entry as TouchedEntry).updatedAt ?? null

  return (
    <>
      <div className="flex flex-col gap-4" data-library-entry={entry.status}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusBand
            status={entry.status}
            label={t(`status.${entry.status}`)}
            touchedAt={touchedAt}
            locale={locale}
            className="h-9 px-3 text-sm"
          />
          {rating ? (
            <p className="flex items-baseline gap-1.5">
              <span aria-hidden="true" className="text-meta font-semibold text-text-tertiary">
                {td('yourRating')}
              </span>
              <span aria-hidden="true" className="font-display text-3xl leading-none tabular-nums text-text-primary">
                {rating.value}
              </span>
              <span aria-hidden="true" className="text-meta text-text-tertiary">
                {td('outOf', { max: rating.max })}
              </span>
              <span className="sr-only">
                {td('yourRating')}: {td('ratingOf', { value: rating.value, max: rating.max })}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <KButton
            ref={updateRef}
            variant="primary"
            onClick={openModal}
            onPointerEnter={prefetch}
            onFocus={prefetch}
          >
            {t('updateEntry')}
          </KButton>
          <KButton
            variant="secondary"
            onClick={() => { setConfirmRemove(true); prefetch() }}
            onPointerEnter={prefetch}
            onFocus={prefetch}
            disabled={loading}
          >
            {t('remove')}
          </KButton>
        </div>
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
        finalFocusRef={afterRemoveFocus}
        error={removeError}
      />
    </>
  )
}
