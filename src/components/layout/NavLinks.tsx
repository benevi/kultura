'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { primaryNavItems, isNavActive, FOCUS_RING } from '@/components/layout/nav-shared'

/** Navegación de escritorio (en móvil la hace `BottomNav`). */
export function NavLinks({ username }: { username: string }) {
  const t = useTranslations('nav')
  const pathname = usePathname()

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
                  // Pastilla neutra para el activo: el rosa queda para la acción (DIS-9).
                  'flex items-center gap-1.5 min-h-11 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors',
                  FOCUS_RING,
                  active
                    ? 'bg-surface-elevated text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/60'
                )}
              >
                {/* A 768 px no caben 5 etiquetas + iconos + 3 botones: icono desde lg. */}
                <Icon className="hidden lg:block w-[18px] h-[18px]" />
                {t(labelKey)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
