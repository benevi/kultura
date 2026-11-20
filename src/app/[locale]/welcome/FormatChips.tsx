'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/index'
import type { MediaType } from '@/types/media'
import {
  IconAnime,
  IconComic,
  IconFilm,
  IconGamepad,
  IconLibrary,
  IconManga,
  IconTv,
  type KIcon,
} from '@/components/icons'

/** Orden e icono de los formatos (el mismo orden e iconos que Descubrir). */
const WELCOME_FORMATS: ReadonlyArray<{ type: MediaType; icon: KIcon }> = [
  { type: 'movie', icon: IconFilm },
  { type: 'tv', icon: IconTv },
  { type: 'anime', icon: IconAnime },
  { type: 'manga', icon: IconManga },
  { type: 'book', icon: IconLibrary },
  { type: 'comic', icon: IconComic },
  { type: 'game', icon: IconGamepad },
]

/** Chips de formato: paso propio en el orden de siempre, filtro dentro de «puntuar» si no. */
export function FormatChips({
  formats,
  onChange,
  className,
  compact = false,
}: {
  formats: MediaType[]
  onChange: (next: MediaType[]) => void
  className?: string
  compact?: boolean
}) {
  const t = useTranslations('onboarding')
  return (
    <div role="group" aria-label={t('formatsTitle')} className={cn('flex flex-wrap', compact ? 'gap-2' : 'gap-3', className)}>
      {WELCOME_FORMATS.map(({ type, icon: Icon }) => {
        const active = formats.includes(type)
        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? formats.filter((f) => f !== type) : [...formats, type])}
            className={cn(
              'inline-flex items-center gap-2 rounded-pill font-body font-bold transition-colors duration-150',
              compact ? 'min-h-[44px] px-4 py-2 text-sm' : 'min-h-[48px] px-5 py-3 text-body',
              'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
              active
                ? 'bg-accent-pink text-on-accent-pink'
                : 'bg-surface-elevated text-text-primary hover:bg-surface-border'
            )}
          >
            <Icon aria-hidden="true" className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            {t(`formats.${type}`)}
          </button>
        )
      })}
    </div>
  )
}
