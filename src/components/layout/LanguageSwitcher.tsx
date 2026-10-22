'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useTransition } from 'react'
import { cn } from '@/lib/utils/index'
import { FOCUS_RING } from '@/components/layout/nav-shared'

const LOCALES = ['es', 'en'] as const

/** Nombre de cada idioma en su propio idioma (no se traduce). */
const ENDONYMS: Record<(typeof LOCALES)[number], string> = { es: 'Español', en: 'English' }

/**
 * Selector de idioma de dos botones conmutables (`aria-pressed`). Cada botón
 * mide 44×44 (MOV-4, ACC-12) y su nombre va en su idioma, con `lang`, para
 * que el lector lo pronuncie bien.
 */
export function LanguageSwitcher({ labelledBy }: { labelledBy?: string }) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const activeIndex = Math.max(0, LOCALES.indexOf(locale as (typeof LOCALES)[number]))

  const handleSelect = (next: (typeof LOCALES)[number]) => {
    if (next === locale || isPending) return
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : t('language')}
      aria-busy={isPending || undefined}
      className={cn(
        'relative inline-flex items-center rounded-full border border-surface-border bg-surface-elevated p-0.5',
        isPending && 'opacity-60'
      )}
    >
      {/* Indicador deslizante: marca la opción activa sin depender de banderas/emoji */}
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-11 rounded-full bg-accent-positive transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${activeIndex * 44}px)` }}
      />
      {LOCALES.map((loc) => {
        const active = loc === locale
        return (
          <button
            key={loc}
            type="button"
            lang={loc}
            onClick={() => handleSelect(loc)}
            disabled={isPending}
            aria-pressed={active}
            aria-label={ENDONYMS[loc]}
            className={cn(
              'relative z-10 w-11 h-11 text-xs font-bold uppercase tracking-wider rounded-full transition-colors duration-200',
              FOCUS_RING,
              active ? 'text-on-accent-positive' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {loc}
          </button>
        )
      })}
    </div>
  )
}
