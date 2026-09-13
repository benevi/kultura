'use client'

import { useState, useEffect, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { MediaCard } from '@/components/media/MediaCard'
import type { AiRec } from '@/lib/claude/recommendations'

type Status = 'loading' | 'done' | 'empty' | 'error' | 'rate_limited'

// Un esqueleto por tipo recomendable (movie, tv, anime, book, manga, comic, game).
const SKELETON_KEYS = [0, 1, 2, 3, 4, 5, 6]

export function AiRecommendations() {
  const t = useTranslations('aiRecommendations')
  const tDetail = useTranslations('mediaDetail')
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
    <section className="relative">
      {status === 'done' && (
        <div
          className="inline-block absolute -top-3.5 left-0 z-10 rounded-2xl px-3.5 py-1.5 md:px-4 md:py-2 bg-accent-lime text-on-accent-lime font-display text-[10px] md:text-[11px] font-extrabold tracking-wide"
          style={{ transform: 'rotate(-4deg)', boxShadow: '4px 4px 0 rgba(0,0,0,0.35)' }}
        >
          🤖 {t('aiPickBadge')}
        </div>
      )}

      <div className={`flex items-baseline gap-2 mb-3 ${status === 'done' ? 'pt-4 md:pt-5' : ''}`}>
        <h2 className="font-display text-xl text-text-primary">{t('title')}</h2>
        <span className="font-body text-xs text-text-tertiary">{t('poweredBy')}</span>
      </div>

      {status === 'loading' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {recs.map((rec) => {
            // Sin explicación del modelo se pinta el porqué localizado a partir
            // de datos reales (géneros del ítem + match), igual que la ficha; sin
            // géneros no hay frase honesta que construir → solo la card.
            const genres = (rec.item.genres ?? []).slice(0, 2)
            const why = rec.reason ??
              (genres.length > 0
                ? tDetail('whyRecommendedText', {
                    genres: genres.join(', '),
                    score: rec.matchScore,
                  })
                : null)

            return (
              <div key={rec.item.id} className="flex flex-col gap-2">
                {/* Misma card que Descubrir/Biblioteca: enlaza a la ficha real por
                    externalId y pinta el badge de match que guía la recomendación. */}
                <MediaCard item={rec.item} matchScore={rec.matchScore} showType />
                {why && (
                  <p className="font-body text-xs text-text-secondary line-clamp-3 leading-relaxed">
                    {why}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
