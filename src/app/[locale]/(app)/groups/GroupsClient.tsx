'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
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
      { id: group.id, name: group.name, description: group.description, coverColor: group.cover_color, memberRole: group.memberRole },
      ...prev,
    ])
    setShowCreate(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface-default rounded-xl border border-surface-border p-1">
        <TabButton active={activeTab === 'mine'} onClick={() => setActiveTab('mine')}>
          {t('myGroupsTab')}
          {groups.length > 0 && (
            <span className="ml-1.5 text-xs bg-surface-elevated text-text-secondary rounded-full px-1.5 py-0.5">
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
            <h2 className="font-display text-xl">{tFriends('myGroups')}</h2>
            <KButton size="sm" variant="primary" onClick={() => setShowCreate(v => !v)}>
              + {tFriends('createGroup')}
            </KButton>
          </div>

          {showCreate && (
            <CreateGroupForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
          )}

          {groups.length === 0 ? (
            <div className="bg-surface-default rounded-xl border border-surface-border p-8 text-center">
              <div className="text-3xl mb-3">💬</div>
              <p className="text-text-secondary text-sm">{tFriends('noGroups')}</p>
              <p className="text-text-tertiary text-xs mt-1">{tFriends('noGroupsHint')}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map(g => (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="bg-surface-default border border-surface-border rounded-xl p-4 hover:border-text-tertiary transition-colors flex flex-col gap-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: g.coverColor }}
                    >
                      {g.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-semibold text-sm text-text-primary truncate">{g.name}</span>
                  </div>
                  {g.description && (
                    <p className="text-xs text-text-secondary line-clamp-2 mt-1">{g.description}</p>
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
