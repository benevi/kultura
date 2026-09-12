'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { TabButton } from '@/components/ui/TabButton'
import { CreateGroupForm, type CreatedGroup } from '@/components/social/CreateGroupForm'
import { DiscoverGroupsClient } from './DiscoverGroupsClient'
import { F0 } from '@/lib/design/f0-tokens'

export interface MyGroup {
  id: string
  name: string
  description: string | null
  coverColor: string
  memberRole?: string
}

interface GroupsClientProps {
  myGroups: MyGroup[]
}

export function GroupsClient({ myGroups: initialGroups }: GroupsClientProps) {
  const t = useTranslations('groups')
  const tFriends = useTranslations('friends')

  const [activeTab, setActiveTab] = useState<'mine' | 'discover'>('mine')
  const [groups, setGroups] = useState<MyGroup[]>(initialGroups)
  const [showCreate, setShowCreate] = useState(false)

  function handleCreated(group: CreatedGroup) {
    setGroups(prev => [
      {
        id: group.id,
        name: group.name,
        description: group.description,
        // Mismo default legacy que avatar_color (ver Avatar.tsx LEGACY_RED):
        // se remapea al leer, no se toca el default a nivel de BD.
        coverColor: group.cover_color === '#E82020' ? F0.pink : group.cover_color,
        memberRole: group.memberRole,
      },
      ...prev,
    ])
    setShowCreate(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs — chips F0 (ver TabButton) */}
      <div className="flex gap-2">
        <TabButton active={activeTab === 'mine'} onClick={() => setActiveTab('mine')}>
          {t('myGroupsTab')}
          {groups.length > 0 && (
            <span
              className="ml-1.5 text-xs font-extrabold rounded-full px-1.5 py-0.5"
              style={
                activeTab === 'mine'
                  ? { background: F0.onPink, color: F0.pink }
                  : { background: F0.stroke, color: F0.textSecondary }
              }
            >
              {groups.length}
            </span>
          )}
        </TabButton>
        <TabButton active={activeTab === 'discover'} onClick={() => setActiveTab('discover')}>
          {t('discoverTab')}
        </TabButton>
      </div>

      {/* MIS GRUPOS */}
      {activeTab === 'mine' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold" style={{ color: F0.text }}>{tFriends('myGroups')}</h2>
            <KButton
              size="sm"
              variant="primary"
              onClick={() => setShowCreate(v => !v)}
              className="rounded-full font-extrabold"
              style={{ background: F0.pink, color: F0.onPink }}
            >
              + {tFriends('createGroup')}
            </KButton>
          </div>

          {showCreate && (
            <CreateGroupForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
          )}

          {groups.length === 0 ? (
            <div className="rounded-bento border p-8 text-center" style={{ background: F0.surface, borderColor: F0.stroke }}>
              <div className="text-3xl mb-3">💬</div>
              <p className="text-sm" style={{ color: F0.textSecondary }}>{tFriends('noGroups')}</p>
              <p className="text-xs mt-1" style={{ color: F0.muted }}>{tFriends('noGroupsHint')}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map(g => (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="rounded-bento border p-4 hover:brightness-110 transition-all flex flex-col gap-2"
                  style={{ background: F0.surface, borderColor: F0.stroke }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-11 h-11 rounded-[16px_16px_16px_4px] flex-shrink-0 flex items-center justify-center font-display font-extrabold text-sm"
                      style={{ background: g.coverColor, color: F0.onPink }}
                    >
                      {g.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-bold text-sm truncate" style={{ color: F0.text }}>{g.name}</span>
                  </div>
                  {g.description && (
                    <p className="text-xs line-clamp-2" style={{ color: F0.textSecondary }}>{g.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DESCUBRIR */}
      {activeTab === 'discover' && <DiscoverGroupsClient />}
    </div>
  )
}
