// ============================================================
// KULTURA — /groups/[id] (Server Component)
// Vista de grupo: posts + miembros
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { heroGradient, hueFromSeed } from '@/lib/design/gradient'
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

  const tG = await getTranslations('groups')

  // Preview "apilado" (DISENO.md — avatares apilados): primeros miembros de
  // la lista ya cargada, mismo dato que el sidebar, solo tratamiento visual.
  const stackPreview = members.slice(0, 5)

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-14 pt-2 pb-14 flex flex-col gap-7">
      {/* Hero — card "feature" F0 (mockup GroupDetail): acento radial sobre
          gradiente oscuro del mismo matiz, derivado del id del grupo. */}
      <div
        className="rounded-[32px] px-6 py-7 md:px-10 md:py-9 flex flex-col md:flex-row md:items-center justify-between gap-5"
        style={{ background: heroGradient(hueFromSeed(group.id)) }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-wrap mb-2">
            <h1 className="font-display text-[28px] md:text-[34px] font-extrabold text-text-primary">
              {group.name}
            </h1>
            {!group.isPublic && (
              <Badge
                variant="muted"
                className="flex-shrink-0 bg-transparent border-2 font-bold border-surface-border text-text-secondary"
              >
                {tG('privateBadge')}
              </Badge>
            )}
          </div>
          {group.description && (
            <p className="text-sm text-text-secondary mb-1.5">{group.description}</p>
          )}
          <p className="text-sm text-text-tertiary">
            {tG('membersCount', { count: members.length })} · {group.isPublic ? tG('public') : tG('private')}
          </p>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Avatares apilados (DISENO.md — solapados, borde --bg) */}
          {stackPreview.length > 0 && (
            <div className="flex items-center" aria-hidden="true">
              {stackPreview.map((m, i) => m.user && (
                <div
                  key={m.user.id}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white border-2 border-surface-base"
                  style={{
                    background: `linear-gradient(135deg, ${m.user.avatarColor}, color-mix(in srgb, ${m.user.avatarColor} 55%, black))`,
                    marginLeft: i === 0 ? 0 : '-12px',
                    zIndex: stackPreview.length - i,
                  }}
                >
                  {m.user.avatarInitials}
                </div>
              ))}
            </div>
          )}
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
            <div className="rounded-[20px] bg-surface-default p-8 text-center text-sm text-text-secondary">
              {tG('joinHint')}
            </div>
          )}
        </div>

        {/* Members sidebar */}
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-text-primary">{tG('members')}</h2>
          <div className="rounded-[20px] bg-surface-default overflow-hidden">
            {members.map((m) => (
              m.user && (
                <div
                  key={m.user.id}
                  className="flex items-center gap-3 px-4 py-3 border-t border-surface-border first:border-t-0"
                >
                  {m.role === 'owner' ? (
                    <div
                      className="rounded-full p-[2px] flex-shrink-0"
                      style={{ background: `conic-gradient(from 180deg, var(--accent-yellow), var(--accent-orange), var(--accent-yellow))` }}
                    >
                      <Avatar initials={m.user.avatarInitials} color={m.user.avatarColor} size="sm" />
                    </div>
                  ) : (
                    <Avatar initials={m.user.avatarInitials} color={m.user.avatarColor} size="sm" />
                  )}
                  <span className="text-sm flex-1 truncate font-bold text-text-primary">{m.user.username}</span>
                  {m.role === 'owner' && (
                    <span className="text-xs flex-shrink-0 text-accent-yellow" aria-hidden="true">👑</span>
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
