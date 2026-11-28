// ============================================================
// KULTURA — /u/[username] (Server Component, PÚBLICA)
// Perfil público de escaparate (DIS-6, CRE-7, CRE-12): cabecera con avatar,
// @usuario y bio; contadores por formato, 4 favoritos y "en curso" si quien
// mira puede ver la biblioteca (D-04b); y las listas públicas, visibles sin
// cuenta. Vive FUERA de `(app)` a propósito: ese grupo redirige a login a
// quien no tiene sesión.
//
// Invitación: `?ref={username}&inv={firma}` enseña "{username} te invita" y
// los enlaces de registro llevan la atribución (`utm_*`, `ref`, `inv`) hasta
// el alta (D-12), sin cookies.
//
// Fase 8.5 P3: con `SALA_PERFIL` la página sale en «Sala» (`SalaPublicCollection`). Con
// la bandera en `1` se decide sin leer cookies; en `prueba`, con la cookie de
// prueba (la página ya es dinámica: lee la sesión y `searchParams`). Con `0`,
// el HTML de siempre.
//
// Bloqueos: con sesión, si hay un bloqueo en cualquier sentido entre quien
// mira y el dueño, la página sale como la genérica de `/u/…/r/…`: solo la
// cabecera (nombre y avatar), sin biblioteca y sin listas. Igual en las dos
// ramas (la de siempre y «Sala»).
// ============================================================

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { KButton } from '@/components/ui/KButton'
import { ReportButton } from '@/components/social/ReportButton'
import { Link } from '@/i18n/navigation'
import {
  CollectionOwner,
  FavoritesGrid,
  FormatCounters,
  FormatLabel,
  SignedInBar,
  InviteBanner,
  LockedLibrary,
  PLURAL_KEY,
  PublicListRow,
  SignUpCta,
  WatchingRow,
} from '@/components/collection/PublicCollection'
import { InviteLinkButton } from '@/components/collection/InviteLinkButton'
import { createClient } from '@/lib/supabase/server'
import {
  getLibraryShowcase,
  getOwnerDetails,
  getPublicCollection,
  viewerCanReadLibrary,
  type LibraryShowcase,
  type PublicList,
  type PublicOwner,
} from '@/lib/social/public-collection'
import { parseAttributionRecord, withAttribution, type AttributionParams } from '@/lib/analytics/attribution'
import { invitePath, isValidInviteSignature } from '@/lib/analytics/invite'
import { siteUrl } from '@/lib/site-url'
import type { MediaType } from '@/types/media'
import { salaMarcaEnabled, salaPerfilEnabled } from '@/lib/flags/sala'
import { getViewer } from '@/lib/media/viewer'
import { getUnreadCount } from '@/lib/social/notifications'
import { readRatingScale } from '@/lib/library/scale'
import { ownerShareScale, type ShareScale } from '@/lib/share/rating-share'
import { viewerBlockedWith } from '@/lib/social/block-check'
import { SalaPublicCollection } from '@/components/collection/sala/SalaPublicCollection'

type SearchParams = Record<string, string | string[] | undefined>

interface Props {
  params: Promise<{ locale: string; username: string }>
  searchParams?: Promise<SearchParams>
}

/** Por debajo de esto el perfil es "contenido fino": fuera del índice (y del sitemap de F-16). */
const MIN_INDEXABLE_TITLES = 5

/** Cuántas portadas de la primera fila cargan con prioridad (REN-6). */
const PRIORITY_POSTERS = 4

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username: raw } = await params
  const username = decodeName(raw)
  const t = await getTranslations({ locale, namespace: 'collection' })
  const collection = await getPublicCollection(username).catch(() => null)
  const name = collection?.owner.username ?? username
  const title = t('metaTitle', { username: name })
  const ogTitle = `${title} · KULTURA`
  const description = t('metaDescription', { username: name })
  const path = `/${locale}/u/${encodeURIComponent(name)}`
  const publicTitles = collection?.lists.reduce((n, l) => n + l.items.length, 0) ?? 0
  return {
    title,
    description,
    // El enlace de invitación (?ref=…&inv=…) y los utm cuentan como la misma página.
    alternates: {
      canonical: path,
      languages: {
        es: `/es/u/${encodeURIComponent(name)}`,
        en: `/en/u/${encodeURIComponent(name)}`,
      },
    },
    robots: publicTitles >= MIN_INDEXABLE_TITLES ? undefined : { index: false, follow: true },
    openGraph: {
      title: ogTitle,
      description,
      type: 'profile',
      url: `${siteUrl()}${path}`,
      siteName: 'KULTURA',
      locale: locale === 'en' ? 'en_US' : 'es_ES',
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description },
  }
}

