// ============================================================
// KULTURA — /u/[username]/l/[id] (Server Component, PÚBLICA)
// Una lista pública en solo lectura, como página impresa del álbum: la
// cabecera en el campo amarillo (formato, nombre, quién la hace y cuántos
// títulos tiene) y debajo la página con sus cromos en el orden del dueño.
// 404 si no es pública o no es de `username` (así un enlace no sirve para
// adivinar listas privadas). Un nombre antiguo redirige (308) al actual
// (R11), y se puede denunciar (D-13): con sesión, el botón de F-11; sin
// ella, el formulario público.
//
// Página de aterrizaje: la lista entera se lee sin cuenta y hay UNA acción
// fija al pie («Haz tu propia lista, gratis») que vuelve aquí tras el alta.
//
// F-25 (MIXED_LISTS): los títulos salen en el orden que eligió el dueño, con
// sus notas y la descripción; un «Ranking personal» pinta el número. Esos
// datos se piden EN PARALELO con la lista (solo por id) y solo se usan si la
// lista resulta ser pública y de `username`. Sin ellos, el orden de llegada.
// ============================================================

import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Footer } from '@/components/layout/Footer'
import { Avatar } from '@/components/ui/Avatar'
import { AlbumPage } from '@/components/album/AlbumPage'
import { FormatLabel, PublicBar, SignUpCta } from '@/components/collection/PublicCollection'
import { ReportButton } from '@/components/social/ReportButton'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { isModerationV2 } from '@/lib/social/friends'
import { siteUrl } from '@/lib/site-url'
import { getPublicList, resolveRenamedUsername, usernameExists } from '@/lib/social/public-collection'
import { getPublicListExtras, sortListItems } from '@/lib/social/lists'
import { OrderedListGrid, type OrderedListEntry } from '@/components/collection/OrderedListGrid'
import type { MediaItem, MediaType } from '@/types/media'

interface Props {
  params: Promise<{ locale: string; username: string; id: string }>
}

const SINGULAR_KEY: Record<string, MediaType> = {
  movie: 'movie', tv: 'tv', anime: 'anime', manga: 'manga',
  book: 'book', comic: 'comic', game: 'game',
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username, id } = await params
  const name = decodeName(username)
  const t = await getTranslations({ locale, namespace: 'collection' })
  const data = await getPublicList(name, id).catch(() => null)
  const title = data ? t('listMetaTitle', { list: data.list.name, username: name }) : t('metaTitle', { username: name })
  const ogTitle = `${title} · KULTURA`
  const description = data
    ? t('listMetaDescription', { username: name, count: data.list.items.length })
    : t('metaDescription', { username: name })
  const path = `/${locale}/u/${encodeURIComponent(name)}/l/${encodeURIComponent(id)}`
  return {
    title,
    description,
    alternates: { canonical: path },
    // Una lista con menos de 5 títulos es contenido fino (SEO-3).
    robots: data && data.list.items.length >= 5 ? undefined : { index: false, follow: true },
    openGraph: { title: ogTitle, description, url: `${siteUrl()}${path}`, siteName: 'KULTURA' },
    twitter: { card: 'summary_large_image', title: ogTitle, description },
  }
}

