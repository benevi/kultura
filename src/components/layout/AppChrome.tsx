import type { User } from '@supabase/supabase-js'
import { getViewer, type ViewerProfile } from '@/lib/media/viewer'
import { AppChromeFrame } from '@/components/layout/AppChromeFrame'
import { AppFooter } from '@/components/layout/AppFooter'
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
    <AppChromeFrame userId={user.id} profile={profile} unreadCount={unreadCount} demo={isDemoUser(user)} footer={<AppFooter />}>
      {children}
    </AppChromeFrame>
  )
}
