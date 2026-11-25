'use client'

// ============================================================
// KULTURA — La lógica de «Para ti» (D-06 / ROJO-4), sin la vista.
// La comparten `AiRecommendations` (Inicio de hoy) y `SalaHomeForYou`
// (Inicio en «Sala», fase 8.5 I2b): los mismos estados, la misma petición y
// el mismo momento en que se hace. Nada se pide al montarse: la IA solo se
// llama con `fetchRecs`, que es el botón «Recomiéndame» (el consentimiento
// que promete la política de privacidad) o «Reintentar».
// ============================================================

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { AiRec, AiRecsResult } from '@/lib/claude/recommendations'
import type { MediaItem } from '@/types/media'
import { ApiError, apiFetch } from '@/lib/api/client'

export type AiRecsStatus = 'idle' | 'loading' | 'done' | 'starter' | 'empty' | 'error' | 'rate_limited'

export interface AiRecsInput {
  /** Las recomendaciones de hoy, si ya se generaron (las lee Inicio en el servidor sin coste). */
  initial?: AiRecsResult | null
  /** Lo popular para una cuenta sin señal suficiente: se enseña sin botón. */
  starter?: MediaItem[]
  /** Esqueleto mientras el servidor prepara lo popular. No pide nada. */
  pending?: boolean
}

function initialStatus(
  initial: AiRecsResult | null | undefined,
  starter: MediaItem[] | undefined,
  pending: boolean
): AiRecsStatus {
  if (pending) return 'loading'
  if (initial && initial.recommendations.length > 0) return 'done'
  if (starter && starter.length > 0) return 'starter'
  return 'idle'
}

/**
 * Estado de «Para ti». `focusRef` recibe el foco cuando el resultado llega
 * por un clic: el botón que lo tenía desaparece y el lector de pantalla se
 * quedaría en el vacío.
 */
export function useAiRecommendations<T extends HTMLElement>(
  { initial = null, starter: initialStarter, pending = false }: AiRecsInput,
  focusRef: RefObject<T | null>
) {
  const [recs, setRecs] = useState<AiRec[]>(initial?.recommendations ?? [])
  const [source, setSource] = useState<AiRecsResult['source']>(initial?.source ?? 'ai')
  const [capped, setCapped] = useState(initial?.capped === true)
  // `saved: false` → el modelo falló y no se guardó: no son "las de hoy".
  const [saved, setSaved] = useState(initial?.saved !== false)
  const [starter, setStarter] = useState<MediaItem[]>(initialStarter ?? [])
  const [status, setStatus] = useState<AiRecsStatus>(() => initialStatus(initial, initialStarter, pending))
  const controllerRef = useRef<AbortController | null>(null)
  const focusOnResult = useRef(false)

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    if (status === 'loading' || status === 'idle' || !focusOnResult.current) return
    focusOnResult.current = false
    focusRef.current?.focus()
  }, [status, focusRef])

  const fetchRecs = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    focusOnResult.current = true
    setStatus('loading')

    apiFetch<Partial<AiRecsResult> & { starter?: MediaItem[] }>('/api/ai-recommendations', {
      signal: controller.signal,
    })
      .then((data) => {
        const list = data.recommendations ?? []
        const popular = data.starter ?? []
        setRecs(list)
        setSource(data.source ?? 'ai')
        setCapped(data.capped === true)
        setSaved(data.saved !== false)
        setStarter(popular)
        // Sin recomendaciones propias se enseña lo popular, y solo si tampoco
        // hay eso queda la tarjeta de "añade títulos" sola.
        setStatus(list.length > 0 ? 'done' : popular.length > 0 ? 'starter' : 'empty')
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setStatus(err instanceof ApiError && err.code === 'rate_limited' ? 'rate_limited' : 'error')
      })
  }, [])

  return { recs, source, capped, saved, starter, status, fetchRecs }
}
