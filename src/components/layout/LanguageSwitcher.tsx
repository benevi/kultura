'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useTransition } from 'react'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const otherLocale = locale === 'es' ? 'en' : 'es'

  const handleSwitch = () => {
    startTransition(() => {
      router.replace(pathname, { locale: otherLocale })
    })
  }

  return (
    <button
      onClick={handleSwitch}
      disabled={isPending}
      aria-label={`Switch to ${otherLocale === 'es' ? 'Español' : 'English'}`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-text hover:bg-surface2 rounded-lg transition-all border border-border disabled:opacity-50"
    >
      <span className="text-base leading-none" aria-hidden>
        {locale === 'es' ? '🇪🇸' : '🇺🇸'}
      </span>
      <span className="uppercase tracking-wider font-semibold">
        {locale === 'es' ? 'ES' : 'EN'}
      </span>
    </button>
  )
}
