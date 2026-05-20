'use client'

import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'

export interface HeroItem {
  media_id: string
  episode_progress: { season?: number; episode: number; current?: number; total?: number } | null
  media: {
    id: string
    title: string
    poster: string | null
    year: number | null
    type: string
    synopsis: string | null
  } | null
}

interface HeroSectionProps {
  item: HeroItem | null
}

export function HeroSection({ item }: HeroSectionProps) {
  const t = useTranslations('home')

  if (!item?.media) {
    return (
      <section className="bg-surface-default border border-surface-border rounded-card p-6 flex flex-col gap-3">
        <span className="text-3xl">🎬</span>
        <div>
          <p className="font-display text-lg font-semibold text-text-primary">{t('welcomeTitle')}</p>
          <p className="font-body text-sm text-text-secondary mt-1">{t('welcomeSubtitle')}</p>
        </div>
        <KButton asChild size="sm" className="w-fit">
          <Link href="/discover">{t('goDiscover')}</Link>
        </KButton>
      </section>
    )
  }

  const { media, episode_progress } = item
  const externalId = media.id.split('_').slice(1).join('_')
  const href = `/media/${media.type}/${externalId}`

  const progress = episode_progress?.current != null && episode_progress?.total != null
    ? Math.round((episode_progress.current / episode_progress.total) * 100)
    : null

  return (
    <section className="relative overflow-hidden rounded-card min-h-48 md:min-h-64 p-4 md:p-6">
      {media.poster && (
        <>
          <Image
            src={media.poster}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
            priority
          />
          <div className="absolute inset-0" style={{ background: 'rgba(10,12,14,0.80)' }} />
        </>
      )}
      {!media.poster && <div className="absolute inset-0 bg-surface-default" />}

      <div className="relative z-10 flex gap-4">
        {media.poster && (
          <div className="w-24 md:w-36 flex-shrink-0 rounded-card overflow-hidden aspect-[2/3] relative">
            <Image
              src={media.poster}
              alt={media.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 96px, 144px"
            />
          </div>
        )}

        <div className="flex flex-col justify-end min-w-0">
          <p className="font-body text-xs text-text-secondary uppercase tracking-wide mb-1">{t('continuing')}</p>
          <h2 className="font-display text-xl md:text-2xl font-bold text-text-primary leading-tight">{media.title}</h2>
          <p className="font-body text-sm text-text-secondary mt-0.5">
            {[media.year, media.type].filter(Boolean).join(' · ')}
          </p>
          {media.synopsis && (
            <p className="font-body text-sm text-text-secondary line-clamp-2 md:line-clamp-3 mt-1">
              {media.synopsis}
            </p>
          )}

          {progress !== null && (
            <div className="mt-3 w-full max-w-xs">
              <div className="rounded-full h-1.5" style={{ background: 'var(--surface-elevated)' }}>
                <div
                  data-testid="progress-fill"
                  className="rounded-full h-1.5 transition-all"
                  style={{ width: `${Math.min(progress, 100)}%`, background: 'var(--accent-positive)' }}
                />
              </div>
            </div>
          )}

          <KButton asChild size="sm" className="mt-3 w-fit">
            <Link href={href}>{t('continue')}</Link>
          </KButton>
        </div>
      </div>
    </section>
  )
}
