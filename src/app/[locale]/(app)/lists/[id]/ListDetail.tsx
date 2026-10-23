'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CloseButton } from '@/components/ui/CloseButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ShareLinkButton } from '@/components/social/ShareLinkButton'
import { MediaCard } from '@/components/media/MediaCard'
import { createLogger } from '@/lib/logger'
import type { List, ListItem, ListMember } from '@/types/list'

const log = createLogger('ListDetail')

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
  const tcol = useTranslations('collection')
  const router = useRouter()
  const [items, setItems] = useState<ListItem[]>(initialItems)
  const [members, setMembers] = useState<ListMember[]>(initialMembers)
  const [removingItem, setRemovingItem] = useState<string | null>(null)
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(list.isPublic)
  const [savingVisibility, setSavingVisibility] = useState(false)

  const isOwner = list.ownerId === currentUserId
  const publicPath = list.owner ? `/u/${list.owner.username}/l/${list.id}` : null

  async function handleVisibilityChange(value: string) {
    const next = value === 'public'
    if (next === isPublic || savingVisibility) return
    setSavingVisibility(true)
    setActionError(null)
    setIsPublic(next) // optimista: se revierte si falla
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      log.error('visibility change failed', { message: err instanceof Error ? err.message : String(err) })
      setIsPublic(!next)
      setActionError(tcol('visibilityError'))
    } finally {
      setSavingVisibility(false)
    }
  }

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
    setActionError(null)
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      if (!res.ok) {
        setActionError(t('removeError'))
        return
      }
      setItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch (err) {
      log.error('Failed to remove item', { err })
      setActionError(t('removeError'))
    } finally {
      setRemovingItem(null)
    }
  }

  async function handleInvite() {
    if (!inviteUserId) return
    setInviting(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-action': 'invite' },
        body: JSON.stringify({ userId: inviteUserId }),
      })
      if (!res.ok) {
        setActionError(t('inviteError'))
        return
      }
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
      log.error('Failed to invite member', { err })
      setActionError(t('inviteError'))
    } finally {
      setInviting(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    setActionError(null)
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-action': 'remove-member' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        setActionError(t('removeMemberError'))
        return
      }
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch (err) {
      log.error('Failed to remove member', { err })
      setActionError(t('removeMemberError'))
    }
  }

  const memberIds = new Set(members.map((m) => m.userId))
  memberIds.add(list.ownerId)
  const invitableFriends = currentUserFriends.filter((f) => !memberIds.has(f.id))

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {/* El nombre de la lista ES el título de la pantalla, así que va
              al tipo del canvas (display 42px/700) — pero NO usa `PageHeading`:
              el artboard lo mete en una cabecera con avatares y chips debajo,
              no en la fila de título + acción. */}
          <h1 className="font-display text-[30px] md:text-[38px] font-bold tracking-tight text-text-primary leading-tight">
            {list.name}
          </h1>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {list.isCollaborative && (
              <div className="flex items-center">
                {list.owner && (
                  <Avatar
                    initials={list.owner.avatarInitials}
                    color={list.owner.avatarColor}
                    size="sm"
                    className="ring-2 ring-surface-base"
                  />
                )}
                {members.map((m, i) => (
                  m.user && (
                    <Avatar
                      key={m.userId}
                      initials={m.user.avatarInitials}
                      color={m.user.avatarColor}
                      size="sm"
                      className={i === 0 && !list.owner ? 'ring-2 ring-surface-base' : '-ml-[10px] ring-2 ring-surface-base'}
                    />
                  )
                ))}
              </div>
            )}
            <span className="text-[13px] text-text-tertiary">
              {list.isCollaborative && (
                <span className="font-semibold text-text-primary">{t('collaborative')}</span>
              )}
              {list.isCollaborative && ' · '}
              {t('itemCount', { count: items.length })}
            </span>
          </div>
          {isOwner && (
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <SegmentedControl
                ariaLabel={tcol('visibility')}
                value={isPublic ? 'public' : 'private'}
                onChange={handleVisibilityChange}
                options={[
                  { value: 'private', label: tcol('private') },
                  { value: 'public', label: tcol('public') },
                ]}
              />
              {isPublic && publicPath && (
                <ShareLinkButton path={publicPath} title={list.name} label={tcol('share')} />
              )}
            </div>
          )}
          {isOwner && (
            <p className="text-[13px] text-text-tertiary mt-2">
              {isPublic ? tcol('publicHint') : tcol('privateHint')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isOwner && (
            <KButton
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="text-text-secondary hover:text-accent-danger"
            >
              {t('deleteList')}
            </KButton>
          )}
          {canEdit && (
            <KButton asChild>
              <Link href="/discover">
                {/* El "+" es decoración, igual que el emoji de `PageHeading`:
                    fuera del nombre accesible y sin repetirlo por idioma. */}
                <span aria-hidden="true" className="mr-1">+</span>
                {t('addItem')}
              </Link>
            </KButton>
          )}
        </div>
      </header>

      {/* ACC-3: los fallos se anuncian. */}
      {deleteError && <p role="alert" className="text-sm text-accent-danger">{deleteError}</p>}
      {actionError && <p role="alert" className="text-sm text-accent-danger">{actionError}</p>}

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
        <h2 className="font-display text-xl font-bold mb-4 text-text-primary">
          {t('itemsTitle')}
          <span className="ml-2 text-sm font-body font-medium text-text-secondary">{items.length}</span>
        </h2>
        {items.length === 0 ? (
          <div className="bg-surface-default rounded-3xl p-10 text-center flex flex-col items-center gap-3">
            <span aria-hidden="true" className="text-3xl">📋</span>
            <p className="text-text-primary text-sm font-medium">{t('noItems')}</p>
            <p className="text-text-secondary text-sm">{t('noItemsHint')}</p>
            <Link
              href="/discover"
              className="inline-flex items-center justify-center h-8 px-4 mt-1 text-xs rounded-pill font-body font-bold bg-accent-pink text-on-accent-pink hover:brightness-110 transition-all"
            >
              {t('noItemsDiscover')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-5">
            {items.map((item) => (
              <div key={item.id} className="relative group">
                {item.media ? (
                  <MediaCard item={item.media} />
                ) : (
                  <div
                    className="aspect-[2/3] rounded-bento flex items-center justify-center"
                    style={{ background: 'linear-gradient(155deg, var(--surface2), var(--surface))' }}
                  >
                    <span className="text-xs text-text-secondary text-center px-1 line-clamp-3">{item.mediaId}</span>
                  </div>
                )}
                {canEdit && (
                  // Visible también al enfocarlo con el teclado y en pantallas
                  // táctiles (sin hover no se veía nunca); 44 px de zona táctil.
                  <CloseButton
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={removingItem === item.id}
                    label={t('removeItemNamed', { title: item.media?.title ?? item.mediaId })}
                    className="absolute top-0 right-0 bg-surface-base/80 hover:text-accent-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Miembros (solo listas colaborativas) */}
      {list.isCollaborative && (
        <section>
          <h2 className="font-display text-xl font-bold mb-4 text-text-primary">{t('membersTitle')}</h2>
          <div className="bg-surface-default rounded-3xl divide-y divide-surface-border overflow-hidden">
            {/* Owner */}
            {list.owner && (
              <div className="flex items-center gap-3 px-5 py-4">
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
                <div key={m.userId} className="flex items-center gap-3 px-5 py-4">
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
              <label htmlFor={`invite-${list.id}`} className="sr-only">{t('inviteMember')}</label>
              <select
                id={`invite-${list.id}`}
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                className="flex-1 min-h-11 bg-surface-base border border-field-border rounded-button px-3 py-2 text-base md:text-sm text-text-primary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
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
