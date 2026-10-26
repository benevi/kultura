import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isDemoUser } from '@/lib/demo'
import { getTranslations } from 'next-intl/server'
import { SettingsForm } from './SettingsForm'
import { PlatformsSection } from './PlatformsSection'
import { readPlatforms } from './platforms'
import { isLibraryVisibility } from '@/app/api/settings/identity'
import { accountGraceEnabled, libraryVisibilityEnabled, readAccountState } from '@/app/api/settings/account-state'
import { ACCOUNT_GRACE_DAYS } from '@/app/api/settings/identity'
import { ratingScale10Enabled, readRatingScale } from '@/lib/library/scale'
import { weeklyEmailAllowedFor, weeklyEmailConfig } from '@/lib/email/config'
import { readWeeklyEmailPreference } from '@/lib/email/preferences'
import { OPTIN_TOKEN_TTL_SECONDS } from '@/lib/email/unsubscribe-token'

function isOptinPending(requestedAt: string | null): boolean {
  if (!requestedAt) return false
  return Date.now() - new Date(requestedAt).getTime() < OPTIN_TOKEN_TTL_SECONDS * 1000
}
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

  // F-28: el correo semanal solo se ofrece con todo configurado (bandera,
  // claves y, si existe, WEEKLY_EMAIL_ONLY) y nunca a la demo.
  const offerWeeklyEmail = !isDemoUser(user) && weeklyEmailAllowedFor(weeklyEmailConfig(), user)
  const [{ data: profile }, account, platforms, weeklyEmail] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    readAccountState(supabase, user.id),
    // F-25: tabla privada (RLS: solo el dueño); `null` sin la migración.
    readPlatforms(supabase, user.id, locale),
    // F-28: `null` sin la migración (la opción no se enseña).
    offerWeeklyEmail ? readWeeklyEmailPreference(supabase, user.id) : Promise.resolve(null),
  ])

  // D-04b: el selector solo con la bandera Y la columna (migración aplicada);
  // sin ellas rige la política de W1 ("cualquiera con cuenta").
  const visibility = (profile as { library_visibility?: unknown } | null)?.library_visibility
  const initialLibraryVisibility =
    libraryVisibilityEnabled() && isLibraryVisibility(visibility) ? visibility : null

  // F-25: «Mis plataformas» solo si su tabla existe (migración aplicada).
  const platformsSlot = platforms ? (
    <PlatformsSection
      userId={user.id}
      initialServices={platforms.services}
      initialRegion={platforms.region}
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
        // F-24 → F-28: la escala de notas vive aquí (antes, en la Biblioteca).
        initialRatingScale={ratingScale10Enabled() ? readRatingScale(user) : null}
        initialWeeklyEmail={
          weeklyEmail
            ? {
                weekly: weeklyEmail.weekly,
                consentedAt: weeklyEmail.consentedAt,
                // Enlace de confirmación enviado y aún vigente (7 días).
                pending: isOptinPending(weeklyEmail.optinRequestedAt),
              }
            : null
        }
      />
    </main>
  )
}
