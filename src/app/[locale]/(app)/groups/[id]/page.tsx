// ============================================================
// KULTURA — /groups/[id] (Server Component)
// Vista de grupo: posts + miembros
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AVATAR_ICONS } from '@/components/icons/avatars'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { GroupFeed } from './GroupFeed'
import { JoinGroupButton } from './JoinGroupButton'
import { InviteButton } from './InviteButton'
import { getGroupById, getMemberRole, getGroupMembers } from '@/lib/social/groups'
import { F0 } from '@/lib/design/f0-tokens'
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

  // Preview "apilado" (CLAUDE.md — avatares apilados): primeros miembros de
  // la lista ya cargada, mismo dato que el sidebar, solo tratamiento visual.
  const stackPreview = members.slice(0, 5)

  // E-AVATAR-ICONS: sin icono elegido, el grupo sigue identificándose por la
  // inicial de su nombre, como hasta ahora.
  const GroupIcon = group.icon ? AVATAR_ICONS[group.icon] : undefined

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      {/* Group header — card "feature" (CLAUDE.md: gradiente + acento radial) */}
      <div
        className="relative overflow-hidden rounded-bento-lg border p-5 flex items-start gap-4"
        style={{ background: F0.surface, borderColor: F0.stroke }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(120% 100% at 15% 0%, color-mix(in oklch, ${group.coverColor} 60%, transparent) 0%, transparent 55%)`,
          }}
        />
        <div
          className="relative z-10 w-14 h-14 rounded-[16px_16px_16px_4px] flex-shrink-0 flex items-center justify-center font-display font-extrabold text-xl"
          style={{ background: group.coverColor, color: F0.onPink }}
        >
          {GroupIcon ? (
            <GroupIcon className="w-7 h-7" aria-hidden="true" />
          ) : (
            group.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="relative z-10 flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h1 className="font-display text-2xl font-extrabold truncate" style={{ color: F0.text }}>
              {group.name}
            </h1>
            {!group.isPublic && (
              <Badge
                variant="muted"
                className="flex-shrink-0 bg-transparent border-2 font-bold border-[oklch(32%_0.025_280)] text-[oklch(76%_0.02_280)]"
              >
                {tG('privateBadge')}
              </Badge>
            )}
          </div>
          {group.description && (
            <p className="text-sm mt-1" style={{ color: F0.textSecondary }}>{group.description}</p>
          )}

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {/* Amigos/miembros apilados (CLAUDE.md — avatares apilados) */}
            {stackPreview.length > 0 && (
              <div className="flex items-center">
                {stackPreview.map((m, i) => m.user && (
                  <div
                    key={m.user.id}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${m.user.avatarColor}, color-mix(in srgb, ${m.user.avatarColor} 55%, black))`,
                      border: `2px solid ${F0.surface}`,
                      marginLeft: i === 0 ? 0 : '-10px',
                      zIndex: stackPreview.length - i,
                    }}
                  >
                    {m.user.avatarInitials}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs" style={{ color: F0.muted }}>
              {/* La clave i18n ya incluye el número: pintarlo también aquí fuera
                  daba el "1 1 miembros" visto en producción. Se usa la del
                  namespace `groups`, que además tiene singular ("1 miembro"),
                  en vez de la de `friends`, que siempre decía "miembros". */}
              {tG('membersCount', { count: members.length })}
            </p>
          </div>
        </div>
        <div className="relative z-10 flex-shrink-0 flex items-center gap-2">
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
            <div
              className="rounded-bento border p-8 text-center text-sm"
              style={{ background: F0.surface, borderColor: F0.stroke, color: F0.textSecondary }}
            >
              {tG('joinHint')}
            </div>
          )}
        </div>

        {/* Members sidebar */}
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold" style={{ color: F0.text }}>{tG('members')}</h2>
          <div className="rounded-bento border overflow-hidden" style={{ background: F0.surface, borderColor: F0.stroke }}>
            {members.map((m) => (
              m.user && (
                <div
                  key={m.user.id}
                  className="flex items-center gap-3 px-3 py-2.5 border-t first:border-t-0"
                  style={{ borderColor: F0.stroke }}
                >
                  {m.role === 'owner' ? (
                    <div
                      className="rounded-full p-[2px] flex-shrink-0"
                      style={{ background: `conic-gradient(from 180deg, ${F0.yellow}, ${F0.orange}, ${F0.yellow})` }}
                    >
                      <Avatar initials={m.user.avatarInitials} color={m.user.avatarColor} size="sm" />
                    </div>
                  ) : (
                    <Avatar initials={m.user.avatarInitials} color={m.user.avatarColor} size="sm" />
                  )}
                  <span className="text-sm flex-1 truncate font-medium" style={{ color: F0.text }}>{m.user.username}</span>
                  {m.role === 'owner' && (
                    <span className="text-xs flex-shrink-0" style={{ color: F0.yellow }} aria-label={tG('members')}>👑</span>
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
