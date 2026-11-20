'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/input'
import { KButton } from '@/components/ui/KButton'
import { FriendCard } from '@/components/social/FriendCard'
import { FriendshipButton } from '@/components/social/FriendshipButton'
import { getBlockedUsers, unblockUser, type BlockedUser } from '@/lib/social/actions'
import type { Friendship } from '@/types/user'
import { IconLists, IconFriends } from '@/components/icons'
import { PushOffer } from '@/components/push/PushOffer'
import { apiFetch } from '@/lib/api/client'

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
      const users = await apiFetch<SearchUser[]>(
        `/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`
      )
      setSearchResults(users)
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
      {/* Share link — card "feature" (gradiente + acento radial) */}
      <section
        className="relative overflow-hidden rounded-bento-xl p-5 flex items-center justify-between gap-4 bg-[linear-gradient(155deg,oklch(30%_0.05_280),var(--surface-base))]"
      >
        <div
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_100%_at_20%_10%,oklch(68%_0.24_350/0.55)_0%,transparent_55%)]"
        />
        <div className="relative z-10 min-w-0">
          <p className="text-sm font-extrabold text-text-primary">{t('shareProfile')}</p>
          <p className="text-xs mt-0.5 truncate text-text-secondary">{profileUrl}</p>
        </div>
        <KButton
          size="sm"
          variant="primary"
          onClick={handleCopyProfileLink}
          aria-label={copied ? undefined : t('copyProfileLink')}
          title={t('copyProfileLink')}
          className="relative z-10 flex-shrink-0"
        >
          {copied ? t('profileLinkCopied') : <IconLists className="h-4 w-4" />}
        </KButton>
      </section>

      {/* Link a grupos (los grupos ahora viven en /groups) */}
      <Link
        href="/groups"
        className="rounded-bento border p-4 flex items-center justify-between gap-4 transition-colors hover:brightness-110 bg-surface-default border-surface-border"
      >
        <span className="text-sm font-bold text-text-primary">{t('groups')}</span>
        <span className="text-text-tertiary" aria-hidden>→</span>
      </Link>

      <div className="flex flex-col gap-8">
        {/* Search by username */}
        <section>
          <h2 className="font-display text-xl font-bold mb-3 text-text-primary">{t('searchFriend')}</h2>
          <form onSubmit={handleSearch} className="flex gap-2 items-end">
            <Input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="flex-1 rounded-2xl border-2 focus-visible:ring-accent-pink bg-surface-elevated border-surface-border text-text-primary"
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
                  className="flex items-center gap-4 rounded-bento px-[22px] py-4 bg-surface-default"
                >
                  <Avatar initials={u.avatar_initials} color={u.avatar_color} size="sm" />
                  <Link
                    href={`/profile/${u.username}`}
                    className="flex-1 text-sm font-bold hover:opacity-80 transition-opacity text-text-primary"
                  >
                    {u.username}
                  </Link>
                  <FriendshipButton
                    initialStatus="none"
                    targetUserId={u.id}
                    friendshipId={undefined}
                    allowBlock={false}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending requests */}
        {pending.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2 text-text-primary">
              {t('pendingRequests')}
              <span
                className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full font-body text-xs font-extrabold bg-accent-lime text-on-accent-lime"
              >
                {pending.length}
              </span>
            </h2>
            {/* Filas sueltas del artboard (radio 20, gap 12), no un bloque. */}
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
          <h2 className="font-display text-xl font-bold mb-3 text-text-primary">{t('myFriends')}</h2>
          {friends.length === 0 ? (
            <div className="rounded-bento border p-8 text-center bg-surface-default border-surface-border">
              <IconFriends aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-text-tertiary" />
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

        <BlockedUsersSection />
      </div>
      {/* Tras pedir o aceptar una amistad se ofrecen los avisos push. */}
      <PushOffer />
    </div>
  )
}

/**
 * F-11: usuarios bloqueados, con "Desbloquear". Solo aparece si hay
 * alguien bloqueado.
 */
function BlockedUsersSection() {
  const t = useTranslations('moderation')
  const [users, setUsers] = useState<BlockedUser[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [announce, setAnnounce] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let alive = true
    getBlockedUsers()
      .then((res) => { if (alive && res.enabled) setUsers(res.users) })
      .catch(() => { /* sin moderación disponible: no se pinta */ })
    return () => { alive = false }
  }, [])

  async function handleUnblock(user: BlockedUser) {
    setBusyId(user.id)
    setError(false)
    try {
      await unblockUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      setAnnounce(t('unblockedUser', { username: user.username }))
      // La fila desaparece: el foco no se pierde, vuelve al título de la sección.
      requestAnimationFrame(() => headingRef.current?.focus())
    } catch {
      setError(true)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <p role="status" className="sr-only">{announce}</p>
      {users.length > 0 && (
        <section aria-labelledby="blocked-users-heading">
          <h2
            id="blocked-users-heading"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-xl font-bold mb-1 focus:outline-none text-text-primary"
          >
            {t('blockedListTitle')}
          </h2>
          <p className="text-xs mb-3 text-text-secondary">{t('blockedListHint')}</p>
          {error && <p role="alert" className="text-xs mb-2 text-accent-danger">{t('unblockError')}</p>}
          <ul className="flex flex-col gap-3">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-4 rounded-bento px-[22px] py-4 bg-surface-default">
                <Avatar initials={u.avatarInitials} color={u.avatarColor} size="sm" />
                <Link
                  href={`/profile/${u.username}`}
                  className="flex-1 text-sm font-bold hover:opacity-80 transition-opacity text-text-primary"
                >
                  {u.username}
                </Link>
                <KButton
                  variant="secondary"
                  size="sm"
                  loading={busyId === u.id}
                  onClick={() => handleUnblock(u)}
                  aria-label={t('unblockUser', { username: u.username })}
                  className="hover:text-text-secondary"
                >
                  {t('unblock')}
                </KButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
