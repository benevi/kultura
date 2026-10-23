'use client'

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { useToastContext } from '@/components/ui/ToastProvider'
import { cn } from '@/lib/utils/index'

const MEDIA_TYPE_KEYS = ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game'] as const
type MediaTypeKey = typeof MEDIA_TYPE_KEYS[number]

/** D-04c / X5: al crear se pregunta, y lo marcado de inicio es privada. */
const VISIBILITIES = ['private', 'public'] as const
type Visibility = typeof VISIBILITIES[number]

interface CreateListModalProps {
  onClose: () => void
}

export function CreateListModal({ onClose }: CreateListModalProps) {
  const t = useTranslations('lists')
  const tf = useTranslations('filters')
  const tc = useTranslations('common')
  const router = useRouter()
  const { showError } = useToastContext()
  const nameRef = useRef<HTMLInputElement>(null)
  const errorId = useId()

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [mediaType, setMediaType] = useState<MediaTypeKey>('movie')
  const [isCollaborative, setIsCollaborative] = useState(false)
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        body: JSON.stringify({ name: name.trim(), mediaType, isCollaborative }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('errorCreate'))
        setLoading(false)
        return
      }
      // La lista nace privada (`is_public default false`); hacerla pública es
      // el mismo PATCH que el selector de la propia lista.
      if (visibility === 'public') {
        const patch = await fetch(`/api/lists/${data.list.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: true }),
        }).catch(() => null)
        if (!patch?.ok) showError(t('visibilityAfterCreateError'))
      }
      router.push(`/lists/${data.list.id}`)
      router.refresh()
      onClose()
    } catch {
      setError(t('errorCreate'))
      setLoading(false)
    }
  }

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
        <KInput
          ref={nameRef}
          label={t('listName')}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (nameError && e.target.value.trim()) setNameError('')
          }}
          placeholder={t('namePlaceholder')}
          error={nameError}
          maxLength={80}
          aria-required="true"
          autoComplete="off"
        />

        <Select
          label={t('mediaType')}
          value={mediaType}
          onChange={(v) => setMediaType(v as MediaTypeKey)}
          options={MEDIA_TYPE_KEYS.map((key) => ({ value: key, label: tf(key) }))}
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
