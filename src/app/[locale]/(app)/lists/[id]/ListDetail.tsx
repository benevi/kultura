'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { MediaCard } from '@/components/media/MediaCard'
import type { List, ListItem, ListMember } from '@/types/list'

interface ListDetailProps {
  list: List
  items: ListItem[]
  members: ListMember[]
  currentUserId: string
  currentUserFriends: Array<{ id: string; username: string; avatarColor: string; avatarInitials: string }>
  canEdit: boolean
}

export function ListDetail({
  list,
  items: initialItems,
  members: initialMembers,
  currentUserId,
  currentUserFriends,
  canEdit,
}: ListDetailProps) {
  const t = useTranslations('lists')
  const tc = useTranslations('common')
  const router = useRouter()
  const [items, setItems] = useState<ListItem[]>(initialItems)
  const [members, setMembers] = useState<ListMember[]>(initialMembers)
  const [removingItem, setRemovingItem] = useState<string | null>(null)
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const isOwner = list.ownerId === currentUserId

  async function handleDeleteList() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/lists', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId: list.id }),
      })
      if (!res.ok) {
        setDeleteError(t('errorDelete'))
        setDeleting(false)
        return
      }
      router.push('/lists')
      router.refresh()
    } catch {
      setDeleteError(t('errorDelete'))
      setDeleting(false)
    }
  }

  async function handleRemoveItem(itemId: string) {
    setRemovingItem(itemId)
    try {
      await fetch(`/api/lists/${list.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch (err) {
      console.error('Failed to remove item:', err)
    } finally {
      setRemovingItem(null)
    }
  }

  async function handleInvite() {
    if (!inviteUserId) return
    setInviting(true)
    try {
      await fetch(`/api/lists/${list.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-action': 'invite' },
        body: JSON.stringify({ userId: inviteUserId }),
      })
      const friend = currentUserFriends.find((f) => f.id === inviteUserId)
      if (friend) {
        setMembers((prev) => [
          ...prev,
          {
            listId: list.id,
            userId: friend.id,
            user: { id: friend.id, username: friend.username, avatarColor: friend.avatarColor, avatarInitials: friend.avatarInitials, createdAt: '' },
          },
        ])
      }
      setInviteUserId('')
    } catch (err) {
      console.error('Failed to invite member:', err)
    } finally {
      setInviting(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await fetch(`/api/lists/${list.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-action': 'remove-member' },
        body: JSON.stringify({ userId }),
      })
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch (err) {
      console.error('Failed to remove member:', err)
    }
  }

  const memberIds = new Set(members.map((m) => m.userId))
  memberIds.add(list.ownerId)
  const invitableFriends = currentUserFriends.filter((f) => !memberIds.has(f.id))

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl text-text-primary">{list.name}</h1>
            {list.isCollaborative && (
              <span className="text-xs font-semibold bg-surface-elevated text-text-secondary rounded-full px-2.5 py-1">
                {t('collaborative')}
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary mt-1">{list.owner?.username}</p>
        </div>
        {isOwner && (
          <KButton
            variant="secondary"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="text-text-secondary hover:text-accent-danger flex-shrink-0"
          >
            {t('deleteList')}
          </KButton>
        )}
      </header>

      {deleteError && <p className="text-xs text-accent-danger">{deleteError}</p>}

      <ConfirmModal
        isOpen={confirmDelete}
        title={t('deleteListTitle')}
        message={t('deleteListConfirm')}
        confirmLabel={tc('confirm')}
        cancelLabel={tc('cancel')}
        isDestructive
        loading={deleting}
        onConfirm={handleDeleteList}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Items */}
      <section>
        <h2 className="font-display text-xl mb-4 text-text-primary">
          {t('itemsTitle')}
          <span className="ml-2 text-sm font-body font-medium text-text-secondary">{items.length}</span>
        </h2>
        {items.length === 0 ? (
          <div className="bg-surface-default border border-surface-border rounded-xl p-8 text-center flex flex-col items-center gap-3">
            <span className="text-3xl">📋</span>
            <p className="text-text-primary text-sm font-medium">{t('noItems')}</p>
            <p className="text-text-secondary text-sm">{t('noItemsHint')}</p>
            <Link
              href="/discover"
              className="inline-flex items-center justify-center h-8 px-3 text-xs rounded-button font-body font-medium bg-accent-positive text-on-accent-positive hover:brightness-110 transition-all"
            >
              {t('noItemsDiscover')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {items.map((item) => (
              <div key={item.id} className="relative group">
                {item.media ? (
                  <MediaCard item={item.media} />
                ) : (
                  <div className="aspect-[2/3] bg-surface-elevated rounded-lg flex items-center justify-center">
                    <span className="text-xs text-text-secondary text-center px-1 line-clamp-3">{item.mediaId}</span>
                  </div>
                )}
                {canEdit && (
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={removingItem === item.id}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-surface-base/80 text-text-secondary hover:text-accent-danger flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs disabled:opacity-50"
                    aria-label={t('removeItem')}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Miembros (solo listas colaborativas) */}
      {list.isCollaborative && (
        <section>
          <h2 className="font-display text-xl mb-4 text-text-primary">{t('membersTitle')}</h2>
          <div className="bg-surface-default border border-surface-border rounded-xl divide-y divide-surface-border">
            {/* Owner */}
            {list.owner && (
              <div className="flex items-center gap-3 p-3">
                <Avatar initials={list.owner.avatarInitials} color={list.owner.avatarColor} size="sm" />
                <div className="flex-1">
                  <Link href={`/profile/${list.owner.username}`} className="text-sm font-medium hover:text-accent-positive transition-colors">
                    {list.owner.username}
                  </Link>
                  <span className="ml-2 text-xs text-text-secondary">{t('owner')}</span>
                </div>
              </div>
            )}
            {members.map((m) => (
              m.user && (
                <div key={m.userId} className="flex items-center gap-3 p-3">
                  <Avatar initials={m.user.avatarInitials} color={m.user.avatarColor} size="sm" />
                  <div className="flex-1">
                    <Link href={`/profile/${m.user.username}`} className="text-sm font-medium hover:text-accent-positive transition-colors">
                      {m.user.username}
                    </Link>
                  </div>
                  {isOwner && (
                    <KButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRemoveMember(m.userId)}
                      className="text-text-secondary hover:text-accent-danger flex-shrink-0"
                    >
                      {t('removeMember')}
                    </KButton>
                  )}
                </div>
              )
            ))}
          </div>

          {/* Invitar */}
          {isOwner && invitableFriends.length > 0 && (
            <div className="mt-3 flex gap-2">
              <select
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                className="flex-1 bg-surface-base border border-surface-border rounded-button px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-positive"
              >
                <option value="">{t('selectFriend')}</option>
                {invitableFriends.map((f) => (
                  <option key={f.id} value={f.id}>{f.username}</option>
                ))}
              </select>
              <KButton
                variant="primary"
                size="sm"
                loading={inviting}
                disabled={!inviteUserId}
                onClick={handleInvite}
              >
                {t('invite')}
              </KButton>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
