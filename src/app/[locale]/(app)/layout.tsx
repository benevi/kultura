import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { loginRedirectPath } from '@/lib/utils/safe-redirect'
import { getUnreadCount } from '@/lib/social/notifications'
import { AppChrome, getChromeSession } from '@/components/layout/AppChrome'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { user, profile } = await getChromeSession()

  // Un solo salto y ya con locale (SEO-13). La página de origen viaja como
  // `next` si el middleware la ha dejado en `x-pathname`; si no, sin `next`.
  // Solo la zona con sesión redirige: la ficha (`/media`, D-01) es pública y
  // usa el mismo envoltorio sin esta comprobación.
  if (!user) redirect(loginRedirectPath(locale, headers().get('x-pathname')))
  if (!profile) redirect(`/${locale}/login`)

  const unreadCount = await getUnreadCount(user.id)

  return (
    <AppChrome user={user} profile={profile} unreadCount={unreadCount}>
      {children}
    </AppChrome>
  )
}
