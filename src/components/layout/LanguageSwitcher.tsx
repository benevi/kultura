'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useTransition } from 'react'
import { cn } from '@/lib/utils/index'

const LOCALES = ['es', 'en'] as const

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const activeIndex = LOCALES.indexOf(locale as (typeof LOCALES)[number])

  const handleSelect = (next: (typeof LOCALES)[number]) => {
    if (next === locale || isPending) return
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <div
      role="group"
      aria-label="Idioma / Language"
      className={cn(
        'relative inline-flex items-center rounded-full border border-surface-border bg-surface-elevated p-0.5',
        isPending && 'opacity-60'
      )}
    >
      {/* Indicador deslizante: marca la opción activa sin depender de banderas/emoji */}
      <span
        aria-hidden
        className="absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-accent-positive transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(${activeIndex === 0 ? 2 : 'calc(100% + 2px)'})`,
        }}
      />
      {LOCALES.map((loc) => {
        const active = loc === locale
        return (
          <button
            key={loc}
            type="button"
            onClick={() => handleSelect(loc)}
            disabled={isPending}
            aria-pressed={active}
            aria-label={loc === 'es' ? 'Español' : 'English'}
            className={cn(
              'relative z-10 w-8 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-full transition-colors duration-200',
              active ? 'text-on-accent-positive' : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            {loc}
          </button>
        )
      })}
    </div>
  )
}
