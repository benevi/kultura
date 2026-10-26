// ============================================================
// KULTURA — /[locale]/email/confirm (F-28): confirmar el alta (doble opt-in)
//
// Llega desde el correo de confirmación (`?t=<token optin firmado>`). Abrir
// la página NO activa nada (los filtros de correo abren enlaces solos): hay
// que pulsar el botón, que hace POST a /api/email/confirm y vuelve aquí con
// `?status=…`. Sin JavaScript. No se indexa ni manda el token como referrer
// (y Vercel Analytics la registra sin query: VercelAnalytics.tsx).
// ============================================================

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { EMAIL_TOKEN_SECRET_MIN } from '@/lib/email/config'
import { isCurrentConsentVersion } from '@/lib/email/consent'
import { verifyOptinToken } from '@/lib/email/unsubscribe-token'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ t?: string | string[]; status?: string | string[] }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('email.confirm')
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

type View = 'confirm' | 'done' | 'invalid' | 'stale' | 'error'

function viewFor(status: string, token: string): View {
  if (status === 'done' || status === 'stale' || status === 'error') return status
  if (status === 'invalid' || !token) return 'invalid'
  const secret = process.env.EMAIL_TOKEN_SECRET?.trim() ?? ''
  if (secret.length < EMAIL_TOKEN_SECRET_MIN) return 'invalid'
  const check = verifyOptinToken(token, secret)
  if (!check.ok) return 'invalid'
  return isCurrentConsentVersion(check.textVersion) ? 'confirm' : 'stale'
}

const BUTTON =
  'inline-flex items-center justify-center min-h-11 px-6 rounded-pill font-body font-bold text-sm transition-colors ' +
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

export default async function ConfirmPage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const query = await searchParams
  const token = first(query.t).slice(0, 240)
  const view = viewFor(first(query.status), token)
  const t = await getTranslations('email.confirm')

  const title = { confirm: t('title'), done: t('doneTitle'), invalid: t('invalidTitle'), stale: t('staleTitle'), error: t('errorTitle') }[view]
  const body = { confirm: t('body'), done: t('doneBody'), invalid: t('invalidBody'), stale: t('staleBody'), error: t('errorBody') }[view]
  const showForm = view === 'confirm' || (view === 'error' && token !== '')

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="page-grid [&>*]:max-w-xl flex-1 py-12 md:py-16">
        <div className="rounded-bento bg-surface-default px-6 py-8 sm:px-8">
          <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary mb-3">{title}</h1>
          <p className="text-text-secondary leading-relaxed mb-6">{body}</p>
          {showForm ? (
            <form method="post" action="/api/email/confirm" className="flex flex-wrap gap-3">
              <input type="hidden" name="t" value={token} />
              <input type="hidden" name="l" value={locale} />
              <button type="submit" className={`${BUTTON} bg-accent-pink text-on-accent-pink hover:opacity-90`}>
                {view === 'error' ? t('retry') : t('confirm')}
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap gap-3">
              {view === 'done' ? (
                <a href={`/${locale}/calendar`} className={`${BUTTON} bg-accent-pink text-on-accent-pink hover:opacity-90`}>
                  {t('calendar')}
                </a>
              ) : null}
              <a href={`/${locale}/settings#email`} className={`${BUTTON} bg-surface-elevated text-text-primary`}>
                {t('settings')}
              </a>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
