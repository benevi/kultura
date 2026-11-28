'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { KTextarea } from '@/components/ui/KTextarea'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/utils/index'
import {
  LIST_DESCRIPTION_MAX as DESCRIPTION_MAX,
  LIST_FORM_TEMPLATES as TEMPLATES,
  LIST_MEDIA_TYPE_KEYS as MEDIA_TYPE_KEYS,
  LIST_VISIBILITIES as VISIBILITIES,
  useCreateListForm,
  type ListMediaTypeKey as MediaTypeKey,
} from '@/components/social/useCreateListForm'

interface CreateListModalProps {
  onClose: () => void
}

/**
 * «Crear lista» de hoy. El estado y el alta salen de `useCreateListForm`
 * (fase 8.5 L2), el mismo que usa la versión de «Sala» (`SalaCreateListDialog`).
 */
export function CreateListModal({ onClose }: CreateListModalProps) {
  const t = useTranslations('lists')
  const tf = useTranslations('filters')
  const tc = useTranslations('common')
  const errorId = useId()
  const descriptionId = useId()
  const {
    nameRef,
    name,
    setName,
    nameError,
    namePlaceholder,
    mediaType,
    setMediaType,
    template,
    setTemplate: chooseTemplate,
    typeLocked,
    description,
    setDescription,
    isCollaborative,
    setIsCollaborative,
    visibility,
    setVisibility,
    loading,
    error,
    handleCreate,
  } = useCreateListForm(onClose)

  const typeOptions = [
    ...MEDIA_TYPE_KEYS.map((key) => ({ value: key, label: tf(key) })),
    { value: 'mixed', label: t('mediaTypeMixed') },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      variant="sheet"
      title={t('createList')}
      closeLabel={tc('close')}
      initialFocusRef={nameRef}
      dismissible={!loading}
    >
      <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
        {/* F-25: plantilla primero (cambia el ejemplo del nombre y el tipo). */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm text-muted">{t('templateLabel')}</legend>
          {TEMPLATES.map((option) => {
            const checked = template === option
            return (
              <label
                key={option}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-surface-default px-3 py-3 transition-colors',
                  checked && 'ring-2 ring-accent-pink'
                )}
              >
                <input
                  type="radio"
                  name="list-template"
                  value={option}
                  checked={checked}
                  onChange={() => chooseTemplate(option)}
                  className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-accent-pink"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-text-primary">{t(`template.${option}`)}</span>
                  <span className="text-xs text-text-tertiary">{t(`template.${option}Hint`)}</span>
                </span>
              </label>
            )
          })}
        </fieldset>

        <KInput
          ref={nameRef}
          label={t('listName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={namePlaceholder()}
          error={nameError}
          maxLength={80}
          aria-required="true"
          autoComplete="off"
        />

        {typeLocked ? (
          <p className="text-sm text-text-secondary">
            <span className="font-bold text-text-primary">{t('mediaType')}:</span> {t('mediaTypeMixed')}
          </p>
        ) : (
          <Select
            label={t('mediaType')}
            value={mediaType}
            onChange={(v) => setMediaType(v as MediaTypeKey)}
            options={typeOptions}
          />
        )}

        <KTextarea
          id={descriptionId}
          label={t('descriptionLabel')}
          hint={t('descriptionHint', { count: DESCRIPTION_MAX - description.length })}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={3}
          placeholder={t('descriptionPlaceholder')}
          className="min-h-[88px]"
        />

        {/* Visibilidad: radios nativos (flechas y lector gratis), privada marcada. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm text-muted">
            {t('visibilityLabel')}
          </legend>
          {VISIBILITIES.map((option) => {
            const checked = visibility === option
            const label = option === 'private' ? t('visibilityPrivate') : t('visibilityPublic')
            const hint = option === 'private' ? t('visibilityPrivateHint') : t('visibilityPublicHint')
            return (
              <label
                key={option}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-surface-default px-3 py-3 transition-colors',
                  checked && 'ring-2 ring-accent-pink'
                )}
              >
                <input
                  type="radio"
                  name="list-visibility"
                  value={option}
                  checked={checked}
                  onChange={() => setVisibility(option)}
                  className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-accent-pink"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-text-primary">{label}</span>
                  <span className="text-xs text-text-tertiary">{hint}</span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {/* Colaborativa */}
        <label className="flex min-h-11 items-center gap-3 cursor-pointer rounded-2xl bg-surface-default px-3 py-3">
          <input
            type="checkbox"
            checked={isCollaborative}
            onChange={(e) => setIsCollaborative(e.target.checked)}
            className="accent-accent-positive w-5 h-5 flex-shrink-0"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">{t('collaborative')}</span>
            <span className="text-xs text-text-tertiary">{t('collaborativeHint')}</span>
          </span>
        </label>

        {error && (
          <p id={errorId} role="alert" className="text-sm text-accent-danger">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <KButton type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {tc('cancel')}
          </KButton>
          <KButton
            type="submit"
            variant="primary"
            loading={loading}
            aria-describedby={error ? errorId : undefined}
          >
            {t('create')}
          </KButton>
        </div>
      </form>
    </Modal>
  )
}
