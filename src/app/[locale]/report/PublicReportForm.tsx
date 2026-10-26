'use client'

// ============================================================
// KULTURA — Formulario público de denuncia (sin cuenta)
// Etiquetas visibles, errores por campo con aria-invalid/aria-describedby,
// resumen de error anunciado y enfocado, y confirmación enfocada con el
// número de referencia. El campo `website` es una trampa para bots.
// ============================================================

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import {
  ModerationRequestError,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  submitPublicReport,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/social/actions'

interface Props {
  types: readonly ReportTargetType[]
  presetType?: ReportTargetType
  presetTarget?: string
}

type Field = 'targetType' | 'target' | 'reason' | 'details' | 'contactEmail' | 'goodFaith'
type Errors = Partial<Record<Field, string>>

const DETAILS_MIN = 10
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function PublicReportForm({ types, presetType, presetTarget }: Props) {
  const t = useTranslations('report.page')
  const tr = useTranslations('report')

  const [targetType, setTargetType] = useState<ReportTargetType>(presetType ?? types[0])
  const [target, setTarget] = useState(presetTarget ?? '')
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  const ids = {
    type: useId(),
    target: useId(),
    targetMsg: useId(),
    reasonMsg: useId(),
    details: useId(),
    detailsMsg: useId(),
    faithMsg: useId(),
    summary: useId(),
  }
  const summaryRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reference) doneRef.current?.focus()
  }, [reference])

  const fixedTarget = Boolean(presetType && presetTarget)

  function validate(): Errors {
    const e: Errors = {}
    if (!target.trim()) e.target = t('errors.target')
    if (!reason) e.reason = t('errors.reason')
    if (details.trim().length < DETAILS_MIN) e.details = t('errors.details', { min: DETAILS_MIN })
    if (!EMAIL_RE.test(contactEmail.trim())) e.contactEmail = t('errors.email')
    if (!goodFaith) e.goodFaith = t('errors.goodFaith')
    return e
  }

  function focusSummary() {
    requestAnimationFrame(() => summaryRef.current?.focus())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setFormError(t('errors.summary'))
      focusSummary()
      return
    }
    setSending(true)
    setFormError(null)
    try {
      const res = await submitPublicReport({
        targetType,
        target: target.trim(),
        reason: reason!,
        details: details.trim(),
        contactEmail: contactEmail.trim(),
        goodFaith,
        website,
      })
      setReference(res.reference)
    } catch (err) {
      const status = err instanceof ModerationRequestError ? err.status : 0
      const code = err instanceof ModerationRequestError ? err.code : ''
      if (status === 404 || code === 'invalid_target') {
        setErrors({ target: status === 404 ? t('errors.targetNotFound') : t('errors.targetInvalid') })
        setFormError(t('errors.summary'))
      } else {
        setFormError(status === 429 ? tr('errorTooMany') : t('errors.generic'))
      }
      focusSummary()
    } finally {
      setSending(false)
    }
  }

  if (reference) {
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        role="status"
        className="rounded-2xl border border-surface-border bg-surface-default p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
      >
        <h2 className="font-display text-xl font-bold text-text-primary mb-2">{t('doneTitle')}</h2>
        <p className="text-text-secondary text-sm leading-relaxed">{t('doneBody', { reference })}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6" aria-describedby={formError ? ids.summary : undefined}>
      <div
        ref={summaryRef}
        id={ids.summary}
        tabIndex={-1}
        role="alert"
        className={formError ? 'rounded-2xl border border-accent-danger p-3 text-sm text-accent-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink' : 'sr-only'}
      >
        {formError}
      </div>

      {fixedTarget ? (
        <div className="rounded-2xl border border-surface-border bg-surface-default p-4">
          <p className="text-xs font-bold text-text-tertiary">{t('targetFixedLabel')}</p>
          <p className="text-sm text-text-primary mt-1">
            {t(`types.${targetType}`)} · <span className="break-all text-text-secondary">{target}</span>
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.type} className="font-body text-meta font-bold text-text-tertiary">
              {t('typeLabel')}
            </label>
            <select
              id={ids.type}
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as ReportTargetType)}
              className="w-full rounded-2xl bg-surface-elevated px-[18px] py-[15px] border border-field-border font-body text-base md:text-body text-text-primary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              {types.map((type) => (
                <option key={type} value={type}>{t(`types.${type}`)}</option>
              ))}
            </select>
          </div>
          <KInput
            id={ids.target}
            label={t('targetLabel')}
            hint={t(`targetHint.${targetType}`)}
            error={errors.target}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            maxLength={500}
            required
            autoComplete="off"
          />
        </>
      )}
      {fixedTarget && errors.target && (
        <p role="alert" className="text-xs text-accent-danger -mt-4">{errors.target}</p>
      )}

      <fieldset
        className="flex flex-col gap-1"
        aria-invalid={errors.reason ? true : undefined}
        aria-describedby={errors.reason ? ids.reasonMsg : undefined}
      >
        <legend className="font-body text-meta font-bold text-text-tertiary mb-2">{tr('reasonsLegend')}</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-3 min-h-11 px-2 rounded-button cursor-pointer text-text-primary hover:bg-surface-elevated">
            <input
              type="radio"
              name="reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              required
              className="w-4 h-4 accent-[var(--accent-pink)]"
            />
            <span className="text-sm">{tr(`reasons.${r}`)}</span>
          </label>
        ))}
        {errors.reason && <p id={ids.reasonMsg} role="alert" className="text-xs text-accent-danger">{errors.reason}</p>}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.details} className="font-body text-meta font-bold text-text-tertiary">
          {t('detailsLabel')}
        </label>
        <textarea
          id={ids.details}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={5}
          maxLength={REPORT_DETAILS_MAX}
          required
          aria-invalid={errors.details ? true : undefined}
          aria-describedby={ids.detailsMsg}
          className={`w-full rounded-2xl bg-surface-elevated px-[18px] py-[15px] border font-body text-base md:text-body text-text-primary placeholder:text-text-tertiary resize-y focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${errors.details ? 'border-accent-danger' : 'border-field-border'}`}
        />
        {errors.details ? (
          <p id={ids.detailsMsg} role="alert" className="text-xs text-accent-danger">{errors.details}</p>
        ) : (
          <p id={ids.detailsMsg} className="text-xs text-text-tertiary">
            {t('detailsHint', { count: details.length, max: REPORT_DETAILS_MAX })}
          </p>
        )}
      </div>

      <KInput
        type="email"
        label={t('emailLabel')}
        hint={t('emailHint')}
        error={errors.contactEmail}
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        autoComplete="email"
        maxLength={254}
        required
      />

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 min-h-11 cursor-pointer text-sm text-text-primary">
          <input
            type="checkbox"
            checked={goodFaith}
            onChange={(e) => setGoodFaith(e.target.checked)}
            required
            aria-invalid={errors.goodFaith ? true : undefined}
            aria-describedby={errors.goodFaith ? ids.faithMsg : undefined}
            className="mt-0.5 w-5 h-5 flex-shrink-0 accent-[var(--accent-pink)]"
          />
          <span>{t('goodFaith')}</span>
        </label>
        {errors.goodFaith && <p id={ids.faithMsg} role="alert" className="text-xs text-accent-danger">{errors.goodFaith}</p>}
      </div>

      {/* Trampa para bots: fuera de la vista y del orden de foco. */}
      <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
        <label>
          {t('honeypot')}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <p className="text-xs text-text-tertiary leading-relaxed">{t('privacyNote')}</p>

      <div>
        <KButton type="submit" variant="primary" size="lg" loading={sending}>
          {t('submit')}
        </KButton>
      </div>
    </form>
  )
}
