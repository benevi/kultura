import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
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
    <div className="mt-3 flex gap-2">
      <label htmlFor={`invite-${listId}`} className="sr-only">{t('inviteMember')}</label>
      <select
        id={`invite-${listId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-h-11 bg-surface-base border border-field-border rounded-button px-3 py-2 text-base md:text-sm text-text-primary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <option value="">{t('selectFriend')}</option>
        {friends.map((f) => (
          <option key={f.id} value={f.id}>{f.username}</option>
        ))}
      </select>
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
