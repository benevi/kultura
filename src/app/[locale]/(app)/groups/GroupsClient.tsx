'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { TabButton } from '@/components/ui/TabButton'
import { CreateGroupForm } from '@/components/social/CreateGroupForm'
import type { GroupSummary } from '@/lib/groups/client'
import { DiscoverGroupsClient } from './DiscoverGroupsClient'
import { IconGroups } from '@/components/icons'

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

  function handleCreated(group: GroupSummary) {
    setGroups(prev => [
      {
        id: group.id,
        name: group.name,
        description: group.description,
        // El color legacy ya llega remapeado (ver mapGroup).
        coverColor: group.coverColor,
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
            <div className="rounded-bento border p-8 text-center bg-surface-default border-surface-border">
              <IconGroups className="w-9 h-9 mx-auto mb-3 text-text-tertiary" />
              <p className="text-sm text-text-secondary">{tFriends('noGroups')}</p>
              <p className="text-xs mt-1 text-text-tertiary">{tFriends('noGroupsHint')}</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map(g => (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="rounded-bento border p-4 hover:brightness-110 transition-all flex flex-col gap-2 bg-surface-default border-surface-border"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-11 h-11 rounded-2xl rounded-bl-lg flex-shrink-0 flex items-center justify-center font-display font-extrabold text-sm text-on-accent-pink"
                      style={{ background: g.coverColor }}
                    >
                      {g.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-bold text-sm truncate text-text-primary">{g.name}</span>
                  </div>
                  {g.description && (
                    <p className="text-xs line-clamp-2 text-text-secondary">{g.description}</p>
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
