'use client'

// ============================================================
// KULTURA — useLibraryAction
// El comportamiento de las acciones de biblioteca de la ficha, sin vista:
// lo usan `LibraryAction` (la ficha de hoy) y `SalaLibraryAction` («Sala»,
// fase 8.5). Mismas server actions, mismos avisos, mismo «Deshacer».
//
// F-24: al abrir el diálogo pide la escala y el diario del título
// (/api/library/diary; se adelanta al pasar el ratón o el foco por el botón y
// se recuerda mientras dure la página).
//
// Quitar con «Deshacer»: el título desaparece al momento, pero el DELETE real
// espera a que se vaya el aviso (`onExpire`). El borrado se lleva por la FK
// (ON DELETE CASCADE) el diario del título —reseñas y notas privadas— y eso
// no se puede volver a crear: por eso «Deshacer» CANCELA el borrado en vez de
// volver a guardar la entrada. Si la página se cierra antes, se borra ya
// (`keepalive`); si se vuelve a añadir antes, el borrado pendiente se anula.
//
// F-27: a la vez se pide el progreso del título y lo que dice el proveedor
// (/api/library/progress: temporadas, capítulos, páginas, horas medias).
//
// La vista pone el sistema de avisos (`toast`), dónde buscar el «Deshacer» de
// su aviso (`undoSelector`) y cómo se anima el sello (`playStamp`).
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { LibraryStatusSaveData } from '@/components/library/useLibraryStatusForm'
import {
  removeFromLibrary,
  saveLibraryEntry,
  fetchDiaryConfig,
  deleteDiaryLog,
  fetchProgressConfig,
  type ProgressConfig,
} from '@/lib/library/actions'
import type { LibraryPayloadWithProgress } from '@/lib/library/progress'
import { prefersReducedMotion } from '@/lib/library/motion'
import { createLogger } from '@/lib/logger'
import { ApiError } from '@/lib/api/client'
import type { DiaryConfig, LibraryEntry } from '@/types/library'

const log = createLogger('LibraryAction')

/** Cuánto se queda la pegatina de «Visto» antes de irse. */
export const STAMP_VISIBLE_MS = 1400

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

/** Solo para tests. */
export function __resetDiaryCache() {
  diaryCache.clear()
  progressCache.clear()
}

/** Borrado pendiente mientras dura el aviso con «Deshacer». */
interface PendingRemoval {
  entry: LibraryEntry
  settled: boolean
}

export interface LibraryMediaCache {
  externalId: string
  type: string
  title: string
  poster?: string
  backdrop?: string
  year?: number
  synopsis?: string
  genres?: string[]
}

/** Lo que el hook necesita del sistema de avisos (el de hoy o el de «Sala»). */
export interface LibraryToastApi {
  show: (payload: {
    message: string
    type?: 'success' | 'error' | 'info'
    duration?: number
    action?: {
      label: string
      onAction: () => void
      onExpire?: () => void
      autoFocus?: boolean
      /** A dónde va el foco tras la acción (lo usan los avisos de «Sala»). */
      focusAfter?: () => HTMLElement | null
    }
  }) => void
  showError: (message: string) => void
}

interface UseLibraryActionOptions {
  mediaId: string
  mediaCache: LibraryMediaCache
  initialEntry: LibraryEntry | null
  isAuthenticated: boolean
  toast: LibraryToastApi
  /** Selector del botón de acción de los avisos («Deshacer»). */
  undoSelector: string
  /** Anima el sello; devuelve `false` si no se anima (movimiento reducido). */
  playStamp: (el: Element | null | undefined) => boolean
}

