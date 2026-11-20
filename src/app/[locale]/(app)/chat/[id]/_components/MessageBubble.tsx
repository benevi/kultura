import { useTranslations, useLocale } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import { MessageActions } from './MessageActions'
import { timeLabel, type Message } from './conversation'

/** Un mensaje: avatar y nombre (si es ajeno), texto, hora y su acción. */
export function MessageBubble({
  conversationId,
  message: msg,
  isMine,
  onDeleted,
}: {
  conversationId: string
  message: Message
  isMine: boolean
  onDeleted: (id: string) => void
}) {
  const t = useTranslations('chat')
  const locale = useLocale()
  // Saneamiento 2.10 (Q6): al borrar su cuenta, el mensaje se queda
  // sin autor ni texto; la conversación del otro no se rompe.
  const orphaned = msg.sender_id === null

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isMine && msg.users && (
        <Avatar
          initials={msg.users.avatar_initials}
          color={msg.users.avatar_color}
          size="sm"
        />
      )}
      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* En los recibidos, el nombre de quien escribe acompaña al
            avatar: sin él solo se veían unas iniciales sueltas. */}
        {!isMine && (orphaned || msg.users?.username) && (
          <span className="text-xs font-semibold text-text-secondary px-1">
            {orphaned ? t('deletedUser') : msg.users?.username}
          </span>
        )}
        <div
          className={`px-3.5 py-2.5 text-sm leading-relaxed rounded-bento ${
            isMine
              ? 'bg-accent-pink text-on-accent-pink font-medium rounded-br-lg'
              : 'bg-surface-elevated text-text-primary rounded-bl-lg'
          }`}
        >
          {orphaned ? <span className="italic text-text-secondary">{t('deletedMessage')}</span> : msg.content}
        </div>
        <div className={`flex items-center gap-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs text-text-secondary px-1">
            {timeLabel(msg.created_at, locale)}
          </span>
          {!orphaned && (
            <MessageActions
              conversationId={conversationId}
              message={msg}
              isMine={isMine}
              onDeleted={onDeleted}
            />
          )}
        </div>
      </div>
    </div>
  )
}
