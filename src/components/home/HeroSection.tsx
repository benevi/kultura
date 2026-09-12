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

/* Mismo set de emoji por tipo que ProfileStats (F0 usa emoji liberalmente
   como sustituto de icono en chips — ver CLAUDE.md). */
const TYPE_EMOJI: Record<string, string> = {
  movie: '🎬',
  tv: '📺',
  anime: '⛩️',
  book: '📚',
  comic: '🦸',
  manga: '🖊️',
  game: '🎮',
}

/* Fórmula F0 del hero (canvas "Kultura Editorial"): gradiente lineal de dos
   tonos + acento radial en la esquina superior-izquierda — misma fórmula
   que "cards feature grandes" en CLAUDE.md, con los valores oklch literales
   del hero real. */
const HERO_GRADIENT = 'linear-gradient(120deg, oklch(38% 0.14 300) 0%, oklch(22% 0.08 280) 100%)'
const MEDIA_BLOCK_FALLBACK =
  'radial-gradient(120% 100% at 20% 10%, oklch(55% 0.2 340 / 0.6) 0%, transparent 55%), ' +
  'linear-gradient(160deg, oklch(30% 0.1 300), oklch(16% 0.06 280))'
const MEDIA_BLOCK_ACCENT = 'radial-gradient(120% 100% at 20% 10%, oklch(55% 0.2 340 / 0.5) 0%, transparent 55%)'
const HARD_SHADOW = '10px 10px 0 var(--surface-elevated)'

export function HeroSection({ item }: HeroSectionProps) {
  const t = useTranslations('home')
  const tMedia = useTranslations('media')

  if (!item?.media) {
    return (
      <section
        className="relative overflow-hidden rounded-bento-lg p-6 md:p-10 flex flex-col gap-3 max-w-md"
        style={{ background: HERO_GRADIENT, boxShadow: HARD_SHADOW }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: MEDIA_BLOCK_ACCENT }} />
        <span className="relative z-10 text-3xl">🎬</span>
        <div className="relative z-10">
          <p className="font-display text-lg md:text-xl font-extrabold text-text-primary">{t('welcomeTitle')}</p>
          <p className="font-body text-sm text-text-secondary mt-1">{t('welcomeSubtitle')}</p>
        </div>
        <KButton asChild size="md" className="relative z-10 w-fit mt-1">
          <Link href="/discover">{t('goDiscover')}</Link>
        </KButton>
      </section>
    )
  }

  const { media, episode_progress } = item
  const externalId = media.id.split('_').slice(1).join('_')
  const href = `/media/${media.type}/${externalId}`
  const typeEmoji = TYPE_EMOJI[media.type] ?? '🎬'

  const progress = episode_progress?.current != null && episode_progress?.total != null
    ? Math.round((episode_progress.current / episode_progress.total) * 100)
    : null

  return (
    <section className="relative rounded-bento-lg" style={{ boxShadow: HARD_SHADOW }}>
      {/* Badge colgante — misma pegatina lime/rotada/sombra dura que el match badge
          de F0, reutilizada aquí con texto real ("Continuando"), no un dato inventado. */}
      <div
        className="absolute -top-3.5 left-6 md:left-9 z-20 rounded-2xl px-4 py-2 bg-accent-lime text-on-accent-lime font-display text-[11px] md:text-xs font-extrabold tracking-wide"
        style={{ transform: 'rotate(-6deg)', boxShadow: '4px 4px 0 rgba(0,0,0,0.35)' }}
      >
        <span aria-hidden="true">▶</span> <span className="uppercase">{t('continuing')}</span>
      </div>

      <div
        className="relative overflow-hidden rounded-bento-lg flex flex-col md:flex-row"
        style={{ background: HERO_GRADIENT }}
      >
        <div className="relative w-full md:w-64 lg:w-80 aspect-[16/9] md:aspect-auto md:self-stretch flex-shrink-0 overflow-hidden rounded-t-bento-lg md:rounded-l-bento-lg md:rounded-tr-none">
          {media.poster ? (
            <>
              <Image
                src={media.poster}
                alt={media.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 320px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0" style={{ background: MEDIA_BLOCK_FALLBACK }} />
          )}
          <div className="absolute inset-0 pointer-events-none" style={{ background: MEDIA_BLOCK_ACCENT }} />
        </div>

        <div className="relative flex-1 p-6 md:p-9 flex flex-col justify-center gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated text-text-primary font-body font-bold text-xs px-3 py-1.5">
              {typeEmoji} {tMedia(media.type as Parameters<typeof tMedia>[0])}
            </span>
            {media.year && (
              <span className="inline-flex items-center rounded-full bg-surface-elevated text-text-primary font-body font-bold text-xs px-3 py-1.5">
                {media.year}
              </span>
            )}
          </div>

          <h2 className="font-display text-xl md:text-3xl font-extrabold text-text-primary leading-tight">
            {media.title}
          </h2>

          {media.synopsis && (
            <p className="font-body text-sm text-text-secondary line-clamp-2 md:line-clamp-3">
              {media.synopsis}
            </p>
          )}

          {progress !== null && (
            <div className="w-full max-w-xs">
              <div className="rounded-full h-1.5 bg-surface-elevated">
                <div
                  data-testid="progress-fill"
                  className="rounded-full h-1.5 transition-all bg-accent-positive"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}

          <KButton asChild size="lg" className="w-fit mt-1">
            <Link href={href}>{t('continue')}</Link>
          </KButton>
        </div>
      </div>
    </section>
  )
}
