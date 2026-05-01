import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUnreadCount } from '@/lib/social/notifications'
import { AuthHeader } from '@/components/layout/AuthHeader'
import { BottomNav } from '@/components/layout/BottomNav'
import { AppFooter } from '@/components/layout/AppFooter'
import { ToastProvider } from '@/components/ui/ToastProvider'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('username, avatar_color, avatar_initials')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/login')

  const unreadCount = await getUnreadCount(user.id)

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <AuthHeader profile={profile} unreadCount={unreadCount} />
        <div className="flex-1 pb-16 md:pb-0">{children}</div>
        <AppFooter />
        <BottomNav username={profile.username} />
      </div>
    </ToastProvider>
  )
}
