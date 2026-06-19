'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Users2, Users, ListChecks, Lightbulb, Search, type LucideIcon } from 'lucide-react'

interface MoreSheetProps {
  isOpen: boolean
  onClose: () => void
}

const ITEMS: { key: string; href: string; icon: LucideIcon }[] = [
  { key: 'friends', href: '/friends', icon: Users2 },
  { key: 'groups', href: '/groups', icon: Users },
  { key: 'lists', href: '/lists', icon: ListChecks },
  { key: 'suggestions', href: '/suggestions', icon: Lightbulb },
  { key: 'search', href: '/search', icon: Search },
]

/**
 * Bottom-sheet móvil para la nav "Más". Patrón overlay+panel de ConfirmModal,
 * pero anclado abajo (slide-up). Solo móvil (md:hidden).
 *
 * Deuda menor (a11y): sin focus-trap completo — el foco va al panel al abrir y
 * Esc/click-fuera cierran, pero Tab puede salir del sheet. Aceptable por ahora.
 */
export function MoreSheet({ isOpen, onClose }: MoreSheetProps) {
  const t = useTranslations('nav')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      data-testid="more-sheet-overlay"
      onClick={onClose}
      className="md:hidden fixed inset-0 z-50 bg-black/60 animate-backdrop-in"
    >
      <div
        ref={panelRef}
        data-testid="more-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('more')}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-0 inset-x-0 bg-surface-default border-t border-surface-border rounded-t-xl pt-2 pb-[env(safe-area-inset-bottom)] animate-modal-in focus:outline-none"
      >
        {/* Grabber */}
        <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-surface-border" />

        <nav className="flex flex-col py-2">
          {ITEMS.map(({ key, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              onClick={onClose}
              className="flex items-center gap-3 px-5 py-3 text-text hover:bg-surface2 transition-colors"
            >
              <Icon size={20} strokeWidth={1.75} className="text-text-secondary" />
              <span className="text-sm font-medium">{t(key)}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
