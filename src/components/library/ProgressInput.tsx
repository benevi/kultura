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
// escribiéndolo; las flechas del teclado funcionan en el campo.
// ============================================================

import { useId, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { CloseButton } from '@/components/ui/CloseButton'
import { SalaButton } from '@/components/sala/SalaButton'
import { cn } from '@/lib/utils/index'
import {
  PROGRESS_LIMITS,
  compactProgress,
  hasProgress,
  progressFieldsFor,
  progressPercent,
  type ProgressField,
  type ProgressValue,
} from '@/lib/library/progress'

export interface ProgressInputProps {
  mediaType: string
  value: ProgressValue | null
  onChange: (value: ProgressValue | null) => void
  /** Total de la unidad principal (episodios de la temporada, páginas…). */
  total?: number | null
  /** Juegos: horas medias de RAWG (referencia, no un tope). */
  referenceHours?: number | null
  /** Series y anime: solo temporada si es serie (anime numera seguido). */
  showSeason?: boolean
  /** Botón «Limpiar progreso» (por defecto, `onChange(null)`). */
  onClear?: () => void
  /**
   * `sala`: con los componentes y tokens de «Sala» (fase 8.5, ficha con
   * `SALA_FICHA`). La lógica es la misma; solo cambia cómo se pinta.
   */
  variant?: 'default' | 'sala'
}

// Borde `--field-border` y anillo de 2 px del sistema (ACC-4); 16 px en
// móvil para que iOS no haga zoom al enfocar (MOV-5).
const INPUT =
  'min-h-11 bg-surface-base border border-field-border rounded-button px-3 py-2 text-base md:text-sm font-body text-text-primary text-center tabular-nums placeholder:text-text-tertiary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring transition-colors'
const STEP_BUTTON =
  'inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-field-border bg-surface-default font-display text-lg font-bold text-text-primary hover:bg-surface-elevated focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-40 transition-colors'
const LABEL = 'block text-xs font-body font-medium text-text-secondary mb-1'

/** Cómo se pinta cada pieza: la ficha de hoy o «Sala» (48 px, esquinas rectas). */
interface Skin {
  input: string
  step: string
  label: string
  hint: string
  legend: string
  modeGroup: string
  modeOption: string
  modeOn: string
  modeOff: string
  track: string
  bar: string
  percent: string
}

const SKINS: Record<'default' | 'sala', Skin> = {
  default: {
    input: INPUT,
    step: STEP_BUTTON,
    label: LABEL,
    hint: 'mt-1 min-h-4 text-xs text-text-tertiary tabular-nums',
    legend: 'text-sm font-body font-medium text-text-secondary mb-1',
    modeGroup: 'flex rounded-full border border-field-border p-0.5',
    modeOption:
      'inline-flex min-h-11 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-full px-3 text-sm font-bold transition-colors has-[:focus-visible]:[outline-style:solid] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring',
    modeOn: 'bg-accent-positive text-on-accent-positive',
    modeOff: 'text-text-secondary hover:text-text-primary',
    track: 'h-1.5 flex-1 rounded-full bg-surface-elevated',
    bar: 'h-1.5 rounded-full bg-accent-positive motion-safe:transition-[width] motion-safe:duration-slow',
    percent: 'min-w-[3.5ch] text-right text-xs font-bold text-text-secondary tabular-nums',
  },
  sala: {
    input:
      'min-h-sala-target border-2 border-sala-border bg-sala-background px-3 text-base text-sala-ink text-center tabular-nums sala-hover:border-sala-ink sala-focused:border-sala-ink sala-focused:sala-focus transition-colors duration-sala-fast ease-sala motion-reduce:transition-none',
    step:
      'inline-flex h-sala-target w-sala-target flex-shrink-0 items-center justify-center border-2 border-sala-ink bg-transparent sala-type-data text-sala-ink enabled:sala-hover:bg-sala-ink enabled:sala-hover:text-sala-background sala-focused:sala-focus disabled:cursor-not-allowed disabled:border-dashed disabled:border-sala-border disabled:text-sala-ink-secondary transition-colors duration-sala-fast ease-sala motion-reduce:transition-none',
    label: 'block sala-type-small text-sala-ink mb-1',
    hint: 'mt-1 min-h-5 sala-type-small text-sala-ink-secondary tabular-nums',
    legend: 'sala-type-label text-sala-ink mb-2',
    modeGroup: 'flex border-2 border-sala-ink',
    modeOption:
      'inline-flex min-h-sala-target min-w-[5rem] cursor-pointer items-center justify-center px-4 sala-type-label has-[:focus-visible]:sala-focus transition-colors duration-sala-fast ease-sala motion-reduce:transition-none',
    modeOn: 'bg-sala-ink text-sala-background',
    modeOff: 'text-sala-ink sala-hover:bg-sala-panel',
    track: 'h-2 flex-1 bg-sala-panel outline outline-1 outline-sala-border',
    bar: 'h-2 bg-sala-accent motion-safe:transition-[width] motion-safe:duration-sala-slow',
    percent: 'min-w-[3.5ch] text-right sala-type-small text-sala-ink tabular-nums',
  },
}

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
  skin: Skin
}

