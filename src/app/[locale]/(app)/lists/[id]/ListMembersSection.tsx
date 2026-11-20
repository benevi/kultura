import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import type { List, ListMember } from '@/types/list'
import { InviteMemberForm } from './InviteMemberForm'
import type { ListFriend } from './list-detail-utils'

interface ListMembersSectionProps {
  list: Pick<List, 'id' | 'owner'>
  members: ListMember[]
  isOwner: boolean
  onRemoveMember: (userId: string) => void
  invitableFriends: ListFriend[]
  inviteUserId: string
  onInviteUserIdChange: (userId: string) => void
  inviting: boolean
  onInvite: () => void
}

/** Miembros de una lista colaborativa y, para el dueño, invitar y quitar. */
export function ListMembersSection({
  list,
  members,
  isOwner,
  onRemoveMember,
  invitableFriends,
  inviteUserId,
  onInviteUserIdChange,
  inviting,
  onInvite,
}: ListMembersSectionProps) {
  const t = useTranslations('lists')

  return (
    <section>
      <h2 className="font-display text-xl font-bold mb-4 text-text-primary">{t('membersTitle')}</h2>
      <div className="bg-surface-default rounded-bento divide-y divide-surface-border overflow-hidden">
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
                  onClick={() => onRemoveMember(m.userId)}
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
        <InviteMemberForm
          listId={list.id}
          friends={invitableFriends}
          value={inviteUserId}
          onChange={onInviteUserIdChange}
          inviting={inviting}
          onInvite={onInvite}
        />
      )}
    </section>
  )
}
