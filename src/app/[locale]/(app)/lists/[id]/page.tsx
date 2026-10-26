// ============================================================
// KULTURA — /lists/[id] (Server Component)
// Detalle de lista: título, items, miembros.
// ============================================================

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getListDetail, canEditList } from '@/lib/social/lists'
import { getFriends } from '@/lib/social/friends'
import { mixedListsEnabled } from '@/app/api/lists/shared'
import { ListDetail } from './ListDetail'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const detail = await getListDetail(id).catch(() => null)
  if (detail) return { title: detail.list.name }
  const t = await getTranslations('lists')
  return { title: t('metaFallback') }
}

export default async function ListDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const detail = await getListDetail(id)
  if (!detail) notFound()

  const { list, items, members } = detail

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
        mixedEnabled={mixedListsEnabled()}
      />
    </main>
  )
}
