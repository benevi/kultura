'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/input'
import { FriendCard } from '@/components/social/FriendCard'
import { FriendshipButton } from '@/components/social/FriendshipButton'
import type { Friendship } from '@/types/user'

interface SearchUser {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
}

interface Group {
  id: string
  name: string
  description: string | null
  cover_color: string
  memberRole: string
}

interface FriendsClientProps {
  friends: Friendship[]
  pendingRequests: Friendship[]
  profileUrl: string
}

export function FriendsClient({
  friends: initialFriends,
  pendingRequests: initialPending,
  profileUrl,
}: FriendsClientProps) {
  const t = useTranslations('friends')

  // Friends state
  const [friends, setFriends] = useState<Friendship[]>(initialFriends)
  const [pending, setPending] = useState<Friendship[]>(initialPending)
  const [copied, setCopied] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [searchDone, setSearchDone] = useState(false)

  // Groups state
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends')

  // ── Friends logic ──────────────────────────────────────────
  function removeFriendFromList(friendshipId: string) {
    setFriends(prev => prev.filter(f => f.id !== friendshipId))
  }

  function resolveRequest(friendshipId: string) {
    const accepted = pending.find(p => p.id === friendshipId)
    setPending(prev => prev.filter(p => p.id !== friendshipId))
    if (accepted) setFriends(prev => [{ ...accepted, status: 'accepted' }, ...prev])
  }

  async function handleCopyProfileLink() {
    try {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  // ── Search logic ───────────────────────────────────────────
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchDone(false)
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`)
    const data = await res.json()
    setSearchResults(data.users ?? [])
    setSearching(false)
    setSearchDone(true)
  }

  // ── Groups logic ───────────────────────────────────────────
  async function loadGroups() {
    if (groupsLoaded) return
    const res = await fetch('/api/groups')
    const data = await res.json()
    setGroups(data.groups ?? [])
    setGroupsLoaded(true)
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!groupName.trim()) return
    setCreatingGroup(true)
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName.trim(), description: groupDesc.trim() || undefined }),
    })
    const data = await res.json()
    if (data.group) {
      setGroups(prev => [{ ...data.group, memberRole: 'owner' }, ...prev])
      setGroupName('')
      setGroupDesc('')
      setShowCreateGroup(false)
    }
    setCreatingGroup(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Share link */}
      <section className="bg-surface rounded-xl border border-border p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">{t('shareProfile')}</p>
          <p className="text-xs text-muted mt-0.5 truncate">{profileUrl}</p>
        </div>
        <button
          onClick={handleCopyProfileLink}
          className="flex-shrink-0 px-3 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          {copied ? t('profileLinkCopied') : '📋'}
        </button>
      </section>

      {/* Tab selector */}
      <div className="flex gap-1 bg-surface rounded-xl border border-border p-1">
        <TabButton active={activeTab === 'friends'} onClick={() => setActiveTab('friends')}>
          {t('myFriends')}
          {friends.length > 0 && (
            <span className="ml-1.5 text-xs bg-surface2 text-muted rounded-full px-1.5 py-0.5">
              {friends.length}
            </span>
          )}
        </TabButton>
        <TabButton
          active={activeTab === 'groups'}
          onClick={() => { setActiveTab('groups'); loadGroups() }}
        >
          {t('groups')}
        </TabButton>
      </div>

      {/* FRIENDS TAB */}
      {activeTab === 'friends' && (
        <div className="flex flex-col gap-8">
          {/* Search by username */}
          <section>
            <h2 className="font-display text-xl mb-3">{t('searchFriend')}</h2>
            <form onSubmit={handleSearch} className="flex gap-2 items-end">
              <Input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="flex-1"
              />
              <button
                type="submit"
                disabled={searching}
                className="h-10 px-4 text-sm font-semibold bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {searching ? '...' : t('search')}
              </button>
            </form>

            {searchDone && searchResults.length === 0 && (
              <p className="text-sm text-muted mt-3">{t('noUserFound')}</p>
            )}

            {searchResults.length > 0 && (
              <div className="mt-3 bg-surface border border-border rounded-xl divide-y divide-border overflow-hidden">
                {searchResults.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar initials={u.avatar_initials} color={u.avatar_color} size="sm" />
                    <Link
                      href={`/profile/${u.username}`}
                      className="flex-1 text-sm font-medium text-text hover:text-accent transition-colors"
                    >
                      {u.username}
                    </Link>
                    <FriendshipButton
                      initialStatus="none"
                      targetUserId={u.id}
                      friendshipId={undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pending requests */}
          {pending.length > 0 && (
            <section>
              <h2 className="font-display text-xl mb-3">
                {t('pendingRequests')}
                <span className="ml-2 text-sm font-body font-semibold text-accent">
                  {pending.length}
                </span>
              </h2>
              <div className="bg-surface rounded-xl border border-border px-4">
                {pending.map(friendship => (
                  <FriendCard
                    key={friendship.id}
                    friendship={friendship}
                    variant="pending"
                    onAction={resolveRequest}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Friends list */}
          <section>
            <h2 className="font-display text-xl mb-3">{t('myFriends')}</h2>
            {friends.length === 0 ? (
              <div className="bg-surface rounded-xl border border-border p-8 text-center">
                <div className="text-3xl mb-3">👥</div>
                <p className="text-muted text-sm">{t('noFriends')}</p>
                <p className="text-muted text-xs mt-1">{t('noFriendsHint')}</p>
              </div>
            ) : (
              <div className="bg-surface rounded-xl border border-border px-4">
                {friends.map(friendship => (
                  <FriendCard
                    key={friendship.id}
                    friendship={friendship}
                    variant="friend"
                    onAction={removeFriendFromList}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* GROUPS TAB */}
      {activeTab === 'groups' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">{t('myGroups')}</h2>
            <button
              onClick={() => setShowCreateGroup(v => !v)}
              className="px-3 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              + {t('createGroup')}
            </button>
          </div>

          {showCreateGroup && (
            <form onSubmit={handleCreateGroup} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder={t('groupNamePlaceholder')}
                maxLength={60}
                required
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <textarea
                value={groupDesc}
                onChange={e => setGroupDesc(e.target.value)}
                placeholder={t('groupDescPlaceholder')}
                maxLength={200}
                rows={2}
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {creatingGroup ? '...' : t('createGroup')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="px-4 py-2 text-sm font-medium text-muted hover:text-text transition-colors"
                >
                  ✕
                </button>
              </div>
            </form>
          )}

          {!groupsLoaded ? (
            <div className="text-sm text-muted text-center py-8">...</div>
          ) : groups.length === 0 ? (
            <div className="bg-surface rounded-xl border border-border p-8 text-center">
              <div className="text-3xl mb-3">💬</div>
              <p className="text-muted text-sm">{t('noGroups')}</p>
              <p className="text-muted text-xs mt-1">{t('noGroupsHint')}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map(g => (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="bg-surface border border-border rounded-xl p-4 hover:border-muted transition-colors flex flex-col gap-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: g.cover_color }}
                    >
                      {g.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-semibold text-sm text-text truncate">{g.name}</span>
                  </div>
                  {g.description && (
                    <p className="text-xs text-muted line-clamp-2 mt-1">{g.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
        active
          ? 'bg-surface2 text-text'
          : 'text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}
