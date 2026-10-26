'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { Avatar } from '@/components/ui/Avatar'
import { IconCalendar, IconIdea } from '@/components/icons'
import { createClient } from '@/lib/supabase/client'
import { unsubscribeCurrentDevice } from '@/lib/push/client'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { isNavActive, FOCUS_RING, MENU_ROW } from '@/components/layout/nav-shared'
import { HeaderMenu } from '@/components/layout/HeaderMenu'

interface AvatarDropdownProps {
  username: string
  avatarColor: string
  avatarInitials: string
  avatarIcon?: string | null
}

/** Engranaje relleno para Ajustes (los iconos comunes no traen uno). */
function IconSettings(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path
        fillRule="evenodd"
        d="M10.3 2.6c.3-1 1.1-1.6 1.7-1.6s1.4.6 1.7 1.6l.3 1.1c.2.6.8.9 1.4.7l1.1-.4c1-.3 1.9 0 2.3.5.5.5.8 1.4.5 2.3l-.4 1.1c-.2.6.1 1.2.7 1.4l1.1.3c1 .3 1.6 1.1 1.6 1.7s-.6 1.4-1.6 1.7l-1.1.3c-.6.2-.9.8-.7 1.4l.4 1.1c.3 1 0 1.9-.5 2.3-.5.5-1.4.8-2.3.5l-1.1-.4c-.6-.2-1.2.1-1.4.7l-.3 1.1c-.3 1-1.1 1.6-1.7 1.6s-1.4-.6-1.7-1.6l-.3-1.1c-.2-.6-.8-.9-1.4-.7l-1.1.4c-1 .3-1.9 0-2.3-.5-.5-.5-.8-1.4-.5-2.3l.4-1.1c.2-.6-.1-1.2-.7-1.4l-1.1-.3C1.6 13.4 1 12.6 1 12s.6-1.4 1.6-1.7l1.1-.3c.6-.2.9-.8.7-1.4l-.4-1.1c-.3-1 0-1.9.5-2.3.5-.5 1.4-.8 2.3-.5l1.1.4c.6.2 1.2-.1 1.4-.7l.3-1.1ZM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      />
    </svg>
  )
}

/**
 * Menú del avatar (DIS-9): Ajustes, Sugerencias, idioma y cerrar sesión. El
 * perfil ya es uno de los 5 destinos de la navegación, así que no se repite.
 */
export function AvatarDropdown({ username, avatarColor, avatarInitials, avatarIcon }: AvatarDropdownProps) {
  const t = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const tCalendar = useTranslations('calendar.nav')
  const router = useRouter()
  const pathname = usePathname()
  const languageLabelId = useId()

  async function handleSignOut() {
    const supabase = createClient()
    // F-33: los avisos push de este navegador se van con la sesión.
    await unsubscribeCurrentDevice()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // F-28: el Calendario, también aquí (en móvil y en escritorio estrecho es
  // el único acceso; en `xl` está además en la barra).
  const links = [
    { key: 'calendar', href: '/calendar', icon: IconCalendar, label: tCalendar('label') },
    { key: 'settings', href: '/settings', icon: IconSettings, label: t('settings') },
    { key: 'suggestions', href: '/suggestions', icon: IconIdea, label: t('suggestions') },
  ] as const

  return (
    <HeaderMenu
      label={t('accountMenu', { username })}
      trigger={<Avatar initials={avatarInitials} color={avatarColor} icon={avatarIcon} className="w-11 h-11 text-sm" />}
      triggerClassName={cn('flex-shrink-0 rounded-full', FOCUS_RING)}
      current={links.some(({ href }) => isNavActive(pathname, href))}
    >
      {(close) => (
        <div className="flex flex-col gap-1">
          <p className="px-3 pt-1 pb-2 text-xs text-text-tertiary truncate" translate="no">@{username}</p>
          <nav aria-label={t('accountNav')}>
            <ul className="flex flex-col gap-0.5">
              {links.map(({ key, href, icon: Icon, label }) => {
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
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="flex items-center justify-between gap-3 px-3 py-1">
            <span id={languageLabelId} className="text-sm font-semibold text-text-primary">
              {t('language')}
            </span>
            <LanguageSwitcher labelledBy={languageLabelId} />
          </div>
          <div className="my-1 border-t border-surface-border" />
          <button type="button" className={cn(MENU_ROW, 'text-accent-danger')} onClick={handleSignOut}>
            {tAuth('signOut')}
          </button>
        </div>
      )}
    </HeaderMenu>
  )
}
