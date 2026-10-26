import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isDemoUser } from '@/lib/demo'
import { getTranslations } from 'next-intl/server'
import { SettingsForm } from './SettingsForm'
import { PlatformsSection } from './PlatformsSection'
import { normalizeServices, platformRegionFor } from './platforms'
import { isLibraryVisibility } from '@/app/api/settings/identity'
import { accountGraceEnabled, libraryVisibilityEnabled, readAccountState } from '@/app/api/settings/account-state'
import { ACCOUNT_GRACE_DAYS } from '@/app/api/settings/identity'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('title') }
}

interface SettingsPageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ email?: string }>
}

export default async function SettingsPage({ params, searchParams }: SettingsPageProps) {
  const { locale } = await params
  const query = (await searchParams) ?? {}
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings`)}`)

  const [{ data: profile }, account] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    readAccountState(supabase, user.id),
  ])

  // D-04b: el selector solo con la bandera Y la columna (migración aplicada);
  // sin ellas rige la política de W1 ("cualquiera con cuenta").
  const visibility = (profile as { library_visibility?: unknown } | null)?.library_visibility
  const initialLibraryVisibility =
    libraryVisibilityEnabled() && isLibraryVisibility(visibility) ? visibility : null

  // F-25: «Mis plataformas» solo si la columna existe (migración aplicada);
  // `select('*')` la trae sin pedirla por nombre, así que antes no falla nada.
  const streaming = profile as { streaming_services?: unknown; streaming_region?: unknown } | null
  const platformsSlot =
    streaming && Array.isArray(streaming.streaming_services) ? (
      <PlatformsSection
        userId={user.id}
        initialServices={normalizeServices(streaming.streaming_services)}
        initialRegion={platformRegionFor(streaming.streaming_region, locale)}
        isDemo={isDemoUser(user)}
      />
    ) : null

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
        emailConfirmed={query.email === 'confirmed'}
        initialLibraryVisibility={isDemoUser(user) ? null : initialLibraryVisibility}
        deletionRequestedAt={account.state?.deletion_requested_at ?? null}
        // Mismo cálculo que GET /api/account: con la bandera y la tabla, 7 días.
        graceDays={accountGraceEnabled() && account.migrated ? ACCOUNT_GRACE_DAYS : 0}
        platformsSlot={platformsSlot}
      />
    </main>
  )
}
