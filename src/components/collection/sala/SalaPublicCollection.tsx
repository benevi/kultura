// ============================================================
// KULTURA — /u/[username] en «Sala» (fase 8.5 P3, bandera SALA_PERFIL)
// El perfil público con la misma cabecera de persona que `/profile` (franja
// con el color del avatar, avatar cuadrado y «@nombre» como rótulo), sus
// números, los favoritos en `SalaWorkCard` con la nota en la escala de su
// dueño, «En curso» y las listas públicas con `SalaRow`, los bloqueos con
// `SalaBlockState` y, con sesión, la barra de la app (`AppChromeLazy`: la
// misma de `AppChrome`, por `next/dynamic` para no cargarla sin sesión).
//
// Lo que arregla respecto a la página de hoy:
// - **Favoritos en dos escalas**: decían siempre «de 5»; ahora «9 de 10» si
//   su dueño puntúa sobre 10, como `/u/…/r/…`.
// - **Con sesión se perdía la navegación**: `SignedInBar` solo traía el logo
//   e «Inicio». Ahora la barra de la app, como la ficha pública.
// - **Tres llamadas a registrarse** para quien llega con invitación (banner,
//   biblioteca bloqueada y «¿Y la tuya?»). Ahora una: la de la invitación si
//   la hay; si no, la del final. El bloqueo solo ofrece «Ya tengo cuenta».
//
// Lo que ve quien no tiene cuenta no cambia (privacidad, propuesta §7): ni la
// fecha de alta, ni la visibilidad, ni nada de la biblioteca; la página no las
// pide sin sesión. Las piezas de cliente llegan por `next/dynamic`
// (`SalaProfileLazy`): con la bandera apagada no se descargan.
// ============================================================

import type { User } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { AppChromeLazy } from '@/components/layout/AppChromeLazy'
import { AppFooter } from '@/components/layout/AppFooter'
import { isDemoUser } from '@/lib/demo'
import { ClientMessages } from '@/i18n/ClientMessages'
import { PUBLIC_PROFILE_CLIENT_NAMESPACES, SHELL_CLIENT_NAMESPACES } from '@/i18n/client-messages'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ReportButton } from '@/components/social/ReportButton'
import { InviteLinkButton } from '@/components/collection/InviteLinkButton'
import { PLURAL_KEY, SignedInBar } from '@/components/collection/PublicCollection'
import { SalaLink } from '@/components/sala/SalaLink'
import {
  SalaProfileCtaLazy,
  SalaProfileEditLazy,
  SalaProfileFavoritesLazy,
  SalaProfileHeaderLazy,
  SalaProfileInviteLazy,
  SalaProfileLinkButtonLazy,
  SalaProfileNumbersLazy,
  SalaProfileRowLazy,
  SalaProfileStateLazy,
} from '@/components/profile/sala/SalaProfilePublicLazy'
import { invitePath } from '@/lib/analytics/invite'
import { rating10ToScore } from '@/lib/library/rating'
import type { ShareScale } from '@/lib/share/rating-share'
import type { ViewerProfile } from '@/lib/media/viewer'
import type { FavoriteItem, LibraryShowcase, PublicCollectionItem, PublicList, PublicOwner } from '@/lib/social/public-collection'
import type { MediaType } from '@/types/media'

/** Cuántas portadas de la primera fila cargan con prioridad (REN-6). */
const PRIORITY_POSTERS = 4

export interface SalaPublicCollectionProps {
  locale: string
  owner: PublicOwner
  lists: PublicList[]
  /** Con sesión y perfil: la barra de la app. Con sesión sin perfil (alta a medias): la barra de hoy. */
  chrome: { user: User; profile: ViewerProfile | null; unreadCount: number } | null
  isOwner: boolean
  showcase: LibraryShowcase | null
  /** Escala de notas del dueño (la de `/u/…/r/…`). */
  scale: ShareScale
  /** Quien llega sin cuenta con la invitación del dueño (`?ref=`). */
  invite: { friendsOnSignup: boolean } | null
  registerHref: string
  loginHref: string
}

/** «Nota: 9 de 10» o «Nota: 4,5 de 5», en la escala del dueño (como `formatShareRating`). */
function ratingText(
  item: FavoriteItem,
  scale: ShareScale,
  locale: string,
  t: (key: string, values: Record<string, string>) => string,
): string {
  const number = new Intl.NumberFormat(locale === 'en' ? 'en' : 'es', { maximumFractionDigits: 1 })
  const rating10 = item.rating10
  if (rating10 === undefined) return t('favoriteRating', { scale: 'stars', value: number.format(item.score) })
  if (scale === 'ten') return t('favoriteRating', { scale: 'ten', value: number.format(rating10) })
  if (scale === 'stars') return t('favoriteRating', { scale: 'stars', value: number.format(rating10 / 2) })
  return t('favoriteRating', { scale: 'stars', value: number.format(rating10ToScore(rating10) ?? item.score) })
}