/** Agrupa listas ya ordenadas por formato, conservando ese orden. */
function groupByFormat(lists: PublicList[]): Array<[MediaType, PublicList[]]> {
  const groups: Array<[MediaType, PublicList[]]> = []
  for (const list of lists) {
    const last = groups[groups.length - 1]
    if (last && last[0] === list.mediaType) last[1].push(list)
    else groups.push([list.mediaType, [list]])
  }
  return groups
}

type Viewer = { id: string } | null

async function currentViewer(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Viewer> {
  try {
    const { data } = await supabase.auth.getUser()
    return data.user ? { id: data.user.id } : null
  } catch {
    return null
  }
}

export default async function PublicCollectionPage({ params, searchParams }: Props) {
  const { locale, username } = await params
  const sp = (await searchParams) ?? {}
  const name = decodeName(username)
  const collection = await getPublicCollection(name)
  // Un nombre antiguo es un 404 más (Q8): no lleva al nombre actual.
  if (!collection) notFound()

  let { lists } = collection
  let owner: PublicOwner = collection.owner
  const supabase = await createClient()
  const sala = await salaPerfilEnabled()
  // En «Sala» la sesión llega con su perfil (la barra de la app lo pinta):
  // `getViewer` la lee una vez por petición.
  const session = sala ? await getViewer() : null
  const viewer: Viewer = sala ? (session?.user ? { id: session.user.id } : null) : await currentViewer(supabase)
  const isOwner = viewer?.id === owner.id

  // D-04b: sin sesión, nunca (ni se consulta). Con sesión, la base decide; la
  // lectura va en paralelo (una sola espera) y la RLS ya devuelve solo lo
  // permitido. La fecha de alta y la visibilidad solo se leen con sesión
  // (anon no tiene permiso sobre esas columnas, F-02).
  let canRead = false
  let showcase: LibraryShowcase | null = null
  // «Sala»: la escala de notas del dueño (la de `/u/…/r/…`) y los avisos sin
  // leer de la barra de la app, en la misma espera.
  let scale: ShareScale = 'stars'
  let unreadCount = 0
  let salaMarca = false
  if (viewer) {
    const [blocked, allowed, data, details, salaExtra] = await Promise.all([
      viewerBlockedWith(supabase, viewer.id, owner.id),
      isOwner ? Promise.resolve(true) : viewerCanReadLibrary(supabase, owner.id),
      getLibraryShowcase(supabase, owner.id).catch(() => null),
      getOwnerDetails(supabase, owner.id).catch(() => null),
      sala
        ? Promise.all([
            isOwner ? Promise.resolve(readRatingScale(session?.user)) : ownerShareScale(owner.id),
            session?.profile ? getUnreadCount(viewer.id).catch(() => 0) : Promise.resolve(0),
            salaMarcaEnabled(),
          ])
        : Promise.resolve(null),
    ])
    // Con un bloqueo entre los dos: nada del dueño salvo la cabecera.
    canRead = allowed && !blocked
    showcase = canRead ? data : null
    if (blocked) lists = []
    if (details) owner = { ...owner, ...details }
    if (salaExtra) [scale, unreadCount, salaMarca] = salaExtra
  }

  const t = await getTranslations('collection')
  const tm = await getTranslations('media')
  const tl = await getTranslations('lists')
  // F-25: una lista mixta no tiene formato en `media`; su grupo va al final.
  const formatName = (format: string) => (format in PLURAL_KEY ? tm(PLURAL_KEY[format as MediaType]) : tl('mediaTypeMixed'))

  // D-12: el alta desde este perfil lleva la atribución de la visita; sin
  // `ref`, se atribuye a este perfil (sin firma: no crea amistad).
  const attribution = parseAttributionRecord(sp)
  const refIsOwner = attribution.ref?.toLowerCase() === owner.username.toLowerCase()
  const friendsOnSignup = refIsOwner && isValidInviteSignature(owner.id, attribution.ref, attribution.inv)
  const signupAttribution: AttributionParams = attribution.ref
    ? attribution
    : { ...attribution, ref: owner.username, channel: attribution.utm_source ? 'utm' : 'ref' }
  const registerHref = withAttribution('/login?mode=register', signupAttribution)
  const loginHref = withAttribution('/login?mode=login', signupAttribution)

  if (sala) {
    return (
      <SalaPublicCollection
        locale={locale}
        owner={owner}
        lists={lists}
        chrome={session?.user ? { user: session.user, profile: session.profile, unreadCount, sala: salaMarca } : null}
        isOwner={isOwner}
        showcase={canRead ? showcase : null}
        scale={scale}
        invite={!viewer && refIsOwner ? { friendsOnSignup } : null}
        registerHref={registerHref}
        loginHref={loginHref}
      />
    )
  }

  // REN-6: prioridad solo para la PRIMERA fila de pósters reales de la página.
  const firstPosters: 'favorites' | 'watching' | 'lists' =
    showcase && showcase.favorites.length > 0 ? 'favorites' : showcase && showcase.watching.length > 0 ? 'watching' : 'lists'

  return (
    <div className="min-h-screen flex flex-col">
      {viewer ? <SignedInBar /> : <Header />}
      <main id="main" className="page-grid [&>*]:max-w-4xl flex-1 py-10 flex flex-col gap-10 md:gap-12">
        {!viewer && refIsOwner ? (
          <InviteBanner username={owner.username} friendsOnSignup={friendsOnSignup} registerHref={registerHref} />
        ) : null}

        <CollectionOwner
          owner={owner}
          actions={<OwnerActions owner={owner} locale={locale} viewer={viewer} isOwner={isOwner} />}
        />

        {isOwner ? <OwnerNote owner={owner} /> : null}

        {/* Biblioteca (D-04b) */}
        {canRead && showcase ? (
          <>
            <FormatCounters showcase={showcase} />
            <FavoritesGrid favorites={showcase.favorites} isOwner={isOwner} priority={firstPosters === 'favorites'} />
            <WatchingRow items={showcase.watching} priorityCount={firstPosters === 'watching' ? PRIORITY_POSTERS : 0} />
          </>
        ) : (
          <HiddenLibrary
            owner={owner}
            signedIn={Boolean(viewer)}
            registerHref={registerHref}
            loginHref={loginHref}
          />
        )}

        {/* Listas públicas: las ve cualquiera */}
        <section aria-labelledby="lists-title" className="flex flex-col gap-6">
          <h2 id="lists-title" className="font-display text-xl md:text-2xl font-extrabold text-text-primary">
            {t('publicLists')}
          </h2>
          {lists.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-bento bg-surface-default px-6 py-7">
              <p className="font-bold text-text-primary">
                {isOwner ? t('emptyOwn') : t('empty', { username: owner.username })}
              </p>
              <p className="text-sm text-text-tertiary">{isOwner ? t('emptyOwnHint') : t('emptyHint')}</p>
              {isOwner ? (
                <KButton asChild variant="secondary" size="sm" className="mt-2">
                  <Link href="/lists">{t('emptyOwnAction')}</Link>
                </KButton>
              ) : null}
            </div>
          ) : (
            groupByFormat(lists).map(([format, group], groupIndex) => (
              <section key={format} className="flex flex-col gap-6" aria-label={formatName(format)}>
                <div>
                  <FormatLabel>{formatName(format)}</FormatLabel>
                </div>
                {group.map((list, i) => (
                  <PublicListRow
                    key={list.id}
                    list={list}
                    username={owner.username}
                    priorityCount={firstPosters === 'lists' && groupIndex === 0 && i === 0 ? PRIORITY_POSTERS : 0}
                  />
                ))}
              </section>
            ))
          )}
        </section>

        {!viewer ? <SignUpCta href={registerHref} /> : null}

        {/* DSA: denunciar sin cuenta lleva al formulario público (F-11) */}
        {!viewer ? (
          <p className="text-center">
            <Link
              href={`/report?target=user&id=${encodeURIComponent(owner.username)}`}
              className="inline-flex items-center min-h-11 text-meta text-text-tertiary underline-offset-4 hover:underline hover:text-text-primary"
            >
              {t('reportProfile')}
            </Link>
          </p>
        ) : null}
      </main>
      <Footer />
    </div>
  )
}

