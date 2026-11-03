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
import { AlbumPage } from '@/components/album/AlbumPage'
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

// Botones del álbum en papel (los de `KButton`, sin cargar JavaScript): el
// rosa es la única acción; el secundario, blanco con raya de 2 px en tinta.
const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-button border-2 px-6 font-body text-sm font-bold ' +
  'transition-colors duration-fast ease-out ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'
const PRIMARY = `${BUTTON} border-accent-pink bg-accent-pink text-on-accent-pink hover:border-accent-pink-hover hover:bg-accent-pink-hover`
const SECONDARY = `${BUTTON} border-button-secondary-border bg-button-secondary text-on-button-secondary hover:bg-surface-elevated`
/** La etiqueta blanca de la tapa, como en /login. */
const LABEL = 'theme-paper w-full max-w-xl rounded-bento border-2 border-text-primary bg-surface-default p-6 md:p-8'

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
    <AlbumPage as="div" contained={false} className="flex min-h-screen flex-col">
      <Header />
      <AlbumPage as="main" id="main" tone="cyan" className="flex-1 py-12 md:py-16">
        <div className={LABEL}>
          {/* La vuelta del formulario es una página nueva: el h1 ya dice el resultado. */}
          <h1 className="mb-3 text-balance font-display text-2xl text-text-primary md:text-3xl">
            {title}
          </h1>
          <p className="mb-6 font-body text-base text-text-secondary">{body}</p>

          {view === 'confirm' || (view === 'error' && token) ? (
            <form method="post" action="/api/email/unsubscribe" className="flex flex-wrap gap-3">
              <input type="hidden" name="t" value={token} />
              <input type="hidden" name="l" value={locale} />
              <button type="submit" className={PRIMARY}>
                {view === 'error' ? t('retry') : t('confirm')}
              </button>
              <a href={`/${locale}/settings#email`} className={SECONDARY}>
                {t('settings')}
              </a>
            </form>
          ) : (
            <div className="flex flex-wrap gap-3">
              <a href={`/${locale}/settings#email`} className={SECONDARY}>
                {t('settings')}
              </a>
              <a href={`/${locale}`} className={`${BUTTON} border-transparent text-text-primary underline decoration-2 underline-offset-4 hover:decoration-accent-pink`}>
                {t('home')}
              </a>
            </div>
          )}
        </div>
      </AlbumPage>
      <Footer />
    </AlbumPage>
  )
}
