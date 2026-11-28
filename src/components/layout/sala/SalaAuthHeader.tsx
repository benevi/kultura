'use client'

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { CLASES as SALA_LINK, TEXTO_SUELTO } from '@/components/sala/sala-link-classes'
import { SalaLogo } from '@/components/sala/SalaLogo'
import { primaryNavItems, isNavActive } from '@/components/layout/nav-shared'
import { SocialMenu } from '@/components/layout/SocialMenu'
import { NotificationsBell } from '@/components/layout/NotificationsBell'
import { AvatarDropdown } from '@/components/layout/AvatarDropdown'
import type { ViewerProfile } from '@/lib/media/viewer'

// ============================================================
// KULTURA — Cabecera con sesión en «Sala» (fase 8.5 M2, bandera `SALA_MARCA`)
//
// La de hoy (`AuthHeader`) con la piel de «Sala»: el logo D1 en trazados, los
// destinos como enlaces sueltos de «Sala» (las clases de `SalaLink`) y la página actual marcada con
// `aria-current` y una barra de tinta (no solo con color). A la derecha, las
// mismas tres cajas (Social, avisos con su contador y la cuenta), de 48 px.
// Sin línea de abajo: la separa del contenido un paso de tono (biblia §1).
// En el móvil la navegación sigue en `BottomNav` (M3).
// ============================================================

const NAV_LINK = 'relative px-3 text-sala-ink-secondary'
/** Página actual: tinta y una barra de 4 px bajo la caja de 48 px. */
const NAV_CURRENT =
  'text-sala-ink after:absolute after:inset-x-3 after:bottom-0 after:h-1 after:bg-sala-ink'

function SalaNavLinks({ username }: { username: string }) {
  const t = useTranslations('nav')
  const tCalendar = useTranslations('calendar.nav')
  const pathname = usePathname()
  const items = [
    ...primaryNavItems(username).map(({ key, labelKey, href }) => ({ key, href, label: t(labelKey), wide: false })),
    { key: 'calendar', href: '/calendar', label: tCalendar('label'), wide: true },
  ]

  return (
    <nav aria-label={t('primaryNav')} className="hidden md:flex flex-1 justify-center min-w-0">
      <ul className="flex items-center gap-1 lg:gap-2">
        {items.map(({ key, href, label, wide }) => {
          const active = isNavActive(pathname, href)
          return (
            // F-28: el Calendario solo desde `xl`; por debajo, en el menú de la cuenta.
            <li key={key} className={wide ? 'hidden xl:block' : undefined}>
              {/* Un `SalaLink` suelto, con sus clases y sin el componente (ver `sala-link-classes`). */}
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(SALA_LINK.standalone, NAV_LINK, active && NAV_CURRENT)}
              >
                <span className={TEXTO_SUELTO}>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export interface SalaAuthHeaderProps {
  profile: Pick<ViewerProfile, 'username' | 'avatar_color' | 'avatar_initials' | 'avatar_icon'>
  unreadCount: number
}

export function SalaAuthHeader({ profile, unreadCount }: SalaAuthHeaderProps) {
  return (
    <header data-sala-header="" className="sticky top-0 z-40 bg-sala-background text-sala-ink font-sala-text">
      <div className="page-grid relative flex items-center gap-2 h-16">
        <Link
          href="/home"
          className="flex items-center min-h-sala-target flex-shrink-0 text-sala-ink sala-focused:sala-focus"
        >
          {/* 20 px en el móvil (cabe a 320 con las tres cajas), 24 desde `md`. */}
          <SalaLogo height={24} className="h-5 w-auto md:h-6" />
        </Link>

        <SalaNavLinks username={profile.username} />

        <div className="flex items-center gap-1 ml-auto">
          <SocialMenu skin="sala" />
          <NotificationsBell unreadCount={unreadCount} skin="sala" />
          <AvatarDropdown
            username={profile.username}
            avatarColor={profile.avatar_color}
            avatarInitials={profile.avatar_initials}
            avatarIcon={profile.avatar_icon ?? null}
            skin="sala"
          />
        </div>
      </div>
    </header>
  )
}
