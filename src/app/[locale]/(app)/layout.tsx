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
        <div className="min-h-screen flex flex-col">
          <AuthHeader profile={profile} unreadCount={unreadCount} />
          {isDemoUser(user) && <DemoBanner />}
          <div className="flex-1 pb-16 md:pb-0">{children}</div>
          <AppFooter />
          <BottomNav />
        </div>
      </UnreadChatProvider>
    </ToastProvider>
  )
}
