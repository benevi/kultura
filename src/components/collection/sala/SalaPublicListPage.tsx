// ============================================================
// KULTURA — /u/[username]/l/[id] en «Sala» (fase 8.5 L5, bandera SALA_LISTAS)
// Monta la lista pública (`SalaPublicListLazy`) con los textos ya traducidos
// y, con sesión, la barra de la app (`AppChromeLazy`, como `/u` en P3 y la
// nota pública en P4). Sin sesión, la cabecera pública y una sola llamada a
// registrarse. Los datos (lista, orden, notas, bloqueo) los resuelve la
// página: aquí no se pide nada más.
// ============================================================

import type { User } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { AppChromeLazy } from '@/components/layout/AppChromeLazy'
import { AppFooter } from '@/components/layout/AppFooter'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SignedInBar } from '@/components/collection/PublicCollection'
import { ReportButton } from '@/components/social/ReportButton'
import { SalaLink } from '@/components/sala/SalaLink'
import { SalaPublicListLazy } from '@/components/lists/sala/SalaPublicListLazy'
import type { SalaPublicListEntry } from '@/components/lists/sala/SalaPublicList'
import { ClientMessages } from '@/i18n/ClientMessages'
import { PUBLIC_PROFILE_CLIENT_NAMESPACES, SHELL_CLIENT_NAMESPACES } from '@/i18n/client-messages'
import { isDemoUser } from '@/lib/demo'
import type { ViewerProfile } from '@/lib/media/viewer'
import type { PublicCollectionItem, PublicList, PublicOwner } from '@/lib/social/public-collection'
import type { ListTemplate } from '@/types/list'
import type { MediaType } from '@/types/media'

export interface SalaPublicListPageProps {
  locale: string
  owner: PublicOwner
  list: PublicList
  /** Los títulos en el orden del dueño, con su nota (F-25). */
  entries: Array<{ item: PublicCollectionItem; note: string | null }>
  description: string | null
  template: ListTemplate | null
  /** Con sesión y perfil: la barra de la app. Con sesión sin perfil (alta a medias): la barra de hoy. */
  chrome: { user: User; profile: ViewerProfile | null; unreadCount: number } | null
  registerHref: string
}

function mediaHref(item: PublicCollectionItem): string {
  return `/media/${item.type}/${item.mediaId.split('_').slice(1).join('_')}`
}

export async function SalaPublicListPage({
  locale,
  owner,
  list,
  entries,
  description,
  template,
  chrome,
  registerHref,
}: SalaPublicListPageProps) {
  const [t, tl, tType, tc] = await Promise.all([
    getTranslations({ locale, namespace: 'collection' }),
    getTranslations({ locale, namespace: 'lists' }),
    getTranslations({ locale, namespace: 'discoverFilters.typeBadge' }),
    getTranslations({ locale, namespace: 'common' }),
  ])
  const signedIn = chrome !== null
  const min = (s: string) => s.toLocaleLowerCase(locale)
  const format = (list.mediaType as string) === 'mixed' ? tl('mediaTypeMixed') : tType(list.mediaType)
  const facts = [
    min(format),
    template ? min(tl(`template.${template}`)) : null,
    t('items', { count: list.items.length }),
  ].filter((x): x is string => Boolean(x))

  const items: SalaPublicListEntry[] = entries.map(({ item, note }) => ({
    mediaId: item.mediaId,
    href: mediaHref(item),
    title: item.title,
    format: item.type as MediaType,
    formatLabel: tType(item.type),
    year: item.year,
    poster: item.poster,
    note,
  }))

  const report = signedIn ? (
    <ReportButton targetType="list" targetId={list.id} contextLabel={list.name} skin="sala" closeLabel={tc('close')} triggerClassName="-ms-6" />
  ) : (
    <SalaLink variant="standalone" href={`/report?target=list&id=${encodeURIComponent(list.id)}`}>
      {t('reportList')}
    </SalaLink>
  )

  const content = (
    <SalaPublicListLazy
      name={list.name}
      facts={facts}
      owner={{
        username: owner.username,
        avatarColor: owner.avatarColor,
        avatarInitials: owner.avatarInitials,
        avatarIcon: owner.avatarIcon,
        label: tl('sala.by', { username: owner.username }),
        href: `/u/${encodeURIComponent(owner.username)}`,
      }}
      description={description}
      ranked={template === 'ranking'}
      entries={items}
      labels={{ items: tl('itemsTitle'), empty: tl('noItems'), loading: tc('loading') }}
      report={report}
      cta={signedIn ? null : { title: t('ctaTitle'), text: t('ctaText'), button: t('ctaButton'), href: registerHref }}
    />
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
