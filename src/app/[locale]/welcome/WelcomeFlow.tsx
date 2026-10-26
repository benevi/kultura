'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, type AbstractIntlMessages } from 'next-intl'
import { Logo } from '@/components/layout/Logo'
import { KButton } from '@/components/ui/KButton'
import { KInput } from '@/components/ui/KInput'
import { PosterImage } from '@/components/media/PosterImage'
import { AiRecommendations } from '@/components/home/AiRecommendations'
import { posterGradient } from '@/lib/images/poster-gradient'
import { cn } from '@/lib/utils/index'
import { AUTH_CARD } from '../login/AuthShell'
import { TermsCheckbox } from '../login/TermsCheckbox'
import { USERNAME_REGEX, isReservedUsername } from '@/app/api/settings/identity'
import { RateStars } from './RateStars'
import { WelcomeImport } from './WelcomeImport'
import {
  STARTER_MIN_RATINGS,
  pickStarterTitles,
  type StarterTitle,
} from './starter-titles'
import type { MediaType } from '@/types/media'

const STEPS = ['name', 'formats', 'rate', 'recs'] as const
type Step = (typeof STEPS)[number]

/** Orden y emoji de los formatos (el mismo orden que el resto de la app). */
export const WELCOME_FORMATS: ReadonlyArray<{ type: MediaType; emoji: string }> = [
  { type: 'movie', emoji: '🎬' },
  { type: 'tv', emoji: '📺' },
  { type: 'anime', emoji: '🌸' },
  { type: 'manga', emoji: '🗯️' },
  { type: 'book', emoji: '📚' },
  { type: 'comic', emoji: '💥' },
  { type: 'game', emoji: '🎮' },
]

/** Espera antes de guardar una nota: las flechas cambian la nota de una en una. */
const SAVE_DEBOUNCE_MS = 500

interface WelcomeFlowProps {
  locale: 'es' | 'en'
  /** Destino al terminar (ya saneado en el servidor). */
  next: string
  currentUsername: string
  /** El nombre actual es el generado (`u_xxxxxx`): se invita a cambiarlo. */
  suggestChange: boolean
  /** Alta con Google: falta la casilla de edad y términos (SEG-7). */
  needsTerms: boolean
  /** F-26: textos del paso opcional "Importar" (sin ellos no se ofrece). */
  importMessages?: AbstractIntlMessages | null
  /** F-26: cuenta de la sesión, para el avance guardado del importador. */
  userId?: string | null
}

type SaveState = 'saving' | 'saved' | 'error'

