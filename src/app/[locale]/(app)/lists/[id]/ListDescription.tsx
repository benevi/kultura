'use client'

import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { DESCRIPTION_MAX } from './list-detail-utils'
import type { ListDescriptionState } from './useListDescription'

export type ListDescriptionProps = Pick<
  ListDescriptionState,
  'description' | 'editing' | 'draft' | 'setDraft' | 'saving' | 'error' | 'fieldId' | 'hintId' | 'startEditing' | 'cancelEditing' | 'save'
> & {
  /** Solo el dueño puede escribirla. */
  isOwner: boolean
}

/** Descripción de la lista y, para el dueño, su editor. */
export function ListDescription({
  description,
  editing,
  draft,
  setDraft,
  saving,
  error,
  fieldId,
  hintId,
  startEditing,
  cancelEditing,
  save,
  isOwner,
}: ListDescriptionProps) {
  const t = useTranslations('lists')

  return (
    <>
      {description && !editing && (
        <p className="mt-4 max-w-2xl text-body leading-relaxed text-text-secondary whitespace-pre-line break-words">
          {description}
        </p>
      )}
      {isOwner && !editing && (
        <button
          type="button"
          onClick={startEditing}
          className="mt-2 inline-flex min-h-11 items-center rounded-lg text-meta font-bold text-accent-pink underline-offset-4 hover:underline focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {description ? t('editDescription') : t('addDescription')}
        </button>
      )}
      {isOwner && editing && (
        <form onSubmit={save} className="mt-4 flex max-w-2xl flex-col gap-2">
          <label htmlFor={fieldId} className="text-meta font-bold text-text-tertiary">
            {t('descriptionLabel')}
          </label>
          <textarea
            id={fieldId}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            placeholder={t('descriptionPlaceholder')}
            aria-describedby={hintId}
            aria-invalid={error ? true : undefined}
            className="w-full min-h-[88px] resize-y rounded-2xl border border-field-border bg-surface-elevated px-4 py-3 font-body text-base md:text-body text-text-primary placeholder:text-text-tertiary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          />
          <p id={hintId} className="text-xs text-text-tertiary">
            {t('descriptionHint', { count: DESCRIPTION_MAX - draft.length })}
          </p>
          {error && <p role="alert" className="text-sm text-accent-danger">{t('descriptionError')}</p>}
          <div className="flex gap-2">
            <KButton type="submit" size="sm" loading={saving}>{t('descriptionSave')}</KButton>
            <KButton type="button" size="sm" variant="secondary" onClick={cancelEditing} disabled={saving}>
              {t('cancel')}
            </KButton>
          </div>
        </form>
      )}
    </>
  )
}
