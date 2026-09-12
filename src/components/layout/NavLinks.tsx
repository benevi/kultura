'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { useUnreadChat } from '@/components/layout/UnreadChatProvider'
import {
  IconHome,
  IconCompass,
  IconLibrary,
  IconLists,
  IconChat,
  IconFriends,
  IconGroups,
  IconIdea,
  type KIcon,
} from '@/components/icons'

const NAV_ITEMS: { key: string; href: string; icon: KIcon }[] = [
  { key: 'home', href: '/home', icon: IconHome },
  { key: 'discover', href: '/discover', icon: IconCompass },
  { key: 'library', href: '/library', icon: IconLibrary },
  { key: 'lists', href: '/lists', icon: IconLists },
  { key: 'chat', href: '/chat', icon: IconChat },
  { key: 'friends', href: '/friends', icon: IconFriends },
  { key: 'groups', href: '/groups', icon: IconGroups },
  { key: 'suggestions', href: '/suggestions', icon: IconIdea },
]

export function NavLinks() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { unreadCount } = useUnreadChat()

  return (
    <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
      {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              active
                ? 'bg-accent-positive text-on-accent-positive'
                : 'text-text-secondary hover:text-text'
            )}
          >
            <span className="relative">
              <Icon className="w-[18px] h-[18px]" />
              {key === 'chat' && unreadCount > 0 && (
                <span
                  aria-label={t('unreadMessages', { count: unreadCount })}
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-accent-positive text-on-accent-positive text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none ring-2 ring-surface-default"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            {t(key)}
          </Link>
        )
      })}
    </nav>
  )
}
