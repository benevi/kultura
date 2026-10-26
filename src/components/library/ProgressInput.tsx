'use client'

// ============================================================
// KULTURA — ProgressInput (F-27, PRO-5)
// Progreso de un título según su formato, para el diálogo de biblioteca:
//   serie   temporada + episodio ("de 10" con los datos de TMDB)
//   anime   episodio
//   manga y cómic   capítulo + volumen
//   libro   página o % (selector), "de 350" con las páginas de la ficha
//   juego   horas jugadas, con la media de RAWG como referencia
// Cada número se cambia con −/+ (44 px, nombre accesible propio) o
// escribiéndolo; las flechas del teclado funcionan en el campo. Sin la
// migración (`full` = false) solo se ofrece lo de siempre: episodios en
// series y anime.
// ============================================================

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { CloseButton } from '@/components/ui/CloseButton'
import { cn } from '@/lib/utils/index'
import {
  PROGRESS_LIMITS,
  compactProgress,
  hasProgress,
  progressFieldsFor,
  progressPercent,
  supportsLegacyProgress,
  type ProgressField,
  type ProgressValue,
} from '@/lib/library/progress'

export interface ProgressInputProps {
  mediaType: string
  value: ProgressValue | null
  onChange: (value: ProgressValue | null) => void
  /** Todos los formatos (PROGRESS_V2 y la migración); si no, solo episodios. */
  full: boolean
  /** Total de la unidad principal (episodios de la temporada, páginas…). */
  total?: number | null
  /** Juegos: horas medias de RAWG (referencia, no un tope). */
  referenceHours?: number | null
  /** Series y anime: solo temporada si es serie (anime numera seguido). */
  showSeason?: boolean
  /** Botón «Limpiar progreso» (por defecto, `onChange(null)`). */
  onClear?: () => void
}

// Borde `--field-border` y anillo de 2 px del sistema (ACC-4); 16 px en
// móvil para que iOS no haga zoom al enfocar (MOV-5).
const INPUT =
  'min-h-11 bg-surface-base border border-field-border rounded-button px-3 py-2 text-base md:text-sm font-body text-text-primary text-center tabular-nums placeholder:text-text-tertiary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring transition-colors'
const STEP_BUTTON =
  'inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-field-border bg-surface-default font-display text-lg font-bold text-text-primary hover:bg-surface-elevated focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-40 transition-colors'
const LABEL = 'block text-xs font-body font-medium text-text-secondary mb-1'

function clampField(field: ProgressField, n: number, min: number = PROGRESS_LIMITS[field].min): number {
  const lim = PROGRESS_LIMITS[field]
  const v = Math.min(lim.max, Math.max(min, n))
  return lim.whole ? Math.round(v) : Math.round(v * 10) / 10
}

interface StepperProps {
  field: ProgressField
  label: string
  value: number | null | undefined
  onValue: (n: number | null) => void
  hint?: string | null
  /** Paso de los botones (el campo admite cualquier valor válido). */
  step?: number
  testId?: string
  width?: string
  /** Mínimo propio (más alto que el de la base). */
  min?: number
}

function Stepper({ field, label, value, onValue, hint, step, testId, width = 'w-20', min: minProp }: StepperProps) {
  const t = useTranslations('progress')
  const id = useId()
  const lim = { ...PROGRESS_LIMITS[field], min: Math.max(PROGRESS_LIMITS[field].min, minProp ?? PROGRESS_LIMITS[field].min) }
  const inc = step ?? lim.step
  const current = typeof value === 'number' ? value : null

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(',', '.')
    if (raw.trim() === '') {
      onValue(null)
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    onValue(clampField(field, n, lim.min))
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col">
      <label id={`${id}-label`} htmlFor={`${id}-input`} className={LABEL}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={STEP_BUTTON}
          aria-label={t('decrease', { unit: field })}
          disabled={current === null || current <= lim.min}
          onClick={() => onValue(current === null ? null : clampField(field, current - inc, lim.min))}
        >
          <span aria-hidden="true">−</span>
        </button>
        <input
          id={`${id}-input`}
          type="number"
          inputMode={lim.whole ? 'numeric' : 'decimal'}
          min={lim.min}
          max={lim.max}
          step={lim.whole ? 1 : 'any'}
          value={current ?? ''}
          onChange={handleInput}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(INPUT, width)}
          data-testid={testId}
        />
        <button
          type="button"
          className={STEP_BUTTON}
          aria-label={t('increase', { unit: field })}
          disabled={current !== null && current >= lim.max}
          onClick={() => onValue(clampField(field, current === null ? Math.max(lim.min, (field === 'episode' ? 0 : PROGRESS_LIMITS[field].min) + inc) : current + inc, lim.min))}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {/* Hueco fijo: la pista no mueve nada al aparecer (CLS 0). */}
      <span id={`${id}-hint`} className="mt-1 min-h-4 text-xs text-text-tertiary tabular-nums">
        {hint ?? ''}
      </span>
    </div>
  )
}

