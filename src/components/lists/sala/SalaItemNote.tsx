'use client'

// ============================================================
// KULTURA — Nota de un título de la lista en «Sala» (fase 8.5 L4)
// El comportamiento es el de `ItemNote` (`useItemNote`): se ve si existe;
// quien puede editar la añade, cambia o borra en línea (vacía, se quita), y
// si falla el texto no se pierde. Aquí cambia la vista: `SalaTextarea` con
// su contador y su error, «Cancelar» y «Guardar nota» de 48 px, y el botón
// que abre el editor dice de qué título es la nota.
// ============================================================

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaTextarea } from '@/components/sala/SalaTextarea'
import { cn } from '@/lib/utils/index'
import type { ListItem } from '@/types/list'
import { NOTE_MAX, useItemNote } from '@/app/[locale]/(app)/lists/[id]/useItemNote'

interface SalaItemNoteProps {
  listId: string
  item: ListItem
  editable: boolean
  onSaved: (note: string | null) => void
  className?: string
}

export function SalaItemNote({ listId, item, editable, onSaved, className }: SalaItemNoteProps) {
  const t = useTranslations('lists')
  const td = useTranslations('diary')
  const fieldId = useId()
  const note = useItemNote(listId, item, onSaved)
  const title = item.media?.title ?? item.mediaId

  if (note.editing) {
    return (
      <form onSubmit={note.save} className={cn('flex flex-col gap-3', className)}>
        <SalaTextarea
          ref={note.fieldRef}
          id={fieldId}
          label={t('noteLabel', { title })}
          error={note.error ? t('noteError') : undefined}
          value={note.draft}
          onChange={(e) => note.setDraft(e.target.value)}
          onKeyDown={note.onFieldKeyDown}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder={t('notePlaceholder')}
          counter={(count, max) => td('chars', { count, max })}
        />
        <div className="flex flex-wrap gap-3">
          <SalaButton type="button" variant="quiet" onClick={note.close} disabled={note.saving}>
            {t('cancel')}
          </SalaButton>
          <SalaButton type="submit" loading={note.saving} loadingLabel={t('sala.savingNote')}>
            {t('noteSave')}
          </SalaButton>
        </div>
      </form>
    )
  }

  if (!item.note && !editable) return null

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      {item.note ? (
        <p className="whitespace-pre-line sala-type-small text-sala-ink-secondary [overflow-wrap:anywhere]">
          <span className="sr-only">{t('noteFor', { title })}: </span>
          {item.note}
        </p>
      ) : null}
      {editable ? (
        <SalaButton
          ref={note.toggleRef}
          variant="quiet"
          onClick={note.open}
          aria-label={item.note ? t('editNoteNamed', { title }) : t('addNoteNamed', { title })}
          className="-ms-6"
        >
          {item.note ? t('editNote') : t('addNote')}
        </SalaButton>
      ) : null}
    </div>
  )
}
