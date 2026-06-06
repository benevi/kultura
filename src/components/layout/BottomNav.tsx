'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { Home, Compass, MessageCircle, BookOpen, Users } from 'lucide-react'

export function BottomNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  const items = [
    { key: 'home', href: '/home', icon: Home },
    { key: 'discover', href: '/discover', icon: Compass },
    { key: 'chat', href: '/chat', icon: MessageCircle },
    { key: 'library', href: '/library', icon: BookOpen },
    { key: 'groups', href: '/groups', icon: Users },
  ] as const

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-default border-t border-surface-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16">
        {items.map(({ key, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full',
                active ? 'text-accent-positive' : 'text-text-secondary'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
              <span className="text-[10px] font-medium leading-none">{t(key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
