// ============================================================
// KULTURA — /u/[username]/l/[id] (Server Component, PÚBLICA)
// Una lista pública en solo lectura. 404 si no es pública o no es de
// `username` (así un enlace no sirve para adivinar listas privadas).
// ============================================================

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Avatar } from '@/components/ui/Avatar'
import { MediaGrid } from '@/components/media/MediaGrid'
import { FormatLabel, SignUpCta } from '@/components/collection/PublicCollection'
import { Link } from '@/i18n/navigation'
import { getPublicList } from '@/lib/social/public-collection'
import type { MediaItem, MediaType } from '@/types/media'

interface Props {
  params: Promise<{ locale: string; username: string; id: string }>
}

const SINGULAR_KEY = {
  movie: 'movie', tv: 'tv', anime: 'anime', manga: 'manga',
  book: 'book', comic: 'comic', game: 'game',
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, id } = await params
  const name = decodeURIComponent(username)
  const t = await getTranslations('collection')
  const data = await getPublicList(name, id).catch(() => null)
  const title = data ? `${data.list.name} · ${name} · KULTURA` : t('metaTitle', { username: name })
  const description = t('listMetaDescription', { username: name })
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PublicListPage({ params }: Props) {
  const { username, id } = await params
  const data = await getPublicList(decodeURIComponent(username), id)
  if (!data) notFound()

  const t = await getTranslations('collection')
  const tm = await getTranslations('media')
  const { owner, list } = data
  const gridItems: MediaItem[] = list.items.map((item) => ({
    id: item.mediaId,
    externalId: item.mediaId.split('_').slice(1).join('_'),
    type: item.type as MediaType,
    title: item.title,
    poster: item.poster ?? undefined,
    year: item.year,
  }))

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-10 flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <div>
            <FormatLabel>{tm(SINGULAR_KEY[list.mediaType])}</FormatLabel>
          </div>
          <h1 className="font-display text-[30px] md:text-[38px] font-bold tracking-tight text-text-primary leading-tight">
            {list.name}
          </h1>
          <Link
            href={`/u/${owner.username}`}
            className="self-start flex items-center gap-3 text-[13px] text-text-tertiary hover:text-text-primary"
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
        </header>

        <MediaGrid items={gridItems} requirePoster={false} />

        <SignUpCta />
      </main>
      <Footer />
    </div>
  )
}
