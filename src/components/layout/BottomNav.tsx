'use client'

import type { MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { primaryNavItems, isNavActive, FOCUS_RING } from '@/components/layout/nav-shared'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Barra inferior de móvil: los mismos 5 destinos que `NavLinks` (DIS-9). Cada
 * celda ocupa todo el alto (64 px) y un quinto del ancho (≥ 64 px a 320).
 * Re-tocar la pestaña en la que ya estás sube al principio (MOV-7); desde una
 * subpágina (`/lists/abc`) vuelve a la raíz de la pestaña.
 */
export function BottomNav({ username }: { username: string }) {
  const t = useTranslations('nav')
  const pathname = usePathname()

  function handleClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (pathname !== href) return
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  return (
    <nav
      aria-label={t('primaryNav')}
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-base border-t-2 border-surface-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch h-16">
        {primaryNavItems(username).map(({ key, labelKey, href, icon: Icon }) => {
          const active = isNavActive(pathname, href)
          return (
            <li key={key} className="flex-1 min-w-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={(e: MouseEvent<HTMLAnchorElement>) => handleClick(e, href)}
                className={cn(
                  'group relative flex flex-col items-center justify-center gap-1 h-full w-full rounded-lg [-webkit-tap-highlight-color:transparent]',
                  FOCUS_RING,
                  'focus-visible:outline-offset-[-4px]',
                  active ? 'text-text-primary' : 'text-text-secondary'
                )}
              >
                {/* Banda amarilla de orientación arriba del destino activo
                    (DISENO.md): el amarillo orienta, el rosa es la acción. */}
                {active ? (
                  <span aria-hidden="true" className="absolute inset-x-4 top-0 h-[3px] rounded-full bg-wayfinding" />
                ) : null}
                <span
                  className={cn(
                    'flex items-center justify-center w-14 h-8 rounded-full transition-colors duration-fast',
                    active ? null : 'group-active:bg-surface-elevated'
                  )}
                >
                  <Icon className="w-6 h-6" />
                </span>
                <span className={cn('text-xs leading-none truncate max-w-full px-1', active ? 'font-bold' : 'font-medium')}>
                  {t(labelKey)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
