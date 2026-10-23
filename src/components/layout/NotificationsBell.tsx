'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { IconBell } from '@/components/icons'
import { isNavActive, HEADER_ICON_BOX, HEADER_ICON_CURRENT, CountBadge } from '@/components/layout/nav-shared'

/**
 * Campana de la cabecera. Es cliente para leer la ruta con `usePathname`: el
 * layout no se vuelve a pintar al navegar, así que un `aria-current` calculado
 * en el servidor se quedaba con la página de entrada (ACC-7).
 */
export function NotificationsBell({ unreadCount }: { unreadCount: number }) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const current = isNavActive(pathname, '/notifications')

  return (
    <Link
      href="/notifications"
      aria-label={t('notificationsLabel', { count: unreadCount })}
      aria-current={current ? 'page' : undefined}
      className={cn(HEADER_ICON_BOX, current && HEADER_ICON_CURRENT)}
    >
      <IconBell className="w-5 h-5" />
      <CountBadge count={unreadCount} />
    </Link>
  )
}
