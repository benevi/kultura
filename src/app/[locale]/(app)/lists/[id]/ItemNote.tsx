'use client'

// ============================================================
// KULTURA — Nota de un título dentro de una lista (F-25, PRO-10)
// Se ve siempre que exista; quien puede editar la lista la añade, cambia o
// borra en línea (un campo vacío la quita). El fallo se anuncia y el texto
// escrito no se pierde.
// ============================================================

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { K_FIELD_ERROR } from '@/components/ui/KField'
import { KTextarea } from '@/components/ui/KTextarea'
import { cn } from '@/lib/utils/index'
import type { ListItem } from '@/types/list'
import { NOTE_MAX, useItemNote } from './useItemNote'

export { NOTE_MAX } from './useItemNote'

interface ItemNoteProps {
  listId: string
  item: ListItem
  editable: boolean
  onSaved: (note: string | null) => void
  className?: string
}

export function ItemNote({ listId, item, editable, onSaved, className }: ItemNoteProps) {
  const t = useTranslations('lists')
  const fieldId = useId()
  const hintId = useId()
  const errorId = useId()
  const { fieldRef, toggleRef, editing, draft, setDraft, saving, error, open, close, save, onFieldKeyDown } =
    useItemNote(listId, item, onSaved)
  const title = item.media?.title ?? item.mediaId

  if (editing) {
    return (
      <form onSubmit={save} className={cn('flex flex-col gap-2', className)}>
        <KTextarea
          ref={fieldRef}
          id={fieldId}
          label={t('noteLabel', { title })}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder={t('notePlaceholder')}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          onKeyDown={onFieldKeyDown}
          className={cn('min-h-[72px]', error && K_FIELD_ERROR)}
        />
        <p id={hintId} className="text-xs text-text-tertiary">
          {t('noteHint', { count: NOTE_MAX - draft.length })}
        </p>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-accent-danger">{t('noteError')}</p>
        )}
        <div className="flex gap-2">
          <KButton type="submit" size="sm" loading={saving}>{t('noteSave')}</KButton>
          <KButton type="button" size="sm" variant="secondary" onClick={close} disabled={saving}>
            {t('cancel')}
          </KButton>
        </div>
      </form>
    )
  }

  if (!item.note && !editable) return null

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      {item.note ? (
        <p className="text-meta leading-snug text-text-secondary whitespace-pre-line break-words">
          <span className="sr-only">{t('noteFor', { title })}: </span>
          {item.note}
        </p>
      ) : null}
      {editable && (
        <button
          ref={toggleRef}
          type="button"
          onClick={open}
          aria-label={item.note ? t('editNoteNamed', { title }) : t('addNoteNamed', { title })}
          className="inline-flex min-h-11 items-center text-meta font-bold text-accent-pink underline-offset-4 hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring rounded-lg"
        >
          {item.note ? t('editNote') : t('addNote')}
        </button>
      )}
    </div>
  )
}
