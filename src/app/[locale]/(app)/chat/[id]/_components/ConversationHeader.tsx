import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { ConversationOptions } from './ConversationOptions'
import type { OtherUser } from './conversation'

/** Cabecera: volver a la lista, con quién se habla y las opciones. */
export function ConversationHeader({
  conversationId,
  otherUser,
  onBlocked,
}: {
  conversationId: string
  otherUser: OtherUser | null
  onBlocked: () => void
}) {
  const t = useTranslations('chat')

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface-default">
      <Link
        href="/chat"
        aria-label={t('backToChats')}
        className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </Link>
      {otherUser ? (
        <>
          <Avatar initials={otherUser.avatar_initials} color={otherUser.avatar_color} size="sm" />
          <Link
            href={`/profile/${otherUser.username}`}
            className="font-semibold text-sm text-text-primary hover:text-accent-info transition-colors"
          >
            {otherUser.username}
          </Link>
        </>
      ) : (
        <span className="text-sm text-text-secondary">{t('otherLeft')}</span>
      )}
      <ConversationOptions
        conversationId={conversationId}
        otherUser={otherUser}
        onBlocked={onBlocked}
      />
    </div>
  )
}
