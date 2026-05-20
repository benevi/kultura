'use client'

import { useState, useEffect } from 'react'
import { MediaRow } from '@/components/home/MediaRow'
import { useTranslations } from 'next-intl'
import type { CircleMediaItem } from '@/lib/social/circle'

export function PopularInCircle() {
  const t = useTranslations('home')
  const [items, setItems] = useState<CircleMediaItem[]>([])
  const [status, setStatus] = useState<'loading' | 'done' | 'empty' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/popular-in-circle', { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { items?: CircleMediaItem[] }) => {
        const list = data.items ?? []
        setItems(list)
        setStatus(list.length === 0 ? 'empty' : 'done')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setStatus('error')
      })

    return () => controller.abort()
  }, [])

  if (status === 'error') return null

  const rowItems = items.map((item) => ({
    mediaId: item.mediaId,
    title: item.title,
    poster: item.poster,
    type: item.type,
  }))

  return (
    <MediaRow
      title={t('popularInCircle')}
      items={rowItems}
      isLoading={status === 'loading'}
      emptyIcon={status === 'empty' ? '👥' : undefined}
      emptyMessage={status === 'empty' ? t('noFriends') : undefined}
      emptyHint={status === 'empty' ? t('noFriendsHint') : undefined}
      emptyAction={status === 'empty' ? { label: t('addFriends'), href: '/friends' } : undefined}
    />
  )
}
