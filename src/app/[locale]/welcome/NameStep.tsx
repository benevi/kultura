'use client'

import type { RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { cn } from '@/lib/utils/index'
import { AUTH_CARD } from '../login/AuthShell'
import { TermsCheckbox } from '../login/TermsCheckbox'
import type { NameForm } from './useNameForm'
import { BODY_CLASS, HEADING_CLASS } from './welcome-steps'

interface NameStepProps {
  form: NameForm
  headingRef: RefObject<HTMLHeadingElement | null>
  isFirstStep: boolean
  /** El nombre actual es el generado: la pista enseña cuál es. */
  suggestChange: boolean
  onBack: () => void
}

/** Paso "nombre" (+ términos si entró con Google). */
export function NameStep({ form, headingRef, isFirstStep, suggestChange, onBack }: NameStepProps) {
  const t = useTranslations('onboarding')
  const {
    username,
    setUsername,
    savedUsername,
    usernameError,
    setUsernameError,
    termsPending,
    termsChecked,
    setTermsChecked,
    termsError,
    setTermsError,
    saving,
    nameFailed,
    usernameRef,
    termsRef,
    submitName,
  } = form

  return (
    <section aria-labelledby="welcome-heading" className="animate-toast-in mx-auto w-full max-w-[560px]">
      <div className={AUTH_CARD}>
        {isFirstStep && (
          <p className="inline-block rotate-[-4deg] rounded-pill bg-accent-lime px-3.5 py-1.5 font-display text-xs font-extrabold tracking-wide text-on-accent-lime shadow-sticker">
            {t('welcomeBadge')}
          </p>
        )}
        <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={cn(HEADING_CLASS, isFirstStep && 'mt-5')}>
          {t('nameTitle')}
        </h1>
        <p className={BODY_CLASS}>{t('nameBody')}</p>

        <form onSubmit={submitName} noValidate className="mt-7 flex flex-col gap-[18px]">
          <KInput
            ref={usernameRef}
            id="welcome-username"
            name="username"
            label={t('nameLabel')}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              if (usernameError) setUsernameError('')
            }}
            placeholder={t('namePlaceholder')}
            hint={suggestChange ? t('nameHintGenerated', { current: savedUsername }) : t('nameHint')}
            error={usernameError}
            aria-invalid={usernameError ? true : undefined}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
          />

          {termsPending && (
            <TermsCheckbox
              ref={termsRef}
              id="welcome-terms"
              checked={termsChecked}
              onChange={(checked) => {
                setTermsChecked(checked)
                if (checked) setTermsError('')
              }}
              error={termsError}
            />
          )}

          {nameFailed && (
            <p role="alert" className="rounded-2xl bg-accent-danger/10 px-[18px] py-3 font-body text-sm text-accent-danger">
              {nameFailed}
            </p>
          )}

          <KButton type="submit" size="lg" loading={saving} className="mt-2 w-full">
            {t('continue')}
          </KButton>
          {!isFirstStep && (
            <KButton type="button" variant="secondary" size="lg" onClick={onBack} className="w-full">
              {t('back')}
            </KButton>
          )}
        </form>
      </div>
    </section>
  )
}
