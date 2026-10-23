'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'

type SuggestionType = 'bug' | 'feature' | 'improvement' | 'other'

const SUBJECT_MIN = 3
const DESCRIPTION_MIN = 10
const DESCRIPTION_MAX = 2000

const FIELD_CLASS =
  'w-full bg-surface-elevated border border-field-border rounded-[14px] px-[18px] py-[15px] text-base md:text-sm text-text-primary placeholder-text-tertiary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

/**
 * Formulario de sugerencias (ACC-2, ACC-3, ACC-10):
 * - Cada campo con su `<label htmlFor>` (antes solo había placeholder).
 * - El tipo es un grupo de botones conmutables con `aria-pressed` dentro de un
 *   `fieldset`/`legend`, no colores sueltos.
 * - Al enviar con errores, cada campo marca `aria-invalid`, su mensaje va
 *   enlazado con `aria-describedby` y se anuncia (`role="alert"`), y el foco
 *   salta al primer campo que falla.
 * - El éxito se anuncia y recibe el foco (el formulario desaparece).
 */
export function SuggestionsForm() {
  const t = useTranslations('suggestions')
  const id = useId()
  const subjectId = `${id}-subject`
  const descriptionId = `${id}-description`
  const subjectErrorId = `${id}-subject-error`
  const descriptionErrorId = `${id}-description-error`
  const counterId = `${id}-counter`
  const subjectRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const successRef = useRef<HTMLDivElement>(null)

  const [type, setType] = useState<SuggestionType>('feature')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ subject?: string; description?: string }>({})

  useEffect(() => {
    if (status === 'success') successRef.current?.focus()
  }, [status])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const s = subject.trim()
    const d = description.trim()
    const errors: { subject?: string; description?: string } = {}
    if (s.length < SUBJECT_MIN) errors.subject = t('errorSubjectShort')
    if (d.length < DESCRIPTION_MIN) errors.description = t('errorDescriptionShort')
    setFieldErrors(errors)
    if (errors.subject || errors.description) {
      setErrorKey(null)
      setStatus('idle')
      ;(errors.subject ? subjectRef : descriptionRef).current?.focus()
      return
    }
    setStatus('sending')
    setErrorKey(null)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, subject: s, description: d }),
      })
      if (!res.ok) {
        setErrorKey(res.status === 429 ? 'errorRateLimit' : 'error')
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setErrorKey('error')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="p-4 text-center flex flex-col items-center gap-3 outline-none"
      >
        <div aria-hidden="true" className="text-4xl">✅</div>
        <p className="font-display font-extrabold text-text-primary text-lg">{t('success')}</p>
        <p className="text-sm text-text-tertiary">{t('successHint')}</p>
        <KButton
          variant="secondary"
          onClick={() => { setStatus('idle'); setSubject(''); setDescription(''); setFieldErrors({}) }}
          className="mt-2"
        >
          {t('newFeedback')}
        </KButton>
      </div>
    )
  }

  const typeOptions: Array<{ value: SuggestionType; label: string }> = [
    { value: 'feature', label: t('typeFeature') },
    { value: 'improvement', label: t('typeImprovement') },
    { value: 'bug', label: t('typeBug') },
    { value: 'other', label: t('typeOther') },
  ]

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* Type */}
      <fieldset>
        <legend className="block text-sm font-semibold text-text-primary mb-2">{t('typeLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={type === opt.value}
              onClick={() => setType(opt.value)}
              className={cn(
                'min-h-11 px-4 py-2 rounded-pill text-sm font-bold transition-all',
                'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                type === opt.value
                  ? 'bg-accent-positive text-on-accent-positive'
                  : 'bg-surface-elevated text-text-tertiary hover:text-text-primary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Subject */}
      <div>
        <label htmlFor={subjectId} className="block text-sm font-semibold text-text-primary mb-2">
          {t('subjectLabel')}
        </label>
        <input
          ref={subjectRef}
          id={subjectId}
          type="text"
          value={subject}
          onChange={e => {
            setSubject(e.target.value)
            if (fieldErrors.subject && e.target.value.trim().length >= SUBJECT_MIN) {
              setFieldErrors((f) => ({ ...f, subject: undefined }))
            }
          }}
          placeholder={t('subjectPlaceholder')}
          maxLength={120}
          aria-required="true"
          aria-invalid={fieldErrors.subject ? true : undefined}
          aria-describedby={fieldErrors.subject ? subjectErrorId : undefined}
          className={cn(FIELD_CLASS, fieldErrors.subject && 'border-accent-danger')}
        />
        {fieldErrors.subject && (
          <p id={subjectErrorId} role="alert" className="mt-1 text-xs text-accent-danger">{fieldErrors.subject}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor={descriptionId} className="block text-sm font-semibold text-text-primary mb-2">
          {t('descriptionLabel')}
        </label>
        <textarea
          ref={descriptionRef}
          id={descriptionId}
          value={description}
          onChange={e => {
            setDescription(e.target.value)
            if (fieldErrors.description && e.target.value.trim().length >= DESCRIPTION_MIN) {
              setFieldErrors((f) => ({ ...f, description: undefined }))
            }
          }}
          placeholder={t('descriptionPlaceholder')}
          maxLength={DESCRIPTION_MAX}
          rows={5}
          aria-required="true"
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={[fieldErrors.description ? descriptionErrorId : null, counterId].filter(Boolean).join(' ')}
          className={cn(FIELD_CLASS, 'resize-none', fieldErrors.description && 'border-accent-danger')}
        />
        <div className="mt-1 flex justify-between gap-3">
          {fieldErrors.description ? (
            <p id={descriptionErrorId} role="alert" className="text-xs text-accent-danger">{fieldErrors.description}</p>
          ) : <span />}
          <p id={counterId} className="text-xs text-text-tertiary text-right">
            <span aria-hidden="true">{description.length}/{DESCRIPTION_MAX}</span>
            <span className="sr-only">{t('charCount', { count: description.length, max: DESCRIPTION_MAX })}</span>
          </p>
        </div>
      </div>

      {status === 'error' && errorKey && (
        <p role="alert" className="text-sm text-accent-danger">{t(errorKey)}</p>
      )}

      <KButton
        type="submit"
        variant="primary"
        size="lg"
        loading={status === 'sending'}
        className="w-full"
      >
        {status === 'sending' ? t('submitting') : t('submit')}
      </KButton>
    </form>
  )
}
