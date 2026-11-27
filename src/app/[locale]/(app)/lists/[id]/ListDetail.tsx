'use client'

import type { List, ListItem, ListMember } from '@/types/list'
import { ListHeader } from './ListHeader'
import { DeleteListDialog } from './DeleteListDialog'
import { ListItemsSection } from './ListItemsSection'
import { ListMembersSection } from './ListMembersSection'
import { useListDetail } from './useListDetail'
import { useListDescription } from './useListDescription'
import { canSeeListMembers, invitableFriends, type ListFriend } from './list-detail-utils'

interface ListDetailProps {
  list: List
  items: ListItem[]
  members: ListMember[]
  currentUserId: string
  currentUserFriends: ListFriend[]
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
  const detail = useListDetail({ list, initialItems, initialMembers, currentUserFriends })
  const description = useListDescription(list.id, list.description)
  const ranked = list.template === 'ranking'
  const canOrder = canEdit
  const isOwner = list.ownerId === currentUserId
  // Miembros: solo para el dueño y los miembros (el servidor ya no los manda
  // a los demás; aquí tampoco se pinta la sección vacía).
  const showMembers = canSeeListMembers(list, detail.members, currentUserId)

  return (
    <div className="flex flex-col gap-10">
      <ListHeader
        list={list}
        members={showMembers ? detail.members : []}
        itemCount={detail.items.length}
        isOwner={isOwner}
        canEdit={canEdit}
        description={description}
        isPublic={detail.isPublic}
        onVisibilityChange={detail.handleVisibilityChange}
        onDeleteClick={detail.openConfirmDelete}
      />

      {/* ACC-3: los fallos se anuncian. */}
      {detail.deleteError && <p role="alert" className="text-sm text-accent-danger">{detail.deleteError}</p>}
      {detail.actionError && <p role="alert" className="text-sm text-accent-danger">{detail.actionError}</p>}

      <DeleteListDialog
        isOpen={detail.confirmDelete}
        deleting={detail.deleting}
        onConfirm={detail.handleDeleteList}
        onCancel={detail.closeConfirmDelete}
      />

      <ListItemsSection
        listId={list.id}
        items={detail.items}
        onItemsChange={detail.onItemsChange}
        ranked={ranked}
        canEdit={canEdit}
        canOrder={canOrder}
        reordering={detail.reordering}
        onToggleReordering={detail.toggleReordering}
        removingItem={detail.removingItem}
        onRemoveItem={detail.handleRemoveItem}
      />

      {/* Miembros (solo listas colaborativas, y solo para su dueño y sus miembros) */}
      {list.isCollaborative && showMembers && (
        <ListMembersSection
          list={list}
          members={detail.members}
          isOwner={isOwner}
          onRemoveMember={detail.handleRemoveMember}
          invitableFriends={invitableFriends(detail.members, list.ownerId, currentUserFriends)}
          inviteUserId={detail.inviteUserId}
          onInviteUserIdChange={detail.setInviteUserId}
          inviting={detail.inviting}
          onInvite={detail.handleInvite}
        />
      )}
    </div>
  )
}