function toItem(item: PublicCollectionItem, detail?: string) {
  return { mediaId: item.mediaId, title: item.title, poster: item.poster, type: item.type, year: item.year, detail }
}

export async function SalaPublicCollection({
  locale,
  owner,
  lists,
  chrome,
  isOwner,
  showcase,
  scale,
  invite,
  registerHref,
  loginHref,
}: SalaPublicCollectionProps) {
  const [t, tm, tl, tp, ts, ti, tc] = await Promise.all([
    getTranslations('collection'),
    getTranslations('media'),
    getTranslations('lists'),
    getTranslations('profile'),
    getTranslations('settings'),
    getTranslations('invite'),
    getTranslations('common'),
  ])
  const signedIn = chrome !== null
  const username = owner.username
  // F-25: una lista mixta no tiene formato en `media`.
  const formatName = (format: string) => (format in PLURAL_KEY ? tm(PLURAL_KEY[format as MediaType]) : tl('mediaTypeMixed'))

  // Solo llega con sesión (`getOwnerDetails`): sin cuenta no hay fecha (R2).
  const joinedAt = owner.createdAt ? new Date(owner.createdAt) : null
  const memberSince =
    joinedAt && Number.isFinite(joinedAt.getTime())
      ? t('memberSince', { date: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(joinedAt) })
      : null

  // REN-6: prioridad solo para la PRIMERA fila de pósters reales de la página.
  const firstPosters: 'favorites' | 'watching' | 'lists' =
    showcase && showcase.favorites.length > 0 ? 'favorites' : showcase && showcase.watching.length > 0 ? 'watching' : 'lists'

  const numbers = showcase && showcase.total > 0
    ? [
        { value: showcase.total, label: tp('totalItems', { count: showcase.total }) },
        { value: showcase.completed, label: tp('completed', { count: showcase.completed }) },
        // Los formatos en minúscula (decisión de Víctor tras P1, también en `/u`).
        ...showcase.byFormat.map((f) => ({
          value: f.count,
          label: tm(f.count === 1 ? f.type : PLURAL_KEY[f.type]).toLocaleLowerCase(locale),
        })),
      ]
    : []

  const actions = isOwner ? (
    <>
      <InviteLinkButton path={invitePath(locale, owner)} skin="sala" />
      <SalaProfileEditLazy label={tp('editProfile')} />
    </>
  ) : signedIn ? (
    <>
      <SalaProfileLinkButtonLazy href={`/profile/${encodeURIComponent(username)}`}>{t('openProfile')}</SalaProfileLinkButtonLazy>
      <ReportButton targetType="user" targetId={owner.id} skin="sala" closeLabel={tc('close')} />
    </>
  ) : null

  const visibility = owner.libraryVisibility ?? 'public'
  const hiddenTitle = tp('libraryHidden', { username })

  const content = (
    <main id="main" data-sala-profile="public" className="page-grid [&>*]:max-w-6xl flex-1 py-6 md:py-8 flex flex-col gap-8 md:gap-10">
      {invite ? (
        <SalaProfileInviteLazy
          title={ti('bannerTitle', { username })}
          text={invite.friendsOnSignup ? ti('bannerFriends') : ti('bannerText')}
          cta={ti('bannerCta')}
          href={registerHref}
        />
      ) : null}

      <SalaProfileHeaderLazy
        username={username}
        avatarColor={owner.avatarColor}
        avatarInitials={owner.avatarInitials}
        avatarIcon={owner.avatarIcon}
        memberSince={memberSince}
        bio={owner.bio}
      >
        {actions}
      </SalaProfileHeaderLazy>

      {/* Quién ve qué, con el camino a Ajustes: solo lo ve su dueño. */}
      {isOwner ? (
        <p data-sala-profile-owner-note="" className="font-sala-text text-sala-ink-secondary sala-type-small max-w-prose">
          {t('ownerNote', { visibility: ts(`visibility.${visibility}`) })}{' '}
          {visibility === 'public' ? `${t('ownerNoteNoAccount')} ` : null}
          <SalaLink href="/settings">{t('ownerSettings')}</SalaLink>
        </p>
      ) : null}

      {/* Biblioteca (D-04b): solo con sesión y permiso. */}
      {showcase ? (
        <>
          <SalaProfileNumbersLazy label={t('statsLabel')} items={numbers} />
          {showcase.favorites.length > 0 ? (
            <SalaProfileFavoritesLazy
              title={t('favorites')}
              items={showcase.favorites.map((f) => toItem(f, ratingText(f, scale, locale, t)))}
              hint={isOwner && showcase.favorites.length < 4 ? t('favoritesHint') : null}
              priority={firstPosters === 'favorites'}
            />
          ) : isOwner ? (
            <SalaProfileStateLazy
              name="favorites-empty"
              title={t('favorites')}
              description={t('favoritesEmpty')}
              action={<SalaProfileLinkButtonLazy href="/library">{t('favoritesEmptyAction')}</SalaProfileLinkButtonLazy>}
            />
          ) : null}
          <SalaProfileRowLazy
            title={t('watching')}
            name="watching"
            items={showcase.watching.map((w) => toItem(w))}
            priorityCount={firstPosters === 'watching' ? PRIORITY_POSTERS : 0}
          />
        </>
      ) : visibility === 'private' && signedIn ? (
        <SalaProfileStateLazy name="hidden" title={hiddenTitle} description={tp('libraryHiddenPrivate')} />
      ) : signedIn ? (
        // Con sesión y sin permiso: solo amigos (o la base no lo confirmó). El
        // botón para ir a su perfil y añadirle ya está en la cabecera.
        <SalaProfileStateLazy name="hidden" title={hiddenTitle} description={tp('libraryHiddenFriends')} />
      ) : (
        // Sin cuenta: hace falta una y decide su dueño. La llamada a registrarse
        // es otra (la invitación o la del final); aquí, solo «Ya tengo cuenta».
        <SalaProfileStateLazy
          name="locked"
          title={t('lockedTitle', { username })}
          description={t('lockedText')}
          action={<SalaProfileLinkButtonLazy href={loginHref}>{t('signIn')}</SalaProfileLinkButtonLazy>}
        />
      )}

      {/* Listas públicas: las ve cualquiera. */}
      {lists.length === 0 ? (
        <SalaProfileStateLazy
          name="lists-empty"
          title={isOwner ? t('emptyOwn') : t('empty', { username })}
          description={isOwner ? t('emptyOwnHint') : t('emptyHint')}
          action={isOwner ? <SalaProfileLinkButtonLazy href="/lists">{t('emptyOwnAction')}</SalaProfileLinkButtonLazy> : undefined}
        />
      ) : (
        <section aria-labelledby="lists-title" data-sala-profile-lists="" className="font-sala-text text-sala-ink flex flex-col gap-8">
          <h2 id="lists-title" className="sala-type-data">
            {t('publicLists')}
          </h2>
          {lists.map((list, i) => (
            <SalaProfileRowLazy
              key={list.id}
              headingLevel={3}
              title={list.name}
              name={`list-${list.id}`}
              description={formatName(list.mediaType).toLocaleLowerCase(locale)}
              items={list.items.map((item) => toItem(item))}
              priorityCount={firstPosters === 'lists' && i === 0 ? PRIORITY_POSTERS : 0}
              action={
                <SalaLink variant="standalone" href={`/u/${encodeURIComponent(username)}/l/${list.id}`}>
                  {t('viewList')}
                  <span className="sr-only"> {list.name}</span> · {t('items', { count: list.items.length })}
                </SalaLink>
              }
            />
          ))}
        </section>
      )}

      {!signedIn && !invite ? (
        <SalaProfileCtaLazy title={t('ctaTitle')} text={t('ctaText')} cta={t('ctaButton')} href={registerHref} />
      ) : null}

      {/* DSA: denunciar sin cuenta lleva al formulario público (F-11). */}
      {!signedIn ? (
        <p className="font-sala-text text-center">
          <SalaLink variant="standalone" href={`/report?target=user&id=${encodeURIComponent(username)}`}>
            {t('reportProfile')}
          </SalaLink>
        </p>
      ) : null}
    </main>
  )

  if (chrome?.profile) {
    // La barra de la app usa los textos del shell (cabecera, menú, barra
    // inferior), que el proveedor de `/u` no lleva: va dentro de uno con los
    // del shell, y la página vuelve a tener los suyos debajo, como en la
    // ficha pública (`media/layout.tsx`). Solo con sesión: quien llega sin
    // cuenta no carga estos textos dos veces.
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
