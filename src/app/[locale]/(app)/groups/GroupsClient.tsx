'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { GroupCard } from '@/components/social/GroupCard'
import { KButton } from '@/components/ui/KButton'
import { TabButton } from '@/components/ui/TabButton'
import { CreateGroupForm, type CreatedGroup } from '@/components/social/CreateGroupForm'
import { DiscoverGroupsClient } from './DiscoverGroupsClient'

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
        coverColor: group.cover_color === '#E82020' ? 'var(--accent-pink)' : group.cover_color,
        memberRole: group.memberRole,
      },
      ...prev,
    ])
    setShowCreate(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs — chips F0 (ver TabButton) */}
      <div className="flex gap-3 max-w-md">
        <TabButton active={activeTab === 'mine'} onClick={() => setActiveTab('mine')}>
          {t('myGroupsTab')}
          {groups.length > 0 && (
            <span
              className={`ml-1.5 text-xs font-extrabold rounded-full px-1.5 py-0.5 ${
                activeTab === 'mine'
                  ? 'bg-on-accent-pink text-accent-pink'
                  : 'bg-surface-border text-text-secondary'
              }`}
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
            <h2 className="font-display text-xl font-bold text-text-primary">{tFriends('myGroups')}</h2>
            <KButton
              size="sm"
              variant="primary"
              onClick={() => setShowCreate(v => !v)}
            >
              + {tFriends('createGroup')}
            </KButton>
          </div>

          {showCreate && (
            <CreateGroupForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
          )}

          {groups.length === 0 ? (
            <div className="rounded-[20px] bg-surface-default p-8 text-center">
              <div className="text-3xl mb-3" aria-hidden="true">💬</div>
              <p className="text-sm text-text-secondary">{tFriends('noGroups')}</p>
              <p className="text-xs mt-1 text-text-tertiary">{tFriends('noGroupsHint')}</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map(g => (
                <GroupCard key={g.id} group={g} />
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
