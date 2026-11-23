'use client'

import { useEffect, useState } from 'react'
import { fetchFriends } from '@/lib/social/actions'
import { apiFetch } from '@/lib/api/client'

export type RecommendFriend = Awaited<ReturnType<typeof fetchFriends>>[number]

export interface RecommendMediaCache {
  externalId: string
  type: string
  title: string
  poster?: string
  backdrop?: string
  year?: number
  synopsis?: string
  genres?: string[]
}

export type RecommendStatus = 'idle' | 'sending' | 'sent' | 'error'

/**
 * El estado de «Recomendar a un amigo»: cargar los amigos al montarse, elegir,
 * escribir el mensaje y enviar una recomendación por amigo. Lo comparten el
 * diálogo de hoy (`RecommendModal`) y el de «Sala» (`SalaRecommendDialog`):
 * un solo sitio decide qué se envía.
 */
export function useRecommendForm(mediaId: string, mediaCache: RecommendMediaCache, onClose: () => void) {
  const [friends, setFriends] = useState<RecommendFriend[]>([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<RecommendStatus>('idle')

  useEffect(() => {
    fetchFriends()
      .then(setFriends)
      .catch(() => setFriends([]))
      .finally(() => setLoadingFriends(false))
  }, [])

  function toggleFriend(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleSend() {
    if (selected.size === 0) return
    setStatus('sending')
    const results = await Promise.allSettled(
      Array.from(selected).map((toUserId) =>
        apiFetch('/api/recommendations', {
          method: 'POST',
          json: { toUserId, mediaId, message: message || undefined, mediaCache },
        })
      )
    )
    const anyFailed = results.some((r) => r.status === 'rejected')
    if (anyFailed) {
      setStatus('error')
    } else {
      setStatus('sent')
      setTimeout(onClose, 1200)
    }
  }

  return { friends, loadingFriends, selected, toggleFriend, message, setMessage, status, handleSend }
}