function Stepper({ field, label, value, onValue, hint, step, testId, width = 'w-20', min: minProp, skin }: StepperProps) {
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
      <label id={`${id}-label`} htmlFor={`${id}-input`} className={skin.label}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={skin.step}
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
          className={cn(skin.input, width)}
          data-testid={testId}
        />
        <button
          type="button"
          className={skin.step}
          aria-label={t('increase', { unit: field })}
          disabled={current !== null && current >= lim.max}
          onClick={() => onValue(clampField(field, current === null ? Math.max(lim.min, (field === 'episode' ? 0 : PROGRESS_LIMITS[field].min) + inc) : current + inc, lim.min))}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {/* Hueco fijo: la pista no mueve nada al aparecer (CLS 0). */}
      <span id={`${id}-hint`} className={skin.hint}>
        {hint ?? ''}
      </span>
    </div>
  )
}

export function ProgressInput({
  mediaType,
  value,
  onChange,
  total = null,
  referenceHours = null,
  showSeason,
  onClear,
  variant = 'default',
}: ProgressInputProps) {
  const t = useTranslations('progress')
  const tl = useTranslations('library')
  const modeId = useId()
  const skin = SKINS[variant]
  const boxRef = useRef<HTMLFieldSetElement>(null)
  // «Limpiar progreso» desaparece al pulsarlo: el foco va al primer campo.
  const clear = () => {
    if (onClear) onClear()
    else onChange(null)
    boxRef.current?.querySelector<HTMLInputElement>('input[type=number]')?.focus()
  }

  const fields = progressFieldsFor(mediaType)
  if (fields.length === 0) return null

  const withSeason = showSeason ?? mediaType === 'tv'
  const set = (field: ProgressField, n: number | null) => {
    const next: ProgressValue = { ...(value ?? {}), [field]: n }
    if (typeof total === 'number') next.total = total
    onChange(compactProgress(next))
  }
  const ofTotal = typeof total === 'number' ? t('ofTotal', { total }) : null
  const percent = progressPercent(mediaType, { ...(value ?? {}), total: total ?? value?.total ?? null })

  let body: React.ReactNode = null
  if (mediaType === 'tv' || mediaType === 'anime') {
    body = (
      <>
        {withSeason && (
          <Stepper
            skin={skin}
            field="season"
            label={t('season')}
            value={value?.season}
            onValue={(n) => set('season', n)}
            testId="input-season"
          />
        )}
        <Stepper
          skin={skin}
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
        <Stepper skin={skin} field="chapter" label={t('chapter')} value={value?.chapter} onValue={(n) => set('chapter', n)} hint={ofTotal} testId="input-chapter" width="w-24" />
        <Stepper skin={skin} field="volume" label={t('volume')} value={value?.volume} onValue={(n) => set('volume', n)} testId="input-volume" />
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
          <legend id={modeId} className={skin.label}>{t('bookMode')}</legend>
          <div className={skin.modeGroup}>
            {([false, true] as const).map((pct) => (
              <label
                key={String(pct)}
                className={cn(skin.modeOption, pct === byPercent ? skin.modeOn : skin.modeOff)}
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
          <Stepper skin={skin} field="percent" label={t('percent')} value={value?.percent} onValue={(n) => set('percent', n)} step={5} testId="input-percent" />
        ) : (
          <Stepper skin={skin} field="page" label={t('page')} value={value?.page} onValue={(n) => set('page', n)} step={10} hint={ofTotal} testId="input-page" width="w-24" />
        )}
      </>
    )
  } else if (mediaType === 'game') {
    body = (
      <Stepper
        skin={skin}
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
    <fieldset ref={boxRef} className="flex flex-col gap-2">
      <legend className={skin.legend}>{t('title')}</legend>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        {body}
        {hasProgress(value) && variant === 'sala' && (
          <SalaButton
            type="button"
            variant="quiet"
            onClick={clear}
            data-testid="clear-progress"
            className="mt-6"
          >
            {tl('clearProgress')}
          </SalaButton>
        )}
        {hasProgress(value) && variant !== 'sala' && (
          <CloseButton
            onClick={clear}
            label={tl('clearProgress')}
            data-testid="clear-progress"
            className="mt-5"
          />
        )}
      </div>
      {/* Barra con hueco fijo (CLS 0); el número va en texto para lectores. */}
      <div className="flex items-center gap-3" data-testid="progress-summary">
        <div aria-hidden="true" className={skin.track}>
          <div
            className={skin.bar}
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
        <span className={skin.percent}>
          {percent !== null ? t('percentDone', { percent }) : ''}
        </span>
      </div>
    </fieldset>
  )
}
