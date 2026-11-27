'use client'

import type { ReactNode } from 'react'
import type { ViewerProfile } from '@/lib/media/viewer'
import { AuthHeader } from '@/components/layout/AuthHeader'
import { BottomNav } from '@/components/layout/BottomNav'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { UnreadChatProvider } from '@/components/layout/UnreadChatProvider'
import { DemoBanner } from '@/components/layout/DemoBanner'

// ============================================================
// KULTURA — La parte de cliente del envoltorio con sesión (`AppChrome`)
//
// Cabecera, avisos, barra inferior y proveedores. El pie (`AppFooter`) es de
// servidor y llega pintado (`footer`). Va aparte para que `/u` con «Sala»
// (fase 8.5 P3) pueda cargarlo por `next/dynamic` (`AppChromeLazy`) solo
// cuando hay sesión: importado sin más, sus componentes cliente entrarían en
// el JS de la página para todos, también sin la bandera.
// ============================================================

export interface AppChromeFrameProps {
  userId: string
  profile: ViewerProfile
  unreadCount: number
  /** Cuenta de demostración: el aviso de arriba. */
  demo: boolean
  footer: ReactNode
  children: ReactNode
}

export function AppChromeFrame({ userId, profile, unreadCount, demo, footer, children }: AppChromeFrameProps) {
  return (
    <ToastProvider>
      <UnreadChatProvider userId={userId}>
        <div className="min-h-dvh flex flex-col">
          <AuthHeader profile={profile} unreadCount={unreadCount} />
          {demo && <DemoBanner />}
          {/* El relleno inferior va en el envoltorio que INCLUYE el pie: así
              la BottomNav fija (64 px + zona segura) no tapa ni el último
              contenido ni la atribución a TMDB/RAWG (MOV-6, V8, ROJO-11). */}
          <div className="flex-1 flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className="flex-1">{children}</div>
            {footer}
          </div>
          <BottomNav username={profile.username} />
        </div>
      </UnreadChatProvider>
    </ToastProvider>
  )
}
