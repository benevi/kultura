'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { primaryNavItems, isNavActive, FOCUS_RING, WAYFINDING_BAND } from '@/components/layout/nav-shared'
import { IconCalendar } from '@/components/icons'

const LINK_BASE =
  // El activo lleva la banda amarilla de orientación al pie (DISENO.md); el
  // rosa queda para la acción (DIS-9).
  'relative flex items-center gap-1.5 min-h-11 px-4 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors duration-fast'

const LINK_ACTIVE = `text-text-primary ${WAYFINDING_BAND}`
const LINK_IDLE = 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'

/**
 * Navegación de escritorio (en móvil la hace `BottomNav`).
 *
 * F-28: el Calendario va detrás de los 5 destinos comunes solo desde `xl`
 * (1280 px), donde cabe con su icono sin apretar la cabecera; por debajo, y en
 * móvil, está en el menú del avatar (`AvatarDropdown`).
 */
export function NavLinks({ username }: { username: string }) {
  const t = useTranslations('nav')
  const tCalendar = useTranslations('calendar.nav')
  const pathname = usePathname()
  const calendarActive = isNavActive(pathname, '/calendar')

  return (
    <nav aria-label={t('primaryNav')} className="hidden md:flex flex-1 justify-center min-w-0">
      <ul className="flex items-center gap-1">
        {primaryNavItems(username).map(({ key, labelKey, href, icon: Icon }) => {
          const active = isNavActive(pathname, href)
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  LINK_BASE,
                  FOCUS_RING,
                  active ? LINK_ACTIVE : LINK_IDLE
                )}
              >
                {/* A 768 px no caben 5 etiquetas + iconos + 3 botones: icono desde lg. */}
                <Icon className="hidden lg:block w-[18px] h-[18px]" />
                {t(labelKey)}
              </Link>
            </li>
          )
        })}
        <li className="hidden xl:block">
          <Link
            href="/calendar"
            aria-current={calendarActive ? 'page' : undefined}
            className={cn(
              LINK_BASE,
              FOCUS_RING,
              calendarActive ? LINK_ACTIVE : LINK_IDLE
            )}
          >
            <IconCalendar className="w-[18px] h-[18px]" />
            {tCalendar('label')}
          </Link>
        </li>
      </ul>
    </nav>
  )
}
