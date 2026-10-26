'use client'

// ============================================================
// KULTURA — «Marcar siguiente» con actualización optimista (F-27)
// El número cambia al instante; si el servidor falla, vuelve a lo de antes y
// se avisa. El servidor manda (con TMDB sabe si toca cambiar de temporada o
// si la serie está al día). Si lo marcado es el final, se abre la propuesta
// de pasar a «Completado» (y apuntarlo en el diario si F-24 está activo).
// ============================================================

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { advanceProgress, completeFromProgress } from '@/lib/library/actions'
import { localDateString } from '@/lib/library/dates'
import { nextProgress, type ProgressValue } from '@/lib/library/progress'
import { useProgressLabel } from '@/components/library/useProgressLabel'
import type { LibraryStatus } from '@/types/library'

export interface ProgressAnnouncement {
  text: string
  /** `alert` para fallos (se anuncia al momento). */
  tone: 'polite' | 'alert'
}

interface Options {
  mediaId: string
  mediaType: string
  title: string
  progress: ProgressValue | null
  status: LibraryStatus
}

export function useProgressAdvance({ mediaId, mediaType, title, progress: initial, status: initialStatus }: Options) {
  const t = useTranslations('progress')
  const label = useProgressLabel()
  const [progress, setProgress] = useState<ProgressValue | null>(initial)
  const [status, setStatus] = useState<LibraryStatus>(initialStatus)
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState<ProgressAnnouncement | null>(null)
  const [finish, setFinish] = useState<{ diary: boolean } | null>(null)
  const [completing, setCompleting] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  // Evita dos peticiones a la vez con toques muy seguidos.
  const inFlight = useRef(false)

  async function advance() {
    if (inFlight.current) return
    inFlight.current = true
    const before = progress
    const beforeStatus = status
    const guess = nextProgress(mediaType, progress, null)
    if (guess) setProgress(guess.value)
    if (status === 'pending' || status === 'abandoned') setStatus('in_progress')
    setBusy(true)
    try {
      const result = await advanceProgress(mediaId)
      setProgress(result.progress)
      setStatus(result.status)
      if (result.caughtUp) {
        setAnnouncement({ text: t('caughtUp', { title }), tone: 'polite' })
      } else {
        setAnnouncement({ text: t('saved', { title, label: label(mediaType, result.progress) }), tone: 'polite' })
      }
      if (result.finished) {
        setFinishError(null)
        setFinish({ diary: result.diary })
      }
    } catch (err) {
      setProgress(before)
      setStatus(beforeStatus)
      const unavailable = err instanceof Error && err.message === 'progress_unavailable'
      setAnnouncement({ text: unavailable ? t('unavailable') : t('failed', { title }), tone: 'alert' })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function complete(log: boolean) {
    setCompleting(true)
    setFinishError(null)
    try {
      const result = await completeFromProgress(mediaId, { log, watchedOn: localDateString() })
      setStatus('completed')
      setFinish(null)
      setAnnouncement({
        text: result.logFailed
          ? t('completedLogFailed', { title })
          : result.log
            ? t('completedWithLog', { title })
            : t('completed', { title }),
        tone: result.logFailed ? 'alert' : 'polite',
      })
    } catch {
      // El diálogo sigue abierto con el aviso dentro (ACC-11).
      setFinishError(t('completeFailed'))
    } finally {
      setCompleting(false)
    }
  }

  return {
    progress,
    status,
    busy,
    announcement,
    finish,
    completing,
    finishError,
    advance,
    complete,
    dismissFinish: () => {
      setFinish(null)
      setFinishError(null)
    },
  }
}
