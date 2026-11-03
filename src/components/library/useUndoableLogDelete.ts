'use client'

// ============================================================
// KULTURA — Borrar un apunte del diario con «Deshacer» (WIG)
//
// Un apunte lleva su reseña y su nota personal, y borrarlo no tiene vuelta:
// por eso desaparece al momento de la vista, pero el DELETE real espera a que
// se vaya el aviso (`onExpire`), igual que «Quitar de mi biblioteca».
// «Deshacer» CANCELA el borrado (no vuelve a crear nada) y el apunte vuelve a
// su sitio. Si la página se cierra antes, se borra ya (`keepalive`).
// ============================================================

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { useTranslations } from 'next-intl'
import { useToastContext } from '@/components/ui/ToastProvider'
import { deleteDiaryLog } from '@/lib/library/actions'
import { createLogger } from '@/lib/logger'
import type { DiaryLog } from '@/types/library'

const log = createLogger('useUndoableLogDelete')

interface PendingDelete {
  log: DiaryLog
  index: number
  settled: boolean
}

/** El mismo DELETE que `deleteDiaryLog`, pero que sobrevive al cierre de la página. */
function deleteOnPageHide(id: string): void {
  void fetch('/api/library/diary', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
    keepalive: true,
  }).catch(() => undefined)
}

/**
 * Devuelve `remove(log, title)`: lo quita de `setLogs` y enseña el aviso con
 * «Deshacer». `onCommitted` avisa cuando el borrado ya es real.
 */
export function useUndoableLogDelete(
  setLogs: Dispatch<SetStateAction<DiaryLog[]>>,
  onCommitted?: (id: string) => void
): (entry: DiaryLog, title: string) => void {
  const t = useTranslations('diary')
  const { show, showError } = useToastContext()
  const pending = useRef(new Map<string, PendingDelete>())

  function restore(p: PendingDelete) {
    setLogs((prev) => {
      if (prev.some((l) => l.id === p.log.id)) return prev
      const next = prev.slice()
      next.splice(Math.min(p.index, next.length), 0, p.log)
      return next
    })
  }

  function undo(p: PendingDelete) {
    if (p.settled) return
    p.settled = true
    pending.current.delete(p.log.id)
    restore(p)
    show({ message: t('restored'), type: 'success' })
  }

  async function commit(p: PendingDelete) {
    if (p.settled) return
    p.settled = true
    pending.current.delete(p.log.id)
    try {
      await deleteDiaryLog(p.log.id)
      onCommitted?.(p.log.id)
    } catch (err) {
      log.error('Failed to delete diary log', { err })
      restore(p)
      showError(t('deleteFailed'))
    }
  }

  // Cerrar o dejar la página con borrados pendientes: se hacen ya.
  useEffect(() => {
    const map = pending.current
    const flush = () => {
      for (const p of map.values()) {
        if (p.settled) continue
        p.settled = true
        deleteOnPageHide(p.log.id)
      }
      map.clear()
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  return (entry, title) => {
    // El sitio del apunte se apunta cuando React aplica el cambio (el
    // actualizador puede ir después): «Deshacer» siempre llega más tarde.
    const p: PendingDelete = { log: entry, index: 0, settled: false }
    pending.current.set(entry.id, p)
    setLogs((prev) => {
      const at = prev.findIndex((l) => l.id === entry.id)
      if (at >= 0) p.index = at
      return prev.filter((l) => l.id !== entry.id)
    })
    show({
      message: t('deleted', { title }),
      type: 'success',
      action: {
        label: t('undo'),
        onAction: () => undo(p),
        onExpire: () => void commit(p),
        autoFocus: true,
      },
    })
  }
}
