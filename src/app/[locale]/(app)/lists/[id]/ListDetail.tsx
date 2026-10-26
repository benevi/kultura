'use client'

import { useCallback, useId, useState } from 'react'
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
import { ReorderableItems } from './ReorderableItems'
import { ItemNote } from './ItemNote'

const log = createLogger('ListDetail')

interface ListDetailProps {
  list: List
  items: ListItem[]
  members: ListMember[]
  currentUserId: string
  currentUserFriends: Array<{ id: string; username: string; avatarColor: string; avatarInitials: string }>
  canEdit: boolean
  /** MIXED_LISTS (F-25): ordenar, notas y descripción. */
  mixedEnabled?: boolean
}

const DESCRIPTION_MAX = 500

export function ListDetail({
  list,
  items: initialItems,
  members: initialMembers,
  currentUserId,
  currentUserFriends,
  canEdit,
  mixedEnabled = false,
}: ListDetailProps) {
  const t = useTranslations('lists')
  const tf = useTranslations('filters')
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
  const [reordering, setReordering] = useState(false)
  const [description, setDescription] = useState(list.description ?? '')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)
  const [descriptionError, setDescriptionError] = useState(false)
  const descriptionFieldId = useId()
  const descriptionHintId = useId()
  const ranked = list.template === 'ranking'
  const canOrder = mixedEnabled && canEdit
  const onItemsChange = useCallback((next: ListItem[]) => setItems(next), [])

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
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setActionError(data.error === 'not_friends' ? t('inviteNotFriend') : t('inviteError'))
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

  async function handleSaveDescription(e: React.FormEvent) {
    e.preventDefault()
    setSavingDescription(true)
    setDescriptionError(false)
    try {
      const res = await fetch(`/api/lists/${list.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descriptionDraft }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDescription(descriptionDraft.trim())
      setEditingDescription(false)
    } catch (err) {
      log.error('description save failed', { message: err instanceof Error ? err.message : String(err) })
      setDescriptionError(true)
    } finally {
      setSavingDescription(false)
    }
  }

  const formatLabel = list.mediaType === 'mixed' ? t('mediaTypeMixed') : tf(list.mediaType)

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
              <span className="font-semibold text-text-secondary">{formatLabel}</span>
              {list.template ? ` · ${t(`template.${list.template}`)}` : ''}
              {' · '}
              {list.isCollaborative && (
                <span className="font-semibold text-text-primary">{t('collaborative')}</span>
              )}
              {list.isCollaborative && ' · '}
              {t('itemCount', { count: items.length })}
            </span>
          </div>
          {description && !editingDescription && (
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-secondary whitespace-pre-line break-words">
              {description}
            </p>
          )}
          {isOwner && mixedEnabled && !editingDescription && (
            <button
              type="button"
              onClick={() => {
                setDescriptionDraft(description)
                setDescriptionError(false)
                setEditingDescription(true)
              }}
              className="mt-2 inline-flex min-h-11 items-center rounded-sm text-[13px] font-bold text-accent-pink underline-offset-4 hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              {description ? t('editDescription') : t('addDescription')}
            </button>
          )}
          {isOwner && mixedEnabled && editingDescription && (
            <form onSubmit={handleSaveDescription} className="mt-4 flex max-w-2xl flex-col gap-2">
              <label htmlFor={descriptionFieldId} className="text-[13px] font-bold text-text-tertiary">
                {t('descriptionLabel')}
              </label>
              <textarea
                id={descriptionFieldId}
                autoFocus
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                maxLength={DESCRIPTION_MAX}
                rows={3}
                placeholder={t('descriptionPlaceholder')}
                aria-describedby={descriptionHintId}
                aria-invalid={descriptionError ? true : undefined}
                className="w-full min-h-[88px] resize-y rounded-[14px] border border-field-border bg-surface-elevated px-4 py-3 font-body text-base md:text-[15px] text-text-primary placeholder:text-text-tertiary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              />
              <p id={descriptionHintId} className="text-xs text-text-tertiary">
                {t('descriptionHint', { count: DESCRIPTION_MAX - descriptionDraft.length })}
              </p>
              {descriptionError && <p role="alert" className="text-sm text-accent-danger">{t('descriptionError')}</p>}
              <div className="flex gap-2">
                <KButton type="submit" size="sm" loading={savingDescription}>{t('descriptionSave')}</KButton>
                <KButton type="button" size="sm" variant="secondary" onClick={() => setEditingDescription(false)} disabled={savingDescription}>
                  {t('cancel')}
                </KButton>
              </div>
            </form>
          )}
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-text-primary">
            {t('itemsTitle')}
            <span className="ml-2 text-sm font-body font-medium text-text-secondary">{items.length}</span>
          </h2>
          {canOrder && items.length > 0 && (
            <KButton
              variant={reordering ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={reordering}
              onClick={() => setReordering((v) => !v)}
            >
              {reordering ? t('reorderDone') : t('reorder')}
            </KButton>
          )}
        </div>
        {reordering && canOrder && items.length > 0 ? (
          <ReorderableItems listId={list.id} items={items} onItemsChange={onItemsChange} ranked={ranked} />
        ) : items.length === 0 ? (
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
          // El orden manual es el orden de lectura (lista numerada); el número
          // solo se PINTA en un «Ranking personal».
          <ol className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-5" aria-label={t('itemsTitle')}>
            {items.map((item, index) => (
              <li key={item.id} className="relative group flex flex-col gap-2">
                {ranked && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-2 -top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-accent-lime px-2 font-display text-sm font-extrabold tabular-nums text-on-accent-lime shadow-[4px_4px_0_rgba(0,0,0,0.4)]"
                  >
                    {index + 1}
                  </span>
                )}
                {ranked && <span className="sr-only">{t('rankPosition', { position: index + 1 })}</span>}
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
                {/* En la rejilla la nota solo se lee; se escribe en «Ordenar y
                    anotar» (una fila por título, sin controles ocultos). */}
                {mixedEnabled && item.note ? (
                  <ItemNote listId={list.id} item={item} editable={false} onSaved={() => undefined} />
                ) : null}
              </li>
            ))}
          </ol>
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
