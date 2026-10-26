'use client'

// ============================================================
// KULTURA — «Esta noche en tus plataformas» + «Sorpréndeme» (F-25, PRO-6)
// Recibe del servidor SOLO los pendientes que ya se sabe que están en las
// plataformas del usuario; «Sorpréndeme» elige uno al azar entre ellos (sin
// repetir el anterior) y lo anuncia. Ninguna petición desde el navegador.
// ============================================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { PosterImage } from '@/components/media/PosterImage'
import { IconDice } from '@/components/icons'
import { posterGradient } from '@/lib/images/poster-gradient'
import type { TonightPick } from './tonight'

function hrefOf(item: TonightPick): string {
  return `/media/${item.type}/${item.mediaId.split('_').slice(1).join('_')}`
}

/** Índice al azar distinto de `previous` (si hay más de uno). */
export function pickIndex(length: number, previous: number | null, random: () => number = Math.random): number {
  if (length <= 1) return 0
  let next = Math.floor(random() * length)
  if (next === previous) next = (next + 1) % length
  return next
}

function Poster({ item, sizes }: { item: TonightPick; sizes: string }) {
  return (
    <div
      className="relative aspect-[2/3] w-full overflow-hidden rounded-bento bg-surface-elevated"
      style={{ background: posterGradient(item.mediaId || item.title) }}
    >
      {item.poster ? <PosterImage src={item.poster} sizes={sizes} className="object-cover" /> : null}
    </div>
  )
}

export function TonightClient({ picks, platforms }: { picks: TonightPick[]; platforms: string[] }) {
  const t = useTranslations('platforms')
  const [index, setIndex] = useState<number | null>(null)
  const pick = index === null ? null : picks[index]

  function surprise() {
    setIndex((prev) => pickIndex(picks.length, prev))
  }

  return (
    <section aria-labelledby="tonight-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="tonight-title" className="font-display text-xl font-bold text-text-primary">
            {t('tonightTitle')}
          </h2>
          <p className="font-body text-sm text-text-tertiary">
            {t('tonightHint', { platforms: platforms.join(', ') })}
          </p>
        </div>
        {picks.length > 0 && (
          <KButton size="sm" onClick={surprise}>
            <IconDice aria-hidden="true" className="mr-1.5 h-4 w-4" />
            {pick ? t('surpriseAgain') : t('surprise')}
          </KButton>
        )}
      </div>

      {/* El resultado se anuncia en una frase (status) sin mover el foco del
          botón; la tarjeta con el enlace va aparte. */}
      <p role="status" className="sr-only">
        {pick ? t('surprisePick', { title: pick.title, platforms: pick.platforms.join(', ') }) : ''}
      </p>
      <div>
        {pick ? (
          <div
            className="flex items-center gap-4 rounded-bento border-2 border-accent-lime/60 bg-surface-default p-4"
          >
            <div className="w-20 flex-shrink-0 sm:w-24">
              <Poster item={pick} sizes="96px" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="font-body text-xs font-extrabold uppercase tracking-wide text-text-tertiary">
                {t('surpriseLabel')}
              </p>
              <p className="font-display text-lg font-extrabold leading-tight text-text-primary">{pick.title}</p>
              <p className="font-body text-sm text-text-secondary">{t('surpriseOn', { platforms: pick.platforms.join(', ') })}</p>
              <Link
                href={hrefOf(pick)}
                className="inline-flex min-h-11 items-center self-start font-body text-sm font-bold text-accent-pink underline-offset-4 hover:underline"
              >
                {t('surpriseOpen', { title: pick.title })}
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {picks.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-bento border border-surface-border bg-surface-default p-6">
          <p className="font-body text-sm font-medium text-text-primary">{t('tonightEmpty')}</p>
          <p className="font-body text-xs text-text-tertiary">{t('tonightEmptyHint')}</p>
          <KButton asChild size="sm" variant="secondary">
            <Link href="/settings#platforms">{t('editPlatforms')}</Link>
          </KButton>
        </div>
      ) : (
        <ul className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
          {picks.map((item) => (
            <li key={item.mediaId} className="w-28 flex-shrink-0 md:w-36">
              <Link href={hrefOf(item)} className="group block">
                <Poster item={item} sizes="(max-width: 768px) 112px, 144px" />
                <p className="mt-2 line-clamp-2 font-display text-sm font-bold leading-tight text-text-primary" title={item.title}>
                  {item.title}
                </p>
                <p className="mt-0.5 line-clamp-1 font-body text-xs text-text-tertiary">{item.platforms.join(', ')}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="font-body text-xs text-text-tertiary">
        {t('attribution')}
        {picks.length > 0 ? (
          <>
            {' · '}
            <Link href="/settings#platforms" className="inline-flex min-h-6 items-center underline-offset-4 hover:underline">
              {t('editPlatforms')}
            </Link>
          </>
        ) : null}
      </p>
    </section>
  )
}
