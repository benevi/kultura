'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/input'
import { KButton } from '@/components/ui/KButton'
import { FriendCard } from '@/components/social/FriendCard'
import { FriendshipButton } from '@/components/social/FriendshipButton'
import type { Friendship } from '@/types/user'

interface SearchUser {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
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
  const [searchError, setSearchError] = useState(false)

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
    setSearchError(false)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        setSearchError(true)
        setSearchResults([])
        return
      }
      setSearchResults(data.users ?? [])
      setSearchDone(true)
    } catch {
      setSearchError(true)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Share link */}
      <section className="bg-surface-default rounded-xl border border-surface-border p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{t('shareProfile')}</p>
          <p className="text-xs text-text-secondary mt-0.5 truncate">{profileUrl}</p>
        </div>
        <KButton
          size="sm"
          variant="primary"
          onClick={handleCopyProfileLink}
          className="flex-shrink-0"
        >
          {copied ? t('profileLinkCopied') : '📋'}
        </KButton>
      </section>

      {/* Link a grupos (los grupos ahora viven en /groups) */}
      <Link
        href="/groups"
        className="bg-surface-default rounded-xl border border-surface-border p-4 flex items-center justify-between gap-4 hover:border-text-tertiary transition-colors"
      >
        <span className="text-sm font-semibold text-text-primary">{t('groups')}</span>
        <span className="text-text-secondary" aria-hidden>→</span>
      </Link>

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
            <KButton
              type="submit"
              size="md"
              variant="primary"
              loading={searching}
              disabled={searching}
              className="flex-shrink-0"
            >
              {searching ? '...' : t('search')}
            </KButton>
          </form>

          {searchError && (
            <p role="alert" className="text-sm text-accent-danger mt-3">{t('searchError')}</p>
          )}

          {!searchError && searchDone && searchResults.length === 0 && (
            <p className="text-sm text-text-secondary mt-3">{t('noUserFound')}</p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-3 bg-surface-default border border-surface-border rounded-xl divide-y divide-surface-border overflow-hidden">
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar initials={u.avatar_initials} color={u.avatar_color} size="sm" />
                  <Link
                    href={`/profile/${u.username}`}
                    className="flex-1 text-sm font-medium text-text-primary hover:text-accent-positive transition-colors"
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
              <span className="ml-2 text-sm font-body font-semibold text-accent-positive">
                {pending.length}
              </span>
            </h2>
            <div className="bg-surface-default rounded-xl border border-surface-border px-4">
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
            <div className="bg-surface-default rounded-xl border border-surface-border p-8 text-center">
              <div className="text-3xl mb-3">👥</div>
              <p className="text-text-secondary text-sm">{t('noFriends')}</p>
              <p className="text-text-tertiary text-xs mt-1">{t('noFriendsHint')}</p>
            </div>
          ) : (
            <div className="bg-surface-default rounded-xl border border-surface-border px-4">
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
    </div>
  )
}
