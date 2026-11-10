import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { loginRedirectPath } from '@/lib/utils/safe-redirect'
import { getUnreadCount } from '@/lib/social/notifications'
import { AppChrome, getChromeSession } from '@/components/layout/AppChrome'
import { getTranslations } from 'next-intl/server'
import { PwaShell } from '@/components/pwa/PwaShell'
import type { InstallLabels } from '@/components/pwa/InstallPrompt'

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
  if (!user) redirect(loginRedirectPath(locale, (await headers()).get('x-pathname')))
  if (!profile) redirect(`/${locale}/login`)

  const [unreadCount, t] = await Promise.all([
    getUnreadCount(user.id),
    getTranslations({ locale, namespace: 'pwa.install' }),
  ])

  return (
    <AppChrome user={user} profile={profile} unreadCount={unreadCount}>
      {children}
      {/* F-23: service worker y aviso de instalación (MOV-2, MOV-3). */}
      <PwaShell installLabels={installLabels(t)} />
    </AppChrome>
  )
}

function installLabels(t: (key: keyof InstallLabels) => string): InstallLabels {
  const keys = ['title', 'body', 'action', 'later', 'iosTitle', 'iosStepShare', 'iosStepAdd', 'iosDone'] as const
  return Object.fromEntries(keys.map((key) => [key, t(key)])) as unknown as InstallLabels
}
