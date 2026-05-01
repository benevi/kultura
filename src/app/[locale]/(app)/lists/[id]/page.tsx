// ============================================================
// KULTURA — /lists/[id] (Server Component)
// Detalle de lista: título, items, miembros.
// ============================================================

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getListDetail, canEditList } from '@/lib/social/lists'
import { getFriends } from '@/lib/social/friends'
import { ListDetail } from './ListDetail'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const detail = await getListDetail(id).catch(() => null)
  return { title: detail ? `${detail.list.name} · KULTURA` : 'Lista · KULTURA' }
}

export default async function ListDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const detail = await getListDetail(id)
  if (!detail) notFound()

  const { list, items, members } = detail

  // Determinar si el usuario puede editar
  const canEdit = user ? await canEditList(id, user.id) : false

  // Amigos del usuario para el selector de invitación
  let friends: Array<{ id: string; username: string; avatarColor: string; avatarInitials: string }> = []
  if (user) {
    const friendships = await getFriends(user.id)
    friends = friendships
      .map((f) => f.otherUser)
      .filter((u): u is NonNullable<typeof u> => u !== undefined)
      .map((u) => ({ id: u.id, username: u.username, avatarColor: u.avatarColor, avatarInitials: u.avatarInitials }))
  }

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-3xl">{list.name}</h1>
          {list.isCollaborative && (
            <span className="text-xs font-semibold bg-surface2 text-muted rounded-full px-2.5 py-1">
              Colaborativa
            </span>
          )}
        </div>
        <p className="text-sm text-muted mt-1">{list.owner?.username}</p>
      </div>
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
