// ============================================================
// KULTURA — /[locale]/welcome (onboarding, CRE-6)
//
// Tras el alta (correo o Google): 1) nombre público y, si entró con Google,
// la casilla de edad y términos; 2) formatos; 3) puntuar títulos conocidos;
// 4) primeras recomendaciones con el botón de "Para ti". En el paso 3, opcional,
// importar el historial de otra app (F-26). Objetivo: primer
// valor en menos de un minuto. Todo se puede saltar.
//
// Fuera de `(app)`: sin la navegación de la app, a pantalla completa. Pide
// sesión (sin ella → login con vuelta aquí) y nunca la demo, que no escribe.
// ============================================================

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { isDemoUser } from '@/lib/demo'
import { resolveAuthNext } from '@/lib/utils/safe-redirect'
import { GENERATED_USERNAME_REGEX } from '@/app/api/settings/identity'
import { hasAcceptedTerms, readAccountState } from '@/app/api/settings/account-state'
import { WelcomeFlow } from './WelcomeFlow'

interface WelcomeProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ next?: string }>
}

export async function generateMetadata({ params }: WelcomeProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'onboarding' })
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

/**
 * Namespaces que usa el cliente de esta página. Se pasan en su propio
 * proveedor para no depender de qué recorte del layout (REN-5) llegue aquí.
 */
const CLIENT_NAMESPACES = ['onboarding', 'auth', 'aiRecommendations', 'discoverFilters', 'media', 'errors', 'common'] as const

export default async function WelcomePage({ params, searchParams }: WelcomeProps) {
  const { locale } = await params
  const next = resolveAuthNext((await searchParams)?.next ?? null, locale)
  // `next` nunca vuelve aquí: se cortaría el bucle al terminar.
  const finish = next.startsWith(`/${locale}/welcome`) ? `/${locale}/home` : next

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/welcome?next=${encodeURIComponent(finish)}`)}`)
  }
  if (isDemoUser(user)) redirect(`/${locale}/home`)

  const [{ data: profile }, account] = await Promise.all([
    supabase.from('users').select('username').eq('id', user.id).maybeSingle(),
    readAccountState(supabase, user.id),
  ])
  if (account.state?.onboarded_at || user.app_metadata?.onboarded_at) redirect(finish)

  const currentUsername = (profile as { username?: string } | null)?.username ?? ''
  const all = await getMessages()
  const messages = Object.fromEntries(
    CLIENT_NAMESPACES.filter((ns) => ns in all).map((ns) => [ns, all[ns]])
  )

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WelcomeFlow
        locale={locale === 'en' ? 'en' : 'es'}
        next={finish}
        currentUsername={currentUsername}
        // Un nombre generado (`u_xxxxxx`) se ofrece cambiar con el campo vacío;
        // uno ya elegido se deja escrito.
        suggestChange={GENERATED_USERNAME_REGEX.test(currentUsername)}
        needsTerms={!hasAcceptedTerms(account.state, user)}
        // F-26: textos del paso opcional "Importar", solo en esta página (el
        // paso los envuelve en su propio <ImportMessages>).
        userId={user.id}
        importMessages={((all as Record<string, unknown>).import as AbstractIntlMessages | undefined) ?? null}
      />
    </NextIntlClientProvider>
  )
}
