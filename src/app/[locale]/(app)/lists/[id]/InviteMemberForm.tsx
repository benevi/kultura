import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { Select } from '@/components/ui/Select'
import type { ListFriend } from './list-detail-utils'

interface InviteMemberFormProps {
  listId: string
  friends: ListFriend[]
  value: string
  onChange: (userId: string) => void
  inviting: boolean
  onInvite: () => void
}

/** Selector de amigo + «Invitar» (solo el dueño, si queda alguien). */
export function InviteMemberForm({ listId, friends, value, onChange, inviting, onInvite }: InviteMemberFormProps) {
  const t = useTranslations('lists')

  return (
    <div className="mt-3 flex items-center gap-2">
      <label htmlFor={`invite-${listId}`} className="sr-only">{t('inviteMember')}</label>
      <div className="min-w-0 flex-1">
        <Select
          id={`invite-${listId}`}
          value={value}
          onChange={onChange}
          options={[
            { value: '', label: t('selectFriend') },
            ...friends.map((f) => ({ value: f.id, label: f.username })),
          ]}
        />
      </div>
      <KButton
        variant="primary"
        size="sm"
        loading={inviting}
        disabled={!value}
        onClick={onInvite}
      >
        {t('invite')}
      </KButton>
    </div>
  )
}