export function WelcomeFlow({ locale, next, currentUsername, suggestChange, needsTerms, importMessages = null, userId = null }: WelcomeFlowProps) {
  const t = useTranslations('onboarding')
  const tAuth = useTranslations('auth')
  const router = useRouter()

  const [step, setStep] = useState<Step>('name')
  const stepIndex = STEPS.indexOf(step)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  // Paso 1
  const [username, setUsername] = useState(suggestChange ? '' : currentUsername)
  const [savedUsername, setSavedUsername] = useState(currentUsername)
  const [usernameError, setUsernameError] = useState('')
  const [termsPending, setTermsPending] = useState(needsTerms)
  const [termsChecked, setTermsChecked] = useState(false)
  const [termsError, setTermsError] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameFailed, setNameFailed] = useState('')
  const usernameRef = useRef<HTMLInputElement>(null)
  const termsRef = useRef<HTMLInputElement>(null)

  // Paso 2
  const [formats, setFormats] = useState<MediaType[]>([])

  // Paso 3
  const titles = useMemo(() => pickStarterTitles(formats), [formats])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({})
  const [rateError, setRateError] = useState('')
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pending = useRef(new Map<string, () => Promise<void>>())
  // F-26: lo importado de otra app (paso opcional) también cuenta.
  const [importedCount, setImportedCount] = useState(0)
  // Lo que se está guardando ya cuenta: si falla, se descuenta y se avisa.
  const ratedCount = Object.values(saveState).filter((s) => s !== 'error').length + importedCount

  const [finishing, setFinishing] = useState(false)

  // El foco va al título de cada paso nuevo (el lector lo anuncia), nunca al
  // cargar la página.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
    window.scrollTo({ top: 0 })
  }, [step])

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((id) => clearTimeout(id))
  }, [])

  // -------------------------------------------------------------------------
  // Paso 1: nombre (+ términos si entró con Google)
  // -------------------------------------------------------------------------

  async function submitName(e: React.FormEvent) {
    e.preventDefault()
    const value = username.trim()
    const changed = value !== '' && value !== savedUsername

    let nameErr = ''
    if (changed && !USERNAME_REGEX.test(value)) nameErr = t('nameInvalid')
    else if (changed && isReservedUsername(value)) nameErr = t('nameReserved')
    const termsErr = termsPending && !termsChecked ? tAuth('termsRequired') : ''
    setUsernameError(nameErr)
    setTermsError(termsErr)
    setNameFailed('')
    if (nameErr) return usernameRef.current?.focus()
    if (termsErr) return termsRef.current?.focus()

    const body: Record<string, unknown> = {}
    if (changed) body.username = value
    if (termsPending) body.accept_terms = true
    if (Object.keys(body).length === 0) return setStep('formats')

    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setUsernameError(data.error === 'username_reserved' ? t('nameReserved') : t('nameTaken'))
        usernameRef.current?.focus()
        return
      }
      if (res.status === 400) {
        setUsernameError(t('nameInvalid'))
        usernameRef.current?.focus()
        return
      }
      if (!res.ok) {
        setNameFailed(t('saveError'))
        return
      }
      if (changed) setSavedUsername(value)
      setTermsPending(false)
      setStep('formats')
    } catch {
      setNameFailed(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  // -------------------------------------------------------------------------
  // Paso 3: notas (se guardan solas, como "completado" con su nota)
  // -------------------------------------------------------------------------

  function rate(title: StarterTitle, score: number) {
    setScores((prev) => ({ ...prev, [title.id]: score }))
    setSaveState((prev) => ({ ...prev, [title.id]: 'saving' }))
    setRateError('')

    const save = async () => {
      timers.current.delete(title.id)
      pending.current.delete(title.id)
      try {
        const res = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId: title.id, status: 'completed', score }),
        })
        if (!res.ok) throw new Error(String(res.status))
        setSaveState((prev) => ({ ...prev, [title.id]: 'saved' }))
      } catch {
        setSaveState((prev) => ({ ...prev, [title.id]: 'error' }))
        setScores((prev) => {
          const copy = { ...prev }
          delete copy[title.id]
          return copy
        })
        setRateError(t('rateError', { title: title.title[locale] }))
      }
    }

    const previous = timers.current.get(title.id)
    if (previous) clearTimeout(previous)
    pending.current.set(title.id, save)
    timers.current.set(title.id, setTimeout(() => void save(), SAVE_DEBOUNCE_MS))
  }

  /** Guarda ya lo que esté esperando el debounce (antes de cambiar de paso). */
  async function flushRatings() {
    timers.current.forEach((id) => clearTimeout(id))
    timers.current.clear()
    const saves = Array.from(pending.current.values())
    pending.current.clear()
    await Promise.all(saves.map((save) => save()))
  }

  // -------------------------------------------------------------------------
  // Fin (o saltar)
  // -------------------------------------------------------------------------

  async function finish() {
    // SEG-7: todo se puede saltar MENOS la casilla de edad y términos (alta
    // con Google). Sin marcarla, "Saltar" se queda en el paso 1 y lo explica.
    if (termsPending && !termsChecked) {
      setStep('name')
      setTermsError(tAuth('termsRequired'))
      requestAnimationFrame(() => termsRef.current?.focus())
      return
    }
    setFinishing(true)
    await flushRatings()
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // Casilla marcada pero aún sin guardar (salta desde el paso 1): va junta.
      body: JSON.stringify(termsPending ? { accept_terms: true, onboarding_done: true } : { onboarding_done: true }),
    }).catch(() => null)
    if (res?.status === 409) {
      // El servidor no tiene la aceptación: de vuelta a la casilla.
      setFinishing(false)
      setTermsPending(true)
      setStep('name')
      setTermsError(tAuth('termsRequired'))
      return
    }
    // Cualquier otro fallo: la próxima vez vuelve a ofrecerse; no impide entrar.
    router.replace(next)
  }

  const headingClass =
    'font-display text-[28px] md:text-[34px] font-extrabold leading-tight tracking-tight text-text-primary outline-none text-balance'
  const bodyClass = 'mt-3 font-body text-[15px] text-text-secondary max-w-[52ch]'

  return (
    <main className="min-h-dvh bg-surface-base px-4 py-6 md:px-14 md:py-10">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <Logo size={28} />
          {/* Saltar todo: nadie se queda atrapado en el onboarding. */}
          <button
            type="button"
            onClick={finish}
            disabled={finishing}
            className="min-h-[44px] rounded-pill px-3 font-body text-[13px] font-bold text-text-tertiary underline-offset-4 transition-colors hover:text-text-primary hover:underline disabled:opacity-40"
          >
            {t('skipAll')}
          </button>
        </header>

        <Progress current={stepIndex} />

        {step === 'name' && (
          <section aria-labelledby="welcome-heading" className="animate-toast-in mx-auto w-full max-w-[560px]">
            <div className={AUTH_CARD}>
              <p className="inline-block rotate-[-4deg] rounded-pill bg-accent-lime px-3.5 py-1.5 font-display text-[11px] font-extrabold tracking-wide text-on-accent-lime shadow-[4px_4px_0_rgba(0,0,0,0.35)]">
                {t('welcomeBadge')}
              </p>
              <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={cn(headingClass, 'mt-5')}>
                {t('nameTitle')}
              </h1>
              <p className={bodyClass}>{t('nameBody')}</p>

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
                  <p role="alert" className="rounded-[14px] bg-accent-danger/10 px-[18px] py-3 font-body text-sm text-accent-danger">
                    {nameFailed}
                  </p>
                )}

                <KButton type="submit" size="lg" loading={saving} className="mt-2 w-full">
                  {t('continue')}
                </KButton>
              </form>
            </div>
          </section>
        )}

        {step === 'formats' && (
          <section aria-labelledby="welcome-heading" className="animate-toast-in mx-auto w-full max-w-[640px]">
            <div className={AUTH_CARD}>
              <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={headingClass}>
                {t('formatsTitle')}
              </h1>
              <p className={bodyClass}>{t('formatsBody')}</p>

              <div role="group" aria-label={t('formatsTitle')} className="mt-7 flex flex-wrap gap-3">
                {WELCOME_FORMATS.map(({ type, emoji }) => {
                  const active = formats.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setFormats((prev) => (active ? prev.filter((f) => f !== type) : [...prev, type]))
                      }
                      className={cn(
                        'inline-flex min-h-[48px] items-center gap-2 rounded-pill px-5 py-3 font-body text-[15px] font-bold transition-colors duration-150',
                        'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                        active
                          ? 'bg-accent-pink text-on-accent-pink'
                          : 'bg-surface-elevated text-text-primary hover:bg-surface-border'
                      )}
                    >
                      <span aria-hidden="true">{emoji}</span>
                      {t(`formats.${type}`)}
                    </button>
                  )
                })}
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <KButton type="button" variant="secondary" size="lg" onClick={() => setStep('name')}>
                  {t('back')}
                </KButton>
                <KButton type="button" size="lg" onClick={() => setStep('rate')}>
                  {formats.length === 0 ? t('continueAll') : t('continue')}
                </KButton>
              </div>
            </div>
          </section>
        )}

        {step === 'rate' && (
          <section aria-labelledby="welcome-heading" className="animate-toast-in flex flex-col gap-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={headingClass}>
                  {t('rateTitle')}
                </h1>
                <p className={bodyClass}>{t('rateBody', { min: STARTER_MIN_RATINGS })}</p>
              </div>
              <p
                role="status"
                className={cn(
                  'inline-flex w-fit flex-shrink-0 items-center gap-2 rounded-pill px-4 py-2 font-body text-sm font-extrabold',
                  ratedCount >= STARTER_MIN_RATINGS
                    ? 'bg-accent-lime text-on-accent-lime'
                    : 'bg-surface-elevated text-text-primary'
                )}
              >
                {ratedCount >= STARTER_MIN_RATINGS
                  ? t('rateReady', { count: ratedCount })
                  : t('rateProgress', { count: ratedCount, min: STARTER_MIN_RATINGS })}
              </p>
            </div>

            {rateError && (
              <p role="alert" className="rounded-[14px] bg-accent-danger/10 px-[18px] py-3 font-body text-sm text-accent-danger">
                {rateError}
              </p>
            )}

            {/* F-26: quien viene de otra app se trae su historial en vez de puntuar a mano. */}
            <WelcomeImport locale={locale} messages={importMessages} userId={userId} onFinished={setImportedCount} />

            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {titles.map((title, i) => (
                <RateTile
                  key={title.id}
                  title={title}
                  locale={locale}
                  score={scores[title.id] ?? 0}
                  priority={i < 4}
                  onRate={(score) => rate(title, score)}
                  formatLabel={t(`formats.${title.type}`)}
                />
              ))}
            </ul>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <KButton type="button" variant="secondary" size="lg" onClick={() => setStep('formats')}>
                {t('back')}
              </KButton>
              <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
                {ratedCount < STARTER_MIN_RATINGS && (
                  <KButton
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={async () => {
                      await flushRatings()
                      setStep('recs')
                    }}
                  >
                    {t('skipStep')}
                  </KButton>
                )}
                <KButton
                  type="button"
                  size="lg"
                  disabled={ratedCount < STARTER_MIN_RATINGS}
                  aria-describedby={ratedCount < STARTER_MIN_RATINGS ? 'rate-min-hint' : undefined}
                  onClick={async () => {
                    await flushRatings()
                    setStep('recs')
                  }}
                >
                  {t('toRecommendations')}
                </KButton>
              </div>
            </div>
            {ratedCount < STARTER_MIN_RATINGS && (
              <p id="rate-min-hint" className="sr-only">
                {t('rateMinHint', { min: STARTER_MIN_RATINGS })}
              </p>
            )}
          </section>
        )}

        {step === 'recs' && (
          <section aria-labelledby="welcome-heading" className="animate-toast-in flex flex-col gap-8">
            <div>
              <h1 id="welcome-heading" ref={headingRef} tabIndex={-1} className={headingClass}>
                {t('recsTitle')}
              </h1>
              <p className={bodyClass}>
                {ratedCount >= STARTER_MIN_RATINGS ? t('recsBody') : t('recsBodyNoRatings')}
              </p>
            </div>

            <AiRecommendations />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <KButton type="button" variant="secondary" size="lg" onClick={() => setStep('rate')}>
                {t('back')}
              </KButton>
              <KButton type="button" size="lg" loading={finishing} onClick={finish}>
                {t('finish')}
              </KButton>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

/** Barra de 4 segmentos: hecho = lima, actual = pink, pendiente = superficie. */
function Progress({ current }: { current: number }) {
  const t = useTranslations('onboarding')
  return (
    <nav aria-label={t('progressLabel')}>
      <p className="sr-only">{t('stepOf', { current: current + 1, total: STEPS.length })}</p>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((step, i) => (
          <li key={step} aria-current={i === current ? 'step' : undefined} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'block h-1.5 rounded-pill transition-colors duration-300',
                i < current ? 'bg-accent-lime' : i === current ? 'bg-accent-pink' : 'bg-surface-elevated'
              )}
            />
            <span
              className={cn(
                'hidden font-body text-xs font-bold sm:block',
                i === current ? 'text-text-primary' : 'text-text-tertiary'
              )}
            >
              {t(`steps.${step}`)}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

interface RateTileProps {
  title: StarterTitle
  locale: 'es' | 'en'
  score: number
  priority: boolean
  formatLabel: string
  onRate: (score: number) => void
}

/** Portada con el gradiente SIEMPRE detrás (por si la imagen falla) y sus estrellas. */
function RateTile({ title, locale, score, priority, formatLabel, onRate }: RateTileProps) {
  const t = useTranslations('onboarding')
  const name = title.title[locale]
  const rated = score > 0
  // Portada caída (404, CDN bloqueado): fuera la <img> rota, queda el gradiente.
  const [posterFailed, setPosterFailed] = useState(false)
  return (
    <li className="relative flex flex-col">
      {rated ? (
        <span
          aria-hidden="true"
          className="absolute -left-2 -top-2 z-10 rotate-[-8deg] rounded-pill bg-accent-lime px-2.5 py-1 font-display text-xs font-extrabold text-on-accent-lime shadow-[4px_4px_0_rgba(0,0,0,0.4)]"
        >
          ★ {score}
        </span>
      ) : null}
      <div
        className={cn(
          'relative aspect-[2/3] w-full overflow-hidden rounded-bento bg-surface-elevated transition-shadow duration-200',
          rated && 'ring-2 ring-accent-lime ring-offset-2 ring-offset-surface-base'
        )}
      >
        <div aria-hidden="true" className="absolute inset-0" style={{ background: posterGradient(title.id) }} />
        {!posterFailed && (
          <PosterImage
            src={title.poster}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
            priority={priority}
            className="object-cover"
            onFail={() => setPosterFailed(true)}
          />
        )}
      </div>
      <p className="mt-3 line-clamp-2 font-body text-sm font-bold text-text-primary">{name}</p>
      <p className="font-body text-xs text-text-tertiary">
        {formatLabel}
        {title.year ? ` · ${title.year}` : ''}
      </p>
      <div className="mt-2">
        <RateStars value={score} onChange={onRate} label={t('rateLabel', { title: name })} />
      </div>
    </li>
  )
}
