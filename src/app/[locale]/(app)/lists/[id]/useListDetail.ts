// ============================================================
// KULTURA — /lists/[id]: estado y llamadas al servidor del detalle
// (títulos, miembros, privacidad y borrado). La descripción va aparte,
// en useListDescription.
// ============================================================

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { createLogger } from '@/lib/logger'
import { ApiError } from '@/lib/api/client'
import {
  deleteList,
  inviteListMember,
  removeListItem,
  removeListMember,
  updateList,
} from '@/lib/lists/client'
import { LIST_ERRORS } from '@/lib/lists/errors'
import type { List, ListItem, ListMember } from '@/types/list'
import { memberFromFriend, type ListFriend } from './list-detail-utils'

const log = createLogger('ListDetail')

interface UseListDetailArgs {
  list: Pick<List, 'id' | 'isPublic'>
  initialItems: ListItem[]
  initialMembers: ListMember[]
  currentUserFriends: ListFriend[]
}

export function useListDetail({ list, initialItems, initialMembers, currentUserFriends }: UseListDetailArgs) {
  const t = useTranslations('lists')
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
  const onItemsChange = useCallback((next: ListItem[]) => setItems(next), [])

  async function handleVisibilityChange(value: string) {
    const next = value === 'public'
    if (next === isPublic || savingVisibility) return
    setSavingVisibility(true)
    setActionError(null)
    setIsPublic(next) // optimista: se revierte si falla
    try {
      await updateList(list.id, { isPublic: next })
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
      await deleteList(list.id)
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
      await removeListItem(list.id, itemId)
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
      await inviteListMember(list.id, inviteUserId)
      const friend = currentUserFriends.find((f) => f.id === inviteUserId)
      if (friend) {
        setMembers((prev) => [...prev, memberFromFriend(list.id, friend)])
      }
      setInviteUserId('')
    } catch (err) {
      const notFriend = err instanceof ApiError && err.code === 'forbidden' && err.message === LIST_ERRORS.notFriends
      if (!notFriend) log.error('Failed to invite member', { err })
      setActionError(notFriend ? t('inviteNotFriend') : t('inviteError'))
    } finally {
      setInviting(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    setActionError(null)
    try {
      await removeListMember(list.id, userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch (err) {
      log.error('Failed to remove member', { err })
      setActionError(t('removeMemberError'))
    }
  }

  return {
    items,
    onItemsChange,
    removingItem,
    handleRemoveItem,
    reordering,
    toggleReordering: () => setReordering((v) => !v),
    members,
    inviteUserId,
    setInviteUserId,
    inviting,
    handleInvite,
    handleRemoveMember,
    isPublic,
    handleVisibilityChange,
    confirmDelete,
    openConfirmDelete: () => setConfirmDelete(true),
    closeConfirmDelete: () => setConfirmDelete(false),
    deleting,
    deleteError,
    handleDeleteList,
    actionError,
  }
}
