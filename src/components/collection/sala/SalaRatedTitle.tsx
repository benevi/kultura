// ============================================================
// KULTURA — /u/[username]/r/[type]/[id] en «Sala» (fase 8.5 P4, bandera SALA_PERFIL)
// La nota pública de una persona sobre una obra con la estética del perfil
// (`SalaProfileReview`): la franja de su dueño, el póster, el título como
// rótulo y la nota en grande en la escala de quien puntúa («9 de 10» o
// «4,5 de 5»). Con sesión, la barra de la app (`AppChromeLazy`, como `/u`);
// sin ella, la cabecera pública y una sola llamada a registrarse al final.
//
// Qué se ve lo sigue decidiendo `resolveRatingShare` (la misma vista que la
// página de hoy): aquí no se pide nada más. Quien no tiene cuenta y no trae
// el enlace firmado ve la página genérica, sin nota.
// ============================================================

import type { User } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { AppChromeLazy } from '@/components/layout/AppChromeLazy'
import { AppFooter } from '@/components/layout/AppFooter'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SignedInBar } from '@/components/collection/PublicCollection'
import { ClientMessages } from '@/i18n/ClientMessages'
import { PUBLIC_PROFILE_CLIENT_NAMESPACES, SHELL_CLIENT_NAMESPACES } from '@/i18n/client-messages'
import {
  SalaProfileCtaLazy,
  SalaProfileLinkButtonLazy,
  SalaProfileReviewLazy,
} from '@/components/profile/sala/SalaProfilePublicLazy'
import { isDemoUser } from '@/lib/demo'
import { rating10ToScore } from '@/lib/library/rating'
import type { RatingShareView, ShareRating } from '@/lib/share/rating-share'
import type { ViewerProfile } from '@/lib/media/viewer'

type ShownView = Extract<RatingShareView, { kind: 'rated' | 'generic' }>

export interface SalaRatedTitleProps {
  locale: string
  view: ShownView
  /** Con sesión y perfil: la barra de la app. Con sesión sin perfil (alta a medias): la barra de hoy. */
  chrome: { user: User; profile: ViewerProfile | null; unreadCount: number } | null
  /** Alta atribuida a quien compartió; solo sin sesión. */
  registerHref: string
}

/** El número de la nota en la escala de su dueño, sin el «/10» ni la estrella de `ShareRating.text`. */
function scoreValue(rating: ShareRating, locale: string): string {
  const number = new Intl.NumberFormat(locale === 'en' ? 'en' : 'es', { maximumFractionDigits: 1 })
  if (rating.scale === 'ten') return number.format(rating.rating10)
  if (rating.scale === 'stars') return number.format(rating.rating10 / 2)
  return number.format(rating10ToScore(rating.rating10) ?? Math.round(rating.rating10 / 2))
}

export async function SalaRatedTitle({ locale, view, chrome, registerHref }: SalaRatedTitleProps) {
  const [t, tm, tc] = await Promise.all([
    getTranslations({ locale, namespace: 'share' }),
    getTranslations({ locale, namespace: 'media' }),
    getTranslations({ locale, namespace: 'collection' }),
  ])
  const signedIn = chrome !== null
  const { owner, media, parsed } = view
  const values = { username: owner.username, title: media.title }
  const profileHref = `/u/${encodeURIComponent(owner.username)}`
  const titleHref = `/media/${parsed.type}/${encodeURIComponent(parsed.externalId)}`
  const rated = view.kind === 'rated' ? view : null

  const content = (
    <main
      id="main"
      data-sala-profile="rating"
      className="page-grid [&>*]:max-w-6xl flex-1 py-6 md:py-8 flex flex-col gap-10 md:gap-12"
    >
      <SalaProfileReviewLazy
        username={owner.username}
        avatarColor={owner.avatarColor}
        avatarInitials={owner.avatarInitials}
        profileHref={profileHref}
        lead={rated ? t('page.salaLead', { username: owner.username }) : null}
        title={media.title}
        poster={media.poster}
        format={parsed.type}
        formatLabel={tm(parsed.type)}
        year={media.year}
        score={
          rated
            ? {
                label: t('page.salaScoreLabel'),
                value: scoreValue(rated.rating, locale),
                of: t('page.salaScoreOf', { scale: rated.rating.scale === 'ten' ? 'ten' : 'stars' }),
              }
            : null
        }
        text={rated ? null : t('page.genericLead', values)}
        hint={rated?.isOwner ? t('page.ownerHint') : null}
      >
        <SalaProfileLinkButtonLazy variant="primary" href={titleHref}>
          {signedIn ? t('page.ctaRate') : t('page.viewTitle')}
        </SalaProfileLinkButtonLazy>
        <SalaProfileLinkButtonLazy href={profileHref}>{t('page.viewProfile', values)}</SalaProfileLinkButtonLazy>
      </SalaProfileReviewLazy>

      {/* Una sola llamada a registrarse, y solo sin sesión. */}
      {!signedIn ? (
        <SalaProfileCtaLazy title={tc('ctaTitle')} text={tc('ctaText')} cta={tc('ctaButton')} href={registerHref} />
      ) : null}
    </main>
  )

  if (chrome?.profile) {
    // Como `/u` (P3): la barra de la app con los textos del shell y la página
    // con los suyos debajo. Solo con sesión.
    return (
      <ClientMessages namespaces={SHELL_CLIENT_NAMESPACES}>
        <AppChromeLazy
          userId={chrome.user.id}
          profile={chrome.profile}
          unreadCount={chrome.unreadCount}
          demo={isDemoUser(chrome.user)}
          footer={<AppFooter />}
        >
          <ClientMessages namespaces={PUBLIC_PROFILE_CLIENT_NAMESPACES}>{content}</ClientMessages>
        </AppChromeLazy>
      </ClientMessages>
    )
  }
  return (
    <div className="min-h-screen flex flex-col">
      {chrome ? <SignedInBar /> : <Header />}
      {content}
      <Footer />
    </div>
  )
}
