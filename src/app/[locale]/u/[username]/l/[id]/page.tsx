// ============================================================
// KULTURA — /u/[username]/l/[id] (Server Component, PÚBLICA)
// Una lista pública en solo lectura. 404 si no es pública o no es de
// `username` (así un enlace no sirve para adivinar listas privadas; un
// nombre antiguo tampoco lleva al actual, Q8). Se puede denunciar (D-13):
// con sesión, el botón de F-11; sin ella, el formulario público.
//
// F-25: los títulos salen en el orden que eligió el dueño, con
// sus notas y la descripción; un «Ranking personal» pinta el número. Esos
// datos se piden EN PARALELO con la lista (solo por id) y solo se usan si la
// lista resulta ser pública y de `username`.
//
// Bloqueos: con sesión, si hay un bloqueo en cualquier sentido entre quien
// mira y el dueño, 404 (como una lista que no existe), también en los
// metadatos (el nombre de la lista no sale en `<title>`). La lista es todo
// dato del dueño: no hay versión genérica como en `/u/…/r/…`.
//
// Fase 8.5 L5: con `SALA_LISTAS` la página sale en «Sala»
// (`SalaPublicListPage`). Con la bandera en `1` se decide sin leer cookies;
// en `prueba`, con la cookie de prueba (la página ya es dinámica: lee la
// sesión). Con `0`, el HTML de siempre. Los mismos datos, el mismo 404 con
// bloqueo y los mismos metadatos en las dos ramas; los miembros de una
// colaborativa no salen en ninguna (#322).
// ============================================================

import * as React from 'react'
import { notFound } from 'next/navigation'
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
import { siteUrl } from '@/lib/site-url'
import { getPublicList } from '@/lib/social/public-collection'
import { viewerBlockedWith } from '@/lib/social/block-check'
import { getPublicListExtras, sortListItems } from '@/lib/social/lists'
import { OrderedListGrid } from '@/components/collection/OrderedListGrid'
import type { MediaItem, MediaType } from '@/types/media'
import { salaListasEnabled } from '@/lib/flags/sala'
import { getViewer } from '@/lib/media/viewer'
import { getUnreadCount } from '@/lib/social/notifications'
import { SalaPublicListPage } from '@/components/collection/sala/SalaPublicListPage'

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

// `React.cache` solo existe en el servidor de React; en los tests, sin caché.
const cache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn)

/**
 * Quién mira (sin sesión: `null`; nunca lanza). Una vez por petición. Con
 * «Sala», la sesión sale de `getViewer` (con el perfil que pinta la barra).
 */
const currentViewer = cache(async (): Promise<{ id: string } | null> => {
  try {
    if (await salaListasEnabled()) {
      const { user } = await getViewer()
      return user ? { id: user.id } : null
    }
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user ? { id: data.user.id } : null
  } catch {
    return null
  }
})

/**
 * La lista pública de `username`, o `null` si no lo es o si hay un bloqueo
 * entre quien mira y el dueño. Una vez por petición (metadatos y página).
 */
const loadVisibleList = cache(async (name: string, id: string) => {
  const [data, viewer] = await Promise.all([getPublicList(name, id), currentViewer()])
  if (!data) return { data: null, viewer }
  const blocked = viewer ? await viewerBlockedWith(await createClient(), viewer.id, data.owner.id) : false
  return { data: blocked ? null : data, viewer }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username, id } = await params
  const name = decodeName(username)
  const t = await getTranslations({ locale, namespace: 'collection' })
  const data = await loadVisibleList(name, id)
    .then((r) => r.data)
    .catch(() => null)
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
  const [{ data, viewer }, extras] = await Promise.all([
    loadVisibleList(name, id),
    getPublicListExtras(id).catch(() => null),
  ])
  // Un nombre antiguo es un 404 más (Q8): no lleva al nombre actual. Con un
  // bloqueo entre quien mira y el dueño, también.
  if (!data) notFound()
  const signedIn = Boolean(viewer)

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
  if (await salaListasEnabled()) {
    const session = viewer ? await getViewer() : null
    const unreadCount = session?.user && session.profile ? await getUnreadCount(session.user.id).catch(() => 0) : 0
    const entries = extras
      ? sortListItems(
          list.items.map((item) => ({
            entry: { item, note: extras.items.get(item.mediaId)?.note ?? null },
            position: extras.items.get(item.mediaId)?.position ?? null,
          })),
        ).map(({ entry }) => entry)
      : list.items.map((item) => ({ item, note: null }))
    return (
      <SalaPublicListPage
        locale={locale}
        owner={owner}
        list={list}
        entries={entries}
        description={extras?.description ?? null}
        template={extras?.template ?? null}
        chrome={session?.user ? { user: session.user, profile: session.profile, unreadCount } : null}
        registerHref={`/login?mode=register&ref=${encodeURIComponent(owner.username)}`}
      />
    )
  }

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
            <ReportButton targetType="list" targetId={list.id} />
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
