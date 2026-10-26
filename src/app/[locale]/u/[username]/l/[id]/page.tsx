// ============================================================
// KULTURA — /u/[username]/l/[id] (Server Component, PÚBLICA)
// Una lista pública en solo lectura. 404 si no es pública o no es de
// `username` (así un enlace no sirve para adivinar listas privadas). Un
// nombre antiguo redirige (308) al actual (R11), y se puede denunciar
// (D-13): con sesión, el botón de F-11; sin ella, el formulario público.
//
// F-25 (MIXED_LISTS): los títulos salen en el orden que eligió el dueño, con
// sus notas y la descripción; un «Ranking personal» pinta el número. Esos
// datos se piden EN PARALELO con la lista (solo por id) y solo se usan si la
// lista resulta ser pública y de `username`.
// ============================================================

import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Avatar } from '@/components/ui/Avatar'
import { MediaGrid } from '@/components/media/MediaGrid'
import { FormatLabel, SignedInBar, SignUpCta } from '@/components/collection/PublicCollection'
import { ReportButton } from '@/components/social/ReportButton'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { isModerationV2 } from '@/lib/social/friends'
import { siteUrl } from '@/lib/site-url'
import { getPublicList, resolveRenamedUsername, usernameExists } from '@/lib/social/public-collection'
import { getPublicListExtras, sortListItems } from '@/lib/social/lists'
import { OrderedListGrid } from '@/components/collection/OrderedListGrid'
import type { MediaItem, MediaType } from '@/types/media'

interface Props {
  params: Promise<{ locale: string; username: string; id: string }>
}

const SINGULAR_KEY: Record<string, string> = {
  movie: 'movie', tv: 'tv', anime: 'anime', manga: 'manga',
  book: 'book', comic: 'comic', game: 'game',
}

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
  const title = data ? `${data.list.name} · ${name}` : t('metaTitle', { username: name })
  const ogTitle = `${title} · KULTURA`
  const description = t('listMetaDescription', { username: name })
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
  const gridItems: MediaItem[] = list.items.map(toMediaItem)
  // Orden del dueño (F-25); `getPublicList` las trae por fecha.
  const ordered = extras
    ? sortListItems(
        list.items.map((item) => ({
          entry: { item: toMediaItem(item), note: extras.items.get(item.mediaId)?.note ?? null },
          position: extras.items.get(item.mediaId)?.position ?? null,
        })),
      ).map(({ entry }) => entry)
    : null
  const formatLabel = SINGULAR_KEY[list.mediaType] ? tm(SINGULAR_KEY[list.mediaType]) : tl('mediaTypeMixed')

  return (
    <div className="min-h-screen flex flex-col">
      {signedIn ? <SignedInBar /> : <Header />}
      <main id="main" className="page-grid [&>*]:max-w-4xl flex-1 py-10 flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <div>
            <FormatLabel>{formatLabel}</FormatLabel>
            {extras?.template ? (
              <span className="ml-2 text-meta font-bold text-text-tertiary">{tl(`template.${extras.template}`)}</span>
            ) : null}
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-text-primary leading-tight">
            {list.name}
          </h1>
          <Link
            href={`/u/${owner.username}`}
            className="self-start flex items-center gap-3 text-meta text-text-tertiary hover:text-text-primary"
          >
            <Avatar initials={owner.avatarInitials} color={owner.avatarColor} icon={owner.avatarIcon} size="sm" />
            <span>
              <span className="font-semibold text-text-primary">{owner.username}</span>
              {' · '}
              {t('items', { count: list.items.length })}
              {' · '}
              {t('backToCollection')}
            </span>
          </Link>
          {extras?.description ? (
            <p className="max-w-2xl text-body leading-relaxed text-text-secondary whitespace-pre-line break-words">
              {extras.description}
            </p>
          ) : null}
        </header>

        {ordered ? (
          <OrderedListGrid entries={ordered} ranked={extras?.template === 'ranking'} label={list.name} />
        ) : (
          <MediaGrid items={gridItems} requirePoster={false} />
        )}

        {signedIn ? null : <SignUpCta href={`/login?mode=register&ref=${encodeURIComponent(owner.username)}`} />}

        {/* D-13: denunciar la lista (con sesión, el botón; sin ella, el formulario público) */}
        <div className="flex justify-center">
          {signedIn ? (
            isModerationV2() ? <ReportButton targetType="list" targetId={list.id} /> : null
          ) : (
            <Link
              href={`/report?target=list&id=${encodeURIComponent(list.id)}`}
              className="inline-flex items-center min-h-11 text-meta text-text-tertiary underline-offset-4 hover:underline hover:text-text-primary"
            >
              {t('reportList')}
            </Link>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
