'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { KInput } from '@/components/ui/KInput'
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
    <div className="flex flex-col gap-8">
      {/* Share link — card "feature" (DISENO.md: gradiente + acento radial) */}
      <section
        className="relative overflow-hidden rounded-[20px] p-5 flex items-center justify-between gap-4"
        style={{
          background:
            'radial-gradient(120% 100% at 20% 10%, oklch(68% 0.24 350 / 0.55) 0%, transparent 55%), linear-gradient(155deg, oklch(30% 0.05 280), var(--surface-base))',
        }}
      >
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-text-primary">{t('shareProfile')}</p>
          <p className="text-xs mt-0.5 truncate text-text-secondary">{profileUrl}</p>
        </div>
        <KButton size="sm" variant="primary" onClick={handleCopyProfileLink} className="flex-shrink-0">
          {copied ? t('profileLinkCopied') : '📋'}
        </KButton>
      </section>

      {/* Link a grupos (los grupos ahora viven en /groups) */}
      <Link
        href="/groups"
        className="rounded-[20px] bg-surface-default px-[22px] py-4 flex items-center justify-between gap-4 transition-colors hover:bg-surface-elevated"
      >
        <span className="text-sm font-bold text-text-primary">{t('groups')}</span>
        <span className="text-text-tertiary" aria-hidden>→</span>
      </Link>

      {/* Search by username */}
      <section id="buscar" className="scroll-mt-24">
        <h2 className="font-display text-xl font-bold mb-[18px] text-text-primary">{t('searchFriend')}</h2>
        <form onSubmit={handleSearch} className="flex gap-2 items-center">
          <KInput
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchFriend')}
          />
          <KButton
            type="submit"
            size="lg"
            variant="primary"
            loading={searching}
            disabled={searching}
            className="flex-shrink-0"
          >
            {searching ? '...' : t('search')}
          </KButton>
        </form>

        {searchError && (
          <p role="alert" className="text-sm mt-3 text-accent-orange">{t('searchError')}</p>
        )}

        {!searchError && searchDone && searchResults.length === 0 && (
          <p className="text-sm mt-3 text-text-secondary">{t('noUserFound')}</p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {searchResults.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-4 rounded-[20px] bg-surface-default px-[22px] py-4"
              >
                <Avatar initials={u.avatar_initials} color={u.avatar_color} size="md" />
                <Link
                  href={`/profile/${u.username}`}
                  className="flex-1 min-w-0 truncate text-[15px] font-bold text-text-primary hover:opacity-80 transition-opacity"
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
          <h2 className="font-display text-xl font-bold mb-[18px] text-text-primary">
            {t('pendingRequests')} ({pending.length})
          </h2>
          <div className="flex flex-col gap-3">
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
        <h2 className="font-display text-xl font-bold mb-[18px] text-text-primary">
          {t('myFriends')}{friends.length > 0 && ` (${friends.length})`}
        </h2>
        {friends.length === 0 ? (
          <div className="rounded-[20px] bg-surface-default p-8 text-center">
            <div className="text-3xl mb-3" aria-hidden="true">👥</div>
            <p className="text-sm text-text-secondary">{t('noFriends')}</p>
            <p className="text-xs mt-1 text-text-tertiary">{t('noFriendsHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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
  )
}
