import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { InlineConfirm, ReportButton, useRestoreFocus } from '@/components/social/ReportButton'
import { deleteMessage } from '@/lib/social/actions'
import { isTempMessage, type Message } from './conversation'

/** Papelera rellena (borrar un mensaje propio). */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="3" y="4.5" width="18" height="3" rx="1.5" />
      <rect x="9" y="2" width="6" height="3" rx="1.5" />
      <path d="M5.5 9h13l-1.1 11.1A2 2 0 0 1 15.4 22H8.6a2 2 0 0 1-2-1.9z" />
    </svg>
  )
}

/** Acción por mensaje: denunciar (ajeno) o borrar (propio, con confirmación). */
export function MessageActions({
  conversationId,
  message,
  isMine,
  onDeleted,
}: {
  conversationId: string
  message: Pick<Message, 'id' | 'users'>
  isMine: boolean
  onDeleted: (id: string) => void
}) {
  const t = useTranslations('moderation')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { ref: triggerRef, restore } = useRestoreFocus()

  if (isTempMessage(message)) return null

  if (!isMine) {
    return (
      <ReportButton
        variant="icon"
        targetType="message"
        targetId={message.id}
        contextLabel={message.users?.username}
      />
    )
  }

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await deleteMessage(conversationId, message.id)
      onDeleted(message.id)
    } catch {
      setError(t('deleteMessageError'))
      setBusy(false)
    }
  }

  if (confirming) {
    return (
      <InlineConfirm
        title={t('deleteMessageConfirmTitle')}
        body={t('deleteMessageConfirmBody')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        loading={busy}
        error={error}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirming(false)
          setError(null)
          restore()
        }}
      />
    )
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={t('deleteMessage')}
      onClick={() => setConfirming(true)}
      className="inline-flex items-center justify-center w-11 h-11 rounded-full text-text-tertiary hover:text-accent-danger hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
    >
      <TrashIcon className="w-4 h-4" />
    </button>
  )
}
