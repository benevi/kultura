// ============================================================
// KULTURA — /[locale]/email/unsubscribe (F-28, CRE-9): baja sin sesión
//
// Llega desde el enlace del correo (`?t=<token firmado>`). Abrir la página NO
// da de baja (los clientes de correo abren enlaces solos): hay que pulsar el
// botón, que hace POST a /api/email/unsubscribe y vuelve aquí con
// `?status=done`. Sin JavaScript: un formulario normal del servidor.
// No se indexa y no manda el token a nadie como referrer.
// ============================================================

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { KButton } from '@/components/ui/KButton'
import { EMAIL_TOKEN_SECRET_MIN } from '@/lib/email/config'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ t?: string | string[]; status?: string | string[] }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('email.unsubscribe')
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

type View = 'confirm' | 'done' | 'invalid' | 'error'

function viewFor(status: string, token: string): View {
  if (status === 'done') return 'done'
  if (status === 'error') return 'error'
  if (status === 'invalid' || !token) return 'invalid'
  const secret = process.env.EMAIL_TOKEN_SECRET?.trim() ?? ''
  // Sin secreto no se puede comprobar aquí; el POST lo dirá.
  if (secret.length < EMAIL_TOKEN_SECRET_MIN) return 'confirm'
  return verifyUnsubscribeToken(token, secret).ok ? 'confirm' : 'invalid'
}

// Solo para «Volver al inicio», que es un enlace de texto sin fondo ni borde:
// no corresponde a ninguna variante de KButton. Los demás son KButton.
const TEXT_LINK =
  'inline-flex items-center justify-center min-h-11 px-6 rounded-pill font-body font-bold text-sm transition-colors ' +
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const query = await searchParams
  const token = first(query.t).slice(0, 200)
  const view = viewFor(first(query.status), token)
  const t = await getTranslations('email.unsubscribe')

  const title = { confirm: t('title'), done: t('doneTitle'), invalid: t('invalidTitle'), error: t('errorTitle') }[view]
  const body = { confirm: t('body'), done: t('doneBody'), invalid: t('invalidBody'), error: t('errorBody') }[view]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="page-grid [&>*]:max-w-xl flex-1 py-12 md:py-16">
        <div className="rounded-bento bg-surface-default px-6 py-8 sm:px-8">
          {/* La vuelta del formulario es una página nueva: el h1 ya dice el resultado. */}
          <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary mb-3">
            {title}
          </h1>
          <p className="text-text-secondary leading-relaxed mb-6">{body}</p>

          {view === 'confirm' || (view === 'error' && token) ? (
            <form method="post" action="/api/email/unsubscribe" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <input type="hidden" name="t" value={token} />
              <input type="hidden" name="l" value={locale} />
              <KButton type="submit" size="lg">
                {view === 'error' ? t('retry') : t('confirm')}
              </KButton>
              <KButton asChild variant="tonal" size="lg">
                <a href={`/${locale}/settings#email`}>{t('settings')}</a>
              </KButton>
            </form>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <KButton asChild variant="tonal" size="lg">
                <a href={`/${locale}/settings#email`}>{t('settings')}</a>
              </KButton>
              <a href={`/${locale}`} className={`${TEXT_LINK} text-text-secondary hover:text-text-primary`}>
                {t('home')}
              </a>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
