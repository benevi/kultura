'use client'

// ============================================================
// KULTURA — «Crear lista» en «Sala» (fase 8.5 L2, bandera SALA_LISTAS)
// Lo mismo que `CreateListModal` (plantilla, nombre, formato, descripción,
// visibilidad y colaborativa) con los componentes de `components/sala`. El
// estado y el alta salen de `useCreateListForm`: solo cambia la vista.
//
// - Hoja en móvil, diálogo centrado en escritorio (`SalaDialog`). El foco
//   entra en el nombre; Escape y «Cancelar» cierran salvo mientras crea.
// - Plantilla y visibilidad con `SalaRadioGroup` (radios nativos: flechas y
//   lector gratis), cada opción con su explicación ligada.
// - El formato, con un `<select>` nativo; con «Franquicia», fijo en «Varios
//   formatos» y dicho en texto.
// - La descripción, con su contador; la colaborativa, con `SalaSwitch`.
// - El error del nombre va en el campo (anunciado, y el foco vuelve a él); el
//   del alta, dentro del diálogo (`error`).
// - «Cancelar» primero y «Crear» al final, como en todos los diálogos de «Sala».
//
// Solo lo carga `SalaListsIndex` al pulsar «Nueva lista» (`next/dynamic`).
// ============================================================

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { SalaDialog } from '@/components/sala/SalaDialog'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaInput } from '@/components/sala/SalaInput'
import { SalaRadio, SalaRadioGroup } from '@/components/sala/SalaRadioGroup'
import { SalaSelect } from '@/components/sala/SalaSelect'
import { SalaSwitch } from '@/components/sala/SalaSwitch'
import { SalaTextarea } from '@/components/sala/SalaTextarea'
import {
  LIST_DESCRIPTION_MAX,
  LIST_FORM_TEMPLATES,
  LIST_MEDIA_TYPE_KEYS,
  LIST_NAME_MAX,
  LIST_VISIBILITIES,
  useCreateListForm,
  type ListMediaTypeKey,
  type ListTemplateKey,
  type ListVisibility,
} from '@/components/social/useCreateListForm'

export function SalaCreateListDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('lists')
  const tType = useTranslations('discoverFilters.typeBadge')
  const tc = useTranslations('common')
  const td = useTranslations('diary')
  const formId = useId()
  const form = useCreateListForm(onClose)

  const counter = (count: number, max: number) => td('chars', { count, max })

  return (
    <SalaDialog
      open
      onClose={onClose}
      variant="sheet"
      title={t('createList')}
      dismissible={!form.loading}
      initialFocusRef={form.nameRef}
      error={form.error}
      closeLabel={tc('close')}
      footer={
        <>
          <SalaButton type="button" variant="quiet" onClick={onClose} disabled={form.loading}>
            {tc('cancel')}
          </SalaButton>
          <SalaButton type="submit" form={formId} variant="primary" loading={form.loading} loadingLabel={t('sala.creating')}>
            {t('create')}
          </SalaButton>
        </>
      }
    >
      {/* `noValidate`: los errores los dicen los campos, no el globo del navegador. */}
      <form id={formId} onSubmit={form.handleCreate} noValidate className="flex flex-col gap-6" data-testid="sala-create-list-form">
        {/* F-25: plantilla primero (cambia el ejemplo del nombre y el formato). */}
        <SalaRadioGroup
          legend={t('templateLabel')}
          name="list-template"
          value={form.template}
          onChange={(v) => form.setTemplate(v as ListTemplateKey)}
        >
          {LIST_FORM_TEMPLATES.map((option) => (
            <SalaRadio key={option} value={option} label={t(`template.${option}`)} hint={t(`template.${option}Hint`)} />
          ))}
        </SalaRadioGroup>

        <SalaInput
          ref={form.nameRef}
          label={t('listName')}
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          placeholder={form.namePlaceholder()}
          error={form.nameError || undefined}
          maxLength={LIST_NAME_MAX}
          aria-required="true"
          autoComplete="off"
        />

        {form.typeLocked ? (
          <p className="sala-type-small text-sala-ink-secondary">
            <span className="font-semibold text-sala-ink">{t('mediaType')}:</span> {t('mediaTypeMixed')}
          </p>
        ) : (
          <SalaSelect
            label={t('mediaType')}
            value={form.mediaType}
            onChange={(e) => form.setMediaType(e.target.value as ListMediaTypeKey)}
            fieldClassName="max-w-[20rem]"
          >
            {LIST_MEDIA_TYPE_KEYS.map((key) => (
              <option key={key} value={key}>
                {tType(key)}
              </option>
            ))}
            <option value="mixed">{t('mediaTypeMixed')}</option>
          </SalaSelect>
        )}

        <SalaTextarea
          label={t('descriptionLabel')}
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          maxLength={LIST_DESCRIPTION_MAX}
          rows={3}
          placeholder={t('descriptionPlaceholder')}
          counter={counter}
        />

        {/* Visibilidad: privada marcada de inicio (X5). */}
        <SalaRadioGroup
          legend={t('visibilityLabel')}
          name="list-visibility"
          value={form.visibility}
          onChange={(v) => form.setVisibility(v as ListVisibility)}
        >
          {LIST_VISIBILITIES.map((option) => (
            <SalaRadio
              key={option}
              value={option}
              label={option === 'private' ? t('visibilityPrivate') : t('visibilityPublic')}
              hint={option === 'private' ? t('visibilityPrivateHint') : t('visibilityPublicHint')}
            />
          ))}
        </SalaRadioGroup>

        <SalaSwitch
          label={t('collaborative')}
          hint={t('collaborativeHint')}
          checked={form.isCollaborative}
          onChange={(e) => form.setIsCollaborative(e.target.checked)}
        />
      </form>
    </SalaDialog>
  )
}
