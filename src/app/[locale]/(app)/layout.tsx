import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { loginRedirectPath } from '@/lib/utils/safe-redirect'
import { createClient } from '@/lib/supabase/server'
import { getUnreadCount } from '@/lib/social/notifications'
import { AuthHeader } from '@/components/layout/AuthHeader'
import { BottomNav } from '@/components/layout/BottomNav'
import { AppFooter } from '@/components/layout/AppFooter'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { UnreadChatProvider } from '@/components/layout/UnreadChatProvider'
import { DemoBanner } from '@/components/layout/DemoBanner'
import { isDemoUser } from '@/lib/demo'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Un solo salto y ya con locale (SEO-13). La página de origen viaja como
  // `next` si el middleware la ha dejado en `x-pathname`; si no, sin `next`.
  if (!user) redirect(loginRedirectPath(locale, headers().get('x-pathname')))

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect(`/${locale}/login`)

  const unreadCount = await getUnreadCount(user.id)

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