/** Quién ve la biblioteca del dueño, con enlace a Ajustes (solo lo ve él). */
async function OwnerNote({ owner }: { owner: PublicOwner }) {
  const t = await getTranslations('collection')
  const ts = await getTranslations('settings')
  // Sin la columna rige la política de W1: cualquiera con sesión.
  const visibility = owner.libraryVisibility ?? 'public'
  return (
    <p className="-mt-4 text-meta text-text-secondary">
      {t('ownerNote', { visibility: ts(`visibility.${visibility}`) })}{' '}
      {visibility === 'public' ? `${t('ownerNoteNoAccount')} ` : null}
      {/* Área táctil de 44 px (py-3) sin abrir hueco entre líneas (-my-3). */}
      <Link
        href="/settings"
        className="inline-flex items-center py-3 -my-3 align-baseline font-bold text-text-primary underline-offset-4 hover:underline"
      >
        {t('ownerSettings')}
      </Link>
    </p>
  )
}

/** La biblioteca no es visible para quien mira: por qué y qué puede hacer. */
async function HiddenLibrary({
  owner,
  signedIn,
  registerHref,
  loginHref,
}: {
  owner: PublicOwner
  signedIn: boolean
  registerHref: string
  loginHref: string
}) {
  const t = await getTranslations('collection')
  const tp = await getTranslations('profile')
  const hiddenTitle = tp('libraryHidden', { username: owner.username })
  if (owner.libraryVisibility === 'private') {
    return <LockedLibrary title={hiddenTitle} text={tp('libraryHiddenPrivate')} />
  }
  if (signedIn) {
    // Con sesión y sin permiso: solo amigos (o la base no lo confirmó). El
    // botón para ir a su perfil y añadirle ya está en la cabecera.
    return <LockedLibrary title={hiddenTitle} text={tp('libraryHiddenFriends')} />
  }
  const ctas = (
    <>
      <KButton asChild size="sm">
        <Link href={registerHref}>{t('ctaButton')}</Link>
      </KButton>
      <KButton asChild variant="secondary" size="sm">
        <Link href={loginHref}>{t('signIn')}</Link>
      </KButton>
    </>
  )
  // Sin sesión no se sabe quién puede verla (la visibilidad no es pública):
  // se explica que hace falta cuenta y que decide su dueño.
  return (
    <LockedLibrary title={t('lockedTitle', { username: owner.username })} text={t('lockedText')}>
      {ctas}
    </LockedLibrary>
  )
}

/** Acciones de la cabecera según quién mira. */
async function OwnerActions({
  owner,
  locale,
  viewer,
  isOwner,
}: {
  owner: PublicOwner
  locale: string
  viewer: Viewer
  isOwner: boolean
}) {
  const tp = await getTranslations('profile')
  const t = await getTranslations('collection')
  if (isOwner) {
    return (
      <>
        <InviteLinkButton path={invitePath(locale, owner)} />
        <KButton asChild variant="secondary" size="sm">
          <Link href="/settings">{tp('editProfile')}</Link>
        </KButton>
      </>
    )
  }
  if (viewer) {
    return (
      <>
        <KButton asChild variant="secondary" size="sm">
          <Link href={`/profile/${encodeURIComponent(owner.username)}`}>{t('openProfile')}</Link>
        </KButton>
        <ReportButton targetType="user" targetId={owner.id} />
      </>
    )
  }
  return null
}
