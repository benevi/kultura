'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { IconHome, IconCompass, IconChat, IconLibrary, IconMore, type KIcon } from '@/components/icons'
import { MoreSheet } from '@/components/ui/MoreSheet'
import { useUnreadChat } from '@/components/layout/UnreadChatProvider'

type NavItem =
  | { key: string; icon: KIcon; href: string; onClick?: never }
  | { key: string; icon: KIcon; href?: never; onClick: true }

export function BottomNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { unreadCount } = useUnreadChat()

  const items: NavItem[] = [
    { key: 'home', href: '/home', icon: IconHome },
    { key: 'discover', href: '/discover', icon: IconCompass },
    { key: 'chat', href: '/chat', icon: IconChat },
    { key: 'library', href: '/library', icon: IconLibrary },
    { key: 'more', onClick: true, icon: IconMore },
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
                <span className="relative">
                  <Icon className="w-[22px] h-[22px]" />
                  {key === 'chat' && unreadCount > 0 && (
                    <span
                      aria-label={t('unreadMessages', { count: unreadCount })}
                      className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-accent-positive text-on-accent-positive text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
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
