import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isDemoUser } from '@/lib/demo'
import { getTranslations } from 'next-intl/server'
import { SettingsForm } from './SettingsForm'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('title') }
}

interface SettingsPageProps {
  params: Promise<{ locale: string }>
  searchParams?: { email?: string }
}

export default async function SettingsPage({ params, searchParams }: SettingsPageProps) {
  const { locale } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings`)}`)

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <main className="max-w-[640px] mx-auto px-4 md:px-8 py-8">
      <SettingsForm
        initialUsername={profile?.username ?? ''}
        initialAvatarColor={profile?.avatar_color ?? 'blue'}
        initialAvatarIcon={profile?.avatar_icon ?? null}
        initialLocale={profile?.preferred_locale ?? null}
        userEmail={user.email ?? ''}
        isDemo={isDemoUser(user)}
        // Vuelta del enlace de cambio de email (`/api/auth/callback`).
        emailConfirmed={searchParams?.email === 'confirmed'}
      />
    </main>
  )
}
