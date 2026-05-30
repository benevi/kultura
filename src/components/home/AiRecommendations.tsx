'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import type { AiRec } from '@/lib/claude/recommendations'

type Status = 'loading' | 'done' | 'empty' | 'error' | 'rate_limited'

const SKELETON_KEYS = [0, 1, 2, 3, 4, 5]

export function AiRecommendations() {
  const t = useTranslations('aiRecommendations')
  const tMedia = useTranslations('media')
  const [recs, setRecs] = useState<AiRec[]>([])
  const [status, setStatus] = useState<Status>('loading')

  const fetchRecs = useCallback(() => {
    setStatus('loading')
    const controller = new AbortController()

    fetch('/api/ai-recommendations', { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 429) { setStatus('rate_limited'); return }
        if (!r.ok) { setStatus('error'); return }
        const data: { recommendations?: AiRec[] } = await r.json()
        const list = data.recommendations ?? []
        setRecs(list)
        setStatus(list.length === 0 ? 'empty' : 'done')
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setStatus('error')
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const cleanup = fetchRecs()
    return cleanup
  }, [fetchRecs])

  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="font-display text-xl text-text-primary">{t('title')}</h2>
        <span className="font-body text-xs text-text-tertiary">{t('poweredBy')}</span>
      </div>

      {status === 'loading' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SKELETON_KEYS.map((i) => (
            <div key={i} className="animate-pulse bg-surface-elevated rounded-card aspect-[2/3]" />
          ))}
        </div>
      )}

      {status === 'empty' && (
        <div className="bg-surface-default border border-surface-border rounded-card p-6 flex flex-col items-center gap-3 text-center">
          <span className="text-3xl">✦</span>
          <div>
            <p className="font-body text-sm font-medium text-text-primary">{t('needMoreItems')}</p>
            <p className="font-body text-xs text-text-tertiary mt-1">{t('needMoreItemsHint')}</p>
          </div>
          <KButton asChild size="sm">
            <Link href="/discover">{t('exploreContent')}</Link>
          </KButton>
        </div>
      )}

      {(status === 'rate_limited' || status === 'error') && (
        <div className="bg-surface-default border border-surface-border rounded-card p-5 flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-sm font-medium text-text-primary">
              {status === 'rate_limited' ? t('rateLimited') : t('error')}
            </p>
            <p className="font-body text-xs text-text-tertiary mt-0.5">{t('tryAgainLater')}</p>
          </div>
          <KButton variant="secondary" size="sm" onClick={fetchRecs} className="flex-shrink-0">
            {t('retry')}
          </KButton>
        </div>
      )}

      {status === 'done' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {recs.map((rec, i) => (
            <Link
              key={i}
              href={rec.mediaUrl ?? `/search?q=${encodeURIComponent(rec.searchQuery)}`}
              className="bg-surface-default border border-surface-border rounded-card overflow-hidden hover:border-accent-positive/50 transition-colors relative group"
            >
              <div className="aspect-[2/3] bg-surface-elevated flex items-center justify-center relative">
                {rec.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rec.posterUrl}
                    alt={rec.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-3xl font-bold text-text-tertiary select-none">
                    {rec.title.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span
                  className="absolute top-1.5 right-1.5 font-body text-[10px] px-1.5 py-0.5 rounded text-text-secondary"
                  style={{ background: 'rgba(10,12,14,0.85)' }}
                >
                  {tMedia(rec.type as Parameters<typeof tMedia>[0]) ?? rec.type}
                </span>
              </div>
              <div className="p-2">
                <p className="font-body text-sm font-medium text-text-primary line-clamp-2 leading-tight">
                  {rec.title}
                </p>
                {rec.year && (
                  <p className="font-body text-xs text-text-tertiary mt-0.5">{rec.year}</p>
                )}
                <p className="font-body text-xs text-text-secondary line-clamp-2 mt-1 leading-relaxed">
                  {rec.reason}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
