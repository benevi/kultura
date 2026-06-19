'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { Home, Compass, MessageCircle, BookOpen, MoreHorizontal, type LucideIcon } from 'lucide-react'
import { MoreSheet } from '@/components/ui/MoreSheet'

type NavItem =
  | { key: string; icon: LucideIcon; href: string; onClick?: never }
  | { key: string; icon: LucideIcon; href?: never; onClick: true }

export function BottomNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  const items: NavItem[] = [
    { key: 'home', href: '/home', icon: Home },
    { key: 'discover', href: '/discover', icon: Compass },
    { key: 'chat', href: '/chat', icon: MessageCircle },
    { key: 'library', href: '/library', icon: BookOpen },
    { key: 'more', onClick: true, icon: MoreHorizontal },
  ]

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-default border-t border-surface-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-16">
          {items.map(({ key, href, onClick, icon: Icon }) => {
            const active = href ? pathname === href : sheetOpen
            const className = cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full',
              active ? 'text-accent-positive' : 'text-text-secondary'
            )
            const inner = (
              <>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
                <span className="text-[10px] font-medium leading-none">{t(key)}</span>
              </>
            )

            if (onClick) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={sheetOpen}
                  className={className}
                >
                  {inner}
                </button>
              )
            }

            return (
              <Link key={key} href={href} className={className}>
                {inner}
              </Link>
            )
          })}
        </div>
      </nav>

      <MoreSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
