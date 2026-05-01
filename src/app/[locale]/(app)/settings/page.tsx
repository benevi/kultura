import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { SettingsForm } from './SettingsForm'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('title') }
}

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('username, avatar_color, preferred_locale')
    .eq('id', user.id)
    .single()

  return (
    <main className="max-w-lg mx-auto px-4 md:px-8 py-8">
      <SettingsForm
        initialUsername={profile?.username ?? ''}
        initialAvatarColor={profile?.avatar_color ?? 'blue'}
        initialLocale={profile?.preferred_locale ?? null}
        userEmail={user.email ?? ''}
      />
    </main>
  )
}
