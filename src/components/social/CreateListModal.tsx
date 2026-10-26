'use client'

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/utils/index'

const MEDIA_TYPE_KEYS = ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game'] as const
type MediaTypeKey = typeof MEDIA_TYPE_KEYS[number] | 'mixed'

/** D-04c / X5: al crear se pregunta, y lo marcado de inicio es privada. */
const VISIBILITIES = ['private', 'public'] as const
type Visibility = typeof VISIBILITIES[number]

/**
 * F-25 (PRO-10): plantillas. «Franquicia» es siempre mixta (Dune: libro +
 * películas + juego); «Ranking personal» numera los títulos y admite
 * cualquier formato. `free` = la lista de siempre.
 */
const TEMPLATES = ['free', 'franchise', 'ranking'] as const
type TemplateKey = typeof TEMPLATES[number]

const DESCRIPTION_MAX = 500

/** Mismo acabado que `KInput` (DISENO.md: caja surface-2, radio 14, foco pink). */
const TEXTAREA_CLASS = cn(
  'w-full min-h-[88px] resize-y rounded-[14px] bg-surface-elevated px-[18px] py-[15px]',
  'border border-field-border',
  'font-body text-base md:text-[15px] text-text-primary',
  'placeholder:text-text-tertiary',
  'transition-colors duration-base ease-standard',
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'
)

interface CreateListModalProps {
  onClose: () => void
  /** MIXED_LISTS (F-25): plantillas, «Varios formatos» y descripción. */
  mixedEnabled?: boolean
}

export function CreateListModal({ onClose, mixedEnabled = false }: CreateListModalProps) {
  const t = useTranslations('lists')
  const tf = useTranslations('filters')
  const tc = useTranslations('common')
  const router = useRouter()
  const nameRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const descriptionId = useId()
  const descriptionHintId = useId()

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [mediaType, setMediaType] = useState<MediaTypeKey>('movie')
  const [template, setTemplate] = useState<TemplateKey>('free')
  const [description, setDescription] = useState('')
  const [isCollaborative, setIsCollaborative] = useState(false)
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typeLocked = template === 'franchise'
  const effectiveType: MediaTypeKey = typeLocked ? 'mixed' : mediaType

  // «Franquicia» fija el tipo en mixta sin perder el que se había elegido:
  // al volver a otra plantilla, el selector conserva su valor.
  function chooseTemplate(next: TemplateKey) {
    setTemplate(next)
  }

  function namePlaceholder(): string {
    if (template === 'franchise') return t('franchiseNamePlaceholder')
    if (template === 'ranking') return t('rankingNamePlaceholder')
    return t('namePlaceholder')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      // ACC-3: el error se anuncia y el foco vuelve al campo.
      setNameError(t('nameRequired'))
      nameRef.current?.focus()
      return
    }
    setNameError('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Una sola petición: la visibilidad va en el alta (antes, un PATCH
        // aparte que podía fallar y dejarla privada).
        body: JSON.stringify({
          name: name.trim(),
          mediaType: effectiveType,
          isCollaborative,
          isPublic: visibility === 'public',
          ...(mixedEnabled && description.trim() ? { description: description.trim() } : {}),
          ...(mixedEnabled && template !== 'free' ? { template } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error === 'mixed_unavailable' ? t('errorMixedUnavailable') : t('errorCreate'))
        setLoading(false)
        return
      }
      router.push(`/lists/${data.list.id}`)
      router.refresh()
      onClose()
    } catch {
      setError(t('errorCreate'))
      setLoading(false)
    }
  }

  const typeOptions = [
    ...MEDIA_TYPE_KEYS.map((key) => ({ value: key, label: tf(key) })),
    ...(mixedEnabled ? [{ value: 'mixed', label: t('mediaTypeMixed') }] : []),
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
        {mixedEnabled && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm text-muted">{t('templateLabel')}</legend>
            {TEMPLATES.map((option) => {
              const checked = template === option
              return (
                <label
                  key={option}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] bg-surface-default px-3 py-3 transition-colors',
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
        )}

        <KInput
          ref={nameRef}
          label={t('listName')}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (nameError && e.target.value.trim()) setNameError('')
          }}
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

        {mixedEnabled && (
          <div className="flex w-full flex-col gap-2">
            <label htmlFor={descriptionId} className="font-body text-[13px] font-bold text-text-tertiary">
              {t('descriptionLabel')}
            </label>
            <textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX}
              rows={3}
              placeholder={t('descriptionPlaceholder')}
              aria-describedby={descriptionHintId}
              className={TEXTAREA_CLASS}
            />
            <p id={descriptionHintId} className="text-xs text-text-tertiary">
              {t('descriptionHint', { count: DESCRIPTION_MAX - description.length })}
            </p>
          </div>
        )}

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
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] bg-surface-default px-3 py-3 transition-colors',
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
        <label className="flex min-h-11 items-center gap-3 cursor-pointer rounded-[14px] bg-surface-default px-3 py-3">
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
