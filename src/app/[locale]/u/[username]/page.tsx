// ============================================================
// KULTURA — /u/[username] (Server Component, PÚBLICA)
// Colección compartible tipo "linktree": las listas públicas de un usuario,
// agrupadas por formato, visibles sin cuenta. Vive FUERA de `(app)` a
// propósito: ese grupo redirige a login a quien no tiene sesión.
// ============================================================

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import {
  CollectionOwner,
  FormatLabel,
  PublicListRow,
  SignUpCta,
} from '@/components/collection/PublicCollection'
import { getPublicCollection, type PublicList } from '@/lib/social/public-collection'
import type { MediaType } from '@/types/media'

interface Props {
  params: Promise<{ locale: string; username: string }>
}

/** Clave plural de `media` para cada formato ("movies", "tvs"…). */
const PLURAL_KEY: Record<MediaType, string> = {
  movie: 'movies', tv: 'tvs', anime: 'animes', manga: 'mangas',
  book: 'books', comic: 'comics', game: 'games',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const username = decodeURIComponent((await params).username)
  const t = await getTranslations('collection')
  const title = t('metaTitle', { username })
  const description = t('metaDescription', { username })
  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
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

export default async function PublicCollectionPage({ params }: Props) {
  const { username } = await params
  const collection = await getPublicCollection(decodeURIComponent(username))
  if (!collection) notFound()

  const t = await getTranslations('collection')
  const tm = await getTranslations('media')
  const { owner, lists } = collection

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-10 flex flex-col gap-12">
        <CollectionOwner owner={owner} />

        {lists.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-bold text-text-primary">{t('empty', { username: owner.username })}</p>
            <p className="text-sm text-text-tertiary">{t('emptyHint')}</p>
          </div>
        ) : (
          groupByFormat(lists).map(([format, group]) => (
            <section key={format} className="flex flex-col gap-6" aria-label={tm(PLURAL_KEY[format])}>
              <div>
                <FormatLabel>{tm(PLURAL_KEY[format])}</FormatLabel>
              </div>
              {group.map((list) => (
                <PublicListRow key={list.id} list={list} username={owner.username} />
              ))}
            </section>
          ))
        )}

        <SignUpCta />
      </main>
      <Footer />
    </div>
  )
}
