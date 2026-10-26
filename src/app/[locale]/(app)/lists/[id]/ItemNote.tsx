'use client'

// ============================================================
// KULTURA — Nota de un título dentro de una lista (F-25, PRO-10)
// Se ve siempre que exista; quien puede editar la lista la añade, cambia o
// borra en línea (un campo vacío la quita). El fallo se anuncia y el texto
// escrito no se pierde.
// ============================================================

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'
import type { ListItem } from '@/types/list'

export const NOTE_MAX = 500

const TEXTAREA_CLASS = cn(
  'w-full min-h-[72px] resize-y rounded-[14px] bg-surface-elevated px-4 py-3',
  'border border-field-border',
  'font-body text-base md:text-[14px] text-text-primary placeholder:text-text-tertiary',
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'
)

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
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const title = item.media?.title ?? item.mediaId

  function open() {
    setDraft(item.note ?? '')
    setError(false)
    setEditing(true)
    requestAnimationFrame(() => fieldRef.current?.focus())
  }

  function close() {
    setEditing(false)
    requestAnimationFrame(() => toggleRef.current?.focus())
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(false)
    try {
      const res = await fetch(`/api/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, note: draft }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json().catch(() => ({}))) as { note?: string | null }
      onSaved(data.note ?? (draft.trim() || null))
      close()
    } catch {
      setError(true)
      fieldRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className={cn('flex flex-col gap-2', className)}>
        <label htmlFor={fieldId} className="text-[13px] font-bold text-text-tertiary">
          {t('noteLabel', { title })}
        </label>
        <textarea
          ref={fieldRef}
          id={fieldId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder={t('notePlaceholder')}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              close()
            }
          }}
          className={TEXTAREA_CLASS}
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
        <p className="text-[13px] leading-snug text-text-secondary whitespace-pre-line break-words">
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
          className="inline-flex min-h-11 items-center text-[13px] font-bold text-accent-pink underline-offset-4 hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring rounded-sm"
        >
          {item.note ? t('editNote') : t('addNote')}
        </button>
      )}
    </div>
  )
}
