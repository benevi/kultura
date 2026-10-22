'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { IconChat, IconFriends, IconGroups, type KIcon } from '@/components/icons'
import { useUnreadChat } from '@/components/layout/UnreadChatProvider'
import { isNavActive, HEADER_ICON_BOX, CountBadge, MENU_ROW } from '@/components/layout/nav-shared'
import { HeaderMenu } from '@/components/layout/HeaderMenu'

export const SOCIAL_ITEMS: { key: 'chat' | 'friends' | 'groups'; href: string; icon: KIcon }[] = [
  { key: 'chat', href: '/chat', icon: IconChat },
  { key: 'friends', href: '/friends', icon: IconFriends },
  { key: 'groups', href: '/groups', icon: IconGroups },
]

/**
 * Centro «Social» de la cabecera (DIS-9): Mensajes, Amigos y Grupos detrás de
 * un único botón con el contador de mensajes sin leer. Igual en móvil y en
 * escritorio. Si la página actual es una de las tres (`/chat/123` incluido),
 * el botón se marca y la fila correspondiente lleva `aria-current="page"`.
 */
export function SocialMenu() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { unreadCount } = useUnreadChat()
  const current = SOCIAL_ITEMS.some(({ href }) => isNavActive(pathname, href))

  return (
    <HeaderMenu
      label={t('socialLabel', { count: unreadCount })}
      trigger={
        <>
          <IconChat className="w-5 h-5" />
          <CountBadge count={unreadCount} />
        </>
      }
      triggerClassName={HEADER_ICON_BOX}
      current={current}
    >
      {(close) => (
        <nav aria-label={t('social')}>
          <ul className="flex flex-col gap-0.5">
            {SOCIAL_ITEMS.map(({ key, href, icon: Icon }) => {
              const active = isNavActive(pathname, href)
              return (
                <li key={key}>
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={active ? 'page' : undefined}
                    className={cn(MENU_ROW, active && 'bg-surface-elevated')}
                  >
                    <Icon className="w-5 h-5 text-text-secondary" />
                    <span className="flex-1">{t(key)}</span>
                    {key === 'chat' && unreadCount > 0 ? (
                      <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-accent-pink text-on-accent-pink text-xs font-bold flex items-center justify-center">
                        <span aria-hidden>{unreadCount > 99 ? '99+' : unreadCount}</span>
                        <span className="sr-only">{t('unreadMessages', { count: unreadCount })}</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </HeaderMenu>
  )
}
