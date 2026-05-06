'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'

const NAV_ITEMS = [
  { key: 'home', href: '/home' },
  { key: 'discover', href: '/discover' },
  { key: 'library', href: '/library' },
  { key: 'lists', href: '/lists' },
  { key: 'chat', href: '/chat' },
  { key: 'friends', href: '/friends' },
  { key: 'suggestions', href: '/suggestions' },
] as const

export function NavLinks() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
      {NAV_ITEMS.map(({ key, href }) => {
        const active = pathname === href
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'relative px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'text-text' : 'text-muted hover:text-text'
            )}
          >
            {t(key)}
            {active && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
