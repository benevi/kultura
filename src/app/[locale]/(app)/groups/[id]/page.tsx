// ============================================================
// KULTURA — /groups/[id] (Server Component)
// Vista de grupo: posts + miembros
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { GroupFeed } from './GroupFeed'
import { JoinGroupButton } from './JoinGroupButton'
import { InviteButton } from './InviteButton'
import { getGroupById, getMemberRole, getGroupMembers } from '@/lib/social/groups'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Grupo · KULTURA' }
}

export default async function GroupPage({ params }: Props) {
  const { id } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [group, memberRole, members] = await Promise.all([
    getGroupById(id),
    getMemberRole(id, user.id),
    getGroupMembers(id, 20),
  ])

  if (!group) notFound()

  const isMember = memberRole !== null
  const isOwner = group.ownerId === user.id
  // Privado no auto-unible: ocultar el botón a quien no es miembro ni owner (evita 403/RLS confuso).
  const showJoin = isMember || isOwner || group.isPublic

  const t = await getTranslations('friends')
  const tG = await getTranslations('groups')

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      {/* Group header */}
      <div
        className="bg-surface rounded-xl border border-border p-4 flex items-start gap-4 border-l-4"
        style={{ borderLeftColor: group.coverColor }}
      >
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-display text-xl"
          style={{ backgroundColor: group.coverColor }}
        >
          {group.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-display text-2xl text-text truncate">{group.name}</h1>
            {!group.isPublic && (
              <Badge variant="muted" className="flex-shrink-0">{tG('privateBadge')}</Badge>
            )}
          </div>
          {group.description && (
            <p className="text-sm text-muted mt-1">{group.description}</p>
          )}
          <p className="text-xs text-muted mt-1">
            {members.length} {t('membersCount', { count: members.length })}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {isOwner && <InviteButton groupId={id} />}
          {showJoin && (
            <JoinGroupButton
              groupId={id}
              isMember={isMember}
              isOwner={isOwner}
            />
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Feed */}
        <div className="md:col-span-2">
          {isMember ? (
            <GroupFeed groupId={id} currentUserId={user.id} />
          ) : (
            <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-muted">
              {tG('joinHint')}
            </div>
          )}
        </div>

        {/* Members sidebar */}
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-text">{tG('members')}</h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
            {members.map((m) => (
              m.user && (
                <div key={m.user.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar initials={m.user.avatarInitials} color={m.user.avatarColor} size="sm" />
                  <span className="text-sm text-text flex-1 truncate">{m.user.username}</span>
                  {m.role === 'owner' && (
                    <span className="text-xs text-muted">👑</span>
                  )}
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
