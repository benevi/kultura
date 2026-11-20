import type { FormEvent } from 'react'
import { useTranslations } from 'next-intl'

/** Campo de escribir — F-11: si ya no se puede escribir, se explica por qué. */
export function MessageComposer({
  canSend,
  text,
  onTextChange,
  sending,
  onSubmit,
}: {
  canSend: boolean
  text: string
  onTextChange: (text: string) => void
  sending: boolean
  onSubmit: (e: FormEvent) => void
}) {
  const t = useTranslations('chat')
  const tm = useTranslations('moderation')

  if (!canSend) {
    return (
      <p
        role="status"
        className="px-4 py-4 border-t border-surface-border bg-surface-default text-sm text-text-secondary text-center"
      >
        {tm('cannotMessage')}
      </p>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 px-4 py-3 border-t border-surface-border bg-surface-default"
    >
      <input
        type="text"
        value={text}
        onChange={e => onTextChange(e.target.value)}
        placeholder={t('messagePlaceholder')}
        aria-label={t('messageLabel')}
        maxLength={2000}
        enterKeyHint="send"
        className="flex-1 min-h-11 bg-surface-elevated border border-field-border rounded-full px-4 py-2 text-base md:text-sm text-text-primary placeholder-text-tertiary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      />
      <button
        type="submit"
        disabled={!text.trim() || sending}
        className="w-11 h-11 rounded-full bg-accent-pink text-on-accent-pink flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-colors flex-shrink-0 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        aria-label={t('send')}
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </form>
  )
}
