'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/input'
import { KButton } from '@/components/ui/KButton'
import { FriendCard } from '@/components/social/FriendCard'
import { FriendshipButton } from '@/components/social/FriendshipButton'
import { F0 } from '@/lib/design/f0-tokens'
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

/* Card F0 estándar (CLAUDE.md — combinación de primitivos: mismo radio,
   mismo stroke que el resto de la pantalla). Reutilizada por las varias
   secciones de esta pantalla en vez de repetir las mismas clases. */
const CARD_STYLE = { background: F0.surface, borderColor: F0.stroke }

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
      {/* Share link — card "feature" (CLAUDE.md: gradiente + acento radial) */}
      <section
        className="relative overflow-hidden rounded-bento-lg p-5 flex items-center justify-between gap-4"
        style={{
          background: `linear-gradient(155deg, oklch(30% 0.05 280), ${F0.bg})`,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(120% 100% at 20% 10%, oklch(68% 0.24 350 / 0.55) 0%, transparent 55%)`,
          }}
        />
        <div className="relative z-10 min-w-0">
          <p className="text-sm font-extrabold" style={{ color: F0.text }}>{t('shareProfile')}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: F0.textSecondary }}>{profileUrl}</p>
        </div>
        <KButton
          size="sm"
          variant="primary"
          onClick={handleCopyProfileLink}
          className="relative z-10 flex-shrink-0 rounded-full font-extrabold"
          style={{ background: F0.pink, color: F0.onPink }}
        >
          {copied ? t('profileLinkCopied') : '📋'}
        </KButton>
      </section>

      {/* Link a grupos (los grupos ahora viven en /groups) */}
      <Link
        href="/groups"
        className="rounded-bento border p-4 flex items-center justify-between gap-4 transition-colors hover:brightness-110"
        style={CARD_STYLE}
      >
        <span className="text-sm font-bold" style={{ color: F0.text }}>{t('groups')}</span>
        <span style={{ color: F0.muted }} aria-hidden>→</span>
      </Link>

      <div className="flex flex-col gap-8">
        {/* Search by username */}
        <section>
          <h2 className="font-display text-xl font-bold mb-3" style={{ color: F0.text }}>{t('searchFriend')}</h2>
          <form onSubmit={handleSearch} className="flex gap-2 items-end">
            <Input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="flex-1 rounded-2xl border-2 focus-visible:ring-[oklch(68%_0.24_350)]"
              style={{ background: F0.surface2, borderColor: F0.stroke, color: F0.text }}
            />
            <KButton
              type="submit"
              size="md"
              variant="primary"
              loading={searching}
              disabled={searching}
              className="flex-shrink-0 rounded-full font-extrabold"
              style={{ background: F0.pink, color: F0.onPink }}
            >
              {searching ? '...' : t('search')}
            </KButton>
          </form>

          {searchError && (
            <p role="alert" className="text-sm mt-3" style={{ color: F0.orange }}>{t('searchError')}</p>
          )}

          {!searchError && searchDone && searchResults.length === 0 && (
            <p className="text-sm mt-3" style={{ color: F0.textSecondary }}>{t('noUserFound')}</p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-3 rounded-bento border overflow-hidden" style={CARD_STYLE}>
              {searchResults.map(u => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3 border-t first:border-t-0"
                  style={{ borderColor: F0.stroke }}
                >
                  <Avatar initials={u.avatar_initials} color={u.avatar_color} size="sm" />
                  <Link
                    href={`/profile/${u.username}`}
                    className="flex-1 text-sm font-bold hover:opacity-80 transition-opacity"
                    style={{ color: F0.text }}
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
            <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2" style={{ color: F0.text }}>
              {t('pendingRequests')}
              <span
                className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full font-body text-xs font-extrabold"
                style={{ background: F0.lime, color: F0.onLime }}
              >
                {pending.length}
              </span>
            </h2>
            <div className="rounded-bento border px-4" style={CARD_STYLE}>
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
          <h2 className="font-display text-xl font-bold mb-3" style={{ color: F0.text }}>{t('myFriends')}</h2>
          {friends.length === 0 ? (
            <div className="rounded-bento border p-8 text-center" style={CARD_STYLE}>
              <div className="text-3xl mb-3">👥</div>
              <p className="text-sm" style={{ color: F0.textSecondary }}>{t('noFriends')}</p>
              <p className="text-xs mt-1" style={{ color: F0.muted }}>{t('noFriendsHint')}</p>
            </div>
          ) : (
            <div className="rounded-bento border px-4" style={CARD_STYLE}>
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
