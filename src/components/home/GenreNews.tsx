'use client'

import { useState, useEffect } from 'react'
import { MediaRow } from '@/components/home/MediaRow'
import { useTranslations } from 'next-intl'
import type { MediaItem } from '@/types/media'

interface GenreNewsData {
  movies: MediaItem[]
  tv: MediaItem[]
  genres: string[]
}

export function GenreNews() {
  const t = useTranslations('home')
  const [data, setData] = useState<GenreNewsData | null>(null)
  const [status, setStatus] = useState<'loading' | 'done' | 'empty' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/genre-news', { signal: controller.signal })
      .then((r) => r.json())
      .then((d: GenreNewsData) => {
        const hasContent = d.movies.length > 0 || d.tv.length > 0
        setData(d)
        setStatus(hasContent ? 'done' : 'empty')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setStatus('error')
      })

    return () => controller.abort()
  }, [])

  if (status === 'error' || status === 'empty') return null

  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <MediaRow title={t('trends')} items={[]} isLoading />
      </div>
    )
  }

  if (!data) return null

  const genres = data.genres.slice(0, 3)
  const noGenres = genres.length === 0

  if (noGenres) {
    const allItems = [...data.movies, ...data.tv].slice(0, 8).map((item) => ({
      mediaId: item.id,
      title: item.title,
      poster: item.poster,
      type: item.type,
    }))
    return <MediaRow title={t('trends')} items={allItems} />
  }

  const movieItems = data.movies.slice(0, 8).map((item) => ({
    mediaId: item.id,
    title: item.title,
    poster: item.poster,
    type: item.type,
  }))

  const tvItems = data.tv.slice(0, 8).map((item) => ({
    mediaId: item.id,
    title: item.title,
    poster: item.poster,
    type: item.type,
  }))

  const rows: { title: string; items: typeof movieItems }[] = []

  if (movieItems.length > 0) {
    rows.push({ title: t('genreNewsTitle', { genre: genres[0] }), items: movieItems })
  }
  if (tvItems.length > 0 && rows.length < 3) {
    const genreLabel = genres[1] ?? genres[0]
    rows.push({ title: t('genreSeriesTitle', { genre: genreLabel }), items: tvItems })
  }

  return (
    <div className="space-y-8">
      {rows.map((row) => (
        <MediaRow key={row.title} title={row.title} items={row.items} />
      ))}
    </div>
  )
}
