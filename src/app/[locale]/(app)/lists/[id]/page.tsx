// ============================================================
// KULTURA — /lists/[id] (Server Component)
// Detalle de lista: título, items, miembros.
// Los miembros de una colaborativa solo los ven (y solo se mandan a) su
// dueño y sus miembros: una lista pública ajena llega sin ellos.
// ============================================================

import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getListDetail, canEditList } from '@/lib/social/lists'
import { getFriends } from '@/lib/social/friends'
import { ListDetail } from './ListDetail'
import { canSeeListMembers, publicListPath } from './list-detail-utils'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { salaListasEnabled } from '@/lib/flags/sala'
import { SalaListDetailLazy } from '@/components/lists/sala/SalaListDetailLazy'

// La pestaña y la página piden la misma lista: una sola consulta por petición.
const getDetail = cache(getListDetail)

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const detail = await getDetail(id).catch(() => null)
  if (detail) return { title: detail.list.name }
  const t = await getTranslations('lists')
  return { title: t('metaFallback') }
}

export default async function ListDetailPage({ params }: Props) {
  const { locale, id } = await params
  const supabase = await createClient()

  // Fase 8.5 L3: la ficha en «Sala» (bandera SALA_LISTAS). Apagada, como hoy.
  if (await salaListasEnabled()) return salaListDetail(supabase, locale, id)

  const { data: { user } } = await supabase.auth.getUser()

  const detail = await getDetail(id)
  if (!detail) notFound()

  const { list, items } = detail
  const members = canSeeListMembers(list, detail.members, user?.id) ? detail.members : []

  const canEdit = user ? await canEditList(id, user.id) : false

  let friends: Array<{ id: string; username: string; avatarColor: string; avatarInitials: string }> = []
  if (user) {
    const friendships = await getFriends(user.id)
    friends = friendships
      .map((f) => f.otherUser)
      .filter((u): u is NonNullable<typeof u> => u !== undefined)
      .map((u) => ({ id: u.id, username: u.username, avatarColor: u.avatarColor, avatarInitials: u.avatarInitials }))
  }

  return (
    <main className="page-grid [&>*]:max-w-4xl py-8">
      <ListDetail
        list={list}
        items={items}
        members={members}
        currentUserId={user?.id ?? ''}
        currentUserFriends={friends}
        canEdit={canEdit}
      />
    </main>
  )
}

/**
 * La ficha en «Sala» (L3). Es la página de trabajo de la lista: su dueño y
 * sus miembros. A los demás, si la lista es pública, se les lleva a su página
 * pública (`/u/…/l/…`), que es la que les toca; si no, no existe para ellos.
 * Puede editar el dueño, o un miembro si es colaborativa (lo mismo que
 * `canEditList`, con los miembros que ya llegan). Los amigos, solo para quien
 * puede invitar: el dueño de una colaborativa.
 */
async function salaListDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locale: string,
  id: string,
) {
  const [{ data: { user } }, detail] = await Promise.all([supabase.auth.getUser(), getDetail(id)])
  if (!detail) notFound()

  const { list, items } = detail
  const isOwner = !!user && user.id === list.ownerId
  const isMember = !!user && detail.members.some((m) => m.userId === user.id)
  if (!user || (!isOwner && !isMember)) {
    const publicPath = list.isPublic ? publicListPath(list) : null
    if (publicPath) redirect(`/${locale}${publicPath}`)
    notFound()
  }

  const canEdit = isOwner || (list.isCollaborative && isMember)
  const [friendships, tMedia] = await Promise.all([
    isOwner && list.isCollaborative ? getFriends(user.id) : Promise.resolve([]),
    getTranslations('media_detail'),
  ])
  const friends = friendships
    .map((f) => f.otherUser)
    .filter((u): u is NonNullable<typeof u> => u !== undefined)
    .map((u) => ({ id: u.id, username: u.username, avatarColor: u.avatarColor, avatarInitials: u.avatarInitials }))

  return (
    <SalaListDetailLazy
      list={list}
      items={items}
      members={detail.members}
      currentUserId={user.id}
      currentUserFriends={friends}
      canEdit={canEdit}
      toastLabels={{
        region: tMedia('salaToastRegion'),
        dismiss: tMedia('salaToastDismiss'),
        hint: tMedia('salaToastHint'),
      }}
    />
  )
}