export function ProgressInput({
  mediaType,
  value,
  onChange,
  full,
  total = null,
  referenceHours = null,
  showSeason,
  onClear,
}: ProgressInputProps) {
  const t = useTranslations('progress')
  const tl = useTranslations('library')
  const modeId = useId()

  const fields = full || supportsLegacyProgress(mediaType) ? progressFieldsFor(mediaType) : []
  if (fields.length === 0) return null

  const withSeason = showSeason ?? mediaType === 'tv'
  const set = (field: ProgressField, n: number | null) => {
    const next: ProgressValue = { ...(value ?? {}), [field]: n }
    if (typeof total === 'number') next.total = total
    onChange(compactProgress(next))
  }
  const ofTotal = typeof total === 'number' ? t('ofTotal', { total }) : null
  const percent = full ? progressPercent(mediaType, { ...(value ?? {}), total: total ?? value?.total ?? null }) : null

  let body: React.ReactNode = null
  if (mediaType === 'tv' || mediaType === 'anime') {
    body = (
      <>
        {withSeason && (
          <Stepper
            field="season"
            label={t('season')}
            value={value?.season}
            onValue={(n) => set('season', n)}
            testId="input-season"
            // Sin la bandera va al jsonb antiguo ({season?, episode}): temporada 1 o más.
            min={full ? undefined : 1}
          />
        )}
        <Stepper
          field="episode"
          label={t('episode')}
          value={value?.episode}
          onValue={(n) => set('episode', n)}
          hint={ofTotal}
          testId="input-episode"
          width="w-24"
        />
      </>
    )
  } else if (mediaType === 'manga' || mediaType === 'comic') {
    body = (
      <>
        <Stepper field="chapter" label={t('chapter')} value={value?.chapter} onValue={(n) => set('chapter', n)} hint={ofTotal} testId="input-chapter" width="w-24" />
        <Stepper field="volume" label={t('volume')} value={value?.volume} onValue={(n) => set('volume', n)} testId="input-volume" />
      </>
    )
  } else if (mediaType === 'book') {
    const byPercent = typeof value?.percent === 'number' || (typeof value?.page !== 'number' && typeof total !== 'number')
    const switchMode = (toPercent: boolean) => {
      if (toPercent === byPercent) return
      const page = value?.page
      const pct = value?.percent
      const next: ProgressValue = toPercent
        ? { percent: typeof page === 'number' && typeof total === 'number' ? Math.min(100, Math.round((page / total) * 100)) : 0 }
        : { page: typeof pct === 'number' && typeof total === 'number' ? Math.round((pct / 100) * total) : 0 }
      if (typeof total === 'number') next.total = total
      onChange(next)
    }
    body = (
      <>
        <fieldset className="flex flex-col">
          <legend id={modeId} className={LABEL}>{t('bookMode')}</legend>
          <div className="flex rounded-full border border-field-border p-0.5">
            {([false, true] as const).map((pct) => (
              <label
                key={String(pct)}
                className={cn(
                  'inline-flex min-h-11 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-full px-3 text-sm font-bold transition-colors',
                  'has-[:focus-visible]:[outline-style:solid] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring',
                  pct === byPercent ? 'bg-accent-positive text-on-accent-positive' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <input
                  type="radio"
                  name={`${modeId}-mode`}
                  className="sr-only"
                  checked={pct === byPercent}
                  onChange={() => switchMode(pct)}
                />
                {pct ? t('modePercent') : t('modePages')}
              </label>
            ))}
          </div>
        </fieldset>
        {byPercent ? (
          <Stepper field="percent" label={t('percent')} value={value?.percent} onValue={(n) => set('percent', n)} step={5} testId="input-percent" />
        ) : (
          <Stepper field="page" label={t('page')} value={value?.page} onValue={(n) => set('page', n)} step={10} hint={ofTotal} testId="input-page" width="w-24" />
        )}
      </>
    )
  } else if (mediaType === 'game') {
    body = (
      <Stepper
        field="hours"
        label={t('hours')}
        value={value?.hours}
        onValue={(n) => set('hours', n)}
        hint={typeof referenceHours === 'number' ? t('hoursReference', { hours: referenceHours }) : null}
        testId="input-hours"
        width="w-24"
      />
    )
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-body font-medium text-text-secondary mb-1">{t('title')}</legend>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        {body}
        {hasProgress(value) && (
          <CloseButton
            onClick={() => (onClear ? onClear() : onChange(null))}
            label={tl('clearProgress')}
            data-testid="clear-progress"
            className="mt-5"
          />
        )}
      </div>
      {/* Barra con hueco fijo (CLS 0); el número va en texto para lectores. */}
      {full && (
        <div className="flex items-center gap-3" data-testid="progress-summary">
          <div aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-surface-elevated">
            <div
              className="h-1.5 rounded-full bg-accent-positive motion-safe:transition-[width] motion-safe:duration-slow"
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
          <span className="min-w-[3.5ch] text-right text-xs font-bold text-text-secondary tabular-nums">
            {percent !== null ? t('percentDone', { percent }) : ''}
          </span>
        </div>
      )}
    </fieldset>
  )
}