export default async function PublicListPage({ params }: Props) {
  const { locale, username, id } = await params
  const name = decodeName(username)
  const [data, extras] = await Promise.all([
    getPublicList(name, id),
    getPublicListExtras(id).catch(() => null),
  ])
  if (!data) {
    // R11: el enlace se compartió con un nombre que ya no existe → al actual.
    if (!(await usernameExists(name))) {
      const current = await resolveRenamedUsername(name)
      if (current) permanentRedirect(`/${locale}/u/${encodeURIComponent(current)}/l/${encodeURIComponent(id)}`)
    }
    notFound()
  }

  const supabase = await createClient()
  const signedIn = await supabase.auth
    .getUser()
    .then(({ data: auth }) => Boolean(auth.user))
    .catch(() => false)

  const t = await getTranslations('collection')
  const tm = await getTranslations('media')
  const tl = await getTranslations('lists')
  const { owner, list } = data
  const toMediaItem = (item: (typeof list.items)[number]): MediaItem => ({
    id: item.mediaId,
    externalId: item.mediaId.split('_').slice(1).join('_'),
    type: item.type as MediaType,
    title: item.title,
    poster: item.poster ?? undefined,
    year: item.year,
  })
  // Orden del dueño (F-25); sin los extras, el de llegada (`getPublicList`
  // las trae por fecha, la más reciente primero).
  const entries: OrderedListEntry[] = extras
    ? sortListItems(
        list.items.map((item) => ({
          entry: { item: toMediaItem(item), note: extras.items.get(item.mediaId)?.note ?? null },
          position: extras.items.get(item.mediaId)?.position ?? null,
        })),
      ).map(({ entry }) => entry)
    : list.items.map((item) => ({ item: toMediaItem(item), note: null }))
  const format = SINGULAR_KEY[list.mediaType]
  const formatLabel = format ? tm(format) : tl('mediaTypeMixed')

  // D-12: el alta se atribuye a quien hizo la lista y vuelve a esta página.
  const pagePath = `/${locale}/u/${encodeURIComponent(owner.username)}/l/${encodeURIComponent(list.id)}`
  const registerHref = `/login?mode=register&next=${encodeURIComponent(pagePath)}&ref=${encodeURIComponent(owner.username)}`

  return (
    <AlbumPage as="div" contained={false} className="flex min-h-screen flex-col">
      <PublicBar locale={locale} signedIn={signedIn} returnTo={pagePath} />
      <main id="main" className="flex-1">
        <AlbumPage as="header" tone="yellow" className="border-b-2 border-album-navy">
          <div className="flex flex-col gap-4 py-8 md:py-12">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-text-primary">
              <FormatLabel format={format}>{formatLabel}</FormatLabel>
              {extras?.template ? <span>{tl(`template.${extras.template}`)}</span> : null}
              <span className="tabular-nums">{t('items', { count: list.items.length })}</span>
            </p>
            <h1 className="max-w-4xl break-words font-display text-3xl text-text-primary text-balance [overflow-wrap:anywhere] md:text-5xl">
              {list.name}
            </h1>
            <Link
              href={`/u/${encodeURIComponent(owner.username)}`}
              className={`group inline-flex min-h-11 items-center gap-3 self-start rounded-lg text-sm text-text-primary ${FOCUS}`}
            >
              <Avatar
                initials={owner.avatarInitials}
                color={owner.avatarColor}
                icon={owner.avatarIcon}
                size="sm"
                className="shrink-0 rounded-cromo border-2 border-album-white"
              />
              <span className="min-w-0 break-words underline-offset-4 group-hover:underline">
                {t.rich('listOwnerLine', {
                  username: owner.username,
                  who: (chunks) => <strong className="font-bold">{chunks}</strong>,
                })}
              </span>
            </Link>
            {extras?.description ? (
              <p className="max-w-2xl whitespace-pre-line break-words text-base text-text-primary">{extras.description}</p>
            ) : null}
          </div>
        </AlbumPage>

        <div className="page-grid flex flex-col gap-10 py-8 md:py-12">
          <OrderedListGrid
            entries={entries}
            ranked={extras?.template === 'ranking'}
            label={list.name}
            showFormat={!format}
          />

          {/* D-13: denunciar la lista (con sesión, el botón; sin ella, el formulario público) */}
          <div>
            {signedIn ? (
              isModerationV2() ? <ReportButton targetType="list" targetId={list.id} /> : null
            ) : (
              <Link
                href={`/report?target=list&id=${encodeURIComponent(list.id)}`}
                className={`inline-flex min-h-11 items-center rounded-lg text-meta text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline ${FOCUS}`}
              >
                {t('reportList')}
              </Link>
            )}
          </div>
        </div>
      </main>
      {signedIn ? null : <SignUpCta href={registerHref} label={t('ctaListButton')} />}
      <Footer />
    </AlbumPage>
  )
}
