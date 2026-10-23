import type { User } from '@supabase/supabase-js'
import { getViewer, type ViewerProfile } from '@/lib/media/viewer'
import { AuthHeader } from '@/components/layout/AuthHeader'
import { BottomNav } from '@/components/layout/BottomNav'
import { AppFooter } from '@/components/layout/AppFooter'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { UnreadChatProvider } from '@/components/layout/UnreadChatProvider'
import { DemoBanner } from '@/components/layout/DemoBanner'
import { isDemoUser } from '@/lib/demo'

// ============================================================
// KULTURA — Envoltorio de la app con sesión (cabecera, avisos, pie y barra)
//
// Lo usan `(app)/layout.tsx`, que exige sesión, y `media/layout.tsx`, la
// ficha pública (D-01): con sesión se ve igual que el resto de la app; sin
// sesión, esa ficha pone la cabecera pública. El envoltorio vive aquí; la
// sesión la carga `getViewer` (una vez por petición) y cada layout decide qué
// hacer si no la hay.
// ============================================================

/** Sesión de la petición (compartida con la página, ver `getViewer`). */
export const getChromeSession = getViewer
export type ChromeProfile = ViewerProfile

interface AppChromeProps {
  user: User
  profile: ChromeProfile
  /** Avisos sin leer (`getUnreadCount`): lo pide el layout, en paralelo. */
  unreadCount: number
  children: React.ReactNode
}

/**
 * Componente síncrono a propósito: el layout carga los datos y lo pinta, así
 * el árbol que devuelve se puede renderizar tal cual (también en los tests).
 */
export function AppChrome({ user, profile, unreadCount, children }: AppChromeProps) {
  return (
    <ToastProvider>
      <UnreadChatProvider userId={user.id}>
        <div className="min-h-dvh flex flex-col">
          <AuthHeader profile={profile} unreadCount={unreadCount} />
          {isDemoUser(user) && <DemoBanner />}
          {/* El relleno inferior va en el envoltorio que INCLUYE el pie: así
              la BottomNav fija (64 px + zona segura) no tapa ni el último
              contenido ni la atribución a TMDB/RAWG (MOV-6, V8, ROJO-11). */}
          <div className="flex-1 flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className="flex-1">{children}</div>
            <AppFooter />
          </div>
          <BottomNav username={profile.username} />
        </div>
      </UnreadChatProvider>
    </ToastProvider>
  )
}