export function useLibraryAction({
  mediaId,
  mediaCache,
  initialEntry,
  isAuthenticated,
  toast,
  undoSelector,
  playStamp,
}: UseLibraryActionOptions) {
  const t = useTranslations('library')
  const td = useTranslations('diary')
  const { show, showError } = toast

  const [entry, setEntry] = useState<LibraryEntry | null>(initialEntry)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [loading, setLoading] = useState(false)
  // ACC-11: los fallos se dicen DENTRO del diálogo que sigue abierto (un
  // toast quedaría debajo y fuera del árbol accesible mientras dure).
  const [saveError, setSaveError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [diary, setDiary] = useState<DiaryConfig | null>(null)
  const [progressConfig, setProgressConfig] = useState<ProgressConfig | null>(null)
  const [stamp, setStamp] = useState(0)
  // Tras «Deshacer», el foco va a «Actualizar», que vuelve a pintarse (2.4.3).
  const [focusUpdate, setFocusUpdate] = useState(0)
  // Al guardar o quitar, el botón que abrió el diálogo desaparece ("Añadir"
  // pasa a "Actualizar" y al revés): el foco va al que lo sustituye.
  const addRef = useRef<HTMLButtonElement>(null)
  const updateRef = useRef<HTMLButtonElement>(null)
  const stampRef = useRef<HTMLSpanElement>(null)
  const pendingRef = useRef<PendingRemoval | null>(null)
  // Tras confirmar, el foco va al «Deshacer» del aviso (el botón que abrió el
  // diálogo ya no existe); si no hay aviso, a «Añadir».
  const afterRemoveFocus = {
    get current(): HTMLElement | null {
      const actions = document.querySelectorAll<HTMLElement>(undoSelector)
      return actions[actions.length - 1] ?? addRef.current
    },
  }

  function prefetch() {
    if (!isAuthenticated) return
    void loadDiary(mediaId).then((config) => {
      if (config) setDiary(config)
    })
    void loadProgress(mediaId).then((config) => {
      if (config) setProgressConfig(config)
    })
  }

  function openModal() {
    setModalOpen(true)
    prefetch()
  }

  function closeModal() {
    setModalOpen(false)
    setSaveError(null)
  }

  function openConfirmRemove() {
    setConfirmRemove(true)
    prefetch()
  }

  function cancelRemove() {
    setConfirmRemove(false)
    setRemoveError(null)
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
  }, [stamp, playStamp])

  useEffect(() => {
    if (focusUpdate > 0) updateRef.current?.focus()
  }, [focusUpdate])

  async function handleSave(data: LibraryStatusSaveData) {
    // Volver a añadirlo mientras sigue el aviso: el borrado pendiente no se hace.
    if (pendingRef.current) pendingRef.current.settled = true
    setLoading(true)
    setSaveError(null)
    try {
      const payload: LibraryPayloadWithProgress = {
        mediaId,
        status: data.status,
        // El diálogo sustituye la entrada entera: lo vacío va como `null`
        // explícito (el POST ya no borra lo que no llega).
        score: data.score,
        rating10: data.rating10,
        ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
        watchedAt: data.watchedAt,
        episodeProgress: data.episodeProgress,
        ...(data.progress !== undefined ? { progress: data.progress } : {}),
        ...(data.log ? { log: data.log } : {}),
        mediaCache,
      }
      const result = await saveLibraryEntry(payload)
      const becameCompleted = result.entry.status === 'completed' && entry?.status !== 'completed'
      setEntry(result.entry)
      // El progreso guardado pasa a ser el de partida (y el plan sigue valiendo).
      progressCache.delete(mediaId)
      setProgressConfig((prev) =>
        prev ? { ...prev, progress: (result.entry as { progress?: ProgressConfig['progress'] }).progress ?? null, next: null } : prev
      )
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
        err instanceof ApiError && err.code === 'provider_unavailable'
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
    show({ message: td('deleted', { title: mediaCache.title }), type: 'success' })
  }

  /** «Deshacer»: el borrado no llega a hacerse; la entrada vuelve tal cual. */
  function undoRemove(pending: PendingRemoval) {
    if (pending.settled) return
    pending.settled = true
    pendingRef.current = null
    setEntry(pending.entry)
    setFocusUpdate((n) => n + 1)
    show({ message: t('restored'), type: 'success' })
  }

  /** El aviso se fue sin «Deshacer» (o se cierra la página): ahora sí se borra. */
  async function commitRemove(pending: PendingRemoval, keepalive = false) {
    if (pending.settled) return
    pending.settled = true
    if (pendingRef.current === pending) pendingRef.current = null
    try {
      await (keepalive ? removeFromLibrary(mediaId, { keepalive: true }) : removeFromLibrary(mediaId))
      // La FK borra el diario del título con la entrada.
      setDiary((prev) => (prev ? { ...prev, logs: [] } : prev))
      diaryCache.delete(mediaId)
    } catch (err) {
      log.error('Failed to remove library entry', { err })
      setEntry(pending.entry)
      showError(t('errors.removeFailed'))
    }
  }

  // Cerrar o dejar la página con un borrado pendiente: se hace ya.
  useEffect(() => {
    const flush = () => {
      if (pendingRef.current) void commitRemove(pendingRef.current, true)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  })

  // Irse a otra pantalla dentro de la app (sin `pagehide`): el componente se
  // desmonta y el aviso con «Deshacer» puede irse con él. El borrado pendiente
  // se hace ya, igual que al cerrar la página.
  const commitRef = useRef(commitRemove)
  commitRef.current = commitRemove
  useEffect(
    () => () => {
      if (pendingRef.current) void commitRef.current(pendingRef.current, true)
    },
    []
  )

  function handleRemove() {
    if (!entry) return
    const pending: PendingRemoval = { entry, settled: false }
    pendingRef.current = pending
    setRemoveError(null)
    setEntry(null)
    setConfirmRemove(false)
    show({
      message: t('removed'),
      type: 'success',
      action: {
        label: t('undo'),
        onAction: () => undoRemove(pending),
        onExpire: () => void commitRemove(pending),
        autoFocus: true,
        focusAfter: () => updateRef.current,
      },
    })
  }

  /** Texto del diálogo de quitar: con el diario, avisa de que también se va. */
  const removeMessage = diary?.enabled
    ? td('removeConfirmBody', { title: mediaCache.title })
    : t('removeConfirmBody', { title: mediaCache.title })

  return {
    entry,
    modalOpen,
    openModal,
    closeModal,
    confirmRemove,
    openConfirmRemove,
    cancelRemove,
    loading,
    saveError,
    removeError,
    diary,
    progressConfig,
    stamp,
    prefetch,
    handleSave,
    handleDeleteLog,
    handleRemove,
    removeMessage,
    addRef,
    updateRef,
    stampRef,
    afterRemoveFocus,
  }
}
