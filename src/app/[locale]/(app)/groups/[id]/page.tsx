// ============================================================
// KULTURA — /groups/[id] (Server Component)
// Vista de grupo: posts + miembros
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { GroupFeed } from './GroupFeed'
import { JoinGroupButton } from './JoinGroupButton'
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

  // Verify membership + get group info
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, description, cover_color, owner_id')
    .eq('id', id)
    .maybeSingle()

  if (!group) notFound()

  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isMember = !!membership

  // Get members
  const { data: members } = await supabase
    .from('group_members')
    .select('role, users(id, username, avatar_color, avatar_initials)')
    .eq('group_id', id)
    .order('joined_at', { ascending: true })
    .limit(20)

  const t = await getTranslations('friends')
  const tG = await getTranslations('groups')

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      {/* Group header */}
      <div
        className="bg-surface rounded-xl border border-border p-4 flex items-start gap-4 border-l-4"
        style={{ borderLeftColor: group.cover_color }}
      >
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-display text-xl"
          style={{ backgroundColor: group.cover_color }}
        >
          {group.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-text truncate">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-muted mt-1">{group.description}</p>
          )}
          <p className="text-xs text-muted mt-1">
            {(members ?? []).length} {t('membersCount', { count: (members ?? []).length })}
          </p>
        </div>
        <JoinGroupButton
          groupId={id}
          isMember={isMember}
          isOwner={group.owner_id === user.id}
        />
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
            {((members ?? []) as unknown as Array<{
              role: string
              users: { id: string; username: string; avatar_color: string; avatar_initials: string } | null
            }>).map((m) => (
              m.users && (
                <div key={m.users.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar initials={m.users.avatar_initials} color={m.users.avatar_color} size="sm" />
                  <span className="text-sm text-text flex-1 truncate">{m.users.username}</span>
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
