import { useState, useId } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { InlineConfirm, ReportButton, useRestoreFocus } from '@/components/social/ReportButton'
import { blockUser, leaveConversation } from '@/lib/social/actions'
import type { OtherUser } from './conversation'

/** Opciones de la conversación: denunciar y bloquear al otro, salir del chat. */
export function ConversationOptions({
  conversationId,
  otherUser,
  onBlocked,
}: {
  conversationId: string
  otherUser: OtherUser | null
  onBlocked: () => void
}) {
  const t = useTranslations('moderation')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<'block' | 'leave' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const { ref: toggleRef, restore } = useRestoreFocus()
  const panelId = useId()

  function cancel() {
    setConfirm(null)
    setError(null)
    restore()
  }

  async function handleBlock() {
    if (!otherUser) return
    setBusy(true)
    setError(null)
    try {
      await blockUser(otherUser.id)
      setBlocked(true)
      setConfirm(null)
      onBlocked()
    } catch {
      setError(t('blockError'))
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave() {
    setBusy(true)
    setError(null)
    try {
      await leaveConversation(conversationId)
      router.push('/chat')
    } catch {
      setError(t('leaveError'))
      setBusy(false)
    }
  }

  return (
    <div className="ml-auto relative">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => { setOpen((v) => !v); setConfirm(null); setError(null) }}
        className="inline-flex items-center justify-center w-11 h-11 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
      >
        <span className="sr-only">{t('conversationOptions')}</span>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
          <circle cx="5" cy="12" r="2.2" /><circle cx="12" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" />
        </svg>
      </button>
      {open && (
        <div
          id={panelId}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !confirm) {
              setOpen(false)
              toggleRef.current?.focus()
            }
          }}
          className="absolute right-0 top-12 z-20 w-72 max-w-[calc(100vw-2rem)] flex flex-col gap-2 p-3 bg-surface-elevated border border-surface-border rounded-2xl shadow-soft"
        >
          {confirm === 'block' ? (
            <InlineConfirm
              title={t('blockConfirmTitle')}
              body={t('blockConfirmBody')}
              confirmLabel={t('block')}
              cancelLabel={t('cancel')}
              loading={busy}
              error={error}
              onConfirm={handleBlock}
              onCancel={cancel}
            />
          ) : confirm === 'leave' ? (
            <InlineConfirm
              title={t('leaveConfirmTitle')}
              body={t('leaveConfirmBody')}
              confirmLabel={t('leave')}
              cancelLabel={t('cancel')}
              loading={busy}
              error={error}
              onConfirm={handleLeave}
              onCancel={cancel}
            />
          ) : (
            <>
              {otherUser && (
                <ReportButton targetType="user" targetId={otherUser.id} contextLabel={otherUser.username} />
              )}
              {otherUser && !blocked && (
                <KButton
                  variant="danger"
                  size="sm"
                  className="justify-start"
                  onClick={() => setConfirm('block')}
                >
                  {t('blockUser', { username: otherUser.username })}
                </KButton>
              )}
              {blocked && <p role="status" className="text-xs text-text-secondary">{t('blockedNotice')}</p>}
              <KButton
                variant="danger"
                size="sm"
                className="justify-start"
                onClick={() => setConfirm('leave')}
              >
                {t('leave')}
              </KButton>
            </>
          )}
        </div>
      )}
    </div>
  )
}
